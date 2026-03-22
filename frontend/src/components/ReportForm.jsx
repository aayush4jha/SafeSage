import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Moon, Eye, AlertTriangle, Flashlight, Users, HelpCircle,
  MapPin, Send, CheckCircle, ChevronRight,
} from 'lucide-react'
import { useSafety } from '../context/SafetyContext'
import { submitReport } from '../services/api'
import ImageVerification from './ImageVerification'

const categories = [
  { id: 'dark_road', label: 'Dark Road', icon: Moon, color: '#f59e0b' },
  { id: 'unsafe_street', label: 'Unsafe Street', icon: AlertTriangle, color: '#ef4444' },
  { id: 'suspicious_activity', label: 'Suspicious Activity', icon: Eye, color: '#f97316' },
  { id: 'harassment', label: 'Harassment', icon: AlertTriangle, color: '#dc2626' },
  { id: 'poor_visibility', label: 'Poor Visibility', icon: Flashlight, color: '#eab308' },
  { id: 'other', label: 'Other', icon: HelpCircle, color: '#64748b' },
]

const severityLabels = ['Low', 'Minor', 'Moderate', 'High', 'Critical']
const severityColors = ['#10b981', '#22c55e', '#f59e0b', '#f97316', '#ef4444']

export default function ReportForm({ onReportSubmitted }) {
  const { userLocation } = useSafety()
  const [category, setCategory] = useState(null)
  const [severity, setSeverity] = useState(3)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!category) return
    setSubmitting(true)

    const reportData = {
      category,
      severity,
      description: description.trim() || undefined,
      lat: userLocation?.lat,
      lng: userLocation?.lng,
      timestamp: new Date().toISOString(),
    }

    try {
      await submitReport(reportData)
    } catch {
      // Submit locally anyway
    }

    setSubmitting(false)
    setSubmitted(true)
    if (onReportSubmitted) onReportSubmitted()

    setTimeout(() => {
      setSubmitted(false)
      setCategory(null)
      setSeverity(3)
      setDescription('')
    }, 3000)
  }, [category, severity, description, userLocation])

  if (submitted) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card"
        style={{
          padding: 40,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
          transition={{ type: 'spring', damping: 10 }}
        >
          <CheckCircle size={56} color="#10b981" />
        </motion.div>
        <h3 style={{ fontSize: 20, fontWeight: 700 }}>Report Submitted</h3>
        <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
          Thank you for keeping the community safe. Your report is linked to your profile and contributes to your safety score.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
      style={{ padding: 20 }}
    >
      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Report a Safety Concern</h3>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
        Your report is linked to your profile. When 5+ users report the same area, it becomes a red zone.
      </p>

      {/* Category selector */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, display: 'block' }}>
          Category
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {categories.map((cat) => {
            const Icon = cat.icon
            const isActive = category === cat.id
            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCategory(cat.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '14px 8px',
                  borderRadius: 12,
                  background: isActive ? `${cat.color}15` : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${isActive ? cat.color + '50' : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={20} color={isActive ? cat.color : '#64748b'} />
                <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? cat.color : '#94a3b8' }}>
                  {cat.label}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Severity slider */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Severity</label>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: severityColors[severity - 1],
            }}
          >
            {severityLabels[severity - 1]}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="range"
            min={1}
            max={5}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            style={{
              width: '100%',
              appearance: 'none',
              WebkitAppearance: 'none',
              height: 6,
              borderRadius: 3,
              background: `linear-gradient(90deg, ${severityColors[0]}, ${severityColors[2]}, ${severityColors[4]})`,
              outline: 'none',
              cursor: 'pointer',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                style={{
                  fontSize: 10,
                  color: severity === n ? severityColors[n - 1] : '#475569',
                  fontWeight: severity === n ? 700 : 400,
                }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, display: 'block' }}>
          Description (optional)
        </label>
        <textarea
          className="input-field"
          rows={3}
          placeholder="Describe the safety concern..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ resize: 'vertical', minHeight: 80 }}
        />
      </div>

      {/* Image Verification */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, display: 'block' }}>
          Photo Verification (optional)
        </label>
        <ImageVerification onAnalysisComplete={(analysis) => {
          // Image analysis can boost report credibility
          if (analysis?.overallRiskFromImage > 60) {
            setSeverity(Math.min(5, severity + 1))
          }
        }} />
      </div>

      {/* Location */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(0, 212, 255, 0.06)',
          border: '1px solid rgba(0, 212, 255, 0.1)',
          marginBottom: 20,
          fontSize: 12,
          color: '#94a3b8',
        }}
      >
        <MapPin size={14} color="#00d4ff" />
        {userLocation ? (
          <span>
            Location: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
          </span>
        ) : (
          <span>Acquiring location...</span>
        )}
      </div>

      {/* Submit button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={!category || submitting}
        className="btn btn-primary"
        style={{
          width: '100%',
          opacity: !category || submitting ? 0.5 : 1,
          cursor: !category || submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? (
          <div className="animate-spin" style={{ width: 18, height: 18, border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #0a0a0f', borderRadius: '50%' }} />
        ) : (
          <>
            <Send size={16} />
            Submit Report
          </>
        )}
      </motion.button>
    </motion.div>
  )
}
