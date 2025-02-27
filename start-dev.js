// 开发环境启动脚本
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 服务器文件路径
const imageServicePath = path.join(__dirname, 'demoFiles', 'imageGenerationServer.js');

// 启动混元生图服务
const startImageService = () => {
  console.log('正在启动混元生图服务...');
  
  const serverProcess = spawn('node', [imageServicePath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      // 确保环境变量被传递
      TENCENT_SECRET_ID: process.env.TENCENT_SECRET_ID,
      TENCENT_SECRET_KEY: process.env.TENCENT_SECRET_KEY
    }
  });
  
  serverProcess.on('error', (error) => {
    console.error('启动混元生图服务失败:', error);
  });
  
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`混元生图服务异常退出，退出码: ${code}`);
    }
  });
  
  console.log('混元生图服务启动成功');
  
  return serverProcess;
};

// 启动游戏开发服务器
const startGameDevServer = () => {
  console.log('正在启动游戏开发服务器...');
  
  const devProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true
  });
  
  devProcess.on('error', (error) => {
    console.error('启动游戏开发服务器失败:', error);
  });
  
  return devProcess;
};

// 主函数
const main = () => {
  // 先启动混元生图服务
  const imageServiceProcess = startImageService();
  
  // 然后启动游戏开发服务器
  const gameDevProcess = startGameDevServer();
  
  // 处理进程退出
  process.on('SIGINT', () => {
    console.log('正在关闭所有服务...');
    imageServiceProcess.kill();
    gameDevProcess.kill();
    process.exit(0);
  });
};

// 执行主函数
main(); 