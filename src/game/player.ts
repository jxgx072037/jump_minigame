import * as THREE from 'three'
import { Platform } from './platform'

export class Player {
  private mesh: THREE.Group
  private body: THREE.Mesh
  private floatingBall: THREE.Mesh
  private initialBallHeight: number = 0.3 // 悬浮球的初始高度偏移
  private ballAnimationTime: number = 0
  
  // 跳跃相关属性
  private isJumping: boolean = false
  private isCharging: boolean = false
  private jumpStartPosition: THREE.Vector3 = new THREE.Vector3()
  private jumpTargetPosition: THREE.Vector3 = new THREE.Vector3()
  private jumpProgress: number = 0
  private jumpPower: number = 0
  private readonly JUMP_SPEED: number = 15 // 固定跳跃速度（单位：米/秒）
  private jumpDuration: number = 0 // 跳跃时长将根据距离动态计算
  private readonly JUMP_HEIGHT_RATIO: number = 0.225 // 跳跃高度与距离的比例
  private onJumpComplete?: (success: boolean) => void
  private currentPlatform?: Platform
  private boundingBox: THREE.Box3
  private boundingBoxHelper: THREE.Box3Helper
  private platforms: Platform[] = []
  private isFalling: boolean = false
  private fallProgress: number = 0
  private fallDuration: number = 0.5 // 倒下动画持续时间（秒）
  private fallDirection: THREE.Vector3 = new THREE.Vector3()

