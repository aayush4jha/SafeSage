import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Radio, MapPin, X, Vibrate, Shield } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'

const HOLD_DURATION = 2000 // 2 seconds to activate

export default function EmergencyButton() {
  const { activeEmergency, triggerEmergency, resolveEmergency, emergencyContacts, userLocation, nearbyPolice } = useSafety()
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const holdTimerRef = useRef(null)
  const startTimeRef = useRef(null)
  const animFrameRef = useRef(null)

  const updateProgress = useCallback(() => {
    if (!startTimeRef.current) return
    const elapsed = Date.now() - startTimeRef.current
    const progress = Math.min(elapsed / HOLD_DURATION, 1)
    setHoldProgress(progress)

    if (progress >= 1) {
      triggerEmergency()
      setIsHolding(false)
      setHoldProgress(0)
      startTimeRef.current = null
      return
    }

    animFrameRef.current = requestAnimationFrame(updateProgress)
  }, [triggerEmergency])

  const handlePointerDown = useCallback(() => {
    if (activeEmergency) return
    setIsHolding(true)
    startTimeRef.current = Date.now()
    animFrameRef.current = requestAnimationFrame(updateProgress)
  }, [activeEmergency, updateProgress])

  const handlePointerUp = useCallback(() => {
    setIsHolding(false)
    setHoldProgress(0)
    startTimeRef.current = null
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  if (activeEmergency) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 950,
          width: 'calc(100% - 40px)',
          maxWidth: 360,
        }}
      >
        <div
          className="glass-card"
          style={{
            padding: 20,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'rgba(239, 68, 68, 0.08)',
          }}
        >
          {/* Active emergency header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 12px #ef4444',
                }}
              />
              <span style={{ fontSize: 15, fontWeight: 800, color: '#ef4444', letterSpacing: '1px' }}>
                EMERGENCY ACTIVE
              </span>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={resolveEmergency}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} color="#94a3b8" />
            </motion.button>
          </div>

          {/* Status items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Phone size={14} color="#10b981" />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>
                Notifying {emergencyContacts.length} contact{emergencyContacts.length !== 1 ? 's' : ''}
              </span>
              <span className="status-indicator green" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Radio size={14} color="#00d4ff" />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Live tracking enabled</span>
              <span className="status-indicator blue" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MapPin size={14} color="#f59e0b" />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>
                {userLocation
                  ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
                  : 'Acquiring location...'}
              </span>
            </div>
          </div>

          {/* Nearby Police Stations */}
          {nearbyPolice.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Shield size={13} color="#60a5fa" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>
                  NEARBY POLICE STATIONS
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                {nearbyPolice.slice(0, 4).map((station, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {station.name}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        {station.distance ? `${station.distance}m away` : ''}
                      </div>
                    </div>
                    <a
                      href={`tel:${station.phone}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 8,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        fontSize: 11,
                        fontWeight: 700,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Phone size={10} />
                      {station.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancel button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={resolveEmergency}
            className="btn btn-outline"
            style={{
              width: '100%',
              marginTop: 16,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            Cancel Emergency
          </motion.button>
        </div>
      </motion.div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 950,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* SOS Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          position: 'relative',
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'none',
        }}
      >
        {/* Hold progress ring */}
        {isHolding && (
          <svg
            style={{
              position: 'absolute',
              width: 80,
              height: 80,
              transform: 'rotate(-90deg)',
            }}
          >
            <circle
              cx={40}
              cy={40}
              r={36}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={3}
              strokeDasharray={226}
              strokeDashoffset={226 * (1 - holdProgress)}
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Pulse rings */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(239, 68, 68, 0.4)',
              '0 0 0 15px rgba(239, 68, 68, 0)',
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
          }}
        />

        <span style={{ fontSize: 18, fontWeight: 900, color: 'white', letterSpacing: '2px', zIndex: 1 }}>
          SOS
        </span>
      </motion.button>

      {/* Hint text */}
      <AnimatePresence>
        {!isHolding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: '#64748b',
              fontWeight: 500,
            }}
          >
            <Vibrate size={10} />
            Hold 2s to activate
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
