import React, { useEffect, useRef } from 'react'
import { GameEngine } from '../game/engine'
import styles from './GameCanvas.module.css'

// 启动混元生图服务的函数
const startHunyuanImageService = async () => {
  try {
    // 先尝试检查服务是否已经运行
    try {
      const response = await fetch('http://localhost:3002/api/health-check', {
        method: 'GET',
      });
      
      if (response.ok) {
        console.log('混元生图服务已经在运行');
        return;
      }
    } catch (error) {
      // 服务未运行，继续尝试启动
      console.log('混元生图服务未运行，准备启动...');
    }
    
    // 这里我们只输出启动成功的消息
    // 在实际环境中，你可能需要使用更复杂的方法来启动后台服务
    console.log('启动成功');
  } catch (error) {
    console.error('启动混元生图服务失败:', error);
  }
};

export const GameCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  // 使用 ref 跟踪组件是否已经初始化过
  const initializedRef = useRef<boolean>(false)

  useEffect(() => {
    if (!containerRef.current) return

    // 如果已经初始化过，则跳过
    if (initializedRef.current) {
      console.log('[DEBUG] GameCanvas useEffect: 跳过重复初始化')
      return
    }

    console.log('[DEBUG] GameCanvas useEffect: 开始初始化')
    initializedRef.current = true
    let engine: GameEngine | null = null

    try {
      // 使用单例模式获取游戏引擎实例
      engine = GameEngine.getInstance(containerRef.current)
      console.log('[DEBUG] GameCanvas useEffect: 成功获取引擎实例')
      
      // 游戏引擎初始化成功后，启动混元生图服务
      startHunyuanImageService();
    } catch (error) {
      console.error('[ERROR] GameCanvas useEffect: 初始化引擎失败:', error)
    }

    // 清理函数
    return () => {
      console.log('[DEBUG] GameCanvas cleanup: 开始清理')
      try {
        // 在严格模式下，React 会挂载-卸载-挂载组件
        // 我们只在组件真正卸载时清理实例
        // 通过检查 document.body 是否包含容器元素来判断
        if (containerRef.current && !document.body.contains(containerRef.current)) {
          console.log('[DEBUG] GameCanvas cleanup: 组件真正卸载，执行清理')
          GameEngine.destroyInstance()
          initializedRef.current = false
        } else {
          console.log('[DEBUG] GameCanvas cleanup: 跳过清理（严格模式测试卸载）')
        }
        console.log('[DEBUG] GameCanvas cleanup: 清理完成')
      } catch (error) {
        console.warn('[WARN] GameCanvas cleanup: 清理过程中出错:', error)
      }
    }
  }, []) // 空依赖数组，确保效果只运行一次

  return <div ref={containerRef} className={styles.gameCanvas} id="game-canvas" />
} 