  constructor() {
    this.mesh = new THREE.Group()

    // 创建身体（圆柱体）
    const bodyGeometry = new THREE.CylinderGeometry(0.25, 0.4, 1.2, 32)
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0x1a237e, // 深蓝色
      shininess: 60, // 增加光泽度
      specular: 0x333333, // 添加高光颜色
      emissive: 0x000000, // 自发光颜色（黑色表示无自发光）
      flatShading: false // 平滑着色
    })
    this.body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    this.body.position.y = 0.6 // 将身体上移半个高度，使底部对齐原点
    this.body.castShadow = true // 添加投射阴影

    // 创建悬浮小球
    const floatingBallGeometry = new THREE.SphereGeometry(0.3, 32, 32)
    const floatingBallMaterial = new THREE.MeshPhongMaterial({
      color: 0x1a237e,
      shininess: 80, // 球体的光泽度更高
      specular: 0x444444, // 更明显的高光
      emissive: 0x000000,
      flatShading: false
    })
    this.floatingBall = new THREE.Mesh(floatingBallGeometry, floatingBallMaterial)
    this.floatingBall.position.y = 1.6 + this.initialBallHeight // 调整悬浮球位置
    this.floatingBall.castShadow = true

    // 将部件添加到组中
    this.mesh.add(this.body)
    this.mesh.add(this.floatingBall)

    // 整体向上移动以使底部与平台对齐
    this.mesh.position.y = 1 // 改为从y=1开始（站在平台上）

    // 创建碰撞边界
    this.boundingBox = new THREE.Box3()
    this.updateBoundingBox()

    // 创建碰撞边界可视化
    this.boundingBoxHelper = new THREE.Box3Helper(this.boundingBox, new THREE.Color(0xff0000))
  }

  // 更新碰撞边界
  private updateBoundingBox(): void {
    // 获取body的世界位置
    const worldPosition = new THREE.Vector3()
    this.body.getWorldPosition(worldPosition)
    
    // 获取body的当前缩放
    const scale = this.body.scale.y
    
    // 计算边界框的大小（考虑缩放）
    const size = new THREE.Vector3(0.8, 1.2 * scale, 0.8)
    
    // 设置边界框的最小点和最大点
    this.boundingBox.min.set(
      worldPosition.x - size.x/2,
      worldPosition.y - size.y/2,
      worldPosition.z - size.z/2
    )
    this.boundingBox.max.set(
      worldPosition.x + size.x/2,
      worldPosition.y + size.y/2,
      worldPosition.z + size.z/2
    )
  }

  // 获取碰撞边界
  public getBoundingBox(): THREE.Box3 {
    this.updateBoundingBox()
    return this.boundingBox
  }

  // 获取碰撞边界可视化助手
  public getBoundingBoxHelper(): THREE.Box3Helper {
    return this.boundingBoxHelper
  }

  // 更新悬浮球动画
  public update(deltaTime: number): void {
    this.ballAnimationTime += deltaTime
    const floatingOffset = Math.sin(this.ballAnimationTime * 2) * 0.1
    this.floatingBall.position.y = 1.6 + this.initialBallHeight + floatingOffset

    if (this.isFalling) {
      this.fallProgress += deltaTime / this.fallDuration
      if (this.fallProgress >= 1) {
        this.fallProgress = 1
        this.isFalling = false
      }
      
      // 修改为135度的倾倒角度（3π/4）而不是90度
      const angle = (Math.PI * 3 / 4) * this.fallProgress
      
      // 根据跳跃方向设置旋转轴（修改为相反方向）
      const rotationAxis = new THREE.Vector3(this.fallDirection.z, 0, -this.fallDirection.x)
      rotationAxis.normalize()
      
      // 应用旋转
      this.mesh.quaternion.setFromAxisAngle(rotationAxis, angle)
    }

    if (this.isJumping) {
      this.jumpProgress += deltaTime / this.jumpDuration
      if (this.jumpProgress >= 1) {
        this.jumpProgress = 1
        this.isJumping = false
        
        // 获取目标位置的XZ坐标
        const targetPos = this.jumpTargetPosition.clone()
        // 保留Y坐标为1，保证在平台高度上进行检测
        targetPos.y = 1
        
        // 将玩家移动到目标位置
        this.setPosition(targetPos.x, targetPos.y, targetPos.z)
        
        // 获取最新的玩家位置（可能与目标位置略有不同）
        const playerPos = this.getPosition()
        
        // 检查是否在任何平台上
        let isOnAnyPlatform = false
        let landedPlatform = null
        for (const platform of this.platforms) {
          if (platform.isPointOnPlatform(playerPos)) {
            isOnAnyPlatform = true
            landedPlatform = platform
            break
          }
        }
        
        // 打印调试信息
        this.printDebugInfo(this.platforms)
        
        if (isOnAnyPlatform) {
          // 如果在任何平台范围内，保持y=1
          // 跳跃成功
          if (this.onJumpComplete) {
            console.log('跳跃判定: 成功')
            this.onJumpComplete(true)
          }
        } else {
          // 如果不在任何平台范围内，y=0（掉落）
          this.setPosition(playerPos.x, 0, playerPos.z)
          // 跳跃失败
          if (this.onJumpComplete) {
            console.log('跳跃判定: 失败')
            this.onJumpComplete(false)
          }
        }
        return
      }

      // 计算当前位置（抛物线轨迹）
      const t = this.jumpProgress
      const p0 = this.jumpStartPosition
      const p1 = this.jumpTargetPosition
      const distance = p1.distanceTo(p0)
      const height = distance * this.JUMP_HEIGHT_RATIO * this.jumpPower

      // 水平线性插值
      const currentX = p0.x + (p1.x - p0.x) * t
      const currentZ = p0.z + (p1.z - p0.z) * t
      
      // 垂直抛物线
      const currentY = height * 4 * (t - t * t) + 1 // 抛物线从y=1开始

      this.mesh.position.set(currentX, currentY, currentZ)

      // 计算朝向
      if (t < 1) {
        const direction = new THREE.Vector2(p1.x - p0.x, p1.z - p0.z).angle()
        this.mesh.rotation.y = direction
      }

      // 更新碰撞边界
      this.updateBoundingBox()
    }
  }

  // 设置位置
  public setPosition(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z)
    this.updateBoundingBox()
  }

  // 获取网格
  public getMesh(): THREE.Group {
    return this.mesh
  }

  // 获取位置
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone()
  }

  // 旋转角色
  public rotate(angle: number): void {
    this.mesh.rotation.y = angle
  }

  // 缩放动画（按压效果）
  public scale(scale: number): void {
    this.body.scale.y = 1
    this.floatingBall.position.y = 1.6 + this.initialBallHeight * scale
    this.floatingBall.scale.y = scale
    this.updateBoundingBox()
  }

  public startCharging(): void {
    if (this.isJumping) return
    this.isCharging = true
    this.scale(0.6)
  }

  public updateCharging(power: number): void {
    if (!this.isCharging) return
    const scale = 1 - (power * 0.4)
    this.scale(scale)
  }

  public jump(
    power: number, 
    targetPosition: THREE.Vector3, 
    platforms: Platform[],
    onComplete?: (success: boolean) => void
  ): void {
    if (this.isJumping) return
    
    this.isCharging = false
    this.isJumping = true
    this.jumpProgress = 0
    this.jumpPower = power
    this.onJumpComplete = onComplete
    
    const currentPos = this.getPosition()
    this.jumpStartPosition.copy(currentPos)
    this.jumpTargetPosition.copy(targetPosition)
    
    const jumpDistance = this.jumpStartPosition.distanceTo(this.jumpTargetPosition)
    this.jumpDuration = jumpDistance / this.JUMP_SPEED
    
    this.scale(1)
    
  }

  // 在跳跃完成时打印位置信息
  private printDebugInfo(platforms: Platform[]): void {
    const playerPos = this.getPosition()
    console.log('--- 调试信息 ---')
    console.log(`棋子位置: x=${playerPos.x.toFixed(2)}, z=${playerPos.z.toFixed(2)}`)
    
    // 打印所有平台的位置信息
    platforms.forEach((platform, index) => {
      const platformPos = platform.getPosition()
      const size = new THREE.Vector3(2.5, 1.0, 2.5) // 平台的固定尺寸
      
      console.log(`平台 ${index} 中心点: x=${platformPos.x.toFixed(2)}, z=${platformPos.z.toFixed(2)}`)
      console.log(`平台 ${index} 边角坐标:`)
      console.log(`  左前: x=${(platformPos.x - size.x/2).toFixed(2)}, z=${(platformPos.z - size.z/2).toFixed(2)}`)
      console.log(`  右前: x=${(platformPos.x + size.x/2).toFixed(2)}, z=${(platformPos.z - size.z/2).toFixed(2)}`)
      console.log(`  左后: x=${(platformPos.x - size.x/2).toFixed(2)}, z=${(platformPos.z + size.z/2).toFixed(2)}`)
      console.log(`  右后: x=${(platformPos.x + size.x/2).toFixed(2)}, z=${(platformPos.z + size.z/2).toFixed(2)}`)
      
      // 计算并打印棋子是否在此平台上的判断结果
      const isOnPlatform = platform.isPointOnPlatform(playerPos)
      console.log(`棋子是否在平台 ${index} 上: ${isOnPlatform ? '是' : '否'}`)
    })
    console.log('---------------')
  }

  // 设置当前平台的引用
  public setCurrentPlatform(platform: Platform): void {
    this.currentPlatform = platform
  }

  // 添加平台到玩家的平台列表
  public addPlatform(platform: Platform): void {
    this.platforms.push(platform)
  }

  // 从玩家的平台列表中移除平台
  public removePlatform(platform: Platform): void {
    const index = this.platforms.indexOf(platform)
    if (index !== -1) {
      this.platforms.splice(index, 1)
    }
  }

  public fallDown(direction: THREE.Vector3): void {
    this.isFalling = true
    this.fallProgress = 0
    this.fallDirection = direction.clone().normalize()
    
    // 重置之前的旋转
    this.mesh.rotation.set(0, this.mesh.rotation.y, 0)
  }
} 