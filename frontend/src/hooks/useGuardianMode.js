import { useState, useEffect, useRef, useCallback } from 'react'
import { useSafety } from '../context/SafetyContext'

// Haversine distance between two GPS points (returns km)
function haversineDistance(loc1, loc2) {
  const R = 6371
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180
  const dLng = (loc2.lng - loc1.lng) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Speed in km/h from two location points with timestamps
function calculateSpeed(loc1, loc2) {
  const dist = haversineDistance(loc1, loc2)
  const timeHours = (loc2.timestamp - loc1.timestamp) / 3600000
  return timeHours > 0 ? dist / timeHours : 0
}

// Get average speed from recent location history
function getRecentSpeeds(history, count = 5) {
  if (history.length < 2) return []
  const speeds = []
  const start = Math.max(0, history.length - count - 1)
  for (let i = start; i < history.length - 1; i++) {
    speeds.push(calculateSpeed(history[i], history[i + 1]))
  }
  return speeds
}

// Play a beep using Web Audio API
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gain.gain.value = 0.3
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.3)
    setTimeout(() => ctx.close(), 500)
  } catch {}
}

const SPEED_DROP_RATIO = 0.5
const MIN_SPEED_KMH = 1
const ALERT_DURATION_MS = 60000
const BEEP_INTERVAL_MS = 20000

export default function useGuardianMode() {
  const {
    guardianMode,
    safetyScore,
    locationHistory,
    isInDangerZone,
    triggerEmergency,
  } = useSafety()

  // States: idle | danger_zone | alert | emergency
  const [guardianState, setGuardianState] = useState('idle')
  const [timeRemaining, setTimeRemaining] = useState(0)

  const baselineSpeedRef = useRef(0)
  const alertStartRef = useRef(null)
  const beepTimerRef = useRef(null)
  const countdownTimerRef = useRef(null)
  const beepCountRef = useRef(0)
  const emergencyTriggeredRef = useRef(false)

  // Calculate current speed from last 2 location points
  const getCurrentSpeed = useCallback(() => {
    if (locationHistory.length < 2) return 0
    const len = locationHistory.length
    return calculateSpeed(locationHistory[len - 2], locationHistory[len - 1])
  }, [locationHistory])

  // Cleanup all timers
  const clearTimers = useCallback(() => {
    if (beepTimerRef.current) {
      clearInterval(beepTimerRef.current)
      beepTimerRef.current = null
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    beepCountRef.current = 0
  }, [])

  // Start beeping + countdown
  const startAlertSequence = useCallback(() => {
    alertStartRef.current = Date.now()
    setTimeRemaining(60)
    beepCountRef.current = 0

    // Immediate first beep
    playBeep()
    beepCountRef.current = 1

    // Beep every 20 seconds (2 more beeps at 20s and 40s)
    beepTimerRef.current = setInterval(() => {
      if (beepCountRef.current < 3) {
        playBeep()
        beepCountRef.current++
      }
      if (beepCountRef.current >= 3) {
        clearInterval(beepTimerRef.current)
        beepTimerRef.current = null
      }
    }, BEEP_INTERVAL_MS)

    // Countdown timer (updates every second)
    countdownTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - alertStartRef.current
      const remaining = Math.max(0, Math.ceil((ALERT_DURATION_MS - elapsed) / 1000))
      setTimeRemaining(remaining)
    }, 1000)
  }, [])

  // User clicks "I'm OK"
  const dismissAlert = useCallback(() => {
    clearTimers()
    setGuardianState('danger_zone')
    setTimeRemaining(0)
  }, [clearTimers])

  // Reset everything
  const resetGuardian = useCallback(() => {
    clearTimers()
    setGuardianState('idle')
    setTimeRemaining(0)
    baselineSpeedRef.current = 0
    emergencyTriggeredRef.current = false
  }, [clearTimers])

  // Main state machine
  useEffect(() => {
    if (!guardianMode) {
      if (guardianState !== 'idle') resetGuardian()
      return
    }

    const currentSpeed = getCurrentSpeed()

    // IDLE → DANGER_ZONE
    if (guardianState === 'idle' && isInDangerZone) {
      const speeds = getRecentSpeeds(locationHistory)
      const avgSpeed = speeds.length > 0
        ? speeds.reduce((a, b) => a + b, 0) / speeds.length
        : 5 // default baseline if no history
      baselineSpeedRef.current = Math.max(avgSpeed, 2) // minimum 2 km/h baseline
      setGuardianState('danger_zone')
      return
    }

    // DANGER_ZONE → check transitions
    if (guardianState === 'danger_zone') {
      // Left danger zone
      if (!isInDangerZone) {
        resetGuardian()
        return
      }
      // Speed dropped
      const baseline = baselineSpeedRef.current
      if (currentSpeed < baseline * SPEED_DROP_RATIO || currentSpeed < MIN_SPEED_KMH) {
        setGuardianState('alert')
        startAlertSequence()
      }
      return
    }

    // ALERT → check transitions
    if (guardianState === 'alert') {
      // Left danger zone
      if (!isInDangerZone) {
        clearTimers()
        resetGuardian()
        return
      }

      // Speed restored
      const baseline = baselineSpeedRef.current
      if (currentSpeed >= baseline * SPEED_DROP_RATIO && currentSpeed > MIN_SPEED_KMH) {
        clearTimers()
        setGuardianState('danger_zone')
        setTimeRemaining(0)
        return
      }

      // Check if 60 seconds elapsed
      if (alertStartRef.current && Date.now() - alertStartRef.current >= ALERT_DURATION_MS) {
        if (!emergencyTriggeredRef.current) {
          emergencyTriggeredRef.current = true
          clearTimers()
          setGuardianState('emergency')
          setTimeRemaining(0)
          triggerEmergency()
        }
      }
    }
  }, [guardianMode, safetyScore, locationHistory, isInDangerZone, guardianState, getCurrentSpeed, resetGuardian, clearTimers, startAlertSequence, triggerEmergency])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  return {
    guardianState,
    timeRemaining,
    dismissAlert,
    isInDangerZone: guardianMode && isInDangerZone,
  }
}
