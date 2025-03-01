document.addEventListener('DOMContentLoaded', () => {
  const imageForm = document.getElementById('imageForm');
  const submitBtn = document.getElementById('submitBtn');
  const resultCard = document.getElementById('resultCard');
  const loading = document.getElementById('loading');
  const resultContent = document.getElementById('resultContent');
  const jobIdElement = document.getElementById('jobId');
  const revisedPromptElement = document.getElementById('revisedPrompt');
  const imageGallery = document.getElementById('imageGallery');
  const statusMessage = document.getElementById('statusMessage');

  // API基础URL - 根据实际部署情况修改
  const API_BASE_URL = 'http://localhost:3000/api';
  
  // 轮询间隔（毫秒）
  const POLLING_INTERVAL = 3000;
  
  // 最大轮询次数
  const MAX_POLLING_COUNT = 60; // 最多轮询3分钟

  // 提交表单
  imageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 禁用提交按钮
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    
    // 显示结果卡片和加载状态
    resultCard.style.display = 'block';
    loading.style.display = 'block';
    resultContent.style.display = 'none';
    
    // 清空之前的结果
    imageGallery.innerHTML = '';
    statusMessage.textContent = '正在提交任务...';
    
    try {
      // 收集表单数据
      const formData = new FormData(imageForm);
      const formDataObj = {};
      
      for (const [key, value] of formData.entries()) {
        if (value) formDataObj[key] = value;
      }
      
      // 提交任务
      const submitResponse = await fetch(`${API_BASE_URL}/submit-image-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formDataObj)
      });
      
      if (!submitResponse.ok) {
        throw new Error(`提交失败: ${submitResponse.status} ${submitResponse.statusText}`);
      }
      
      const submitData = await submitResponse.json();
      const jobId = submitData.JobId;
      
      if (!jobId) {
        throw new Error('未获取到任务ID');
      }
      
      // 显示任务ID
      jobIdElement.textContent = jobId;
      statusMessage.textContent = '任务已提交，正在等待处理...';
      
      // 开始轮询任务状态
      await pollJobStatus(jobId);
      
    } catch (error) {
      console.error('错误:', error);
      statusMessage.textContent = `错误: ${error.message}`;
      loading.style.display = 'block';
      resultContent.style.display = 'none';
    } finally {
      // 恢复提交按钮
      submitBtn.disabled = false;
      submitBtn.textContent = '提交生图任务';
    }
  });
  
  // 轮询任务状态
  async function pollJobStatus(jobId) {
    let pollingCount = 0;
    
    const poll = async () => {
      if (pollingCount >= MAX_POLLING_COUNT) {
        statusMessage.textContent = '轮询超时，请手动查询任务状态';
        return;
      }
      
      pollingCount++;
      statusMessage.textContent = `正在查询任务状态... (${pollingCount}/${MAX_POLLING_COUNT})`;
      
      try {
        const response = await fetch(`${API_BASE_URL}/query-image-job/${jobId}`);
        
        if (!response.ok) {
          throw new Error(`查询失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 检查任务状态
        if (data.JobStatusCode === '5') { // 5表示处理完成
          // 显示结果
          displayResults(data);
          return;
        } else if (data.JobStatusCode === '6') { // 6表示处理失败
          statusMessage.textContent = `任务处理失败: ${data.JobErrorMsg || '未知错误'}`;
          return;
        } else {
          // 继续轮询
          statusMessage.textContent = `任务状态: ${data.JobStatusMsg || '处理中'} (${pollingCount}/${MAX_POLLING_COUNT})`;
          setTimeout(poll, POLLING_INTERVAL);
        }
      } catch (error) {
        console.error('轮询错误:', error);
        statusMessage.textContent = `轮询错误: ${error.message}`;
        setTimeout(poll, POLLING_INTERVAL);
      }
    };
    
    // 开始轮询
    await poll();
  }
  
  // 显示结果
  function displayResults(data) {
    // 隐藏加载状态，显示结果内容
    loading.style.display = 'none';
    resultContent.style.display = 'block';
    
    // 显示扩写后的提示词
    if (data.RevisedPrompt && data.RevisedPrompt.length > 0) {
      revisedPromptElement.textContent = data.RevisedPrompt[0];
    } else {
      revisedPromptElement.textContent = '未获取到扩写后的提示词';
    }
    
    // 显示生成的图片
    if (data.ResultImage && data.ResultImage.length > 0) {
      data.ResultImage.forEach((imageUrl, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = `生成图片 ${index + 1}`;
        img.loading = 'lazy';
        
        imageItem.appendChild(img);
        imageGallery.appendChild(imageItem);
      });
    } else {
      imageGallery.innerHTML = '<p>未获取到生成的图片</p>';
    }
  }
}); 