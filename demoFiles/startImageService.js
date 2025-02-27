// 启动混元生图服务的脚本
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 服务器文件路径
const serverPath = path.join(__dirname, 'imageGenerationServer.js');

// 启动服务器进程
const startServer = () => {
  console.log('正在启动混元生图服务...');
  
  const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    detached: true,
    env: {
      ...process.env,
      // 确保环境变量被传递
      TENCENT_SECRET_ID: process.env.TENCENT_SECRET_ID,
      TENCENT_SECRET_KEY: process.env.TENCENT_SECRET_KEY
    }
  });
  
  // 让进程在后台运行
  serverProcess.unref();
  
  console.log('启动成功');
};

// 执行启动
startServer(); 