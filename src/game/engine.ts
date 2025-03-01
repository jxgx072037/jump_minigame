import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Platform } from './platform'
import { Player } from './player'
import { ParticleSystem } from './particles'
import { AudioManager } from './audio'

// 静态属性声明
export class GameEngine {
  // 使用全局变量保存实例，确保在严格模式下也能保持单例状态
  private static instance: GameEngine | null = null;
  private static currentContainer: HTMLElement | null = null;
  private static GLOBAL_GAME_STARTED: boolean = false;
  // 添加一个标志，表示实例是否已被销毁
  private static instanceDestroyed: boolean = false;

  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  private controls!: OrbitControls
  private platforms: Platform[] = []
  private player!: Player // 使用!操作符表明该属性会在构造函数中被初始化
  private score: number = 0
  private scoreElement!: HTMLDivElement
  private clock!: THREE.Clock
  private isPressing: boolean = false
  private pressStartTime: number = 0
  private readonly MAX_PRESS_TIME: number = 2000 // 最大按压时间（毫秒）
  private readonly BASE_JUMP_POWER: number = 0.004 // 基础跳跃力度系数

  // 相机相关属性
  private readonly CAMERA_SPEED: number = 15 // 与棋子跳跃速度相同
  private cameraTargetPosition!: THREE.Vector3
  private cameraTargetLookAt!: THREE.Vector3
  private cameraMoving: boolean = false
  private cameraStartPosition!: THREE.Vector3
  private cameraStartLookAt!: THREE.Vector3
  private cameraMoveProgress: number = 0
  private cameraMoveDistance: number = 0

  // 添加游戏结束相关属性
  private gameOverElement!: HTMLDivElement
  private isGameOver: boolean = false
  private startMessageElement!: HTMLDivElement // 添加开始提示元素

  // 添加游戏模式选择相关属性
  private gameModeSelectElement!: HTMLDivElement
  private basicModeButton!: HTMLButtonElement
  private evolveModeButton!: HTMLDivElement
  private isGameStarted: boolean = false
  
  // 添加进化模式相关属性
  private evolveModeElement!: HTMLDivElement
  private evolveInputElement!: HTMLInputElement
  private evolveSubmitButton!: HTMLButtonElement

  // 添加侧边栏相关属性
  private sidebarElement!: HTMLDivElement
  private imageResultContainer!: HTMLDivElement
  private isGeneratingImage: boolean = false
  private currentJobId: string = ''
  private checkStatusInterval: number = 0

  private currentPlatformIndex: number = 0
  private targetPlatformIndex: number = 1

  // 添加地面相关属性
  private ground!: THREE.Mesh
  private isGroundMoving: boolean = false
  private groundStartPosition: THREE.Vector3 = new THREE.Vector3()
  private groundTargetPosition: THREE.Vector3 = new THREE.Vector3()
  private groundMoveProgress: number = 0
  private groundMoveDuration: number = 0

  // 添加主光源属性
  private mainLight!: THREE.DirectionalLight

  // 添加粒子系统和音效
  private particleSystem!: ParticleSystem
  private audioManager!: AudioManager

  private renderAxes: () => void = () => {}
  
  // 添加唯一ID用于调试
  private instanceId!: string

  // 修改构造函数为私有
  private constructor(container: HTMLElement) {
    // 如果已经存在实例且未被销毁，直接返回该实例
    if (GameEngine.instance && !GameEngine.instanceDestroyed) {
      console.log(`[DEBUG] 返回已存在的GameEngine实例 ID: ${GameEngine.instance.instanceId}`);
      return GameEngine.instance;
    }

    // 生成实例ID用于调试
    this.instanceId = Math.random().toString(36).substring(2, 8);
    console.log(`[DEBUG] 创建新的GameEngine实例 ID: ${this.instanceId}`);
    
    // 从全局变量获取游戏状态
    this.isGameStarted = GameEngine.GLOBAL_GAME_STARTED;
    console.log(`[DEBUG] 初始化时从全局变量获取游戏状态: ${this.isGameStarted}`);
    
    // 如果是重用被销毁的实例，需要重新初始化所有属性
    if (GameEngine.instanceDestroyed) {
      console.log(`[DEBUG] 重新初始化被销毁的实例 ID: ${this.instanceId}`);
      GameEngine.instanceDestroyed = false;
    }
    
    // 确保跳跃相关属性被正确初始化
    this.isPressing = false;
    this.pressStartTime = 0;
    // MAX_PRESS_TIME和BASE_JUMP_POWER已经在类属性中定义，不需要在这里重新赋值
    console.log(`[DEBUG] 跳跃相关属性初始化: MAX_PRESS_TIME=${this.MAX_PRESS_TIME}, BASE_JUMP_POWER=${this.BASE_JUMP_POWER}`);
    
    this.clock = new THREE.Clock()
    
    // 创建场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xFFFFFF) // 纯白色背景

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      50, // 更小的FOV使画面更接近正交投影效果
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )

    // 设置相机初始位置（在x轴和z轴的正方向）
    this.camera.position.set(8, 12, 8)
    this.camera.lookAt(0, 2, 0)

    // 初始化相机目标位置和观察点
    this.cameraTargetPosition = this.camera.position.clone()
    this.cameraTargetLookAt = new THREE.Vector3(0, 2, 0)

    // 初始化相机相关变量
    this.cameraStartPosition = new THREE.Vector3()
    this.cameraStartLookAt = new THREE.Vector3()

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setClearColor(0xFFFFFF, 1) // 纯白色背景
    this.renderer.shadowMap.enabled = true // 启用阴影
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap // 使用PCF柔和阴影
    container.appendChild(this.renderer.domElement)

    // 创建控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enabled = false // 禁用控制器，保持固定视角

    // 创建分数显示
    this.scoreElement = document.createElement('div')
    this.scoreElement.style.position = 'absolute'
    this.scoreElement.style.top = '20px'
    this.scoreElement.style.left = '20px'
    this.scoreElement.classList.add('pixel-font', 'score')
    this.updateScore(0)
    container.appendChild(this.scoreElement)

    // 创建游戏开始提示
    this.startMessageElement = document.createElement('div')
    this.startMessageElement.style.position = 'absolute'
    this.startMessageElement.style.top = '50%'
    this.startMessageElement.style.left = '50%'
    this.startMessageElement.style.transform = 'translate(-50%, -50%)'
    this.startMessageElement.classList.add('pixel-font', 'game-over')
    this.startMessageElement.style.display = 'none'
    container.appendChild(this.startMessageElement)

    // 创建游戏结束提示
    this.gameOverElement = document.createElement('div')
    this.gameOverElement.style.position = 'absolute'
    this.gameOverElement.style.top = '50%'
    this.gameOverElement.style.left = '50%'
    this.gameOverElement.style.transform = 'translate(-50%, -50%)'
    this.gameOverElement.classList.add('pixel-font', 'game-over')
    this.gameOverElement.style.display = 'none'
    container.appendChild(this.gameOverElement)

    // 创建游戏模式选择界面
    this.gameModeSelectElement = document.createElement('div')
    this.gameModeSelectElement.style.position = 'absolute'
    this.gameModeSelectElement.style.width = '100%'
    this.gameModeSelectElement.style.height = '100%'
    this.gameModeSelectElement.style.top = '0'
    this.gameModeSelectElement.style.left = '0'
    this.gameModeSelectElement.style.display = 'flex'
    this.gameModeSelectElement.style.flexDirection = 'column'
    this.gameModeSelectElement.style.justifyContent = 'center'
    this.gameModeSelectElement.style.alignItems = 'center'
    this.gameModeSelectElement.style.background = `url('game.png')`
    this.gameModeSelectElement.style.backgroundSize = 'cover'
    this.gameModeSelectElement.style.backgroundPosition = 'center'
    this.gameModeSelectElement.style.zIndex = '1000'
    container.appendChild(this.gameModeSelectElement)
    
    // 根据全局游戏状态决定是否显示选择界面
    if (this.isGameStarted) {
      console.log(`[DEBUG] 实例 ${this.instanceId}: 游戏已开始，隐藏选择界面`);
      this.gameModeSelectElement.style.display = 'none';
      this.scoreElement.style.display = 'block';
    }
    
    // 添加标题
    const titleElement = document.createElement('h1')
    titleElement.textContent = '欢迎来到跳一跳'
    titleElement.style.color = 'white'
    titleElement.style.fontSize = '3.5rem'
    titleElement.style.fontWeight = 'bold'
    titleElement.style.textShadow = '2px 2px 10px rgba(0, 0, 0, 0.8)'
    titleElement.style.marginBottom = '1rem'
    titleElement.style.letterSpacing = '3px'
    this.gameModeSelectElement.appendChild(titleElement)
    
    // 添加副标题
    const subtitleElement = document.createElement('p')
    subtitleElement.textContent = '请选择游戏模式：'
    subtitleElement.style.color = 'white'
    subtitleElement.style.fontSize = '1.5rem'
    subtitleElement.style.marginBottom = '2rem'
    subtitleElement.style.textShadow = '1px 1px 5px rgba(0, 0, 0, 0.7)'
    this.gameModeSelectElement.appendChild(subtitleElement)
    
    // 创建按钮容器
    const buttonContainer = document.createElement('div')
    buttonContainer.style.display = 'flex'
    buttonContainer.style.flexDirection = 'column'
    buttonContainer.style.alignItems = 'center'
    buttonContainer.style.gap = '1.5rem'
    this.gameModeSelectElement.appendChild(buttonContainer)
    
