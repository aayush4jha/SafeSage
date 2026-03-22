import { motion, AnimatePresence } from 'framer-motion'
import { Moon } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'

export default function NightModeIndicator() {
  const { isNightMode } = useSafety()

  return (
    <AnimatePresence>
      {isNightMode && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 12,
            background: 'rgba(124, 58, 237, 0.1)',
            border: '1px solid rgba(124, 58, 237, 0.15)',
          }}
        >
          <motion.div
            animate={{
              boxShadow: [
                '0 0 4px rgba(124, 58, 237, 0.3)',
                '0 0 12px rgba(124, 58, 237, 0.6)',
                '0 0 4px rgba(124, 58, 237, 0.3)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#7c3aed',
            }}
          />
          <Moon size={14} color="#7c3aed" />
          <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
            Night Safety Mode Active
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
