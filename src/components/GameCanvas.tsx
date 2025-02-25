import { useEffect, useRef } from 'react'
import { GameEngine } from '../game/engine'
import styles from './GameCanvas.module.css'

export const GameCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<GameEngine | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // 初始化游戏引擎
    engineRef.current = new GameEngine(containerRef.current)

    // 清理函数
    return () => {
      const container = containerRef.current
      if (container && engineRef.current) {
        container.removeChild(engineRef.current.getRenderer().domElement)
      }
    }
  }, [])

  return <div ref={containerRef} className={styles.gameCanvas} />
} 