    // 添加基础模式按钮（带图标）
    this.basicModeButton = document.createElement('button')
    this.basicModeButton.style.display = 'flex'
    this.basicModeButton.style.alignItems = 'center'
    this.basicModeButton.style.justifyContent = 'center'
    this.basicModeButton.style.padding = '0.8rem 2rem'
    this.basicModeButton.style.backgroundColor = 'white'
    this.basicModeButton.style.color = 'rgba(0, 0, 0, 0.8)'
    this.basicModeButton.style.border = 'none'
    this.basicModeButton.style.borderRadius = '2rem'
    this.basicModeButton.style.fontSize = '1.1rem'
    this.basicModeButton.style.fontWeight = 'bold'
    this.basicModeButton.style.cursor = 'pointer'
    this.basicModeButton.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.3)'
    this.basicModeButton.style.transition = 'all 0.2s ease'
    this.basicModeButton.onmouseover = () => {
      this.basicModeButton.style.transform = 'scale(1.05)'
      this.basicModeButton.style.boxShadow = '0 6px 15px rgba(0, 0, 0, 0.35)'
    }
    this.basicModeButton.onmouseout = () => {
      this.basicModeButton.style.transform = 'scale(1)'
      this.basicModeButton.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.3)'
    }
    
    // 添加播放图标（Font Awesome样式）
    const playIcon = document.createElement('div')
    playIcon.innerHTML = '▶'
    playIcon.style.color = '#4CAF50' // 绿色
    playIcon.style.fontSize = '1.2rem'
    playIcon.style.marginRight = '0.5rem'
    this.basicModeButton.appendChild(playIcon)
    
    // 添加文本
    const buttonText = document.createElement('span')
    buttonText.textContent = '开始游戏'
    this.basicModeButton.appendChild(buttonText)
    
    buttonContainer.appendChild(this.basicModeButton)
    
    // 添加进化模式按钮（多人游戏链接样式）
    this.evolveModeButton = document.createElement('div')
    this.evolveModeButton.textContent = '进化模式'
    this.evolveModeButton.style.marginTop = '1.5rem'
    this.evolveModeButton.style.color = 'rgba(255, 255, 255, 0.9)'
    this.evolveModeButton.style.fontSize = '1.1rem'
    this.evolveModeButton.style.cursor = 'pointer'
    this.evolveModeButton.style.position = 'relative'
    this.evolveModeButton.style.paddingBottom = '2px'
    this.evolveModeButton.style.transition = 'all 0.3s ease'
    
    // 添加下划线动画效果
    const underlineEffect = () => {
      this.evolveModeButton.style.display = 'inline-block'
      
      // 添加伪元素样式
      this.evolveModeButton.style.overflow = 'hidden'
      
      // 创建下划线元素
      const underline = document.createElement('div')
      underline.style.position = 'absolute'
      underline.style.bottom = '0'
      underline.style.left = '0'
      underline.style.width = '0'
      underline.style.height = '1px'
      underline.style.backgroundColor = 'white'
      underline.style.transition = 'width 0.3s ease'
      this.evolveModeButton.appendChild(underline)
      
      // 鼠标悬停效果
      this.evolveModeButton.onmouseover = () => {
        underline.style.width = '100%'
        this.evolveModeButton.style.color = 'white'
      }
      
      this.evolveModeButton.onmouseout = () => {
        underline.style.width = '0'
        this.evolveModeButton.style.color = 'rgba(255, 255, 255, 0.9)'
      }
    }
    
    underlineEffect()
    buttonContainer.appendChild(this.evolveModeButton)
    
    // 添加按钮点击事件
    // 使用箭头函数确保正确的this上下文
    this.basicModeButton.addEventListener('click', (e) => {
      console.log(`[DEBUG] 实例 ${this.instanceId}: 基础模式按钮被点击`, e);
      console.log(`[DEBUG] 实例 ${this.instanceId}: 点击时的游戏状态:`, { isGameStarted: this.isGameStarted, globalState: GameEngine.GLOBAL_GAME_STARTED });
      
      // 如果游戏已经开始，避免重复处理
      if (this.isGameStarted || GameEngine.GLOBAL_GAME_STARTED) {
        console.log(`[DEBUG] 实例 ${this.instanceId}: 游戏已经开始，忽略重复点击`);
        return;
      }
      
      // 播放开始游戏的欢快音效
      if (this.audioManager) {
        this.audioManager.playGameStartSound();
      }
      
      this.startBasicMode();
      e.stopPropagation(); // 阻止事件冒泡
    });
    
    this.evolveModeButton.addEventListener('click', (e) => {
      console.log(`[DEBUG] 实例 ${this.instanceId}: 进化模式按钮被点击`, e);
      console.log(`[DEBUG] 实例 ${this.instanceId}: 点击时的游戏状态:`, { isGameStarted: this.isGameStarted, globalState: GameEngine.GLOBAL_GAME_STARTED });
      
      // 如果游戏已经开始，避免重复处理
      if (this.isGameStarted || GameEngine.GLOBAL_GAME_STARTED) {
        console.log(`[DEBUG] 实例 ${this.instanceId}: 游戏已经开始，忽略重复点击`);
        return;
      }
      
      // 播放开始游戏的欢快音效
      if (this.audioManager) {
        this.audioManager.playGameStartSound();
      }
      
      this.showEvolveMode();
      e.stopPropagation(); // 阻止事件冒泡
    });
    
    // 添加光源
    this.setupLights()

    // 添加辅助线
    this.setupHelpers()

    // 添加玩家
    this.setupPlayer()

    // 添加初始平台
    this.setupPlatforms()

    // 初始化粒子系统
    this.particleSystem = new ParticleSystem(this.scene)

    // 初始化音频管理器（替换原有的Howler初始化）
    this.audioManager = new AudioManager()

    // 开始动画循环
    this.animate()

    // 隐藏分数元素，直到游戏开始
    this.scoreElement.style.display = 'none'

    // 添加窗口大小变化监听
    window.addEventListener('resize', this.onWindowResize.bind(this))

    // 如果游戏已经开始，添加交互事件监听器
    if (this.isGameStarted) {
      console.log(`[DEBUG] 实例 ${this.instanceId}: 初始化时游戏已开始，添加事件监听器`);
      this.addEventListeners();
    }
    
    // 在适当的时机检查全局状态
    setInterval(() => {
      console.log(`[DEBUG] 实例 ${this.instanceId}: 定时状态检查:`, { 
        instanceGameStarted: this.isGameStarted,
        globalGameStarted: GameEngine.GLOBAL_GAME_STARTED,
        isGameOver: this.isGameOver
      });
    }, 3000);

    // 保存实例
    GameEngine.instance = this;
  }

  // 修改静态方法获取实例
  public static getInstance(container: HTMLElement): GameEngine {
    console.log('[DEBUG] getInstance 被调用，当前状态:', {
      hasInstance: !!GameEngine.instance,
      instanceDestroyed: GameEngine.instanceDestroyed,
      container: container.id || '无ID'
    });
    
    // 如果实例存在，但容器不同，需要重新附加
    if (GameEngine.instance && GameEngine.currentContainer !== container) {
      console.log('[DEBUG] 重新附加现有实例到新容器');
      const renderer = GameEngine.instance.getRenderer();
      if (GameEngine.currentContainer) {
        try {
          GameEngine.currentContainer.removeChild(renderer.domElement);
        } catch (error) {
          console.warn('[WARN] 移除旧容器中的渲染器元素时出错:', error);
        }
      }
      container.appendChild(renderer.domElement);
      GameEngine.currentContainer = container;
      GameEngine.instance.onWindowResize();
      return GameEngine.instance;
    }
    
    // 如果实例不存在或已被销毁，创建新实例
    if (!GameEngine.instance || GameEngine.instanceDestroyed) {
      console.log('[DEBUG] 创建新的GameEngine实例');
      GameEngine.instance = new GameEngine(container);
      GameEngine.currentContainer = container;
      GameEngine.instanceDestroyed = false; // 重置销毁标志
    } else {
      console.log(`[DEBUG] 返回已存在的GameEngine实例 ID: ${GameEngine.instance.instanceId}`);
    }
    
    return GameEngine.instance;
  }

  // 添加静态方法销毁实例
  public static destroyInstance(): void {
    if (GameEngine.instance) {
      console.log('[DEBUG] destroyInstance 被调用');
      
      // 先调用清理方法
      GameEngine.instance.cleanup();
      
      // 安全地移除渲染器的 DOM 元素
      if (GameEngine.currentContainer && GameEngine.instance.renderer) {
        const rendererElement = GameEngine.instance.renderer.domElement;
        if (rendererElement.parentElement === GameEngine.currentContainer) {
          try {
            GameEngine.currentContainer.removeChild(rendererElement);
            console.log('[DEBUG] 成功移除渲染器 DOM 元素');
          } catch (error) {
            console.warn('[WARN] 移除渲染器 DOM 元素时出错:', error);
          }
        }
      }
      
      // 设置销毁标志，但不立即清除实例引用
      GameEngine.instanceDestroyed = true;
      
      // 重置容器引用和游戏状态
      GameEngine.currentContainer = null;
      GameEngine.GLOBAL_GAME_STARTED = false;
      
      console.log('[DEBUG] GameEngine 实例已标记为销毁');
    }
  }

  // 添加清理方法
  private cleanup(): void {
    console.log('[DEBUG] cleanup 被调用');
    
    // 移除事件监听器
    this.removeEventListeners();
    
    // 移除窗口大小变化监听
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    
    // 停止动画循环 - 修复类型错误
    const animationId = requestAnimationFrame(this.animate.bind(this));
    cancelAnimationFrame(animationId);
    
    // 清理场景
    while(this.scene.children.length > 0) { 
      this.scene.remove(this.scene.children[0]);
    }
    
    // 清理渲染器
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    // 重置游戏状态
    this.isGameStarted = false;
    this.isGameOver = false;
    this.score = 0;
  }

  private setupLights(): void {
    // 主光源 - 从上方照射
    const mainLight = new THREE.DirectionalLight(0xffffff, 4) // 增加主光源强度
    mainLight.position.set(10, 10, 0)
    mainLight.castShadow = true
    
    // 打印初始光源位置
    console.log('初始光源位置:', {
      x: mainLight.position.x,
      y: mainLight.position.y,
      z: mainLight.position.z
    })
    
    // 配置阴影参数
    mainLight.shadow.camera.left = -300
    mainLight.shadow.camera.right = 300
    mainLight.shadow.camera.top = 300
    mainLight.shadow.camera.bottom = -300
    mainLight.shadow.camera.near = 0.1
    mainLight.shadow.camera.far = 100
    mainLight.shadow.mapSize.width = 4096
    mainLight.shadow.mapSize.height = 4096
    mainLight.shadow.bias = -0.001
    mainLight.shadow.radius = 2
    mainLight.shadow.blurSamples = 16

    // 调整光源位置和强度
    mainLight.intensity = 2.5 // 增加光照强度，使地面更加明亮

    this.scene.add(mainLight)
    // 保存主光源引用
    this.mainLight = mainLight

    // 填充光 - 增加环境光强度
    const fillLight = new THREE.AmbientLight(0xffffff, 1.5) // 增加环境光强度
    this.scene.add(fillLight)
  }

  private setupHelpers(): void {
    // 创建一个新的场景和相机用于坐标轴显示
    const axesScene = new THREE.Scene()
    const axesCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10)
    axesCamera.position.set(0, 0, 5)
    
    // 添加坐标轴辅助线到新场景
    const axesHelper = new THREE.AxesHelper(1.5)
    // 设置坐标轴颜色
    const materials = axesHelper.material as THREE.Material[]
    if (Array.isArray(materials)) {
      // 修复类型错误，使用 THREE.Color 对象
      if ((materials[0] as THREE.LineBasicMaterial).color) {
        (materials[0] as THREE.LineBasicMaterial).color = new THREE.Color(0xff0000); // X轴 - 红色
        (materials[1] as THREE.LineBasicMaterial).color = new THREE.Color(0x00ff00); // Y轴 - 绿色
        (materials[2] as THREE.LineBasicMaterial).color = new THREE.Color(0x0000ff); // Z轴 - 蓝色
      }
    }
    axesScene.add(axesHelper)
    
    // 旋转坐标轴以获得更好的视角
    axesHelper.rotation.x = -Math.PI / 6
    axesHelper.rotation.y = Math.PI / 4

    // 添加坐标轴文字标注
    const addAxisLabel = (text: string, position: THREE.Vector3, color: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = 50
      canvas.height = 50
      const context = canvas.getContext('2d')
      if (context) {
        context.font = 'Bold 20px Arial'
        context.fillStyle = color
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(text, 25, 25)
      }
      
      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.copy(position)
      sprite.scale.set(0.5, 0.5, 0.5)
      axesScene.add(sprite)
    }

    // 添加X、Y、Z轴标注
    addAxisLabel('X', new THREE.Vector3(1.8, 0, 0), '#ff0000')
    addAxisLabel('Y', new THREE.Vector3(0, 1.8, 0), '#00ff00')
    addAxisLabel('Z', new THREE.Vector3(0, 0, 1.8), '#0000ff')

    // 在animate方法中渲染坐标轴
    const renderAxes = () => {
      // 计算视口大小
      const width = this.renderer.domElement.width
      const height = this.renderer.domElement.height
      const size = Math.min(width, height) / 4

      // 设置渲染区域在右上角
      this.renderer.setViewport(width - size - 10, 10, size, size)
      this.renderer.setScissor(width - size - 10, 10, size, size)
      this.renderer.setScissorTest(true)
      
      // 渲染坐标轴
      this.renderer.render(axesScene, axesCamera)
      
      // 重置视口
      this.renderer.setViewport(0, 0, width, height)
      this.renderer.setScissor(0, 0, width, height)
      this.renderer.setScissorTest(false)
    }

    // 将renderAxes方法保存为类属性，以便在animate中使用
    this.renderAxes = renderAxes

    // 添加地面平面
    const groundGeometry = new THREE.PlaneGeometry(100, 100); // 稍微减小地面尺寸，与纹理重复设置相匹配
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF, // 使用纯白色
      metalness: 0.2, // 增加金属感
      roughness: 0.6, // 降低粗糙度
      transparent: false,
      emissive: 0x333333, // 添加自发光
      emissiveIntensity: 0.3 // 控制自发光强度
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.001
    ground.receiveShadow = true
    this.scene.add(ground)
    // 将ground保存为类属性，以便后续移动
    this.ground = ground

    // 添加地面碰撞边界（保留碰撞检测逻辑，但不显示边界）
    const groundBoundingBox = new THREE.Box3(
      new THREE.Vector3(-20, -0.1, -20),
      new THREE.Vector3(20, 0, 20)
    )
  }

  private setupPlayer(): void {
    this.player = new Player()
    // 将玩家放在起始平台上
    this.player.setPosition(0, 1, 0)
    this.scene.add(this.player.getMesh())
  }

  private setupPlatforms(): void {
    // 创建起始平台
    const startPlatform = new Platform(true)
    startPlatform.setPosition(0, 0, 0)
    this.scene.add(startPlatform.getMesh())
    this.platforms.push(startPlatform)
    this.player.addPlatform(startPlatform)

    // 设置玩家的初始平台
    this.player.setCurrentPlatform(startPlatform)

    // 立即生成第二个平台
    this.generateNextPlatform()
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this))
    
    const deltaTime = this.clock.getDelta()
    
    // 更新粒子系统
    this.particleSystem.update(deltaTime)
    
    // 更新玩家状态
    this.player.update(deltaTime)
    
    // 更新所有平台的下落动画
    this.platforms.forEach(platform => platform.update(deltaTime))
    
    // 如果正在按压，更新蓄力动画
    if (this.isPressing) {
      const pressDuration = Date.now() - this.pressStartTime
      // 修正计算方式，使用与onPressEnd相同的计算公式
      const power = Math.min(pressDuration / this.MAX_PRESS_TIME, 1)
      console.log('[DEBUG] 蓄力动画更新: 按压时间=', pressDuration, 'ms, 力度=', power);
      this.player.updateCharging(power)
      
      // 更新蓄力音效频率
      this.audioManager.playChargingSound(power)
    }
    
    // 更新相机位置
    if (this.cameraMoving) {
      // 更新移动进度
      this.cameraMoveProgress += (this.CAMERA_SPEED * deltaTime) / this.cameraMoveDistance
      
      if (this.cameraMoveProgress >= 1) {
        // 移动完成
        this.cameraMoveProgress = 1
        this.cameraMoving = false
      }
      
      // 线性插值计算当前位置
      this.camera.position.lerpVectors(
        this.cameraStartPosition,
        this.cameraTargetPosition,
        this.cameraMoveProgress
      )
      
      // 更新观察点
      const currentLookAt = new THREE.Vector3().lerpVectors(
        this.cameraStartLookAt,
        this.cameraTargetLookAt,
        this.cameraMoveProgress
      )
      this.camera.lookAt(currentLookAt)
    }
    
    // 更新地面位置
    if (this.isGroundMoving) {
      this.groundMoveProgress += deltaTime / this.groundMoveDuration
      
      if (this.groundMoveProgress >= 1) {
        this.groundMoveProgress = 1
        this.isGroundMoving = false
      }
      
      // 线性插值计算当前位置
      this.ground.position.lerpVectors(
        this.groundStartPosition,
        this.groundTargetPosition,
        this.groundMoveProgress
      )
    }
    
    // 渲染主场景
    this.renderer.render(this.scene, this.camera)
    
    // 渲染坐标轴
    // this.renderAxes() // 注释掉坐标轴渲染，移除右下角的坐标系显示
  }

  private onWindowResize(): void {
    const container = this.renderer.domElement.parentElement
    if (!container) return

    this.camera.aspect = container.clientWidth / container.clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(container.clientWidth, container.clientHeight)
  }

  private updateScore(newScore: number): void {
    this.score = newScore
    this.scoreElement.textContent = `SCORE: ${this.score}`
  }

  private generateNextPlatform(): void {
    const lastPlatform = this.platforms[this.platforms.length - 1]
    const lastPosition = lastPlatform.getPosition()
    
    // 随机决定在X轴负方向还是Z轴负方向生成（50%概率）
    const isXDirection = Math.random() < 0.5
    
    // 随机生成4-7之间的距离
    const distance = Math.floor(Math.random() * (7 - 4 + 1)) + 4
    
    // 计算新平台的位置
    const newPosition = {
      x: lastPosition.x + (isXDirection ? -distance : 0),
      y: 5, // 从Y=5的高度开始下落
      z: lastPosition.z + (isXDirection ? 0 : -distance)
    }

    // 创建新平台
    const newPlatform = new Platform(false)
    newPlatform.setPosition(
      newPosition.x,
      newPosition.y,
      newPosition.z
    )
    
    // 开始下落动画
    newPlatform.startFalling()
    
    this.scene.add(newPlatform.getMesh())
    this.platforms.push(newPlatform)
    this.player.addPlatform(newPlatform)
  }

  private showGameOver(): void {
    // 如果已经是游戏结束状态，不再重复执行
    if (this.isGameOver) return

    // 立即设置游戏结束状态和停止所有操作
    this.isGameOver = true
    this.isPressing = false
    
    // 移除所有事件监听器，确保完全停止交互
    this.removeEventListeners()
    
    // 立即播放失败音效
    this.audioManager.playGameOverSound()
    
    // 2秒后显示游戏结束界面
    setTimeout(() => {
      // 创建游戏结束内容容器
      this.gameOverElement.innerHTML = ''
      this.gameOverElement.style.display = 'block'
      
      // 创建文本元素
      const textElement = document.createElement('div')
      textElement.textContent = `GAME OVER\nSCORE: ${this.score}`
      textElement.style.marginBottom = '20px'
      this.gameOverElement.appendChild(textElement)
      
      // 创建重启按钮
      const restartButton = document.createElement('button')
      restartButton.textContent = 'RESTART'
      restartButton.classList.add('pixel-font')
      restartButton.style.padding = '10px 20px'
      restartButton.style.fontSize = '16px'
      restartButton.style.cursor = 'pointer'
      restartButton.style.backgroundColor = '#4CAF50'
      restartButton.style.color = 'white'
      restartButton.style.border = 'none'
      restartButton.style.borderRadius = '4px'
      
      // 重启游戏的函数
      const restartGame = () => {
        window.location.reload()
      }
      
      // 添加点击事件（处理鼠标点击）
      restartButton.addEventListener('click', restartGame)
      
      // 添加触摸事件（处理移动设备）
      restartButton.addEventListener('touchstart', (e) => {
        e.preventDefault() // 防止触摸事件被转换为点击事件
        restartGame()
      })
      
      this.gameOverElement.appendChild(restartButton)
    }, 1500)
  }

  // 移除所有事件监听器，确保游戏失败后不响应任何交互
  private removeEventListeners(): void {
    console.log('[DEBUG] removeEventListeners 被调用');
    
    const container = this.renderer?.domElement?.parentElement;
    if (!container) {
      console.log('[DEBUG] 找不到容器元素或渲染器已被清理，跳过移除事件监听器');
      return;
    }

    try {
      container.removeEventListener('mousedown', this.onPressStart.bind(this));
      container.removeEventListener('mouseup', this.onPressEnd.bind(this));
      container.removeEventListener('touchstart', this.onPressStart.bind(this));
      container.removeEventListener('touchend', this.onPressEnd.bind(this));
      console.log('[DEBUG] 事件监听器已成功移除');
    } catch (error) {
      console.warn('[WARN] 移除事件监听器时出错:', error);
    }
  }

  private onPressStart(event: MouseEvent | TouchEvent): void {
    console.log('[DEBUG] onPressStart 被调用，事件类型:', event.type);
    console.log('[DEBUG] 当前游戏状态:', { 
      isGameStarted: this.isGameStarted, 
      isGameOver: this.isGameOver, 
      isPressing: this.isPressing,
      cameraMoving: this.cameraMoving
    });
    
    // 只有在游戏开始、非游戏结束状态，且相机不在移动时才处理
    if (!this.isGameStarted || this.isGameOver || this.cameraMoving) {
      console.log('[DEBUG] 按压被忽略，游戏状态不满足条件');
      return;
    }
    
    // 开始按压
    this.isPressing = true;
    this.pressStartTime = Date.now();
    console.log('[DEBUG] 开始按压，记录时间:', this.pressStartTime);
    console.log('[DEBUG] MAX_PRESS_TIME:', this.MAX_PRESS_TIME, 'ms');
    console.log('[DEBUG] BASE_JUMP_POWER:', this.BASE_JUMP_POWER);
    
    // 让玩家开始充能（缩放效果）
    this.player.startCharging();
    
    // 播放蓄力音效
    this.audioManager.playChargingSound(0);
    
    console.log('[DEBUG] 玩家开始充能');
  }

  private onPressEnd(event: MouseEvent | TouchEvent): void {
    console.log('[DEBUG] onPressEnd 被调用，事件类型:', event.type);
    console.log('[DEBUG] 当前游戏状态:', { 
      isGameStarted: this.isGameStarted, 
      isGameOver: this.isGameOver, 
      isPressing: this.isPressing,
      cameraMoving: this.cameraMoving
    });
    
    // 只有在按压状态下才处理
    if (!this.isPressing) {
      console.log('[DEBUG] 释放被忽略，当前不在按压状态');
      return;
    }
    
    // 计算按压时间
    const pressDuration = Date.now() - this.pressStartTime;
    console.log('[DEBUG] 按压时间:', pressDuration, 'ms');
    console.log('[DEBUG] MAX_PRESS_TIME:', this.MAX_PRESS_TIME, 'ms');
    
    // 计算跳跃力度（0-1范围内）
    const power = Math.min(pressDuration / this.MAX_PRESS_TIME, 1);
    console.log('[DEBUG] 计算的跳跃力度:', power, '(pressDuration / MAX_PRESS_TIME =', pressDuration, '/', this.MAX_PRESS_TIME, '=', pressDuration / this.MAX_PRESS_TIME, ')');
    
    // 停止蓄力音效
    this.audioManager.stopChargingSound();
    
    // 重置按压状态
    this.isPressing = false;
    
    // 执行跳跃
    this.jump(power);
    console.log('[DEBUG] 执行跳跃，力度:', power);
  }

  private jump(power: number): void {
    if (this.platforms.length < 2 || this.isGameOver) return // 游戏结束时不允许跳跃
    
    const currentPlatform = this.platforms[this.currentPlatformIndex]
    const targetPlatform = this.platforms[this.targetPlatformIndex]
    
    const currentPlatformPos = currentPlatform.getPosition()
    const targetPlatformPos = targetPlatform.getPosition()
    const playerPosition = this.player.getPosition()

    // 计算平台之间的相对位置
    const deltaX = targetPlatformPos.x - currentPlatformPos.x
    const deltaZ = targetPlatformPos.z - currentPlatformPos.z
    console.log('[DEBUG] 平台相对位置:', { deltaX, deltaZ });

    // 确定跳跃方向
    const direction = new THREE.Vector3()
    if (Math.abs(deltaX) > Math.abs(deltaZ)) {
      direction.set(Math.sign(deltaX), 0, 0)
      console.log('[DEBUG] 跳跃方向: X轴', Math.sign(deltaX) > 0 ? '正方向' : '负方向');
    } else {
      direction.set(0, 0, Math.sign(deltaZ))
      console.log('[DEBUG] 跳跃方向: Z轴', Math.sign(deltaZ) > 0 ? '正方向' : '负方向');
    }

    // 修改跳跃距离计算方式
    // 使用平台间实际距离作为基础
    const platformDistance = Math.max(Math.abs(deltaX), Math.abs(deltaZ))
    
    // 根据力度计算实际跳跃距离
    // 最小力度时跳跃距离为平台距离的60%，最大力度时为平台距离的110%
    // 这样确保足够的力度时可以跳到目标平台，但不会跳得太远
    const minJumpRatio = 0.6; // 最小跳跃比例
    const maxJumpRatio = 3; // 最大跳跃比例，从5降低到1.1
    const jumpRatio = minJumpRatio + (maxJumpRatio - minJumpRatio) * power;
    const jumpDistance = platformDistance * jumpRatio;
    
    console.log('[DEBUG] 跳跃距离计算: platformDistance * jumpRatio =', 
                platformDistance, '*', jumpRatio.toFixed(2), '=', jumpDistance.toFixed(2),
                '(power =', power.toFixed(2), ')');

    // 计算目标位置（确保使用归一化的方向向量）
    direction.normalize()
    console.log('[DEBUG] 归一化后的方向向量:', direction);
    
    const targetPosition = new THREE.Vector3()
      .copy(playerPosition)
      .add(direction.multiplyScalar(jumpDistance))
    console.log('[DEBUG] 初始目标位置:', targetPosition);
    
    // 优化：根据跳跃方向，强制对齐另一个轴的坐标到目标平台
    if (Math.abs(deltaX) > Math.abs(deltaZ)) {
      // 沿X轴方向跳跃（包括-X方向），强制Z坐标与目标平台一致
      targetPosition.z = targetPlatformPos.z
      console.log('[DEBUG] X轴方向跳跃，强制对齐Z坐标:', targetPosition.z)
    } else {
      // 沿Z轴方向跳跃（包括-Z方向），强制X坐标与目标平台一致
      targetPosition.x = targetPlatformPos.x
      console.log('[DEBUG] Z轴方向跳跃，强制对齐X坐标:', targetPosition.x)
    }
    console.log('[DEBUG] 最终目标位置:', targetPosition);

    // 调整玩家朝向
    const angle = Math.atan2(direction.x, direction.z)
    this.player.rotate(angle)
    
    console.log(`[DEBUG] 开始跳跃: 力度=${power.toFixed(2)}, 距离=${jumpDistance.toFixed(2)}`)
    console.log(`[DEBUG] 目标位置: x=${targetPosition.x.toFixed(2)}, z=${targetPosition.z.toFixed(2)}`)
    
    this.player.jump(power, targetPosition, this.platforms, (success) => {
      if (success) {
        // 在成功着陆时播放音效和粒子效果
        this.audioManager.playLandingSound()
        this.particleSystem.emit(new THREE.Vector3(
          targetPosition.x,
          1, // 平台高度
          targetPosition.z
        ))

        // 更新平台索引
        this.currentPlatformIndex = this.targetPlatformIndex
        this.targetPlatformIndex++
        
        // 更新玩家当前所在的平台
        this.player.setCurrentPlatform(targetPlatform)
        this.updateScore(this.score + 1)
        
        // 生成下一个平台
        this.generateNextPlatform()

        // 开始相机移动
        this.startCameraMovement(deltaX, deltaZ)

        // 移动地面
        const groundTargetX = this.ground.position.x + (Math.abs(deltaX) > Math.abs(deltaZ) ? deltaX : 0)
        const groundTargetZ = this.ground.position.z + (Math.abs(deltaX) > Math.abs(deltaZ) ? 0 : deltaZ)
        const duration = Math.abs(deltaX) > Math.abs(deltaZ) ? Math.abs(deltaX) / this.CAMERA_SPEED : Math.abs(deltaZ) / this.CAMERA_SPEED
        this.startGroundMovement(groundTargetX, groundTargetZ, duration)

        // 更新阴影相机的范围，使其跟随棋子移动
        this.mainLight.shadow.camera.left = targetPosition.x - 300
        this.mainLight.shadow.camera.right = targetPosition.x + 300
        this.mainLight.shadow.camera.top = targetPosition.z + 300
        this.mainLight.shadow.camera.bottom = targetPosition.z - 300
        
        // 更新阴影相机的投影矩阵
        this.mainLight.shadow.camera.updateProjectionMatrix()
      } else {
        // 游戏失败，打印详细信息
        console.log('========== 游戏失败 ==========')
        console.log(`玩家位置: x=${targetPosition.x.toFixed(2)}, z=${targetPosition.z.toFixed(2)}`)
        console.log(`当前平台索引: ${this.currentPlatformIndex}`)
        console.log(`目标平台索引: ${this.targetPlatformIndex}`)
        
        // 打印所有平台的位置和边界信息
        this.platforms.forEach((platform, index) => {
          const platformPos = platform.getPosition()
          const size = platform.getSize()
          console.log(`平台 ${index}: 中心(${platformPos.x.toFixed(2)}, ${platformPos.z.toFixed(2)}), 大小(${size.x.toFixed(2)}, ${size.z.toFixed(2)})`)
        })
        
        console.log('=============================')
        
        // 确定棋子倒下的方向（根据棋子落在平台外的哪一侧）
        const targetPlatformPos = targetPlatform.getPosition()
        const size = targetPlatform.getSize()
        const halfWidth = size.x / 2
        const halfDepth = size.z / 2
        
        // 计算平台边界
        const minX = targetPlatformPos.x - halfWidth
        const maxX = targetPlatformPos.x + halfWidth
        const minZ = targetPlatformPos.z - halfDepth
        const maxZ = targetPlatformPos.z + halfDepth
        
        // 判断棋子超出平台的方向
        let fallDirection = new THREE.Vector3()
        
        if (targetPosition.z < minZ) {
          // 如果玩家z坐标小于平台最小z坐标，则朝z轴负方向倾倒
          console.log('棋子从平台前方掉落(Z轴负方向)')
          fallDirection.set(0, 0, -1)
        } else if (targetPosition.z > maxZ) {
          // 如果玩家z坐标大于平台最大z坐标，则朝z轴正方向倾倒
          console.log('棋子从平台后方掉落(Z轴正方向)')
          fallDirection.set(0, 0, 1)
        } else if (targetPosition.x < minX) {
          // 如果玩家x坐标小于平台最小x坐标，则朝x轴负方向倾倒
          console.log('棋子从平台左侧掉落(X轴负方向)')
          fallDirection.set(-1, 0, 0)
        } else if (targetPosition.x > maxX) {
          // 如果玩家x坐标大于平台最大x坐标，则朝x轴正方向倾倒
          console.log('棋子从平台右侧掉落(X轴正方向)')
          fallDirection.set(1, 0, 0)
        } else {
          // 如果不是边缘情况（罕见），使用默认的跳跃方向
          console.log('棋子从未知方向掉落，使用默认跳跃方向')
          fallDirection = direction.clone()
        }
        
        // 在跳跃失败时，让棋子向确定的方向倒下
        this.player.fallDown(fallDirection)
        this.showGameOver()
      }
    })
  }

  private startCameraMovement(deltaX: number, deltaZ: number): void {
    // 保存起始位置
    this.cameraStartPosition.copy(this.camera.position)
    this.cameraStartLookAt.copy(this.cameraTargetLookAt)
    
    // 设置目标位置
    if (Math.abs(deltaX) > Math.abs(deltaZ)) {
      // 如果是沿X轴跳跃
      this.cameraTargetPosition.set(
        this.camera.position.x + deltaX,
        this.camera.position.y,
        this.camera.position.z
      )
      this.cameraTargetLookAt.set(
        this.cameraStartLookAt.x + deltaX,
        this.cameraStartLookAt.y,
        this.cameraStartLookAt.z
      )
    } else {
      // 如果是沿Z轴跳跃
      this.cameraTargetPosition.set(
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z + deltaZ
      )
      this.cameraTargetLookAt.set(
        this.cameraStartLookAt.x,
        this.cameraStartLookAt.y,
        this.cameraStartLookAt.z + deltaZ
      )
    }
    
    // 计算移动距离
    this.cameraMoveDistance = Math.max(Math.abs(deltaX), Math.abs(deltaZ))
    
    // 重置进度并开始移动
    this.cameraMoveProgress = 0
    this.cameraMoving = true
  }

  // 添加地面相关属性
  private startGroundMovement(targetX: number, targetZ: number, duration: number): void {
    // 地面移动
    this.isGroundMoving = true
    this.groundStartPosition.copy(this.ground.position)
    this.groundTargetPosition.set(targetX, this.ground.position.y, targetZ)
    this.groundMoveProgress = 0
    this.groundMoveDuration = duration
  }

  private showStartMessage(): void {
    this.startMessageElement.textContent = 'GAME START!'
    this.startMessageElement.style.display = 'block'
    
    // 2秒后隐藏提示
    setTimeout(() => {
      this.startMessageElement.style.display = 'none'
    }, 1000)
  }

  // 开始基础模式
  private startBasicMode(): void {
    console.log(`[DEBUG] 实例 ${this.instanceId}: startBasicMode 被调用`);
    console.log(`[DEBUG] 实例 ${this.instanceId}: 调用前的游戏状态:`, { 
      instanceGameStarted: this.isGameStarted,
      globalGameStarted: GameEngine.GLOBAL_GAME_STARTED
    });
    
    // 隐藏游戏模式选择界面
    if (this.gameModeSelectElement) {
      console.log(`[DEBUG] 实例 ${this.instanceId}: 隐藏游戏模式选择界面`);
      this.gameModeSelectElement.style.display = 'none';
    } else {
      console.error(`[ERROR] 实例 ${this.instanceId}: gameModeSelectElement 不存在`);
    }
    
    // 显示分数元素
    if (this.scoreElement) {
      console.log(`[DEBUG] 实例 ${this.instanceId}: 显示分数元素`);
      this.scoreElement.style.display = 'block';
    } else {
      console.error(`[ERROR] 实例 ${this.instanceId}: scoreElement 不存在`);
    }
    
    // 设置全局游戏状态为已开始
    GameEngine.GLOBAL_GAME_STARTED = true;
    // 设置实例游戏状态为已开始
    this.isGameStarted = true;
    console.log(`[DEBUG] 实例 ${this.instanceId}: 游戏状态已设置为:`, { 
      instanceGameStarted: this.isGameStarted,
      globalGameStarted: GameEngine.GLOBAL_GAME_STARTED 
    });
    
    // 激活音频上下文，确保第一次蓄力时能够播放声音
    if (this.audioManager) {
      console.log(`[DEBUG] 实例 ${this.instanceId}: 激活音频上下文`);
      // 播放一个静音的测试音效来激活音频上下文
      this.audioManager.playTestSound();
    }
    
    // 移除现有的事件监听器
    this.removeEventListeners();
    console.log(`[DEBUG] 实例 ${this.instanceId}: 已移除现有事件监听器`);
    
    // 添加交互事件监听器
    this.addEventListeners();
    console.log(`[DEBUG] 实例 ${this.instanceId}: 已添加新的事件监听器`);
  }
  
  // 显示进化模式界面
  private showEvolveMode(): void {
    console.log(`[DEBUG] 实例 ${this.instanceId}: showEvolveMode 被调用`);
    console.log(`[DEBUG] 实例 ${this.instanceId}: 调用前的游戏状态:`, { 
      instanceGameStarted: this.isGameStarted,
      globalGameStarted: GameEngine.GLOBAL_GAME_STARTED
    });
    
    // 隐藏游戏模式选择界面
    if (this.gameModeSelectElement) {
      console.log(`[DEBUG] 实例 ${this.instanceId}: 隐藏游戏模式选择界面`);
      this.gameModeSelectElement.style.display = 'none';
    } else {
      console.error(`[ERROR] 实例 ${this.instanceId}: gameModeSelectElement 不存在`);
    }
    
    // 创建侧边栏
    this.createSidebar();
    
    // 设置全局游戏状态为已开始
    GameEngine.GLOBAL_GAME_STARTED = true;
    // 设置实例游戏状态为已开始
    this.isGameStarted = true;
    console.log(`[DEBUG] 实例 ${this.instanceId}: 游戏状态已设置为:`, { 
      instanceGameStarted: this.isGameStarted,
      globalGameStarted: GameEngine.GLOBAL_GAME_STARTED 
    });
    
    // 激活音频上下文，确保第一次蓄力时能够播放声音
    if (this.audioManager) {
      console.log(`[DEBUG] 实例 ${this.instanceId}: 激活音频上下文`);
      // 播放一个静音的测试音效来激活音频上下文
      this.audioManager.playTestSound();
    }
    
    // 移除现有的事件监听器
    this.removeEventListeners();
    console.log(`[DEBUG] 实例 ${this.instanceId}: 已移除现有事件监听器`);
    
    // 添加交互事件监听器
    this.addEventListeners();
    console.log(`[DEBUG] 实例 ${this.instanceId}: 已添加新的事件监听器`);
  }
  
  // 处理进化模式的输入提交
  private handleEvolveSubmit(): void {
    const inputText = this.evolveInputElement.value.trim()
    
    if (inputText) {
      console.log('进化模式输入:', inputText)
      
      // 清空输入框
      this.evolveInputElement.value = ''
      
      // 后续可以在这里添加处理逻辑
    }
  }
  
  // 添加交互事件监听器
  private addEventListeners(): void {
    console.log('[DEBUG] addEventListeners 被调用');
    console.log('[DEBUG] 当前游戏状态:', { isGameStarted: this.isGameStarted });
    
    const container = this.renderer.domElement.parentElement;
    if (!container) {
      console.error('[ERROR] 找不到容器元素，无法添加事件监听器');
      return;
    }

    console.log('[DEBUG] 添加事件监听器到容器元素:', container);
    
    // 首先移除可能存在的旧监听器，以防重复添加
    this.removeEventListeners();
    
    // 添加新的事件监听器，使用绑定后的方法以确保this上下文正确
    container.addEventListener('mousedown', this.onPressStart.bind(this));
    container.addEventListener('mouseup', this.onPressEnd.bind(this));
    container.addEventListener('touchstart', this.onPressStart.bind(this));
    container.addEventListener('touchend', this.onPressEnd.bind(this));
    
    console.log('[DEBUG] 所有事件监听器已添加');
  }

  // 公共方法：获取场景实例
  public getScene(): THREE.Scene {
    return this.scene
  }

  // 公共方法：获取相机实例
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera
  }

  // 公共方法：获取渲染器实例
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer
  }

  // 创建侧边栏
  private createSidebar(): void {
    // 创建侧边栏容器
    this.sidebarElement = document.createElement('div');
    this.sidebarElement.style.position = 'fixed';
    this.sidebarElement.style.top = '0';
    this.sidebarElement.style.left = '0';
    this.sidebarElement.style.width = '300px';
    this.sidebarElement.style.height = '100%';
    this.sidebarElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    this.sidebarElement.style.boxShadow = '2px 0 5px rgba(0, 0, 0, 0.1)';
    this.sidebarElement.style.padding = '20px';
    this.sidebarElement.style.overflowY = 'auto';
    this.sidebarElement.style.zIndex = '1000';
    this.sidebarElement.style.display = 'flex';
    this.sidebarElement.style.flexDirection = 'column';
    this.sidebarElement.style.gap = '15px';
    document.body.appendChild(this.sidebarElement);
    
    // 添加标题
    const titleElement = document.createElement('h2');
    titleElement.textContent = '混元生图';
    titleElement.style.margin = '0 0 20px 0';
    titleElement.style.borderBottom = '1px solid #ddd';
    titleElement.style.paddingBottom = '10px';
    this.sidebarElement.appendChild(titleElement);
    
    // 添加测试按钮
    const testButton = document.createElement('button');
    testButton.textContent = '测试替换地面纹理';
    testButton.style.padding = '10px';
    testButton.style.backgroundColor = '#ff9800';
    testButton.style.color = 'white';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '4px';
    testButton.style.cursor = 'pointer';
    testButton.style.marginBottom = '20px';
    testButton.style.width = '100%';
    testButton.onclick = () => {
      // 使用一个本地测试图片URL
      const testImageUrl = '/images/test-texture.jpg';
      this.replaceGroundWithImage(testImageUrl);
    };
    this.sidebarElement.appendChild(testButton);
    
    // 创建图片生成表单
    this.createImageGenerationForm();
    
    // 创建结果容器
    this.imageResultContainer = document.createElement('div');
    this.imageResultContainer.style.marginTop = '20px';
    this.sidebarElement.appendChild(this.imageResultContainer);
    
    // 添加关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭侧边栏';
    closeButton.style.marginTop = 'auto';
    closeButton.style.padding = '8px 15px';
    closeButton.style.backgroundColor = '#f44336';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.transition = 'background-color 0.3s';
    closeButton.onmouseover = () => {
      closeButton.style.backgroundColor = '#d32f2f';
    };
    closeButton.onmouseout = () => {
      closeButton.style.backgroundColor = '#f44336';
    };
    closeButton.onclick = () => {
      this.sidebarElement.style.display = 'none';
      
      // 创建一个打开按钮
      const openButton = document.createElement('button');
      openButton.textContent = '打开侧边栏';
      openButton.style.position = 'absolute';
      openButton.style.top = '10px';
      openButton.style.left = '10px';
      openButton.style.padding = '8px 15px';
      openButton.style.backgroundColor = '#4CAF50';
      openButton.style.color = 'white';
      openButton.style.border = 'none';
      openButton.style.borderRadius = '4px';
      openButton.style.cursor = 'pointer';
      openButton.style.zIndex = '999';
      openButton.style.transition = 'background-color 0.3s';
      openButton.onmouseover = () => {
        openButton.style.backgroundColor = '#388E3C';
      };
      openButton.onmouseout = () => {
        openButton.style.backgroundColor = '#4CAF50';
      };
      openButton.onclick = () => {
        this.sidebarElement.style.display = 'flex';
        document.body.removeChild(openButton);
      };
      document.body.appendChild(openButton);
    };
    this.sidebarElement.appendChild(closeButton);
  }

  // 创建图片生成表单
  private createImageGenerationForm(): void {
    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '15px';
    
    // 添加提示词输入
    this.addFormField(form, 'prompt', '提示词', '一只可爱的卡通猫咪，在阳光明媚的草地上玩耍', 'textarea');
    
    // 添加反向提示词输入
    this.addFormField(form, 'negativePrompt', '反向提示词', '模糊，扭曲，低质量');
    
    // 添加风格选择
    const styleOptions = [
      { value: '', label: '默认风格' },
      { value: 'riman', label: '日漫动画' },
      { value: 'shuimo', label: '水墨画' },
      { value: 'monai', label: '莫奈' },
      { value: 'bianping', label: '扁平插画' },
      { value: 'xiangsu', label: '像素插画' },
      { value: 'ertonghuiben', label: '儿童绘本' },
      { value: '3dxuanran', label: '3D 渲染' },
      { value: 'manhua', label: '漫画' },
      { value: 'heibaimanhua', label: '黑白漫画' },
      { value: 'xieshi', label: '写实' },
      { value: 'dongman', label: '动漫' },
      { value: 'bijiasuo', label: '毕加索' },
      { value: 'saibopengke', label: '赛博朋克' },
      { value: 'youhua', label: '油画' },
      { value: 'masaike', label: '马赛克' },
      { value: 'qinghuaci', label: '青花瓷' },
      { value: 'xinnianjianzhi', label: '新年剪纸画' },
      { value: 'xinnianhuayi', label: '新年花艺' }
    ];
    this.addFormSelect(form, 'style', '风格', styleOptions);
    
    // 添加分辨率选择
    const resolutionOptions = [
      { value: '1024:1024', label: '1024x1024 (1:1)' },
      { value: '768:768', label: '768x768 (1:1)' },
      { value: '768:1024', label: '768x1024 (3:4)' },
      { value: '1024:768', label: '1024x768 (4:3)' },
      { value: '720:1280', label: '720x1280 (9:16)' },
      { value: '1280:720', label: '1280x720 (16:9)' },
      { value: '768:1280', label: '768x1280 (3:5)' },
      { value: '1280:768', label: '1280x768 (5:3)' }
    ];
    this.addFormSelect(form, 'resolution', '分辨率', resolutionOptions);
    
    // 添加生成数量选择
    const numOptions = [
      { value: '1', label: '1张' },
      { value: '2', label: '2张' },
      { value: '3', label: '3张' },
      { value: '4', label: '4张' }
    ];
    this.addFormSelect(form, 'num', '生成数量', numOptions);
    
    // 添加随机种子输入
    this.addFormField(form, 'seed', '随机种子 (可选)', '');
    
    // 添加超分选项
    const clarityOptions = [
      { value: '', label: '不使用超分' },
      { value: 'x2', label: '2倍超分' },
      { value: 'x4', label: '4倍超分' }
    ];
    this.addFormSelect(form, 'clarity', '超分选项', clarityOptions);
    
    // 添加prompt扩写开关
    const reviseOptions = [
      { value: '1', label: '开启 (推荐)' },
      { value: '0', label: '关闭' }
    ];
    this.addFormSelect(form, 'revise', 'Prompt扩写', reviseOptions);
    
    // 添加水印开关
    const logoAddOptions = [
      { value: '0', label: '不添加 (默认)' },
      { value: '1', label: '添加' }
    ];
    this.addFormSelect(form, 'logoAdd', '水印', logoAddOptions);
    
    // 添加自定义水印参数
    this.addFormField(form, 'logoParam', '自定义水印 (可选)', '');
    
    // 添加提交按钮
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = '生成图片';
    submitButton.style.padding = '10px 15px';
    submitButton.style.backgroundColor = '#4CAF50';
    submitButton.style.color = 'white';
    submitButton.style.border = 'none';
    submitButton.style.borderRadius = '4px';
    submitButton.style.cursor = 'pointer';
    submitButton.style.marginTop = '10px';
    submitButton.style.transition = 'background-color 0.3s';
    submitButton.onmouseover = () => {
      if (!this.isGeneratingImage) {
        submitButton.style.backgroundColor = '#388E3C';
      }
    };
    submitButton.onmouseout = () => {
      if (!this.isGeneratingImage) {
        submitButton.style.backgroundColor = '#4CAF50';
      }
    };
    form.appendChild(submitButton);
    
    // 添加表单提交事件
    form.onsubmit = (e) => {
      e.preventDefault();
      
      if (this.isGeneratingImage) {
        return;
      }
      
      // 获取表单数据
      const formData = new FormData(form);
      const data: Record<string, string> = {};
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });
      
      // 提交生成请求
      this.submitImageGenerationJob(data, submitButton);
    };
    
    this.sidebarElement.appendChild(form);
  }
  
  // 添加表单字段
  private addFormField(form: HTMLFormElement, name: string, label: string, placeholder: string, type: string = 'text'): void {
    const fieldContainer = document.createElement('div');
    fieldContainer.style.display = 'flex';
    fieldContainer.style.flexDirection = 'column';
    fieldContainer.style.gap = '5px';
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.fontSize = '14px';
    labelElement.style.fontWeight = 'bold';
    labelElement.htmlFor = name;
    fieldContainer.appendChild(labelElement);
    
    if (type === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.name = name;
      textarea.id = name;
      textarea.placeholder = placeholder;
      textarea.rows = 3;
      textarea.style.padding = '8px';
      textarea.style.borderRadius = '4px';
      textarea.style.border = '1px solid #ddd';
      textarea.style.resize = 'vertical';
      fieldContainer.appendChild(textarea);
    } else {
      const input = document.createElement('input');
      input.type = type;
      input.name = name;
      input.id = name;
      input.placeholder = placeholder;
      input.style.padding = '8px';
      input.style.borderRadius = '4px';
      input.style.border = '1px solid #ddd';
      fieldContainer.appendChild(input);
    }
    
    form.appendChild(fieldContainer);
  }
  
  // 添加下拉选择框
  private addFormSelect(form: HTMLFormElement, name: string, label: string, options: { value: string, label: string }[]): void {
    const fieldContainer = document.createElement('div');
    fieldContainer.style.display = 'flex';
    fieldContainer.style.flexDirection = 'column';
    fieldContainer.style.gap = '5px';
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.fontSize = '14px';
    labelElement.style.fontWeight = 'bold';
    labelElement.htmlFor = name;
    fieldContainer.appendChild(labelElement);
    
    const select = document.createElement('select');
    select.name = name;
    select.id = name;
    select.style.padding = '8px';
    select.style.borderRadius = '4px';
    select.style.border = '1px solid #ddd';
    
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      select.appendChild(optionElement);
    });
    
    fieldContainer.appendChild(select);
    form.appendChild(fieldContainer);
  }

  // 提交图片生成任务
  private async submitImageGenerationJob(data: Record<string, string>, submitButton: HTMLButtonElement): Promise<void> {
    try {
      // 更新按钮状态
      this.isGeneratingImage = true;
      submitButton.textContent = '生成中...';
      submitButton.style.backgroundColor = '#9E9E9E';
      submitButton.style.cursor = 'not-allowed';
      
      // 清空之前的结果
      this.imageResultContainer.innerHTML = '';
      
      // 添加加载提示
      const loadingElement = document.createElement('div');
      loadingElement.textContent = '正在提交生成任务...';
      loadingElement.style.padding = '10px';
      loadingElement.style.backgroundColor = '#f5f5f5';
      loadingElement.style.borderRadius = '4px';
      loadingElement.style.textAlign = 'center';
      this.imageResultContainer.appendChild(loadingElement);
      
      // 提交任务
      const response = await fetch('http://localhost:3000/api/submit-image-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: data.prompt,
          negativePrompt: data.negativePrompt,
          style: data.style,
          resolution: data.resolution,
          num: data.num,
          seed: data.seed,
          clarity: data.clarity,
          revise: data.revise,
          logoAdd: data.logoAdd,
          logoParam: data.logoParam
        }),
      });
      
      if (!response.ok) {
        throw new Error(`提交失败: ${response.statusText}`);
      }
      
      const result = await response.json();
      this.currentJobId = result.JobId;
      
      // 更新加载提示
      loadingElement.textContent = `任务已提交，正在生成中 (任务ID: ${this.currentJobId})...`;
      
      // 开始轮询任务状态
      this.checkStatusInterval = window.setInterval(() => {
        this.checkImageGenerationStatus(loadingElement, submitButton);
      }, 3000);
      
    } catch (error) {
      console.error('提交图片生成任务失败:', error);
      
      // 显示错误信息
      this.imageResultContainer.innerHTML = '';
      const errorElement = document.createElement('div');
      errorElement.textContent = `生成失败: ${error instanceof Error ? error.message : '未知错误'}`;
      errorElement.style.padding = '10px';
      errorElement.style.backgroundColor = '#ffebee';
      errorElement.style.color = '#c62828';
      errorElement.style.borderRadius = '4px';
      errorElement.style.textAlign = 'center';
      this.imageResultContainer.appendChild(errorElement);
      
      // 重置按钮状态
      this.isGeneratingImage = false;
      submitButton.textContent = '生成图片';
      submitButton.style.backgroundColor = '#4CAF50';
      submitButton.style.cursor = 'pointer';
    }
  }
  
  // 检查图片生成任务状态
  private async checkImageGenerationStatus(loadingElement: HTMLDivElement, submitButton: HTMLButtonElement): Promise<void> {
    try {
      const response = await fetch(`http://localhost:3000/api/query-image-job/${this.currentJobId}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error(`查询失败: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // 检查任务状态
      if (result.JobStatusCode === '5') { // 处理完成
        // 清除轮询
        clearInterval(this.checkStatusInterval);
        
        // 显示生成的图片
        this.displayGeneratedImages(result);
        
        // 重置按钮状态
        this.isGeneratingImage = false;
        submitButton.textContent = '生成图片';
        submitButton.style.backgroundColor = '#4CAF50';
        submitButton.style.cursor = 'pointer';
      } else if (result.JobStatusCode === '3') { // 处理中
        loadingElement.textContent = `任务正在处理中 (任务ID: ${this.currentJobId})...`;
      } else if (result.JobStatusCode === '4') { // 处理失败
        // 清除轮询
        clearInterval(this.checkStatusInterval);
        
        // 显示错误信息
        this.imageResultContainer.innerHTML = '';
        const errorElement = document.createElement('div');
        errorElement.textContent = `生成失败: ${result.JobErrorMsg || '未知错误'}`;
        errorElement.style.padding = '10px';
        errorElement.style.backgroundColor = '#ffebee';
        errorElement.style.color = '#c62828';
        errorElement.style.borderRadius = '4px';
        errorElement.style.textAlign = 'center';
        this.imageResultContainer.appendChild(errorElement);
        
        // 重置按钮状态
        this.isGeneratingImage = false;
        submitButton.textContent = '生成图片';
        submitButton.style.backgroundColor = '#4CAF50';
        submitButton.style.cursor = 'pointer';
      }
    } catch (error) {
      console.error('查询图片生成任务状态失败:', error);
      
      // 不中断轮询，继续尝试
      loadingElement.textContent = `查询状态失败，正在重试... (任务ID: ${this.currentJobId})`;
    }
  }
  
  // 显示生成的图片
  private displayGeneratedImages(result: any): void {
    // 清空结果容器
    this.imageResultContainer.innerHTML = '';
    
    // 添加标题
    const titleElement = document.createElement('h3');
    titleElement.textContent = '生成结果';
    titleElement.style.margin = '0 0 10px 0';
    titleElement.style.borderBottom = '1px solid #ddd';
    titleElement.style.paddingBottom = '5px';
    this.imageResultContainer.appendChild(titleElement);
    
    // 如果有修改后的提示词，显示它
    if (result.RevisedPrompt && result.RevisedPrompt.length > 0) {
      const revisedPromptContainer = document.createElement('div');
      revisedPromptContainer.style.marginBottom = '15px';
      revisedPromptContainer.style.padding = '10px';
      revisedPromptContainer.style.backgroundColor = '#e8f5e9';
      revisedPromptContainer.style.borderRadius = '4px';
      revisedPromptContainer.style.fontSize = '14px';
      
      const revisedPromptTitle = document.createElement('div');
      revisedPromptTitle.textContent = '扩写后的提示词:';
      revisedPromptTitle.style.fontWeight = 'bold';
      revisedPromptTitle.style.marginBottom = '5px';
      revisedPromptContainer.appendChild(revisedPromptTitle);
      
      const revisedPromptText = document.createElement('div');
      revisedPromptText.textContent = result.RevisedPrompt[0];
      revisedPromptContainer.appendChild(revisedPromptText);
      
      this.imageResultContainer.appendChild(revisedPromptContainer);
    }
    
    // 显示生成的图片
    if (result.ResultImage && result.ResultImage.length > 0) {
      const imagesContainer = document.createElement('div');
      imagesContainer.style.display = 'flex';
      imagesContainer.style.flexDirection = 'column';
      imagesContainer.style.gap = '15px';
      
      result.ResultImage.forEach((imageUrl: string, index: number) => {
        const imageContainer = document.createElement('div');
        imageContainer.style.display = 'flex';
        imageContainer.style.flexDirection = 'column';
        imageContainer.style.gap = '5px';
        
        // 创建图片元素
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = `生成图片 ${index + 1}`;
        image.style.width = '100%';
        image.style.borderRadius = '4px';
        image.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.1)';
        imageContainer.appendChild(image);
        
        // 添加替换按钮
        const replaceButton = document.createElement('button');
        replaceButton.textContent = '替换';
        replaceButton.style.textAlign = 'center';
        replaceButton.style.padding = '8px';
        replaceButton.style.backgroundColor = '#4CAF50';
        replaceButton.style.color = 'white';
        replaceButton.style.border = 'none';
        replaceButton.style.borderRadius = '4px';
        replaceButton.style.marginTop = '5px';
        replaceButton.style.cursor = 'pointer';
        replaceButton.style.transition = 'background-color 0.3s';
        replaceButton.onmouseover = () => {
          replaceButton.style.backgroundColor = '#388E3C';
        };
        replaceButton.onmouseout = () => {
          replaceButton.style.backgroundColor = '#4CAF50';
        };
        replaceButton.onclick = () => {
          // 直接调用替换方法
          this.replaceGroundWithImage(imageUrl);
          
          // 添加替换成功提示
          const successMessage = document.createElement('div');
          successMessage.textContent = '替换成功！';
          successMessage.style.color = '#4CAF50';
          successMessage.style.fontWeight = 'bold';
          successMessage.style.marginTop = '5px';
          successMessage.style.textAlign = 'center';
          imageContainer.appendChild(successMessage);
          
          // 2秒后移除提示
          setTimeout(() => {
            if (imageContainer.contains(successMessage)) {
              imageContainer.removeChild(successMessage);
            }
          }, 2000);
        };
        imageContainer.appendChild(replaceButton);
        
        // 添加下载按钮
        const downloadButton = document.createElement('a');
        downloadButton.href = imageUrl;
        downloadButton.download = `generated-image-${Date.now()}-${index}.jpg`;
        downloadButton.textContent = '下载图片';
        downloadButton.style.textAlign = 'center';
        downloadButton.style.padding = '8px';
        downloadButton.style.backgroundColor = '#2196F3';
        downloadButton.style.color = 'white';
        downloadButton.style.textDecoration = 'none';
        downloadButton.style.borderRadius = '4px';
        downloadButton.style.marginTop = '5px';
        downloadButton.target = '_blank';
        imageContainer.appendChild(downloadButton);
        
        imagesContainer.appendChild(imageContainer);
      });
      
      this.imageResultContainer.appendChild(imagesContainer);
    } else {
      // 没有图片结果
      const noImageElement = document.createElement('div');
      noImageElement.textContent = '没有生成图片结果';
      noImageElement.style.padding = '10px';
      noImageElement.style.backgroundColor = '#f5f5f5';
      noImageElement.style.borderRadius = '4px';
      noImageElement.style.textAlign = 'center';
      this.imageResultContainer.appendChild(noImageElement);
    }
  }
  
  // 用生成的图片替换地面
  private replaceGroundWithImage(imageUrl: string): void {
    // 添加调试日志
    console.log('开始加载图片纹理，URL:', imageUrl);
    
    // 检查是否是外部URL，如果是则使用代理
    let processedImageUrl = imageUrl;
    if (imageUrl.startsWith('http') && !imageUrl.includes('localhost') && !imageUrl.includes('127.0.0.1')) {
      // 使用本地代理服务器转发请求，解决CORS问题
      processedImageUrl = `http://localhost:3000/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      console.log('使用代理URL:', processedImageUrl);
    }
    
    // 使用TextureLoader直接加载纹理
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';
    
    // 创建加载中的提示
    const loadingElement = document.createElement('div');
    loadingElement.textContent = '正在加载纹理...';
    loadingElement.style.position = 'fixed';
    loadingElement.style.bottom = '20px';
    loadingElement.style.right = '20px';
    loadingElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    loadingElement.style.color = 'white';
    loadingElement.style.padding = '10px';
    loadingElement.style.borderRadius = '5px';
    loadingElement.style.zIndex = '1000';
    document.body.appendChild(loadingElement);
    
    // 重新创建地面
    textureLoader.load(
      processedImageUrl,
      (texture) => {
        console.log('纹理加载成功', texture);
        
        // 确保纹理已更新
        texture.needsUpdate = true;
        
        // 获取当前平台的位置
        const currentPlatform = this.platforms[this.currentPlatformIndex];
        const platformPosition = currentPlatform.getPosition();
        console.log('当前平台位置:', platformPosition);
        
        // 移除旧地面
        if (this.ground) {
          console.log('移除旧地面');
          this.scene.remove(this.ground);
          if (this.ground.material) {
            const oldMaterial = this.ground.material as THREE.MeshStandardMaterial;
            if (oldMaterial.map) {
              oldMaterial.map.dispose();
            }
            oldMaterial.dispose();
          }
          this.ground.geometry.dispose();
        }
        
        // 创建新地面
        console.log('创建新地面');
        const groundGeometry = new THREE.PlaneGeometry(100, 100); // 稍微减小地面尺寸，与纹理重复设置相匹配
        
        // 调整纹理设置
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 3); // 将重复次数从1增加到3，使图片在地面上显示得更小
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        
        const groundMaterial = new THREE.MeshStandardMaterial({
          map: texture,
          metalness: 0.2, // 增加金属感
          roughness: 0.6, // 降低粗糙度，使表面更加光滑
          transparent: false,
          side: THREE.DoubleSide, // 确保两面都可见
          color: 0xffffff, // 使用纯白色作为基础颜色，不影响纹理
          emissive: 0x333333, // 增加自发光颜色强度
          emissiveIntensity: 0.4 // 增加自发光强度
        });
        
        // 尝试设置纹理颜色空间（如果支持的话）
        try {
          // @ts-ignore - 忽略类型检查，因为不同版本的Three.js API可能不同
          texture.colorSpace = THREE.SRGBColorSpace;
        } catch (e) {
          console.log('设置纹理颜色空间失败，可能是Three.js版本不支持:', e);
        }
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.001;
        ground.position.x = platformPosition.x;
        ground.position.z = platformPosition.z;
        ground.receiveShadow = true;
        ground.castShadow = false;
        
        // 添加到场景
        this.scene.add(ground);
        this.ground = ground;
        
        console.log('地面已替换为生成的图片', ground);
        
        // 强制更新渲染
        this.renderer.render(this.scene, this.camera);
        
        // 确保在下一帧也更新
        requestAnimationFrame(() => {
          this.renderer.render(this.scene, this.camera);
        });
        
        // 移除加载提示
        document.body.removeChild(loadingElement);
        
        // 显示成功提示
        const successElement = document.createElement('div');
        successElement.textContent = '纹理应用成功！';
        successElement.style.position = 'fixed';
        successElement.style.bottom = '20px';
        successElement.style.right = '20px';
        successElement.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
        successElement.style.color = 'white';
        successElement.style.padding = '10px';
        successElement.style.borderRadius = '5px';
        successElement.style.zIndex = '1000';
        document.body.appendChild(successElement);
        
        // 2秒后移除成功提示
        setTimeout(() => {
          document.body.removeChild(successElement);
        }, 2000);
      },
      (progress) => {
        // 添加进度回调
        console.log('纹理加载进度:', progress);
        loadingElement.textContent = `正在加载纹理... ${Math.round(progress.loaded / progress.total * 100)}%`;
      },
      (error) => {
        console.error('加载图片纹理失败:', error);
        // 移除加载提示
        document.body.removeChild(loadingElement);
        
        // 显示错误提示
        const errorElement = document.createElement('div');
        errorElement.textContent = '纹理加载失败！';
        errorElement.style.position = 'fixed';
        errorElement.style.bottom = '20px';
        errorElement.style.right = '20px';
        errorElement.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        errorElement.style.color = 'white';
        errorElement.style.padding = '10px';
        errorElement.style.borderRadius = '5px';
        errorElement.style.zIndex = '1000';
        document.body.appendChild(errorElement);
        
        // 2秒后移除错误提示
        setTimeout(() => {
          document.body.removeChild(errorElement);
        }, 2000);
      }
    );
  }
} 