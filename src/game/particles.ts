import * as THREE from 'three'

export class ParticleSystem {
  private scene: THREE.Scene
  private particleSystems: Array<{
    points: THREE.Points,
    velocities: number[],
    lifetime: number
  }> = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  public emit(position: THREE.Vector3): void {
    // 创建粒子几何体
    const geometry = new THREE.BufferGeometry()
    const particleCount = 40 // 增加粒子数量

    // 创建粒子位置数组
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const velocities: number[] = []

    // 初始化粒子
    for (let i = 0; i < particleCount; i++) {
      // 随机位置（在圆柱体底面周围散布）
      const radius = Math.random() * 0.2 // 在0.2单位半径的圆内随机分布
      const angle = Math.random() * Math.PI * 2
      positions[i * 3] = position.x + Math.cos(angle) * radius
      positions[i * 3 + 1] = position.y // 从底面发出
      positions[i * 3 + 2] = position.z + Math.sin(angle) * radius

      // 随机颜色（使用暖色调）
      const color = new THREE.Color().setHSL(0.1 + Math.random() * 0.1, 0.9, 0.6)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      // 随机速度（只在水平面上扩散）
      const spreadAngle = Math.random() * Math.PI * 2
      const speed = 6 + Math.random() * 4 // 增加基础速度
      velocities.push(
        Math.cos(spreadAngle) * speed,     // x方向
        0,                                 // y方向保持不变
        Math.sin(spreadAngle) * speed      // z方向
      )
    }

    // 设置几何体属性
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // 创建材质
    const material = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.85, // 增加不透明度
      blending: THREE.AdditiveBlending
    })

    // 创建粒子系统
    const points = new THREE.Points(geometry, material)
    this.scene.add(points)

    // 添加到活动粒子系统列表
    this.particleSystems.push({
      points,
      velocities,
      lifetime: 0.8 // 缩短生命周期
    })

    // 0.8秒后自动清理
    setTimeout(() => {
      this.scene.remove(points)
      const index = this.particleSystems.findIndex(p => p.points === points)
      if (index !== -1) {
        this.particleSystems.splice(index, 1)
      }
    }, 800)
  }

  public update(deltaTime: number): void {
    // 更新所有活动的粒子系统
    for (const system of this.particleSystems) {
      // 获取位置属性
      const positions = (system.points.geometry as THREE.BufferGeometry)
        .getAttribute('position') as THREE.BufferAttribute

      // 更新每个粒子的位置
      for (let i = 0; i < positions.count; i++) {
        // 更新位置（只在水平面上移动）
        positions.setX(i, positions.getX(i) + system.velocities[i * 3] * deltaTime)
        positions.setZ(i, positions.getZ(i) + system.velocities[i * 3 + 2] * deltaTime)
        // Y轴位置保持不变
      }

      // 标记位置需要更新
      positions.needsUpdate = true

      // 更新生命周期和透明度
      system.lifetime -= deltaTime
      if (system.lifetime > 0) {
        // 使用二次方衰减使透明度变化更自然
        (system.points.material as THREE.PointsMaterial).opacity = 
          0.85 * (system.lifetime * system.lifetime) // 从0.85开始衰减
      }
    }
  }
} 