import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 将pipeline转换为Promise版本
const streamPipeline = promisify(pipeline);

// 解析命令行参数
const args = process.argv.slice(2);
let prompt = '';
let taskId = '';

for (const arg of args) {
  if (arg.startsWith('--prompt=')) {
    prompt = arg.substring('--prompt='.length);
  } else if (arg.startsWith('--task-id=')) {
    taskId = arg.substring('--task-id='.length);
  }
}

// 如果没有提供任务ID，生成一个
if (!taskId) {
  taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

// 如果没有提供提示词，使用默认值
if (!prompt) {
  prompt = '一个中国象棋的兵棋子';
}

// 直接从系统环境变量获取API密钥
let API_KEY = process.env.Hunyuan_api_key;

// 确保API_KEY不包含"Bearer"前缀，如果包含则移除
if (API_KEY && API_KEY.includes('Bearer')) {
  // 移除可能的"Bearer "前缀，避免重复
  API_KEY = API_KEY.replace(/^Bearer\s+/i, '');
  console.log('已从API密钥中移除Bearer前缀');
}

if (!API_KEY) {
  console.error('错误: 未找到Hunyuan_api_key环境变量。请确保已设置此环境变量。');
  process.exit(1);
}

// 创建保存3D模型的目录
const modelsDir = path.join(process.cwd(), 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

async function submit3DGeneration(prompt) {
  try {
    const response = await axios({
      method: 'post',
      url: 'http://hunyuanapi.woa.com/openapi/v1/3d/generations/submission',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': API_KEY.startsWith('Bearer') ? API_KEY : `Bearer ${API_KEY}`
      },
      data: {
        model: 'hunyuan-3d-dit',
        prompt: prompt,
        n: 1
      },
      timeout: 60000 // 1分钟超时
    });

    return response.data;
  } catch (error) {
    console.error('提交3D生成任务失败:', error);
    throw error;
  }
}

// 新增：查询任务状态
async function queryTaskStatus(taskId) {
  try {
    const response = await axios({
      method: 'post',
      url: 'http://hunyuanapi.woa.com/openapi/v1/3d/generations/task',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': API_KEY.startsWith('Bearer') ? API_KEY : `Bearer ${API_KEY}`
      },
      data: {
        task_id: taskId
      },
      timeout: 30000
    });

    return response.data;
  } catch (error) {
    console.error('查询任务状态失败:', error);
    throw error;
  }
}

// 新增：下载3D模型文件
async function downloadModel(url, fileName) {
  try {
    console.log(`开始下载模型: ${fileName}`);
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream'
    });

    const filePath = path.join(modelsDir, fileName);
    await streamPipeline(response.data, fs.createWriteStream(filePath));
    console.log(`模型已保存至: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`下载模型失败: ${error.message}`);
    throw error;
  }
}

// 新增：轮询任务状态直到完成
async function pollTaskUntilComplete(taskId, prompt, maxAttempts = 30, interval = 10000) {
  console.log(`开始轮询任务状态，任务ID: ${taskId}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const taskResult = await queryTaskStatus(taskId);
      console.log(`任务状态: ${taskResult.status} (尝试 ${attempt + 1}/${maxAttempts})`);
      
      if (taskResult.status === 'succeeded') {
        console.log('任务成功完成!');
        
        // 下载所有生成的模型
        if (taskResult.data && taskResult.data.length > 0) {
          for (let i = 0; i < taskResult.data.length; i++) {
            const item = taskResult.data[i];
            
            // 下载GLB文件（优先）
            if (item.glb_url) {
              // 使用传入的任务ID作为文件名
              const glbFileName = `${taskId}.glb`;
              await downloadModel(item.glb_url, glbFileName);
            }
            
            // 下载OBJ文件（作为备用）
            if (item.obj_url) {
              // 使用传入的任务ID作为文件名
              const objFileName = `${taskId}.obj`;
              await downloadModel(item.obj_url, objFileName);
            }
            
            // 下载GIF预览
            if (item.gif_url) {
              // 使用传入的任务ID作为文件名
              const gifFileName = `${taskId}.gif`;
              await downloadModel(item.gif_url, gifFileName);
            }
          }
        } else {
          console.log('任务成功但没有返回数据');
        }
        
        return taskResult;
      } else if (taskResult.status === 'failed' || taskResult.status === 'cancelled') {
        console.error(`任务${taskResult.status === 'failed' ? '失败' : '被取消'}`);
        return taskResult;
      }
      
      // 等待一段时间后再次查询
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error) {
      console.error(`轮询过程中出错: ${error.message}`);
      // 继续尝试，不中断轮询
    }
  }
  
  console.error(`达到最大尝试次数 (${maxAttempts})，停止轮询`);
  throw new Error('任务轮询超时');
}

// 主函数
async function main() {
  try {
    console.log(`提交3D生成任务，提示词: "${prompt}", 任务ID: "${taskId}"`);
    
    // 清空models目录中的文件，但保留demo文件夹
    console.log('清空models目录中的文件（保留demo文件夹）...');
    try {
      const files = fs.readdirSync(modelsDir);
      for (const file of files) {
        // 跳过demo文件夹
        if (file === 'demo') {
          console.log(`保留文件夹: ${file}`);
          continue;
        }
        
        const filePath = path.join(modelsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          fs.unlinkSync(filePath);
          console.log(`已删除文件: ${filePath}`);
        } else {
          console.log(`跳过文件夹: ${filePath}`);
        }
      }
      console.log('models目录已清空（保留demo文件夹）');
    } catch (error) {
      console.error('清空models目录时出错:', error);
      // 继续执行，不中断任务提交
    }
    
    // 提交任务
    const submissionResult = await submit3DGeneration(prompt);
    console.log('提交成功:', submissionResult);
    
    if (submissionResult && submissionResult.task_id) {
      // 轮询任务状态并下载结果
      const taskResult = await pollTaskUntilComplete(submissionResult.task_id, prompt);
      console.log('最终任务结果:', taskResult);
    } else {
      console.error('提交成功但未返回task_id');
    }
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

// 执行主函数
main();