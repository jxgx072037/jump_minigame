# 腾讯混元生图服务

这是一个基于腾讯云混元API的图像生成服务，包含后端API和前端界面。

## 功能特点

- 提交生图任务
- 查询生图任务状态
- 展示生成的图片和扩写后的提示词
- 支持多种参数配置（风格、分辨率、数量等）

## 环境要求

- Node.js 18+
- 腾讯云账号及API密钥

## 环境变量设置

使用前需要设置以下环境变量：

```bash
export TENCENT_SECRET_ID="你的腾讯云SecretId"
export TENCENT_SECRET_KEY="你的腾讯云SecretKey"
```

## 安装依赖

```bash
npm install express cors tencentcloud-sdk-nodejs-hunyuan
```

## 启动服务

```bash
node demoFiles/imageGenerationServer.js
```

服务器将在 http://localhost:3000 上运行。

## 使用方法

1. 打开浏览器访问 http://localhost:3000
2. 填写图像生成表单
3. 点击"提交生图任务"按钮
4. 等待图像生成完成
5. 查看生成的图像和扩写后的提示词

## API接口

### 提交生图任务

- URL: `/api/submit-image-job`
- 方法: POST
- 参数:
  - prompt: 提示词（必填）
  - negativePrompt: 反向提示词
  - style: 绘画风格
  - resolution: 分辨率
  - num: 生成数量
  - seed: 随机种子
  - clarity: 超分选项
  - revise: Prompt扩写开关
  - logoAdd: 水印开关
  - logoParam: 自定义水印参数

### 查询生图任务

- URL: `/api/query-image-job/:jobId`
- 方法: GET
- 参数:
  - jobId: 任务ID（路径参数）

## 注意事项

- 图像生成可能需要一些时间，请耐心等待
- 生成的图像链接有效期有限，请及时保存
- 使用API时请遵守腾讯云的服务条款和使用限制 