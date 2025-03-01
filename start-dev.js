import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 确保 models 目录存在
const modelsDir = path.join(__dirname, 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

// 清空 models 目录中的文件
console.log('正在清空 models 目录...');
try {
  const files = fs.readdirSync(modelsDir);
  for (const file of files) {
    const filePath = path.join(modelsDir, file);
    fs.unlinkSync(filePath);
    console.log(`已删除文件: ${filePath}`);
  }
  console.log('models 目录已清空');
} catch (error) {
  console.error('清空 models 目录时出错:', error);
}

// 启动 Vite 开发服务器
const viteProcess = spawn('npm', ['run', 'dev', '--', '--host'], {
  stdio: 'inherit',
  shell: true
});

// 启动 Express 服务器
const expressProcess = spawn('node', ['server.js'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3001' } // 使用不同的端口避免冲突
});

// 处理进程退出
process.on('SIGINT', () => {
  console.log('正在关闭所有服务器...');
  viteProcess.kill('SIGINT');
  expressProcess.kill('SIGINT');
  process.exit();
});

viteProcess.on('close', (code) => {
  console.log(`Vite 开发服务器已退出，退出码: ${code}`);
  expressProcess.kill('SIGINT');
  process.exit(code);
});

expressProcess.on('close', (code) => {
  console.log(`Express 服务器已退出，退出码: ${code}`);
  viteProcess.kill('SIGINT');
  process.exit(code);
});

console.log('所有服务器已启动:');
console.log('- Vite 开发服务器运行在默认端口 (通常是 5173)');
console.log('- Express API 服务器运行在端口 3001'); 