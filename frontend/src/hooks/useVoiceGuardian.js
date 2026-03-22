import { useState, useRef, useCallback, useEffect } from 'react'

export default function useVoiceGuardian({ onAlert, sensitivity = 0.7 } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [alert, setAlert] = useState(null)
  const [permissionGranted, setPermissionGranted] = useState(false)

  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)
  const volumeHistoryRef = useRef([])
  const alertCooldownRef = useRef(false)

  const LOUD_THRESHOLD = 0.6 * sensitivity + 0.2
  const SILENCE_THRESHOLD = 0.05
  const ACTIVITY_WINDOW = 50
  const SILENCE_WINDOW = 30

  const cleanup = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    analyserRef.current = null
  }, [])

  const triggerAlert = useCallback((type) => {
    if (alertCooldownRef.current) return
    alertCooldownRef.current = true
    setAlert(type)
    onAlert?.(type)
    setTimeout(() => { alertCooldownRef.current = false; setAlert(null) }, 5000)
  }, [onAlert])

  const analyze = useCallback(() => {
    if (!analyserRef.current) return
    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(dataArray)

    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      const val = (dataArray[i] - 128) / 128
      sum += val * val
    }
    const rms = Math.sqrt(sum / dataArray.length)
    const normalizedVolume = Math.min(rms * 3, 1)

    setVolumeLevel(normalizedVolume)

    volumeHistoryRef.current.push(normalizedVolume)
    if (volumeHistoryRef.current.length > 100) volumeHistoryRef.current = volumeHistoryRef.current.slice(-100)

    const history = volumeHistoryRef.current

    if (normalizedVolume > LOUD_THRESHOLD) triggerAlert('loud_sound')

    if (history.length >= ACTIVITY_WINDOW + SILENCE_WINDOW) {
      const activitySlice = history.slice(-(ACTIVITY_WINDOW + SILENCE_WINDOW), -SILENCE_WINDOW)
      const silenceSlice = history.slice(-SILENCE_WINDOW)
      const avgActivity = activitySlice.reduce((a, b) => a + b, 0) / activitySlice.length
      const avgSilence = silenceSlice.reduce((a, b) => a + b, 0) / silenceSlice.length
      if (avgActivity > 0.15 && avgSilence < SILENCE_THRESHOLD) triggerAlert('silence_after_activity')
    }

    animFrameRef.current = requestAnimationFrame(analyze)
  }, [LOUD_THRESHOLD, triggerAlert])

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      })
      streamRef.current = stream
      setPermissionGranted(true)
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyserRef.current = analyser
      setIsListening(true)
      volumeHistoryRef.current = []
      analyze()
    } catch (err) {
      console.error('Microphone access denied:', err)
      setPermissionGranted(false)
    }
  }, [analyze])

  const stopListening = useCallback(() => {
    cleanup()
    setIsListening(false)
    setVolumeLevel(0)
    setAlert(null)
  }, [cleanup])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  return { isListening, startListening, stopListening, volumeLevel, alert, permissionGranted }
}
