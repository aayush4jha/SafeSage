import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Upload, Image, CheckCircle, AlertTriangle,
  Sun, Users, Eye, TreePine, X, Loader,
} from 'lucide-react'
import { analyzeReportImage } from '../services/api'

export default function ImageVerification({ onAnalysisComplete }) {
  const [imagePreview, setImagePreview] = useState(null)
  const [imageData, setImageData] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const fileInputRef = useRef(null)

  const handleImageSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target.result)
      setImageData(ev.target.result)
      setAnalysis(null)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!imageData) return
    setAnalyzing(true)

    try {
      const result = await analyzeReportImage(imageData)
      setAnalysis(result)
      if (result.accepted) {
        onAnalysisComplete?.(result)
      }
    } catch (err) {
      setAnalysis({
        rejected: true,
        accepted: false,
        reason: 'Failed to analyze image. Please try again with a clear outdoor photo.',
        environment: { environment: 'error' }
      })
    }
    setAnalyzing(false)
  }, [imageData, onAnalysisComplete])

  const clearImage = () => {
    setImagePreview(null)
    setImageData(null)
    setAnalysis(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const analysisItems = (analysis && analysis.accepted) ? [
    {
      label: 'Darkness Level',
      value: analysis.darkness.level.replace(/_/g, ' '),
      score: analysis.darkness.score,
      icon: Sun,
      color: analysis.darkness.score > 50 ? '#ef4444' : analysis.darkness.score > 30 ? '#f59e0b' : '#10b981',
    },
    {
      label: 'Crowd Presence',
      value: analysis.crowdPresence.level.replace(/_/g, ' '),
      score: analysis.crowdPresence.score,
      icon: Users,
      color: analysis.crowdPresence.score < 40 ? '#ef4444' : analysis.crowdPresence.score < 60 ? '#f59e0b' : '#10b981',
    },
    {
      label: 'Visibility',
      value: analysis.visibility.level,
      score: analysis.visibility.score,
      icon: Eye,
      color: analysis.visibility.score < 40 ? '#ef4444' : analysis.visibility.score < 60 ? '#f59e0b' : '#10b981',
    },
    {
      label: 'Environment',
      value: `${analysis.environment.environment} / ${analysis.environment.timeOfDay}`,
      score: Math.round(analysis.environment.confidence * 100),
      icon: TreePine,
      color: '#00d4ff',
    },
  ] : []

  return (
    <div>
      {/* Upload area */}
      {!imagePreview ? (
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: 20, borderRadius: 12, cursor: 'pointer',
            border: '2px dashed rgba(0,212,255,0.2)',
            background: 'rgba(0,212,255,0.03)',
            textAlign: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          <Camera size={28} color="#00d4ff" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: '#00d4ff', marginBottom: 4 }}>
            Upload Photo to Verify
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Help validate this report with an image
          </div>
        </motion.div>
      ) : (
        <div>
          {/* Image preview */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <img
              src={imagePreview}
              alt="Report verification"
              style={{
                width: '100%', height: 160, objectFit: 'cover',
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
              }}
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={clearImage}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(0,0,0,0.6)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <X size={14} color="#fff" />
            </motion.button>
            {!analysis && (
              <div style={{
                position: 'absolute', bottom: 8, left: 8, right: 8,
                display: 'flex', justifyContent: 'center',
              }}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontSize: 12 }}
                >
                  {analyzing ? (
                    <><Loader size={14} className="animate-spin" /> Analyzing...</>
                  ) : (
                    <><Eye size={14} /> Analyze Image</>
                  )}
                </motion.button>
              </div>
            )}
          </div>

          {/* Analysis Results */}
          <AnimatePresence>
            {analysis && analysis.rejected && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: 14, borderRadius: 12, marginTop: 4,
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  display: 'flex', alignItems: 'start', gap: 10,
                }}
              >
                <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
                    Image Rejected — {analysis.environment?.environment === 'screenshot' ? 'Screenshot Detected' :
                      analysis.environment?.environment === 'indoor' ? 'Indoor Photo Detected' : 'Invalid Image'}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                    {analysis.reason}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={clearImage}
                    style={{
                      marginTop: 8, padding: '6px 14px', borderRadius: 8, fontSize: 11,
                      fontWeight: 600, background: 'rgba(245,158,11,0.15)',
                      color: '#f59e0b', cursor: 'pointer',
                    }}
                  >
                    Try Another Photo
                  </motion.button>
                </div>
              </motion.div>
            )}
            {analysis && analysis.accepted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                {/* Overall risk */}
                <div style={{
                  padding: 12, borderRadius: 10,
                  background: analysis.overallRiskFromImage > 60
                    ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                  border: `1px solid ${analysis.overallRiskFromImage > 60
                    ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {analysis.overallRiskFromImage > 60 ? (
                      <AlertTriangle size={16} color="#ef4444" />
                    ) : (
                      <CheckCircle size={16} color="#10b981" />
                    )}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: analysis.overallRiskFromImage > 60 ? '#ef4444' : '#10b981' }}>
                        {analysis.overallRiskFromImage > 60 ? 'High Risk Verified' : 'Moderate Verification'}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        Credibility: +{analysis.credibilityModifier} points
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 20, fontWeight: 800,
                    color: analysis.overallRiskFromImage > 60 ? '#ef4444' : '#f59e0b',
                  }}>
                    {analysis.overallRiskFromImage}%
                  </div>
                </div>

                {/* Breakdown */}
                {analysisItems.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(0,0,0,0.15)',
                      }}
                    >
                      <Icon size={13} color={item.color} />
                      <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: item.color, textTransform: 'capitalize' }}>
                        {item.value}
                      </span>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}
