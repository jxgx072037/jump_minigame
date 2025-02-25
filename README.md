# 跳一跳游戏 (Jump Game)

一个基于Three.js开发的3D跳一跳游戏，类似于经典的微信小游戏。通过控制按压时间来决定跳跃力度，目标是让角色跳到下一个平台上，获取尽可能高的分数。

![游戏截图](./screenshots/game.png)

## 功能特点

- 3D图形渲染与物理模拟
- 基于按压时间的跳跃力度控制
- 平台随机生成系统
- 完整的游戏循环（开始、游戏中、结束状态）
- 实时分数计算与显示
- 粒子特效系统
- 像素风格UI界面
- 8-bit风格音效
- 跨平台支持（PC与移动设备）

## 技术栈

- **前端框架**：React + TypeScript
- **3D引擎**：Three.js
- **构建工具**：Vite
- **物理引擎**：Cannon.js
- **状态管理**：Zustand
- **音效处理**：Web Audio API
- **网络通信**：Socket.IO（多人模式准备中）

## 安装与运行

### 环境要求

- Node.js 18.0+
- npm 8.0+

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/你的用户名/jump-game.git

# 进入项目目录
cd jump-game

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建生产版本

```bash
# 构建优化后的生产版本
npm run build

# 预览生产版本
npm run preview
```

## 游戏操作

- **PC设备**：鼠标按下开始蓄力，释放跳跃
- **移动设备**：触摸屏幕开始蓄力，抬起手指跳跃
- 按压时间越长，跳跃距离越远
- 成功落在平台上得分，掉落则游戏结束
- 游戏结束后点击"RESTART"按钮重新开始

## 项目结构

```
jump-game/
├── public/            # 静态资源
├── src/
│   ├── components/    # React组件
│   ├── game/          # 游戏核心逻辑
│   │   ├── audio.ts   # 音效系统
│   │   ├── engine.ts  # 游戏引擎
│   │   ├── particles.ts # 粒子系统
│   │   ├── platform.ts # 平台系统
│   │   └── player.ts  # 玩家控制
│   ├── App.tsx        # 应用主组件
│   └── main.tsx       # 入口文件
├── index.html         # HTML模板
├── package.json       # 项目配置
├── tsconfig.json      # TypeScript配置
└── vite.config.ts     # Vite配置
```

## 开发计划

- [x] 基础3D场景
- [x] 角色系统
- [x] 基础平台
- [x] 跳跃机制
- [x] 得分系统
- [x] 音效系统
- [x] 粒子特效
- [x] 游戏UI
- [ ] 支持高阶玩家，基于AI能力对游戏素材和玩法进行创意改编。

## 跨平台开发注意事项

本项目支持在Windows、Mac和Linux环境下开发：

- 代码使用跨平台兼容的路径处理
- 配置文件采用LF行尾
- 使用.gitignore排除环境相关文件
- 提供Docker配置用于一致的开发环境（计划中）

## 贡献指南

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可

本项目采用MIT许可证 - 详见 [LICENSE](LICENSE) 文件
