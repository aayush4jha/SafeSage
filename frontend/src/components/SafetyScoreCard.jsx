import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, Lightbulb, Users, AlertCircle, MapPin } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'
import { formatSafetyScore } from '../utils/helpers'

function AnimatedCounter({ value, duration = 1.2 }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let start = 0
    const end = value
    const startTime = performance.now()

    function step(now) {
      const progress = Math.min((now - startTime) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(Math.round(start + (end - start) * eased))
      if (progress < 1) requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }, [value, duration])

  return display
}

const breakdownItems = [
  { key: 'lighting', label: 'Lighting', icon: Lightbulb, value: 65 },
  { key: 'crowd', label: 'Crowd Density', icon: Users, value: 78 },
  { key: 'incidents', label: 'Incidents', icon: AlertCircle, value: 82 },
  { key: 'isolation', label: 'Isolation', icon: MapPin, value: 60 },
]

export default function SafetyScoreCard({ compact = false }) {
  const { safetyScore } = useSafety()
  const scoreInfo = formatSafetyScore(safetyScore)

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card"
        style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: `conic-gradient(${scoreInfo.color} ${safetyScore * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#1a1a2e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 800,
              color: scoreInfo.color,
            }}
          >
            <AnimatedCounter value={safetyScore} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Safety Score</div>
          <div className={`badge badge-${scoreInfo.emoji}`} style={{ marginTop: 2 }}>
            {scoreInfo.label}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card"
      style={{ padding: 20 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Score circle */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: `conic-gradient(${scoreInfo.color} ${safetyScore * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                background: '#1a1a2e',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  color: scoreInfo.color,
                  lineHeight: 1,
                }}
              >
                <AnimatedCounter value={safetyScore} />
              </span>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                / 100
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Shield size={16} color={scoreInfo.color} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Area Safety</span>
          </div>
          <div className={`badge badge-${scoreInfo.emoji}`} style={{ marginBottom: 8 }}>
            {scoreInfo.label}
          </div>
          <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
            Based on 47 reports and real-time analysis
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {breakdownItems.map(({ key, label, icon: Icon, value }) => {
          const info = formatSafetyScore(value)
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon size={14} color="#64748b" />
              <span style={{ fontSize: 12, color: '#94a3b8', width: 90, flexShrink: 0 }}>
                {label}
              </span>
              <div className="progress-bar" style={{ flex: 1 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className="progress-bar-fill"
                  style={{ background: info.color }}
                />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: info.color, width: 28, textAlign: 'right' }}>
                {value}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
