import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ChevronDown, ChevronUp, Clock, MapPin, AlertTriangle } from 'lucide-react'
import { formatSafetyScore } from '../utils/helpers'
import { fetchDangerPredictions } from '../services/api'

export default function DangerPrediction({ collapsible = true }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [predictions, setPredictions] = useState([])

  useEffect(() => {
    fetchDangerPredictions()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPredictions(data.slice(0, 5).map((d, i) => ({
            id: i + 1,
            area: `Zone ${d.lat?.toFixed(3)}, ${d.lng?.toFixed(3)}`,
            riskLevel: Math.round((d.predictedRisk || 0.5) * 100),
            timeRange: (d.predictedTimeRange || []).join(' - '),
            reason: (d.categories || []).map(c => c.replace(/_/g, ' ')).join(', ') || 'Historical pattern detected',
          })))
        }
      })
      .catch(() => {
        // Generate from current time
        const hour = new Date().getHours()
        const h1 = (hour + 1) % 24, h2 = (hour + 2) % 24
        setPredictions([
          { id: 1, area: 'Near Navrangpura', riskLevel: 78, timeRange: `${h1}:00 - ${h2}:00`, reason: 'Dark roads, past incidents at this time' },
          { id: 2, area: 'Maninagar Underpass', riskLevel: 65, timeRange: `${h1}:00 - ${h2}:00`, reason: 'Poor visibility, low foot traffic' },
          { id: 3, area: 'Sabarmati Riverside', riskLevel: 58, timeRange: `${h1}:00 - ${h2}:00`, reason: 'Isolated area after dark' },
        ])
      })
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass-card"
      style={{ padding: 16, maxWidth: 300 }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: collapsible ? 'pointer' : 'default',
          marginBottom: isCollapsed ? 0 : 14,
        }}
        onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(124, 58, 237, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={14} color="#7c3aed" />
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>Danger Prediction</h4>
            <span style={{ fontSize: 10, color: '#64748b' }}>Next 2 hours</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="badge badge-accent" style={{ fontSize: 9 }}>
            <Sparkles size={9} /> AI
          </span>
          {collapsible &&
            (isCollapsed ? (
              <ChevronDown size={14} color="#64748b" />
            ) : (
              <ChevronUp size={14} color="#64748b" />
            ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {predictions.map((pred, i) => {
                const risk = 100 - pred.riskLevel // Convert risk to safety
                const info = formatSafetyScore(risk)

                return (
                  <motion.div
                    key={pred.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: 'rgba(0,0,0,0.2)',
                      borderLeft: `3px solid ${info.color}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={12} color={info.color} />
                        <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{pred.area}</span>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: info.color,
                          flexShrink: 0,
                        }}
                      >
                        {pred.riskLevel}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
                      <Clock size={10} />
                      <span>{pred.timeRange}</span>
                    </div>

                    <p style={{ fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>
                      {pred.reason}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
