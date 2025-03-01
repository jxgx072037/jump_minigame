import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import axios from 'axios';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 确保models目录存在
const modelsDir = path.join(__dirname, 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

// 清空models目录中的文件
console.log('正在清空models目录...');
try {
  const files = fs.readdirSync(modelsDir);
  for (const file of files) {
    const filePath = path.join(modelsDir, file);
    fs.unlinkSync(filePath);
    console.log(`已删除文件: ${filePath}`);
  }
  console.log('models目录已清空');
} catch (error) {
  console.error('清空models目录时出错:', error);
}

const app = express();
const PORT = process.env.PORT || 3001; // 确保端口是3001

// 将pipeline转换为Promise版本
const streamPipeline = promisify(pipeline);

// 存储任务ID映射关系
const taskIdMapping = new Map();

// 添加 CORS 中间件 - 应用于所有路由
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// 为静态文件服务添加自定义中间件，确保设置正确的 CORS 头
app.use('/models', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
}, express.static(path.join(__dirname, 'models')));

// 辅助函数：查找与前端任务ID关联的实际模型文件
function findModelFile(frontendTaskId) {
  // 首先检查是否有映射关系
  const mappedTaskId = taskIdMapping.get(frontendTaskId);
  
  if (mappedTaskId) {
    // 检查映射的ID对应的文件是否存在
    const mappedObjPath = path.join(modelsDir, `${mappedTaskId}.obj`);
    const mappedGlbPath = path.join(modelsDir, `${mappedTaskId}.glb`);
    const mappedGifPath = path.join(modelsDir, `${mappedTaskId}.gif`);
    
    // 优先检查GLB文件
    if (fs.existsSync(mappedGlbPath)) {
      return {
        found: true,
        objPath: fs.existsSync(mappedObjPath) ? mappedObjPath : null,
        glbPath: mappedGlbPath,
        gifPath: fs.existsSync(mappedGifPath) ? mappedGifPath : null,
        taskId: mappedTaskId
      };
    } else if (fs.existsSync(mappedObjPath)) {
      return {
        found: true,
        objPath: mappedObjPath,
        glbPath: null,
        gifPath: fs.existsSync(mappedGifPath) ? mappedGifPath : null,
        taskId: mappedTaskId
      };
    }
  }
  
  // 如果没有映射或映射的文件不存在，直接检查前端任务ID
  const directObjPath = path.join(modelsDir, `${frontendTaskId}.obj`);
  const directGlbPath = path.join(modelsDir, `${frontendTaskId}.glb`);
  const directGifPath = path.join(modelsDir, `${frontendTaskId}.gif`);
  
  // 优先检查GLB文件
  if (fs.existsSync(directGlbPath)) {
    return {
      found: true,
      objPath: fs.existsSync(directObjPath) ? directObjPath : null,
      glbPath: directGlbPath,
      gifPath: fs.existsSync(directGifPath) ? directGifPath : null,
      taskId: frontendTaskId
    };
  } else if (fs.existsSync(directObjPath)) {
    return {
      found: true,
      objPath: directObjPath,
      glbPath: null,
      gifPath: fs.existsSync(directGifPath) ? directGifPath : null,
      taskId: frontendTaskId
    };
  }
  
  // 如果都找不到，尝试扫描models目录中的所有文件
  // 这是一个兜底方案，查找最近创建的GLB或OBJ文件
  try {
    const files = fs.readdirSync(modelsDir);
    const modelFiles = files.filter(file => file.endsWith('.glb') || file.endsWith('.obj'));
    
    if (modelFiles.length > 0) {
      // 按文件创建时间排序，获取最新的文件
      const sortedFiles = modelFiles.map(file => {
        const filePath = path.join(modelsDir, file);
        return {
          name: file,
          time: fs.statSync(filePath).mtime.getTime(),
          isGlb: file.endsWith('.glb')
        };
      }).sort((a, b) => b.time - a.time);
      
      // 优先获取最新的GLB文件
      const glbFiles = sortedFiles.filter(file => file.isGlb);
      const latestFile = glbFiles.length > 0 ? glbFiles[0] : sortedFiles[0];
      
      const latestTaskId = latestFile.name.replace(/\.(glb|obj)$/, '');
      
      // 更新映射关系
      taskIdMapping.set(frontendTaskId, latestTaskId);
      
      const latestObjPath = path.join(modelsDir, `${latestTaskId}.obj`);
      const latestGlbPath = path.join(modelsDir, `${latestTaskId}.glb`);
      const latestGifPath = path.join(modelsDir, `${latestTaskId}.gif`);
      
      return {
        found: true,
        objPath: fs.existsSync(latestObjPath) ? latestObjPath : null,
        glbPath: fs.existsSync(latestGlbPath) ? latestGlbPath : null,
        gifPath: fs.existsSync(latestGifPath) ? latestGifPath : null,
        taskId: latestTaskId
      };
    }
  } catch (error) {
    console.error('扫描models目录失败:', error);
  }
  
  // 如果所有方法都找不到文件
  return { found: false };
}

