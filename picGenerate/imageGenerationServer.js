import express from 'express';
import cors from 'cors';
import { hunyuan } from 'tencentcloud-sdk-nodejs-hunyuan';

const app = express();
const port = process.env.PORT || 3002;

// 启用CORS和JSON解析
app.use(cors());
app.use(express.json());
app.use(express.static('demoFiles/public'));

// 添加图片代理API，解决CORS问题
app.get('/api/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: '缺少URL参数' });
    }
    
    console.log('代理图片请求:', url);
    
    // 使用fetch获取图片
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `获取图片失败: ${response.statusText}` 
      });
    }
    
    // 获取图片类型
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // 设置响应头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 将图片数据流转发到客户端
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('代理图片失败:', error);
    res.status(500).json({ error: '代理图片失败', details: error.toString() });
  }
});

// 添加健康检查端点
app.get('/api/health-check', (req, res) => {
  res.status(200).json({ status: 'ok', message: '混元生图服务运行正常' });
});

// 实例化混元客户端
const HunyuanClient = hunyuan.v20230901.Client;
const clientConfig = {
  credential: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  },
  region: "ap-guangzhou",
  profile: {
    httpProfile: {
      endpoint: "hunyuan.tencentcloudapi.com",
    },
  },
};

const client = new HunyuanClient(clientConfig);

// 提交生图任务API
app.post('/api/submit-image-job', async (req, res) => {
  try {
    const {
      prompt,
      negativePrompt,
      style,
      resolution,
      num,
      seed,
      clarity,
      revise,
      logoAdd,
      logoParam
    } = req.body;

    // 构建API参数
    const params = {
      Prompt: prompt,
      LogoAdd: logoAdd === 'true' ? 1 : 0, // 确保LogoAdd始终有值，并转换为数字
    };

    // 添加可选参数（如果提供了的话）
    if (negativePrompt) params.NegativePrompt = negativePrompt;
    if (style) params.Style = style;
    if (resolution) params.Resolution = resolution;
    if (num) params.Num = parseInt(num);
    if (seed) params.Seed = parseInt(seed);
    if (clarity) params.Clarity = clarity;
    if (revise !== undefined) params.Revise = revise === 'true' ? 1 : 0;
    if (logoParam) params.LogoParam = logoParam;

    console.log('提交的参数:', params);

    // 调用API提交任务
    const data = await client.SubmitHunyuanImageJob(params);
    res.json(data);
  } catch (error) {
    console.error('提交任务失败:', error);
    res.status(500).json({
      error: error.message || '提交任务失败',
      details: error.toString()
    });
  }
});

// 查询生图任务API
app.get('/api/query-image-job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // 调用API查询任务
    const data = await client.QueryHunyuanImageJob({ JobId: jobId });
    res.json(data);
  } catch (error) {
    console.error('查询任务失败:', error);
    res.status(500).json({
      error: error.message || '查询任务失败',
      details: error.toString()
    });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`图片生成服务运行在 http://localhost:${port}`);
}); 