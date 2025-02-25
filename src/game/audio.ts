export class AudioManager {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private audioEnabled: boolean = false
  private isWechat: boolean = false

  constructor() {
    // 检测是否为微信浏览器
    this.isWechat = /MicroMessenger/i.test(navigator.userAgent)
    
    // 尝试初始化音频上下文
    try {
      // 使用标准或WebKit前缀的AudioContext
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass()
        
        // 在某些浏览器（尤其是移动浏览器）中，AudioContext可能处于suspended状态
        if (this.audioContext.state === 'suspended') {
          this.setupAutoResume()
        } else {
          this.audioEnabled = true
        }
        
        this.masterGain = this.audioContext.createGain()
        this.masterGain.connect(this.audioContext.destination)
        this.masterGain.gain.value = 0.3 // 控制整体音量
      }
    } catch (error) {
      console.warn('无法初始化Web Audio API:', error)
      this.audioEnabled = false
    }
    
    // 添加用户交互事件监听器，确保音频在第一次交互时激活
    this.setupUserInteractionListeners()
  }
  
  // 设置用户交互时自动激活音频上下文
  private setupUserInteractionListeners(): void {
    const activateAudio = () => {
      if (this.audioContext && this.audioContext.state !== 'running') {
        this.audioContext.resume().then(() => {
          this.audioEnabled = true
          console.log('音频上下文已激活')
          
          // 在微信中，播放一个静音音频以确保后续的音频可以播放
          if (this.isWechat) {
            this.playTestSound()
          }
        })
      }
      
      // 激活后移除事件监听器
      document.removeEventListener('click', activateAudio)
      document.removeEventListener('touchstart', activateAudio)
    }
    
    document.addEventListener('click', activateAudio)
    document.addEventListener('touchstart', activateAudio)
  }
  
  // 设置自动恢复音频上下文
  private setupAutoResume(): void {
    // 为可能暂停音频上下文的事件添加监听器
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.audioContext) {
        this.audioContext.resume().then(() => {
          this.audioEnabled = true
        })
      }
    })
  }
  
  // 播放测试声音（用于微信浏览器激活音频）
  private playTestSound(): void {
    if (!this.audioContext || !this.audioEnabled) return
    
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    
    // 设置为无声音
    gain.gain.value = 0.001
    
    osc.connect(gain)
    gain.connect(this.audioContext.destination)
    
    osc.start(0)
    osc.stop(0.1)
  }

  // 生成一个简单的8-bit着陆音效
  public playLandingSound(): void {
    if (!this.audioContext || !this.masterGain || !this.audioEnabled) return
    
    const duration = 0.1 // 音效持续时间（秒）
    const startTime = this.audioContext.currentTime

    // 创建振荡器（方波）
    const squareOsc = this.audioContext.createOscillator()
    squareOsc.type = 'square'
    squareOsc.frequency.setValueAtTime(880, startTime) // A5
    squareOsc.frequency.setValueAtTime(1760, startTime + 0.05) // A6

    // 创建振荡器（正弦波）
    const sineOsc = this.audioContext.createOscillator()
    sineOsc.type = 'sine'
    sineOsc.frequency.setValueAtTime(440, startTime) // A4
    sineOsc.frequency.setValueAtTime(880, startTime + 0.05) // A5

    // 创建增益节点（用于控制音量包络）
    const squareGain = this.audioContext.createGain()
    const sineGain = this.audioContext.createGain()

    // 设置音量包络
    squareGain.gain.setValueAtTime(0.3, startTime)
    squareGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
    
    sineGain.gain.setValueAtTime(0.2, startTime)
    sineGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

    // 连接节点
    squareOsc.connect(squareGain)
    sineOsc.connect(sineGain)
    squareGain.connect(this.masterGain)
    sineGain.connect(this.masterGain)

    // 开始播放并在指定时间停止
    squareOsc.start(startTime)
    sineOsc.start(startTime)
    squareOsc.stop(startTime + duration)
    sineOsc.stop(startTime + duration)
  }

  // 生成游戏结束的失败音效
  public playGameOverSound(): void {
    if (!this.audioContext || !this.masterGain || !this.audioEnabled) return
    
    const duration = 0.5 // 音效持续时间（秒）
    const startTime = this.audioContext.currentTime

    // 创建主要下降音调（三角波）
    const triangleOsc = this.audioContext.createOscillator()
    triangleOsc.type = 'triangle'
    triangleOsc.frequency.setValueAtTime(440, startTime) // A4
    triangleOsc.frequency.linearRampToValueAtTime(220, startTime + duration) // A3

    // 创建不和谐音程（方波）
    const squareOsc = this.audioContext.createOscillator()
    squareOsc.type = 'square'
    squareOsc.frequency.setValueAtTime(466.16, startTime) // Bb4 (不和谐音程)
    squareOsc.frequency.linearRampToValueAtTime(233.08, startTime + duration) // Bb3

    // 创建噪声效果
    const noiseLength = duration * this.audioContext.sampleRate
    const noiseBuffer = this.audioContext.createBuffer(1, noiseLength, this.audioContext.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseLength; i++) {
      noiseData[i] = Math.random() * 2 - 1
    }
    const noiseSource = this.audioContext.createBufferSource()
    noiseSource.buffer = noiseBuffer

    // 创建增益节点
    const triangleGain = this.audioContext.createGain()
    const squareGain = this.audioContext.createGain()
    const noiseGain = this.audioContext.createGain()

    // 设置音量包络
    triangleGain.gain.setValueAtTime(0.3, startTime)
    triangleGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

    squareGain.gain.setValueAtTime(0.2, startTime)
    squareGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

    noiseGain.gain.setValueAtTime(0.1, startTime)
    noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

    // 连接节点
    triangleOsc.connect(triangleGain)
    squareOsc.connect(squareGain)
    noiseSource.connect(noiseGain)
    triangleGain.connect(this.masterGain)
    squareGain.connect(this.masterGain)
    noiseGain.connect(this.masterGain)

    // 开始播放并在指定时间停止
    triangleOsc.start(startTime)
    squareOsc.start(startTime)
    noiseSource.start(startTime)
    triangleOsc.stop(startTime + duration)
    squareOsc.stop(startTime + duration)
    noiseSource.stop(startTime + duration)
  }
} 