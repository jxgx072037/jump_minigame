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
  private readonly JUMP_SPEED: number = 7.5 // 固定跳跃速度（单位：米/秒）
  private jumpDuration: number = 0 // 跳跃时长将根据距离动态计算
  private readonly JUMP_HEIGHT_RATIO: number = 5 // 跳跃高度与距离的比例 (增加高度使曲线更像半圆)
  private onJumpComplete?: (success: boolean) => void
  private currentPlatform?: Platform
  private boundingBox: THREE.Box3
  private boundingBoxHelper: THREE.Box3Helper
  private platforms: Platform[] = []
  private isFalling: boolean = false
  private fallProgress: number = 0
  private fallDuration: number = 0.5 // 倒下动画持续时间（秒）
  private fallDirection: THREE.Vector3 = new THREE.Vector3()
  private fallStartY: number = 0
  
  // 添加翻转动画相关属性
  private isFlipping: boolean = false
  private flipProgress: number = 0
  private flipStartTime: number = 0
  private flipDuration: number = 1 // 翻转动画持续时间（秒）
  private flipAxis: THREE.Vector3 = new THREE.Vector3(1, 0, 0) // 默认绕X轴翻转
  private initialRotation: THREE.Quaternion = new THREE.Quaternion()

  // 添加自定义模型属性
  private customModel: THREE.Object3D | null = null

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
    // 创建新的边界盒
    this.boundingBox = new THREE.Box3();
    
    if (this.customModel) {
      // 如果有自定义模型，使用自定义模型的边界
      this.boundingBox.setFromObject(this.mesh);
      
      // 确保边界盒有一定的高度和宽度
      const size = new THREE.Vector3();
      this.boundingBox.getSize(size);
      
      // 获取边界盒的中心点
      const center = new THREE.Vector3();
      this.boundingBox.getCenter(center);
      
      // 如果边界盒太小，设置一个最小尺寸
      const minSize = 0.5;
      if (size.x < minSize || size.y < minSize || size.z < minSize) {
        console.log('边界盒太小，设置最小尺寸');
        this.boundingBox.set(
          new THREE.Vector3(center.x - minSize/2, center.y - minSize/2, center.z - minSize/2),
          new THREE.Vector3(center.x + minSize/2, center.y + minSize/2, center.z + minSize/2)
        );
      }
      
      // 打印边界盒详细信息
      console.log('自定义模型边界盒详情:', {
        min: {
          x: this.boundingBox.min.x.toFixed(2),
          y: this.boundingBox.min.y.toFixed(2),
          z: this.boundingBox.min.z.toFixed(2)
        },
        max: {
          x: this.boundingBox.max.x.toFixed(2),
          y: this.boundingBox.max.y.toFixed(2),
          z: this.boundingBox.max.z.toFixed(2)
        },
        center: {
          x: center.x.toFixed(2),
          y: center.y.toFixed(2),
          z: center.z.toFixed(2)
        },
        size: {
          x: size.x.toFixed(2),
          y: size.y.toFixed(2),
          z: size.z.toFixed(2)
        }
      });
    } else {
      // 使用默认棋子的边界
      // 计算身体的边界
      const bodyBoundingBox = new THREE.Box3().setFromObject(this.body);
      this.boundingBox.union(bodyBoundingBox);
      
      // 计算悬浮球的边界
      const ballBoundingBox = new THREE.Box3().setFromObject(this.floatingBall);
      this.boundingBox.union(ballBoundingBox);
      
      // 打印默认棋子边界盒信息
      console.log('默认棋子边界盒详情:', {
        min: {
          x: this.boundingBox.min.x.toFixed(2),
          y: this.boundingBox.min.y.toFixed(2),
          z: this.boundingBox.min.z.toFixed(2)
        },
        max: {
          x: this.boundingBox.max.x.toFixed(2),
          y: this.boundingBox.max.y.toFixed(2),
          z: this.boundingBox.max.z.toFixed(2)
        }
      });
    }
    
    // 更新边界盒辅助对象
    if (this.boundingBoxHelper) {
      this.boundingBoxHelper.box = this.boundingBox;
    } else {
      this.boundingBoxHelper = new THREE.Box3Helper(this.boundingBox, 0xffff00);
    }
    
    // 打印边界盒信息
    const size = new THREE.Vector3();
    this.boundingBox.getSize(size);
    console.log('更新边界盒，尺寸:', size);
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
    // 如果使用自定义模型，不需要更新悬浮球动画
    if (this.customModel) {
      // 只更新自定义模型的动画
      if (this.isJumping || this.isFalling) {
        // 已有的跳跃和下落逻辑保持不变
      }
      return;
    }
    
    // 原有的更新逻辑
    this.ballAnimationTime += deltaTime
    const floatingOffset = Math.sin(this.ballAnimationTime * 2) * 0.1
    this.floatingBall.position.y = 1.6 + this.initialBallHeight + floatingOffset

    if (this.isFalling) {
      this.fallProgress += deltaTime / this.fallDuration
      if (this.fallProgress >= 1) {
        this.fallProgress = 1
        this.isFalling = false
      }
      
      // 设置精确的90度旋转角度
      const angle = (Math.PI / 2) * this.fallProgress
      
      // 根据失败方向设置旋转轴
      // 计算垂直于失败方向的旋转轴
      const rotationAxis = new THREE.Vector3(this.fallDirection.z, 0, -this.fallDirection.x)
      rotationAxis.normalize()
      
      // 应用旋转
      this.mesh.quaternion.setFromAxisAngle(rotationAxis, angle)
      
      // 计算高度下降
      // 从平台高度1逐渐降低到地面高度0
      const currentY = Math.max(0, this.fallStartY * (1 - this.fallProgress))
      this.mesh.position.y = currentY
    }

    if (this.isJumping) {
      this.jumpProgress += deltaTime / this.jumpDuration
      
      // 每隔一段时间记录跳跃进度
      if (Math.floor(this.jumpProgress * 10) % 2 === 0) {
        console.log('[DEBUG] 跳跃进度:', this.jumpProgress.toFixed(2));
      }
      
      if (this.jumpProgress >= 1) {
        this.jumpProgress = 1
        this.isJumping = false
        this.isFlipping = false // 确保翻转动画结束
        console.log('[DEBUG] 跳跃完成');
        
        // 重置旋转，确保棋子回到正常姿态
        this.mesh.rotation.x = 0;
        this.mesh.rotation.z = 0;
        
        // 获取目标位置的XZ坐标
        const targetPos = this.jumpTargetPosition.clone()
        // 保留Y坐标为1，保证在平台高度上进行检测
        targetPos.y = 1
        
        // 将玩家移动到目标位置
        this.setPosition(targetPos.x, targetPos.y, targetPos.z)
        console.log('[DEBUG] 设置最终位置:', targetPos);
        
        // 获取最新的玩家位置（可能与目标位置略有不同）
        const playerPos = this.getPosition()
        console.log('[DEBUG] 实际最终位置:', playerPos);
        
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
            console.log('[DEBUG] 跳跃判定: 成功')
            this.onJumpComplete(true)
          }
        } else {
          // 如果不在任何平台范围内，y=0（掉落）
          this.setPosition(playerPos.x, 0, playerPos.z)
          // 跳跃失败
          if (this.onJumpComplete) {
            console.log('[DEBUG] 跳跃判定: 失败')
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
      const height = 4 //跳跃高度固定为3
      
      // 水平线性插值
      const currentX = p0.x + (p1.x - p0.x) * t
      const currentZ = p0.z + (p1.z - p0.z) * t
      
      // 修改垂直抛物线公式，使其更接近半圆形
      // 使用正弦函数来创建更接近半圆的曲线
      const currentY = 1 + height * Math.sin(Math.PI * t)
      
      // 每隔一段时间记录位置
      if (Math.floor(this.jumpProgress * 10) % 2 === 0) {
        console.log('[DEBUG] 跳跃轨迹:', {
          progress: t.toFixed(2),
          x: currentX.toFixed(2),
          y: currentY.toFixed(2),
          z: currentZ.toFixed(2),
          height: height.toFixed(2)
        });
      }

      this.mesh.position.set(currentX, currentY, currentZ)

      // 计算移动方向
      const moveDirection = new THREE.Vector3(p1.x - p0.x, 0, p1.z - p0.z).normalize();
      
      // 计算朝向
      if (t < 1) {
        const direction = new THREE.Vector2(p1.x - p0.x, p1.z - p0.z).angle()
        this.mesh.rotation.y = direction
      }
      
      // 修改翻转动画，从跳跃开始就启动，在落地时正好完成一周
      // 翻转进度与跳跃进度一致，从0到1
      const flipT = t;
      
      // 执行360度翻转
      const flipAngle = flipT * Math.PI * 2; // 0到2π（360度）
      
      // 修改翻转轴，使其垂直于移动方向，但始终保持前空翻效果
      // 确定主要移动方向（X轴或Z轴）
      const absX = Math.abs(moveDirection.x);
      const absZ = Math.abs(moveDirection.z);
      
      // 创建一个四元数来存储旋转
      const flipQuaternion = new THREE.Quaternion();
      
      // 保存原始Y轴旋转（朝向）
      const originalRotationY = this.mesh.rotation.y;
      
      // 根据主要移动方向确定翻转轴
      if (absX > absZ) {
        // 主要沿X轴移动，绕Z轴的垂直轴翻转（即绕Y轴的垂直轴）
        // 如果是向-X方向移动，需要反向翻转
        const rotationAxis = new THREE.Vector3(0, 0, Math.sign(moveDirection.x));
        flipQuaternion.setFromAxisAngle(rotationAxis, flipAngle);
        
        if (Math.floor(this.jumpProgress * 10) % 2 === 0) {
          console.log('[DEBUG] X轴方向前空翻, 方向:', Math.sign(moveDirection.x) > 0 ? '正X' : '负X');
        }
      } else {
        // 主要沿Z轴移动，绕X轴的垂直轴翻转
        // 如果是向-Z方向移动，需要反向翻转
        const rotationAxis = new THREE.Vector3(Math.sign(moveDirection.z), 0, 0);
        flipQuaternion.setFromAxisAngle(rotationAxis, flipAngle);
        
        if (Math.floor(this.jumpProgress * 10) % 2 === 0) {
          console.log('[DEBUG] Z轴方向前空翻, 方向:', Math.sign(moveDirection.z) > 0 ? '正Z' : '负Z');
        }
      }
      
      // 应用翻转旋转
      this.mesh.quaternion.copy(flipQuaternion);
      
      // 恢复原始Y轴旋转（朝向）
      this.mesh.rotation.y = originalRotationY;
      
      if (Math.floor(this.jumpProgress * 10) % 2 === 0) {
        console.log('[DEBUG] 执行翻转:', {
          progress: flipT.toFixed(2),
          angle: (flipAngle * 180 / Math.PI).toFixed(2) + '度'
        });
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
    if (this.customModel) {
      // 对自定义模型应用Y轴缩放
      this.mesh.scale.y = scale;
    } else {
      // 原始棋子模型的缩放
      this.body.scale.y = 1;
      this.floatingBall.position.y = 1.6 + this.initialBallHeight * scale;
      this.floatingBall.scale.y = scale;
    }
    this.updateBoundingBox();
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
    
    console.log('[DEBUG] Player.jump 被调用，力度:', power);
    
    this.isCharging = false
    this.isJumping = true
    this.jumpProgress = 0
    this.jumpPower = power
    this.onJumpComplete = onComplete
    
    const currentPos = this.getPosition()
    this.jumpStartPosition.copy(currentPos)
    this.jumpTargetPosition.copy(targetPosition)
    
    const jumpDistance = this.jumpStartPosition.distanceTo(this.jumpTargetPosition)
    this.jumpDuration = 0.6
    
    // 重置翻转状态
    this.isFlipping = false
    this.flipProgress = 0
    
    console.log('[DEBUG] 跳跃参数:', {
      jumpPower: this.jumpPower,
      jumpStartPosition: this.jumpStartPosition,
      jumpTargetPosition: this.jumpTargetPosition,
      jumpDistance,
      jumpDuration: this.jumpDuration,
      jumpSpeed: this.JUMP_SPEED
    });
    
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
    // 保存起始高度，用于计算下落高度
    this.fallStartY = this.mesh.position.y
    
    // 延长倒下动画持续时间，使其更加平滑
    this.fallDuration = 0.8
    
    // 重置之前的旋转，保留Y轴旋转角度（朝向）
    this.mesh.rotation.set(0, this.mesh.rotation.y, 0)
  }

  // 获取当前自定义模型
  public getCustomModel(): THREE.Object3D | null {
    return this.customModel;
  }

  // 设置自定义3D模型
  public setCustomModel(model: THREE.Object3D): void {
    try {
      // 保存当前位置和旋转
      const currentPosition = this.mesh.position.clone();
      const currentRotation = this.mesh.rotation.clone();
      const currentScale = this.mesh.scale.clone();
      
      // 移除旧模型的所有子对象
      while (this.mesh.children.length > 0) {
        this.mesh.remove(this.mesh.children[0]);
      }
      
      // 清除之前的自定义模型引用
      if (this.customModel) {
        // 如果之前有自定义模型，确保它不再被引用
        this.customModel = null;
      }
      
      // 保存新的自定义模型引用
      this.customModel = model;
      
      // 如果模型是Group类型，我们将其子对象添加到当前mesh
      if (model instanceof THREE.Group) {
        // 复制所有子对象到当前mesh
        model.children.forEach(child => {
          this.mesh.add(child.clone());
        });
      } else {
        // 如果不是Group，直接添加整个模型
        this.mesh.add(model.clone());
      }
      
      // 恢复位置和旋转，但保留模型的 Y 轴位置
      const originalY = model.position.y;
      this.mesh.position.set(currentPosition.x, originalY, currentPosition.z);
      this.mesh.rotation.copy(currentRotation);
      this.mesh.scale.copy(currentScale);
      
      // 确保模型可见
      this.mesh.visible = true;
      
      // 更新碰撞盒
      this.updateBoundingBox();
      
      // 重置状态
      this.isJumping = false;
      this.isCharging = false;
      this.isFalling = false;
      this.isFlipping = false;
      
      console.log('棋子模型已替换为自定义3D模型，子对象数量:', this.mesh.children.length);
    } catch (error) {
      console.error('设置自定义模型时出错:', error);
    }
  }
} 