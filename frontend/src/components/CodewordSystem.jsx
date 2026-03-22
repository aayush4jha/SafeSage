import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, Shield, AlertTriangle, Mic, Phone, MapPin,
  CheckCircle, X, Clock, Hospital, Siren, Eye,
} from 'lucide-react'
import { useSafety } from '../context/SafetyContext'
import { setupCodeword, verifyCodeword, escalateCodeword, getNearbyServices } from '../services/api'

const STAGE_LABELS = [
  { name: 'Normal', color: '#10b981', icon: Shield },
  { name: 'Warning', color: '#f59e0b', icon: AlertTriangle },
  { name: 'Codeword Check', color: '#f97316', icon: Lock },
  { name: 'Recording', color: '#ef4444', icon: Mic },
  { name: 'Contacts Notified', color: '#ef4444', icon: Phone },
  { name: 'Nearby Help', color: '#dc2626', icon: Hospital },
  { name: 'Live Tracking', color: '#dc2626', icon: Eye },
]

export default function CodewordSystem() {
  const { userLocation, emergencyContacts } = useSafety()
  const [hasCodeword, setHasCodeword] = useState(() =>
    localStorage.getItem('nightshield_has_codeword') === 'true'
  )
  const [setupMode, setSetupMode] = useState(false)
  const [newCodeword, setNewCodeword] = useState('')
  const [confirmCodeword, setConfirmCodeword] = useState('')
  const [challengeActive, setChallengeActive] = useState(false)
  const [codewordInput, setCodewordInput] = useState('')
  const [currentStage, setCurrentStage] = useState(0)
  const [nearbyServices, setNearbyServices] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const escalationTimerRef = useRef(null)

  const handleSetup = async () => {
    if (newCodeword.length < 3) {
      setSetupError('Codeword must be at least 3 characters')
      return
    }
    if (newCodeword !== confirmCodeword) {
      setSetupError('Codewords do not match')
      return
    }
    try {
      await setupCodeword(newCodeword)
    } catch {}
    localStorage.setItem('nightshield_has_codeword', 'true')
    setHasCodeword(true)
    setSetupMode(false)
    setNewCodeword('')
    setConfirmCodeword('')
    setSetupError('')
  }

  const handleVerify = async () => {
    if (!codewordInput.trim()) return
    try {
      const result = await verifyCodeword(
        codewordInput,
        userLocation?.lat,
        userLocation?.lng
      )
      setVerifyResult(result)
      if (result.verified) {
        setCurrentStage(0)
        setChallengeActive(false)
        setIsRecording(false)
        setCodewordInput('')
        clearTimeout(escalationTimerRef.current)
      } else {
        setCurrentStage(result.stage || currentStage + 1)
      }
    } catch {
      // Demo: simulate failed verification
      const nextStage = Math.min(6, currentStage + 1)
      setCurrentStage(nextStage)
      setVerifyResult({ verified: false, stage: nextStage })
    }
    setCodewordInput('')
  }

  const handleEscalate = useCallback(async () => {
    const nextStage = Math.min(6, currentStage + 1)
    setCurrentStage(nextStage)

    if (nextStage >= 3) setIsRecording(true)
    if (nextStage >= 5) {
      try {
        const services = await getNearbyServices(userLocation?.lat, userLocation?.lng)
        setNearbyServices(services)
      } catch {
        setNearbyServices({
          police: [
            { name: 'Navrangpura Police Station', distance: 800, phone: '100' },
            { name: 'Ellis Bridge Police Station', distance: 1200, phone: '100' },
          ],
          hospitals: [
            { name: 'Civil Hospital', distance: 500, phone: '108' },
            { name: 'VS Hospital', distance: 1100, phone: '108' },
          ],
        })
      }
    }
  }, [currentStage, userLocation])

  // Auto-escalation timer
  useEffect(() => {
    if (challengeActive && currentStage > 0 && currentStage < 6) {
      escalationTimerRef.current = setTimeout(() => {
        handleEscalate()
      }, 30000) // 30 seconds for demo (would be 60s in production)
      return () => clearTimeout(escalationTimerRef.current)
    }
  }, [challengeActive, currentStage, handleEscalate])

  // Demo trigger
  const triggerChallenge = () => {
    setChallengeActive(true)
    setCurrentStage(1)
    setVerifyResult(null)
  }

  const cancelEscalation = () => {
    setChallengeActive(false)
    setCurrentStage(0)
    setIsRecording(false)
    setNearbyServices(null)
    setVerifyResult(null)
    clearTimeout(escalationTimerRef.current)
  }

  // Setup form
  if (setupMode || !hasCodeword) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{ padding: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(124, 58, 237, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={18} color="#7c3aed" />
          </div>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700 }}>Safety Codeword</h4>
            <span style={{ fontSize: 11, color: '#64748b' }}>Set up your secret safety verification</span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 16 }}>
          Your codeword will be used to verify your safety when you enter risky areas.
          If you cannot provide the correct codeword, the system will automatically escalate
          to protect you.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <input
            className="input-field"
            type="password"
            placeholder="Enter your secret codeword"
            value={newCodeword}
            onChange={(e) => { setNewCodeword(e.target.value); setSetupError('') }}
            style={{ fontSize: 14 }}
          />
          <input
            className="input-field"
            type="password"
            placeholder="Confirm your codeword"
            value={confirmCodeword}
            onChange={(e) => { setConfirmCodeword(e.target.value); setSetupError('') }}
            style={{ fontSize: 14 }}
          />
          {setupError && (
            <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>{setupError}</div>
          )}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSetup}
          className="btn btn-primary"
          style={{ width: '100%' }}
        >
          <Shield size={16} /> Set Codeword
        </motion.button>
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lock size={18} color="#7c3aed" />
          <h4 style={{ fontSize: 15, fontWeight: 700 }}>Codeword Guardian</h4>
        </div>
        <span className="badge badge-safe" style={{ fontSize: 9 }}>
          <CheckCircle size={9} /> ACTIVE
        </span>
      </div>

      {/* Escalation Stage Indicator */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {STAGE_LABELS.map((stage, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= currentStage && currentStage > 0
                  ? stage.color
                  : 'rgba(255,255,255,0.06)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>
        {currentStage > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: STAGE_LABELS[currentStage]?.color, fontWeight: 600,
          }}>
            {(() => { const Icon = STAGE_LABELS[currentStage]?.icon || Shield; return <Icon size={12} /> })()}
            Stage {currentStage}: {STAGE_LABELS[currentStage]?.name}
          </div>
        )}
      </div>

      {/* Challenge Active UI */}
      <AnimatePresence mode="wait">
        {challengeActive ? (
          <motion.div
            key="challenge"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            {/* Codeword Input (stages 1-2) */}
            {currentStage <= 2 && (
              <div style={{
                padding: 16, borderRadius: 12, marginBottom: 12,
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.15)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>
                  Are you safe? Enter your codeword.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input-field"
                    type="password"
                    placeholder="Enter codeword..."
                    value={codewordInput}
                    onChange={(e) => setCodewordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                    style={{ flex: 1, fontSize: 14 }}
                    autoFocus
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleVerify}
                    className="btn btn-safe"
                    style={{ padding: '10px 16px' }}
                  >
                    <CheckCircle size={16} />
                  </motion.button>
                </div>
                {verifyResult && !verifyResult.verified && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6, fontWeight: 500 }}>
                    Incorrect codeword. Escalation level increased.
                  </div>
                )}
              </div>
            )}

            {/* Recording Active (stage 3+) */}
            {isRecording && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  padding: 14, borderRadius: 12, marginBottom: 12,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Mic size={18} color="#ef4444" />
                </motion.div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>Audio Recording Active</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Recording shared with emergency contacts</div>
                </div>
              </motion.div>
            )}

            {/* Contacts Notified (stage 4+) */}
            {currentStage >= 4 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  padding: 14, borderRadius: 12, marginBottom: 12,
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.15)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
                  Emergency Contacts Notified
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(emergencyContacts || []).slice(0, 3).map((contact, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                      <Phone size={11} color="#ef4444" />
                      <span>{contact.name || 'Contact ' + (i + 1)}</span>
                      <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                        <span className="badge badge-danger" style={{ fontSize: 8, padding: '2px 6px' }}>LISTEN</span>
                        <span className="badge badge-primary" style={{ fontSize: 8, padding: '2px 6px' }}>CALL</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Nearby Services (stage 5+) */}
            {currentStage >= 5 && nearbyServices && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 12 }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Siren size={14} /> Nearby Emergency Services
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {nearbyServices.police?.slice(0, 2).map((s, i) => (
                    <div key={'p' + i} style={{
                      padding: 10, borderRadius: 10,
                      background: 'rgba(0,212,255,0.06)',
                      border: '1px solid rgba(0,212,255,0.1)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#00d4ff', marginBottom: 2 }}>
                        <Siren size={10} /> Police
                      </div>
                      <div style={{ fontSize: 10, color: '#e2e8f0' }}>{s.name}</div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>{s.distance}m away</div>
                    </div>
                  ))}
                  {nearbyServices.hospitals?.slice(0, 2).map((s, i) => (
                    <div key={'h' + i} style={{
                      padding: 10, borderRadius: 10,
                      background: 'rgba(239,68,68,0.06)',
                      border: '1px solid rgba(239,68,68,0.1)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 2 }}>
                        <Hospital size={10} /> Hospital
                      </div>
                      <div style={{ fontSize: 10, color: '#e2e8f0' }}>{s.name}</div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>{s.distance}m away</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Still can enter codeword at any stage */}
            {currentStage > 2 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  className="input-field"
                  type="password"
                  placeholder="Enter codeword to cancel..."
                  value={codewordInput}
                  onChange={(e) => setCodewordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleVerify} className="btn btn-safe" style={{ padding: '10px 14px' }}>
                  Verify
                </motion.button>
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={cancelEscalation}
              className="btn btn-outline"
              style={{ width: '100%', borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 12 }}
            >
              <X size={14} /> I'm Safe — Cancel
            </motion.button>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 14 }}>
              Your safety codeword is active. The system will automatically challenge
              you when entering risky areas and escalate if you don't respond.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={triggerChallenge}
                className="btn btn-outline"
                style={{ flex: 1, borderColor: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: 12 }}
              >
                <AlertTriangle size={14} /> Test Challenge
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setSetupMode(true); setHasCodeword(false) }}
                className="btn btn-ghost"
                style={{ fontSize: 12 }}
              >
                Change Codeword
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
