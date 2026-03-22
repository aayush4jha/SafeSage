import { useState, useEffect, useRef, useCallback } from 'react'

export default function useMotionDetection({ enabled = true } = {}) {
  const [isMoving, setIsMoving] = useState(false)
  const [acceleration, setAcceleration] = useState(0)
  const [motionType, setMotionType] = useState('still')
  const [isAnomalous, setIsAnomalous] = useState(false)
  const historyRef = useRef([])
  const lastUpdateRef = useRef(Date.now())

  const classifyMotion = useCallback((magnitude) => {
    if (magnitude < 2) return 'still'
    if (magnitude < 8) return 'walking'
    if (magnitude < 20) return 'running'
    return 'shaking'
  }, [])

  const detectAnomaly = useCallback((history) => {
    if (history.length < 10) return false
    const recent = history.slice(-10)
    const avg = recent.reduce((s, v) => s + v, 0) / recent.length
    const older = history.slice(-20, -10)
    if (older.length < 5) return false
    const olderAvg = older.reduce((s, v) => s + v, 0) / older.length
    if (avg > olderAvg * 3 && avg > 15) return true
    if (olderAvg > 10 && avg < 2) return true
    return false
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleMotion = (event) => {
      const { x, y, z } = event.accelerationIncludingGravity || {}
      if (x == null || y == null || z == null) return
      const now = Date.now()
      if (now - lastUpdateRef.current < 100) return
      lastUpdateRef.current = now
      const magnitude = Math.sqrt(x * x + y * y + z * z) - 9.81
      const absMag = Math.abs(magnitude)
      setAcceleration(absMag)
      setIsMoving(absMag > 2)
      setMotionType(classifyMotion(absMag))
      historyRef.current.push(absMag)
      if (historyRef.current.length > 50) historyRef.current = historyRef.current.slice(-50)
      setIsAnomalous(detectAnomaly(historyRef.current))
    }

    if ('DeviceMotionEvent' in window) {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
          .then((state) => { if (state === 'granted') window.addEventListener('devicemotion', handleMotion) })
          .catch(console.warn)
      } else {
        window.addEventListener('devicemotion', handleMotion)
      }
    }

    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [enabled, classifyMotion, detectAnomaly])

  return { isMoving, acceleration, motionType, isAnomalous }
}
