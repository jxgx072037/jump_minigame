import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { Platform } from './platform'
import { Player } from './player'
import { ParticleSystem } from './particles'
import { AudioManager } from './audio'

export class GameEngine {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private platforms: Platform[] = []
  private player!: Player // 使用!操作符表明该属性会在构造函数中被初始化
  private score: number = 0
  private scoreElement: HTMLDivElement
  private clock: THREE.Clock
  private isPressing: boolean = false
  private pressStartTime: number = 0
  private readonly MAX_PRESS_TIME: number = 2000 // 最大按压时间（毫秒）
  private readonly BASE_JUMP_POWER: number = 0.004 // 基础跳跃力度系数

  // 相机相关属性
  private readonly CAMERA_SPEED: number = 15 // 与棋子跳跃速度相同
  private cameraTargetPosition: THREE.Vector3
  private cameraTargetLookAt: THREE.Vector3
  private cameraMoving: boolean = false
  private cameraStartPosition: THREE.Vector3
  private cameraStartLookAt: THREE.Vector3
  private cameraMoveProgress: number = 0
  private cameraMoveDistance: number = 0

  // 添加游戏结束相关属性
  private gameOverElement: HTMLDivElement
  private isGameOver: boolean = false
  private startMessageElement: HTMLDivElement // 添加开始提示元素

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
  private particleSystem: ParticleSystem
  private audioManager: AudioManager

  private renderAxes: () => void = () => {}

  constructor(container: HTMLElement) {
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

    // 显示开始提示
    this.showStartMessage()

    // 添加窗口大小变化监听
    window.addEventListener('resize', this.onWindowResize.bind(this))

    // 根据设备类型选择事件监听器
    if ('ontouchstart' in window) {
      // 触摸设备
      container.addEventListener('touchstart', this.onPressStart.bind(this))
      container.addEventListener('touchend', this.onPressEnd.bind(this))
    } else {
      // 鼠标设备
      container.addEventListener('mousedown', this.onPressStart.bind(this))
      container.addEventListener('mouseup', this.onPressEnd.bind(this))
    }
  }

  private setupLights(): void {
    // 主光源 - 从上方照射
    const mainLight = new THREE.DirectionalLight(0xffffff, 5)
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
    mainLight.intensity = 2

    this.scene.add(mainLight)
    // 保存主光源引用
    this.mainLight = mainLight

    // 填充光 - 增加环境光强度
    const fillLight = new THREE.AmbientLight(0xffffff, 0.7)
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
      materials[0].color.set(0xff0000) // X轴 - 红色
      materials[1].color.set(0x00ff00) // Y轴 - 绿色
      materials[2].color.set(0x0000ff) // Z轴 - 蓝色
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
    const groundGeometry = new THREE.PlaneGeometry(120, 120)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xFAFAFA,
      metalness: 0,
      roughness: 1,
      transparent: false
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
      const power = Math.min(pressDuration * this.BASE_JUMP_POWER, 1)
      this.player.updateCharging(power)
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
    
    // 固定距离为4个单位
    const distance = 4
    
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

  private onPressStart(event: MouseEvent | TouchEvent): void {
    event.preventDefault()
    if (this.isPressing || this.isGameOver) return // 游戏结束时不允许操作
    
    this.isPressing = true
    this.pressStartTime = Date.now()
    this.player.startCharging()
  }

  private onPressEnd(event: MouseEvent | TouchEvent): void {
    event.preventDefault() // 阻止默认行为
    if (!this.isPressing || this.isGameOver) return // 游戏结束时不允许操作

    const pressDuration = Math.min(Date.now() - this.pressStartTime, this.MAX_PRESS_TIME)
    this.isPressing = false
    
    // 计算跳跃力度（0-1之间）
    const power = pressDuration * this.BASE_JUMP_POWER
    
    // 触发跳跃
    this.jump(power)
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

    // 确定跳跃方向
    const direction = new THREE.Vector3()
    if (Math.abs(deltaX) > Math.abs(deltaZ)) {
      direction.set(Math.sign(deltaX), 0, 0)
    } else {
      direction.set(0, 0, Math.sign(deltaZ))
    }

    const maxDistance = 4
    const jumpDistance = maxDistance * power

    // 计算目标位置（确保使用归一化的方向向量）
    direction.normalize()
    const targetPosition = new THREE.Vector3()
      .copy(playerPosition)
      .add(direction.multiplyScalar(jumpDistance))

    // 调整玩家朝向
    const angle = Math.atan2(direction.x, direction.z)
    this.player.rotate(angle)
    
    console.log(`开始跳跃: 力度=${power.toFixed(2)}, 距离=${jumpDistance.toFixed(2)}`)
    console.log(`目标位置: x=${targetPosition.x.toFixed(2)}, z=${targetPosition.z.toFixed(2)}`)
    
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
} 