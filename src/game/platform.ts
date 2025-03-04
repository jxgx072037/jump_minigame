import * as THREE from 'three'

export class Platform {
  // 添加颜色数组
  private static readonly PLATFORM_COLORS = {
    // 灰调中性色
    neutral: [
      0xE5E1D3, // 浅米灰
      0xD3C6A5, // 暖沙色
      0xE0D3C3, // 燕麦色
      0xA8A8A8, // 岩石灰
      0xB4B4B4  // 雾霾灰
    ],
    // 粉紫色系
    pink: [
      0xD4B8B8, // 灰粉色
      0xC7A8A3, // 干枯玫瑰
      0xBFA5A1, // 藕荷色
      0xB8A9C7, // 灰紫调
      0xC3B1D8  // 薰衣草灰
    ],
    // 蓝绿色系
    blueGreen: [
      0x8A9A9E, // 灰蓝色
      0x9FB4C7, // 雾霾蓝
      0xA3B8A3, // 灰绿色
      0xB0C5C1, // 薄荷灰
      0x8FA0A3  // 青瓷色
    ],
    // 大地色系
    earth: [
      0xC7B8A1, // 浅卡其
      0xB8A089, // 陶土棕
      0xA78F7F, // 焦糖灰
      0x9E8E7E, // 冷咖色
      0x6B5F5F  // 深褐灰
    ]
  }

  private mesh: THREE.Group
  private isFalling: boolean = false
  private velocity: number = 0
  private readonly INITIAL_VELOCITY: number = -10 // 初始下落速度
  private readonly GRAVITY: number = -20 // 重力加速度
  private readonly BOUNCE_FACTOR: number = 0.2 // 弹跳系数
  private readonly BOUNCE_THRESHOLD: number = 0.1 // 停止弹跳的阈值
  private boundingBox: THREE.Box3
  private boundingBoxHelper: THREE.Box3Helper
  private isStart: boolean = false
  private onFirstGroundContact: (() => void) | null = null // 添加回调函数
  private hasContactedGround: boolean = false // 添加标记，用于跟踪是否已经接触过地面

  constructor(isStart: boolean = false) {
    this.mesh = new THREE.Group()
    this.isStart = isStart

    // 创建平台（尺寸随机）
    const sizeX = isStart ? 2.5 : 2 + Math.random(); // x轴尺寸在2到3之间随机浮动
    const sizeZ = isStart ? 2.5 : 2 + Math.random(); // z轴尺寸在2到3之间随机浮动
    const platformGeometry = new THREE.BoxGeometry(sizeX, 1, sizeZ)
    
    // 选择随机颜色
    let platformColor = 0xFFFFFF // 默认白色（用于起始平台）
    
    // 随机透明度（0.6-1之间）
    const opacity = isStart ? 1 : 0.6 + Math.random() * 0.4;
    
    if (!isStart) {
      // 随机选择一个颜色系列
      const colorCategories = Object.values(Platform.PLATFORM_COLORS)
      const randomCategory = colorCategories[Math.floor(Math.random() * colorCategories.length)]
      // 从选中的系列中随机选择一个颜色
      platformColor = randomCategory[Math.floor(Math.random() * randomCategory.length)]
    }

    const platformMaterial = new THREE.MeshPhongMaterial({
      color: platformColor,
      shininess: 0,
      transparent: true,
      opacity: opacity
    })
    const platform = new THREE.Mesh(platformGeometry, platformMaterial)
    platform.position.y = 0.5 // 将平台上移到中心点
    platform.castShadow = true
    platform.receiveShadow = true

    // 创建描边
    const edgesGeometry = new THREE.EdgesGeometry(platformGeometry)
    const edgesMaterial = new THREE.LineBasicMaterial({ 
      color: 0x000000,
      linewidth: 2
    })
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial)
    edges.position.y = 0.5 // 与平台位置相同
    
    // 将平台和描边添加到组中
    this.mesh.add(platform)
    this.mesh.add(edges)

    // 创建碰撞边界
    this.boundingBox = new THREE.Box3()
    this.updateBoundingBox()

