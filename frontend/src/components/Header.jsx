import { motion } from 'framer-motion'
import { Shield, Moon } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'
import { formatSafetyScore } from '../utils/helpers'

export default function Header() {
  const { safetyScore, isNightMode } = useSafety()
  const scoreInfo = formatSafetyScore(safetyScore)

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(10, 10, 15, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Shield size={20} color="#0a0a0f" strokeWidth={2.5} />
        </div>
        <div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
            }}
          >
            NightShield AI
          </h1>
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500, letterSpacing: '0.5px' }}>
            PUBLIC SAFETY
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isNightMode && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              borderRadius: 20,
              background: 'rgba(124, 58, 237, 0.15)',
              border: '1px solid rgba(124, 58, 237, 0.2)',
            }}
          >
            <Moon size={12} color="#7c3aed" />
            <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>NIGHT</span>
          </motion.div>
        )}

        <motion.div
          whileTap={{ scale: 0.95 }}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: `conic-gradient(${scoreInfo.color} ${safetyScore * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: '#12121a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: scoreInfo.color,
            }}
          >
            {safetyScore}
          </div>
        </motion.div>
      </div>
    </motion.header>
  )
}
