import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSocket } from '../services/socket'

export default function EmergencyNotification() {
  const [notifications, setNotifications] = useState([])

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handler = (data) => {
      const id = Date.now() + Math.random()
      setNotifications(prev => [...prev, { id, ...data }])
      // Auto-dismiss after 15 seconds
      setTimeout(() => removeNotification(id), 15000)
    }

    socket.on('family-emergency-alert', handler)
    return () => socket.off('family-emergency-alert', handler)
  }, [removeNotification])

  return (
    <div style={{ position: 'fixed', top: 16, right: 12, left: 12, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380, marginLeft: 'auto' }}>
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            style={{
              background: 'linear-gradient(135deg, #991b1b, #dc2626)',
              borderRadius: 16,
              padding: 16,
              color: 'white',
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.4)',
              cursor: 'pointer',
            }}
            onClick={() => removeNotification(n.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24' }}
              />
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Emergency SOS Alert
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px 0' }}>
              {n.memberName || 'A family member'} triggered an Emergency SOS!
            </p>
            {n.location && (
              <p style={{ fontSize: 12, opacity: 0.85, margin: 0 }}>
                Location: {n.location.lat?.toFixed(4)}, {n.location.lng?.toFixed(4)}
              </p>
            )}
            <p style={{ fontSize: 10, opacity: 0.6, marginTop: 8, marginBottom: 0 }}>
              Tap to dismiss
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