    // 创建碰撞边界可视化
    this.boundingBoxHelper = new THREE.Box3Helper(this.boundingBox, new THREE.Color(0x00ff00))
  }

  // 更新碰撞边界
  private updateBoundingBox(): void {
    // 获取平台的世界位置
    const worldPosition = this.mesh.position.clone()
    
    // 平台的尺寸，x和z在2到3之间随机浮动
    const sizeX = this.isStart ? 2.5 : 2 + Math.random();
    const sizeZ = this.isStart ? 2.5 : 2 + Math.random();
    const size = new THREE.Vector3(sizeX, 1, sizeZ);
    
    // 设置边界框的最小点和最大点
    this.boundingBox.min.set(
      worldPosition.x - size.x/2,
      worldPosition.y,
      worldPosition.z - size.z/2
    )
    this.boundingBox.max.set(
      worldPosition.x + size.x/2,
      worldPosition.y + size.y,
      worldPosition.z + size.z/2
    )
  }

  // 获取碰撞边界
  public getBoundingBox(): THREE.Box3 {
    this.updateBoundingBox()
    return this.boundingBox
  }

  // 设置平台位置
  public setPosition(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z)
    this.updateBoundingBox()
  }

  // 获取平台网格
  public getMesh(): THREE.Group {
    return this.mesh
  }

  // 获取平台位置
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone()
  }

  // 获取平台尺寸
  public getSize(): THREE.Vector3 {
    const box = new THREE.Box3().setFromObject(this.mesh)
    return box.getSize(new THREE.Vector3())
  }

  // 开始下落动画
  public startFalling(): void {
    this.isFalling = true
    this.velocity = this.INITIAL_VELOCITY
  }

  // 更新下落动画
  public update(deltaTime: number): void {
    if (!this.isFalling) return

    // 应用重力
    this.velocity += this.GRAVITY * deltaTime

    // 更新位置
    const newY = this.mesh.position.y + this.velocity * deltaTime

    // 检查是否接触地面
    if (newY <= 0) {
      // 弹跳效果
      if (Math.abs(this.velocity) > this.BOUNCE_THRESHOLD) {
        this.velocity = -this.velocity * this.BOUNCE_FACTOR
        this.mesh.position.y = 0
        
        // 移除在第一次接触地面时触发回调的代码
        // 不再在这里触发水波纹动画
      } else {
        // 停止弹跳
        this.mesh.position.y = 0
        this.isFalling = false
        this.velocity = 0
        
        // 弹跳完全结束时才触发回调
        if (this.onFirstGroundContact) {
          this.onFirstGroundContact()
        }
      }
    } else {
      this.mesh.position.y = newY
    }

    // 更新碰撞边界
    this.updateBoundingBox()
  }

  // 检查是否正在下落
  public isStillFalling(): boolean {
    return this.isFalling
  }

  // 停止平台下落
  public stopFalling(): void {
    this.isFalling = false
    this.velocity = 0
    // 确保平台不会低于地面
    if (this.mesh.position.y < 0) {
      this.mesh.position.y = 0
    }
    // 更新碰撞边界
    this.updateBoundingBox()
  }

  // 检查一个点是否在平台上
  public isPointOnPlatform(point: THREE.Vector3): boolean {
    const platformPos = this.getPosition()
    const size = this.getSize()
    
    // 计算平台的边界
    const halfWidth = size.x / 2
    const halfDepth = size.z / 2
    
    // 减小容错距离从0.4到0.15单位，使游戏更难
    const tolerance = 0.15
    
    // 只检查x和z坐标是否在平台范围内（添加容错）
    const isOnPlatform = (
      point.x >= platformPos.x - halfWidth - tolerance &&
      point.x <= platformPos.x + halfWidth + tolerance &&
      point.z >= platformPos.z - halfDepth - tolerance &&
      point.z <= platformPos.z + halfDepth + tolerance
    )
    
    // 添加细节日志，但仅当判断结果为false且接近平台时才输出
    if (!isOnPlatform) {
      const margin = 0.2 // 额外的边距检查
      const isClose = (
        point.x >= platformPos.x - halfWidth - margin &&
        point.x <= platformPos.x + halfWidth + margin &&
        point.z >= platformPos.z - halfDepth - margin &&
        point.z <= platformPos.z + halfDepth + margin
      )
      
      if (isClose) {
        console.log('--- 边界接近 ---')
        console.log(`检查点: x=${point.x.toFixed(2)}, z=${point.z.toFixed(2)}`)
        console.log(`平台中心: x=${platformPos.x.toFixed(2)}, z=${platformPos.z.toFixed(2)}`)
        console.log(`平台尺寸: 宽=${size.x.toFixed(2)}, 深=${size.z.toFixed(2)}`)
        console.log(`平台边界: x范围[${(platformPos.x - halfWidth).toFixed(2)}, ${(platformPos.x + halfWidth).toFixed(2)}], z范围[${(platformPos.z - halfDepth).toFixed(2)}, ${(platformPos.z + halfDepth).toFixed(2)}]`)
        console.log(`容错后边界: x范围[${(platformPos.x - halfWidth - tolerance).toFixed(2)}, ${(platformPos.x + halfWidth + tolerance).toFixed(2)}], z范围[${(platformPos.z - halfDepth - tolerance).toFixed(2)}, ${(platformPos.z + halfDepth + tolerance).toFixed(2)}]`)
        console.log(`x边界检查: ${point.x >= platformPos.x - halfWidth - tolerance ? '通过' : '失败'} && ${point.x <= platformPos.x + halfWidth + tolerance ? '通过' : '失败'}`)
        console.log(`z边界检查: ${point.z >= platformPos.z - halfDepth - tolerance ? '通过' : '失败'} && ${point.z <= platformPos.z + halfDepth + tolerance ? '通过' : '失败'}`)
        console.log('---------------')
      }
    }
    
    return isOnPlatform
  }

  // 获取碰撞边界可视化助手
  public getBoundingBoxHelper(): THREE.Box3Helper {
    return this.boundingBoxHelper
  }

  // 设置第一次接触地面的回调
  public setOnFirstGroundContact(callback: () => void): void {
    this.onFirstGroundContact = callback
    this.hasContactedGround = false // 重置标记
  }
} 