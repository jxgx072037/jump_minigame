export class AudioManager {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private audioEnabled: boolean = false
  private isWechat: boolean = false
  // 添加蓄力音效相关属性
  private chargingOscillator: OscillatorNode | null = null
  private chargingGain: GainNode | null = null
  private isChargingSoundPlaying: boolean = false
  private maxChargePlayed: boolean = false // 添加标志，避免重复播放最大蓄力音效

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
  public playTestSound(): void {
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

  // 播放开始游戏的欢快8bit音效
  public playGameStartSound(): void {
    if (!this.audioContext || !this.masterGain || !this.audioEnabled) return
    
    const duration = 0.6 // 音效持续时间（秒）
    const startTime = this.audioContext.currentTime
    
    // 创建主旋律（方波 - 典型的8bit音效）
    const mainOsc = this.audioContext.createOscillator()
    mainOsc.type = 'square'
    
    // 创建和声（方波 - 高八度）
    const harmonyOsc = this.audioContext.createOscillator()
    harmonyOsc.type = 'square'
    
    // 创建低音（三角波 - 低八度）
    const bassOsc = this.audioContext.createOscillator()
    bassOsc.type = 'triangle'
    
    // 设置欢快的上升音阶（C大调）
    // 主旋律音符序列
    const mainNotes = [
      { note: 523.25, time: 0 },     // C5
      { note: 587.33, time: 0.1 },   // D5
      { note: 659.25, time: 0.2 },   // E5
      { note: 698.46, time: 0.3 },   // F5
      { note: 783.99, time: 0.4 },   // G5
      { note: 880, time: 0.5 }       // A5
    ]
    
    // 和声音符序列（高八度）
    const harmonyNotes = [
      { note: 1046.50, time: 0 },    // C6
      { note: 1174.66, time: 0.1 },  // D6
      { note: 1318.51, time: 0.2 },  // E6
      { note: 1396.91, time: 0.3 },  // F6
      { note: 1567.98, time: 0.4 },  // G6
      { note: 1760, time: 0.5 }      // A6
    ]
    
    // 低音音符序列（低八度）
    const bassNotes = [
      { note: 261.63, time: 0 },     // C4
      { note: 293.66, time: 0.1 },   // D4
      { note: 329.63, time: 0.2 },   // E4
      { note: 349.23, time: 0.3 },   // F4
      { note: 392.00, time: 0.4 },   // G4
      { note: 440, time: 0.5 }       // A4
    ]
    
    // 设置音符序列
    mainNotes.forEach(note => {
      mainOsc.frequency.setValueAtTime(note.note, startTime + note.time)
    })
    
    harmonyNotes.forEach(note => {
      harmonyOsc.frequency.setValueAtTime(note.note, startTime + note.time)
    })
    
    bassNotes.forEach(note => {
      bassOsc.frequency.setValueAtTime(note.note, startTime + note.time)
    })
    
    // 创建增益节点
    const mainGain = this.audioContext.createGain()
    const harmonyGain = this.audioContext.createGain()
    const bassGain = this.audioContext.createGain()
    
    // 设置音量包络
    mainGain.gain.setValueAtTime(0.3, startTime)
    mainGain.gain.setValueAtTime(0.3, startTime + duration - 0.1)
    mainGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
    
    harmonyGain.gain.setValueAtTime(0.15, startTime)
    harmonyGain.gain.setValueAtTime(0.15, startTime + duration - 0.1)
    harmonyGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
    
    bassGain.gain.setValueAtTime(0.2, startTime)
    bassGain.gain.setValueAtTime(0.2, startTime + duration - 0.1)
    bassGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
    
    // 连接节点
    mainOsc.connect(mainGain)
    harmonyOsc.connect(harmonyGain)
    bassOsc.connect(bassGain)
    mainGain.connect(this.masterGain)
    harmonyGain.connect(this.masterGain)
    bassGain.connect(this.masterGain)
    
    // 开始播放并在指定时间停止
    mainOsc.start(startTime)
    harmonyOsc.start(startTime)
    bassOsc.start(startTime)
    mainOsc.stop(startTime + duration)
    harmonyOsc.stop(startTime + duration)
    bassOsc.stop(startTime + duration)
  }

  // 播放8bit风格的蓄力音效
  public playChargingSound(power: number = 0): void {
    if (!this.audioContext || !this.masterGain || !this.audioEnabled) return
    
    // 当蓄力达到最大值(0.95以上)且尚未播放最大蓄力音效时，播放提示音
    if (power >= 0.95 && !this.maxChargePlayed) {
      this.playMaxChargeSound()
      this.maxChargePlayed = true
    } else if (power < 0.95) {
      // 重置标志，允许再次播放最大蓄力音效
      this.maxChargePlayed = false
    }
    
    // 如果已经在播放，则只更新频率
    if (this.isChargingSoundPlaying && this.chargingOscillator) {
      // 根据力度调整频率，从低音C4 (262Hz)到高音C6 (1047Hz)
      const baseFreq = 262
      const maxFreq = 1047
      const frequency = baseFreq + (maxFreq - baseFreq) * power
      
      // 设置新频率
      this.chargingOscillator.frequency.setValueAtTime(
        frequency, 
        this.audioContext.currentTime
      )
      return
    }
    
    // 创建振荡器（方波 - 8bit风格）
    this.chargingOscillator = this.audioContext.createOscillator()
    this.chargingOscillator.type = 'square'
    
    // 初始频率（低音C4）
    this.chargingOscillator.frequency.setValueAtTime(262, this.audioContext.currentTime)
    
    // 创建增益节点
    this.chargingGain = this.audioContext.createGain()
    this.chargingGain.gain.setValueAtTime(0.15, this.audioContext.currentTime) // 较低的音量
    
    // 连接节点
    this.chargingOscillator.connect(this.chargingGain)
    this.chargingGain.connect(this.masterGain)
    
    // 开始播放
    this.chargingOscillator.start()
    this.isChargingSoundPlaying = true
  }
  
  // 停止蓄力音效
  public stopChargingSound(): void {
    if (!this.audioContext || !this.chargingOscillator || !this.chargingGain) return
    
    // 创建一个短暂的淡出效果
    const stopTime = this.audioContext.currentTime + 0.05
    this.chargingGain.gain.linearRampToValueAtTime(0, stopTime)
    
    // 停止振荡器
    this.chargingOscillator.stop(stopTime)
    
    // 重置状态
    this.isChargingSoundPlaying = false
    this.chargingOscillator = null
    this.chargingGain = null
    this.maxChargePlayed = false // 重置最大蓄力音效标志
  }
  
  // 播放蓄力达到最大时的提示音
  public playMaxChargeSound(): void {
    if (!this.audioContext || !this.masterGain || !this.audioEnabled) return
    
    const startTime = this.audioContext.currentTime
    const duration = 0.1 // 短促的提示音
    
    // 创建高音提示音（三角波）
    const triangleOsc = this.audioContext.createOscillator()
    triangleOsc.type = 'triangle'
    triangleOsc.frequency.setValueAtTime(1200, startTime) // 高音
    triangleOsc.frequency.setValueAtTime(1400, startTime + 0.05) // 更高音
    
    // 创建增益节点
    const triangleGain = this.audioContext.createGain()
    triangleGain.gain.setValueAtTime(0.2, startTime)
    triangleGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
    
    // 连接节点
    triangleOsc.connect(triangleGain)
    triangleGain.connect(this.masterGain)
    
    // 开始播放并在指定时间停止
    triangleOsc.start(startTime)
    triangleOsc.stop(startTime + duration)
  }
} 