// API路由 - 提交3D模型生成任务
app.post('/api/3d-model/submit', async (req, res) => {
  try {
    console.log('收到3D模型生成请求:', req.body);
    
    const { prompt } = req.body;
    
    if (!prompt) {
      console.log('错误: 缺少prompt参数');
      return res.status(400).json({ error: '缺少必要参数: prompt' });
    }
    
    // 在提交新任务前清空models目录
    console.log('提交新任务前清空models目录...');
    try {
      const files = fs.readdirSync(modelsDir);
      for (const file of files) {
        const filePath = path.join(modelsDir, file);
        fs.unlinkSync(filePath);
        console.log(`已删除文件: ${filePath}`);
      }
      console.log('models目录已清空');
    } catch (error) {
      console.error('清空models目录时出错:', error);
      // 继续执行，不中断任务提交
    }
    
    // 直接设置API密钥（从环境变量获取或使用硬编码值）
    // 注意：在生产环境中应该使用环境变量而不是硬编码
    const API_KEY = process.env.Hunyuan_api_key;
    
    console.log('使用API密钥:', API_KEY ? '已设置' : '未设置');
    
    if (!API_KEY) {
      console.log('错误: API密钥未设置');
      return res.status(500).json({ error: '服务器未配置API密钥' });
    }
    
    // 生成唯一的任务ID
    const frontendTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    console.log(`生成前端任务ID: ${frontendTaskId}`);
    
    // 使用子进程执行3D模型生成脚本
    const scriptPath = path.join(__dirname, '3DplayerGenerate', 'run3d.mjs');
    console.log(`脚本路径: ${scriptPath}`);
    
    if (!fs.existsSync(scriptPath)) {
      console.log(`错误: 脚本不存在: ${scriptPath}`);
      return res.status(500).json({ error: '服务器配置错误: 脚本不存在' });
    }
    
    // 创建子进程
    const command = `node ${scriptPath} --prompt="${prompt}" --task-id=${frontendTaskId}`;
    console.log(`执行命令: ${command}`);
    
    // 记录任务开始时间
    const taskStartTime = Date.now();
    
    exec(command, 
      { 
        env: { 
          ...process.env, 
          Hunyuan_api_key: API_KEY 
        } 
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`执行脚本出错: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`脚本错误输出: ${stderr}`);
          return;
        }
        
        console.log(`脚本输出: ${stdout}`);
        
        // 尝试从输出中提取实际的任务ID
        try {
          const taskIdMatch = stdout.match(/任务ID: "([^"]+)"/);
          const successMatch = stdout.match(/提交成功:[\s\S]*?task_id: '([^']+)'/);
          
          if (successMatch && successMatch[1]) {
            const actualTaskId = successMatch[1];
            console.log(`从输出中提取到实际任务ID: ${actualTaskId}`);
            
            // 保存映射关系
            taskIdMapping.set(frontendTaskId, actualTaskId);
            console.log(`已建立映射关系: ${frontendTaskId} -> ${actualTaskId}`);
          } else if (taskIdMatch && taskIdMatch[1]) {
            const actualTaskId = taskIdMatch[1];
            console.log(`从输出中提取到实际任务ID: ${actualTaskId}`);
            
            // 保存映射关系
            taskIdMapping.set(frontendTaskId, actualTaskId);
            console.log(`已建立映射关系: ${frontendTaskId} -> ${actualTaskId}`);
          }
        } catch (error) {
          console.error('解析脚本输出失败:', error);
        }
      }
    );
    
    // 返回任务ID和开始时间
    console.log(`返回任务ID: ${frontendTaskId}`);
    res.json({ 
      task_id: frontendTaskId,
      start_time: taskStartTime 
    });
  } catch (error) {
    console.error('提交3D生成任务失败:', error);
    res.status(500).json({ error: '提交任务失败', details: error.message });
  }
});

// API路由 - 查询3D模型生成任务状态
app.post('/api/3d-model/status', async (req, res) => {
  try {
    console.log('收到任务状态查询请求:', req.body);
    
    const { task_id } = req.body;
    
    if (!task_id) {
      console.log('错误: 缺少task_id参数');
      return res.status(400).json({ error: '缺少必要参数: task_id' });
    }
    
    // 使用辅助函数查找模型文件
    const modelInfo = findModelFile(task_id);
    console.log('模型文件查找结果:', modelInfo);
    
    if (modelInfo.found) {
      // 模型已生成
      console.log(`模型已生成: ${modelInfo.taskId}`);
      
      // 计算等待时间（如果请求中包含开始时间）
      let waitTime = null;
      if (req.body.start_time) {
        waitTime = Math.floor((Date.now() - req.body.start_time) / 1000); // 转换为秒
      }
      
      res.json({
        status: 'succeeded',
        wait_time: waitTime,
        data: [{
          obj_url: modelInfo.objPath ? `/models/${modelInfo.taskId}.obj` : null,
          glb_url: modelInfo.glbPath ? `/models/${modelInfo.taskId}.glb` : null,
          gif_url: modelInfo.gifPath ? `/models/${modelInfo.taskId}.gif` : null
        }]
      });
    } else {
      // 模型生成中
      console.log(`模型生成中: ${task_id}`);
      
      // 计算等待时间（如果请求中包含开始时间）
      let waitTime = null;
      if (req.body.start_time) {
        waitTime = Math.floor((Date.now() - req.body.start_time) / 1000); // 转换为秒
      }
      
      res.json({
        status: 'running',
        wait_time: waitTime,
        message: '模型生成中，请稍后再查询'
      });
    }
  } catch (error) {
    console.error('查询任务状态失败:', error);
    res.status(500).json({ error: '查询任务状态失败', details: error.message });
  }
});

// 所有其他请求返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API端点: http://localhost:${PORT}/api/3d-model/submit`);
  console.log(`静态文件目录: ${path.join(__dirname, 'dist')}`);
  console.log(`模型目录: ${modelsDir}`);
  console.log(`环境变量 Hunyuan_api_key: ${process.env.Hunyuan_api_key ? '已设置' : '未设置'}`);
}); 