import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, AlertCircle, Settings, Shield } from 'lucide-react'
import useVoiceGuardian from '../hooks/useVoiceGuardian'
import { useSafety } from '../context/SafetyContext'

function AudioBars({ volumeLevel, isListening }) {
  const barCount = 20
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const center = barCount / 2
      const distFromCenter = Math.abs(i - center) / center
      const base = isListening ? volumeLevel * (1 - distFromCenter * 0.6) : 0
      const randomFactor = isListening ? 0.3 + Math.random() * 0.7 : 0
      return Math.max(4, base * randomFactor * 32)
    })
  }, [volumeLevel, isListening])

  return (
    <div className="audio-bars" style={{ justifyContent: 'center' }}>
      {bars.map((height, i) => (
        <motion.div
          key={i}
          className="audio-bar"
          animate={{ height }}
          transition={{ duration: 0.1 }}
          style={{
            background: volumeLevel > 0.6 ? '#ef4444' : volumeLevel > 0.3 ? '#f59e0b' : '#00d4ff',
          }}
        />
      ))}
    </div>
  )
}

export default function VoiceGuardianPanel({ expanded = false }) {
  const { triggerEmergency } = useSafety()
  const [sensitivity, setSensitivity] = useState(0.7)
  const [showSettings, setShowSettings] = useState(false)

  const handleAlert = useCallback(
    (type) => {
      console.log('[VoiceGuardian] Alert:', type)
      // Auto-trigger emergency on alert
      // triggerEmergency()
    },
    []
  )

  const { isListening, startListening, stopListening, volumeLevel, alert, permissionGranted } =
    useVoiceGuardian({ onAlert: handleAlert, sensitivity })

  const getStatusInfo = () => {
    if (alert === 'loud_sound')
      return { text: 'Loud Sound Detected!', color: '#ef4444', icon: AlertCircle }
    if (alert === 'silence_after_activity')
      return { text: 'Suspicious Silence Detected', color: '#f59e0b', icon: AlertCircle }
    if (isListening)
      return { text: 'Listening...', color: '#10b981', icon: Volume2 }
    return { text: 'Inactive', color: '#64748b', icon: MicOff }
  }

  const status = getStatusInfo()
  const StatusIcon = status.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
      style={{ padding: 20 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(0, 212, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={18} color="#00d4ff" />
          </div>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700 }}>Voice Guardian</h4>
            <span style={{ fontSize: 11, color: '#64748b' }}>AI audio monitoring</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSettings(!showSettings)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Settings size={14} color="#94a3b8" />
          </motion.button>

          <div
            className={`toggle-switch ${isListening ? 'active' : ''}`}
            onClick={isListening ? stopListening : startListening}
          />
        </div>
      </div>

      {/* Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          padding: '8px 12px',
          borderRadius: 10,
          background: `${status.color}10`,
          border: `1px solid ${status.color}20`,
        }}
      >
        <StatusIcon size={14} color={status.color} />
        <span style={{ fontSize: 12, fontWeight: 600, color: status.color }}>{status.text}</span>
        {isListening && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="status-indicator green"
            style={{ marginLeft: 'auto' }}
          />
        )}
      </div>

      {/* Waveform */}
      {expanded && (
        <div
          style={{
            padding: '16px 0',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.2)',
            marginBottom: 16,
          }}
        >
          <AudioBars volumeLevel={volumeLevel} isListening={isListening} />
        </div>
      )}

      {/* Volume level */}
      {isListening && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
            <span>Volume Level</span>
            <span>{Math.round(volumeLevel * 100)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${volumeLevel * 100}%`,
                background: volumeLevel > 0.6 ? '#ef4444' : volumeLevel > 0.3 ? '#f59e0b' : '#00d4ff',
                transition: 'width 0.1s, background 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {/* Alert */}
      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <AlertCircle size={18} color="#ef4444" />
            </motion.div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>Alert Detected</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {alert === 'loud_sound' ? 'A loud sound was detected nearby' : 'Unusual silence after activity'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="divider" />
            <div style={{ paddingTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Sensitivity</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#00d4ff' }}>
                  {Math.round(sensitivity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                style={{
                  width: '100%',
                  appearance: 'none',
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permission notice */}
      {!isListening && !permissionGranted && (
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 8, lineHeight: 1.4 }}>
          Enable to monitor audio for safety alerts. Microphone permission required.
        </p>
      )}
    </motion.div>
  )
}
