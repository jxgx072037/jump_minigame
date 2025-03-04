// Depends on tencentcloud-sdk-nodejs version 4.0.3 or higher

import { hunyuan } from "tencentcloud-sdk-nodejs-hunyuan";

const HunyuanClient = hunyuan.v20230901.Client;

// 实例化一个认证对象，入参需要传入腾讯云账户 SecretId 和 SecretKey，此处还需注意密钥对的保密
// 代码泄露可能会导致 SecretId 和 SecretKey 泄露，并威胁账号下所有资源的安全性。以下代码示例仅供参考，建议采用更安全的方式来使用密钥，请参见：https://cloud.tencent.com/document/product/1278/85305
// 密钥可前往官网控制台 https://console.cloud.tencent.com/cam/capi 进行获取
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

// 实例化要请求产品的client对象,clientProfile是可选的
const client = new HunyuanClient(clientConfig);
const params = {
  // 必选参数 - 业务参数
  Prompt: "一只可爱的卡通猫咪，在阳光明媚的草地上玩耍，四向无缝拼接", // 文本描述，最多1024个utf-8字符

  // 可选参数
  NegativePrompt: "模糊，扭曲，低质量", // 反向提示词，告诉AI不需要生成的内容
  Style: "dongman", // 绘画风格，参考混元生图风格列表
  Resolution: "1024:1024", // 生成图片分辨率，支持生成以下分辨率的图片：768:768（1:1）、768:1024（3:4）、1024:768（4:3）、1024:1024（1:1）、720:1280（9:16）、1280:720（16:9）、768:1280（3:5）、1280:768（5:3），不传默认使用1024:1024。 示例值：1024:1024
  Num: 1, // 生成图片数量，支持1-4张
  Seed: undefined, // 随机种子，不传则随机生成
  Clarity: undefined, // 超分选项，可选x2或x4
  Revise: 1, // prompt扩写开关，1开启(推荐)，0关闭
  LogoAdd: 0, // 水印开关，0不添加(默认)，1添加
  LogoParam: undefined // 自定义水印参数，默认添加"图片由AI生成"
};

client.SubmitHunyuanImageJob(params).then(
  (data) => {
    console.log(data);

    // 成功后，data.JobId 就是任务ID，可以用于查询任务状态，比如：
    // {
    //     JobId: '1253933009-1740671994-e2518a67-f523-11ef-a971-52540008fd15-0',
    //     RequestId: '6dbfba5a-d324-447a-846e-516b8cf59fcf'
    // }
  },
  (err) => {
    console.error("error", err);
  }
);