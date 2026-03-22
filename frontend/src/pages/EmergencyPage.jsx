import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNavBar from '../components/TopNavBar'
import { useSafety } from '../context/SafetyContext'
import { useAuth } from '../context/AuthContext'
import { useCache } from '../context/CacheContext'
import { fetchEmergencyHistory, getNearbyServices, sendEmergencyPhotos } from '../services/api'
import { generateId, formatTimestamp } from '../utils/helpers'

const SOS_COUNTDOWN = 3 // seconds

// Capture a single photo from a camera
async function captureFromCamera(facingMode) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode }
  })
  const video = document.createElement('video')
  video.srcObject = stream
  video.playsInline = true
  await video.play()
  // Small delay to let camera auto-expose
  await new Promise(r => setTimeout(r, 300))
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d').drawImage(video, 0, 0)
  stream.getTracks().forEach(t => t.stop())
  return canvas.toDataURL('image/jpeg', 0.7)
}

// Capture from both cameras
async function capturePhotos() {
  const photos = []
  try {
    photos.push({ camera: 'back', image: await captureFromCamera('environment') })
  } catch {}
  try {
    photos.push({ camera: 'front', image: await captureFromCamera('user') })
  } catch {}
  return photos
}

export default function EmergencyPage() {
  const { emergencyContacts, setEmergencyContacts, activeEmergency, resolveEmergency, triggerEmergency, userLocation, safetyScore, nearbyPolice, guardianMode, setGuardianMode, emergencyId } = useSafety()
  const { user } = useAuth()
  const { get, set } = useCache()
  const [emergencyHistory, setEmergencyHistory] = useState(() => get('emergency_history') || [])
  const [nearbyHelp, setNearbyHelp] = useState(() => get('emergency_nearbyHelp') || { police: [], hospitals: [] })
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const lastNearbyFetch = useRef(null)
  const navigate = useNavigate()

  // SOS countdown state
  const [sosState, setSosState] = useState('idle') // idle | countdown | activating
  const [countdown, setCountdown] = useState(SOS_COUNTDOWN)
  const countdownTimerRef = useRef(null)

  const navigateToSafetyMap = useCallback((service) => {
    if (!service?.lat && !service?.latitude) return
    const dLat = service.lat ?? service.latitude
    const dLng = service.lng ?? service.longitude
    const name = service.name || ''
    const params = new URLSearchParams({ destLat: dLat, destLng: dLng, destName: name })
    navigate(`/map?${params.toString()}`)
  }, [navigate])

  useEffect(() => {
    if (!get('emergency_history')) {
      fetchEmergencyHistory().then(d => {
        if (Array.isArray(d)) { setEmergencyHistory(d); set('emergency_history', d) }
      }).catch(() => {})
    }

    if (userLocation) {
      const locKey = `emergency_nearby_${userLocation.lat.toFixed(3)}_${userLocation.lng.toFixed(3)}`
      if (!get(locKey)) {
        const now = Date.now()
        if (lastNearbyFetch.current && now - lastNearbyFetch.current < 30000) return
        lastNearbyFetch.current = now
        getNearbyServices(userLocation.lat, userLocation.lng).then(d => {
          setNearbyHelp(d)
          set(locKey, d)
          set('emergency_nearbyHelp', d)
        }).catch(() => {})
      }
    }
  }, [activeEmergency, userLocation, get, set])

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current) }
  }, [])

  const startSOSCountdown = useCallback(() => {
    setSosState('countdown')
    setCountdown(SOS_COUNTDOWN)

    let remaining = SOS_COUNTDOWN
    countdownTimerRef.current = setInterval(() => {
      remaining--
      setCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
        handleSOSActivation()
      }
    }, 1000)
  }, [])

  const cancelSOSCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setSosState('idle')
    setCountdown(SOS_COUNTDOWN)
  }, [])

  const handleSOSActivation = useCallback(async () => {
    setSosState('activating')

    // 1. Trigger the emergency alert
    await triggerEmergency()

    // 2. Auto-call nearest police station
    const policeList = nearbyPolice.length > 0 ? nearbyPolice : nearbyHelp.police
    if (policeList.length > 0 && policeList[0].phone) {
      window.open(`tel:${policeList[0].phone}`, '_self')
    }

    // 3. Capture photos from front & back cameras and send
    try {
      const photos = await capturePhotos()
      if (photos.length > 0) {
        // Use the emergencyId from context once available, or send without
        sendEmergencyPhotos(photos).catch(() => {})
      }
    } catch {}

    setSosState('idle')
  }, [triggerEmergency, nearbyPolice, nearbyHelp.police])

  const addContact = () => {
    const c = { id: generateId(), name: '', phone: '', relationship: 'Family' }
    setEmergencyContacts([...emergencyContacts, c])
    setEditingId(c.id)
    setEditData(c)
  }
  const deleteContact = (id) => {
    setEmergencyContacts(emergencyContacts.filter(c => c.id !== id))
    if (editingId === id) setEditingId(null)
  }
  const saveEditing = () => {
    setEmergencyContacts(emergencyContacts.map(c => c.id === editingId ? { ...editData } : c))
    setEditingId(null)
  }

  const score = safetyScore ?? 72
  const isHighRisk = score < 40
  const isModerate = score >= 40 && score < 65
  const isSafe = score >= 65

  const bannerConfig = isHighRisk
    ? { bg: 'bg-error', text: 'text-on-error', icon: 'warning', title: 'You are in a High Risk Zone', subtitle: 'Enhanced surveillance active. Stay alert and head to the nearest safe point.' }
    : isModerate
    ? { bg: 'bg-tertiary', text: 'text-on-tertiary', icon: 'warning', title: 'Moderate Risk Zone', subtitle: 'Stay cautious. Some safety concerns have been reported in this area.' }
    : { bg: 'bg-primary', text: 'text-on-primary', icon: 'verified_user', title: 'You are in a Safe Zone', subtitle: 'This area has a good safety record. Stay aware of your surroundings.' }

  return (
    <div className="min-h-screen bg-surface-container-low">
      <TopNavBar
        title="Guardian Mode"
        statusBadge={
          isHighRisk ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-error-container text-on-error-container rounded-full text-xs font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-error"></span>
              </span>
              HIGH RISK AREA
            </div>
          ) : isModerate ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full text-xs font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
              </span>
              MODERATE RISK
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant rounded-full text-xs font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              SAFE
            </div>
          )
        }
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
        {/* Risk Banner */}
        <section className={`mb-6 md:mb-8 rounded-2xl md:rounded-3xl ${bannerConfig.bg} ${bannerConfig.text} p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 overflow-hidden relative shadow-lg`}>
          <div className="relative z-10 flex items-center gap-4 md:gap-6">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl md:text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>{bannerConfig.icon}</span>
            </div>
            <div>
              <h3 className="text-lg md:text-2xl font-headline font-extrabold tracking-tight">{bannerConfig.title}</h3>
              <p className="text-white/80 text-sm md:text-base">{bannerConfig.subtitle}</p>
            </div>
          </div>
          <div className="relative z-10 text-left md:text-right flex items-center md:block gap-2">
            <div className="text-2xl md:text-4xl font-headline font-black">{score}%</div>
            <div className="text-xs uppercase tracking-widest font-bold opacity-80">Safety Score</div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          {/* Left: Guardian Toggle + SOS Button */}
          <div className="lg:col-span-7 space-y-8">

            {/* Guardian Mode Toggle Card */}
            <div className="bg-white rounded-3xl shadow-sm p-6">
              {guardianMode ? (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-on-surface">Guardian Mode Active</h4>
                    <p className="text-xs text-on-surface-variant">Auto-monitoring your safety in danger zones</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-fixed rounded-full">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span className="text-xs font-bold text-on-primary-fixed-variant">Active</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant text-2xl">shield</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface">Auto Guardian Mode</h4>
                      <p className="text-xs text-on-surface-variant">Enable automatic danger zone monitoring</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setGuardianMode(true)}
                    className="relative w-14 h-8 rounded-full transition-colors bg-surface-container-highest"
                  >
                    <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-all"></div>
                  </button>
                </div>
              )}
            </div>

            {/* SOS Button */}
            <div className="flex flex-col items-center justify-center p-6 md:p-12 bg-white rounded-2xl md:rounded-3xl shadow-sm">
              {activeEmergency ? (
                <>
                  <div className="w-40 h-40 md:w-56 md:h-56 rounded-full bg-error/10 flex flex-col items-center justify-center text-error gap-2 border-4 border-error">
                    <span className="material-symbols-outlined text-5xl md:text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>emergency_share</span>
                    <span className="text-base md:text-lg font-headline font-black uppercase">ACTIVE</span>
                  </div>
                  <button onClick={resolveEmergency} className="mt-6 md:mt-8 px-6 md:px-8 py-3 bg-primary text-white rounded-2xl font-bold hover:opacity-90 transition-all text-sm md:text-base">
                    I'm Safe — Resolve Emergency
                  </button>
                </>
              ) : sosState === 'countdown' ? (
                <>
                  {/* Countdown state */}
                  <div className="relative w-40 h-40 md:w-56 md:h-56">
                    <svg className="w-40 h-40 md:w-56 md:h-56 -rotate-90" viewBox="0 0 224 224">
                      <circle cx="112" cy="112" r="105" fill="none" stroke="#fee2e2" strokeWidth="8" />
                      <circle
                        cx="112" cy="112" r="105" fill="none"
                        stroke="#dc2626" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 105}`}
                        strokeDashoffset={`${2 * Math.PI * 105 * (countdown / SOS_COUNTDOWN)}`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl md:text-7xl font-headline font-black text-error">{countdown}</span>
                      <span className="text-xs md:text-sm font-bold text-error/70 mt-1">Activating SOS...</span>
                    </div>
                  </div>
                  <button
                    onClick={cancelSOSCountdown}
                    className="mt-6 md:mt-8 px-8 md:px-10 py-3 bg-surface-container-highest text-on-surface rounded-2xl font-bold hover:bg-surface-container-high transition-colors text-base md:text-lg"
                  >
                    Cancel
                  </button>
                  <p className="mt-3 text-on-surface-variant text-center text-xs">
                    SOS will activate in {countdown} second{countdown !== 1 ? 's' : ''}. Press cancel to stop.
                  </p>
                </>
              ) : (
                <>
                  {/* Idle state — SOS button */}
                  <button
                    onClick={startSOSCountdown}
                    className="sos-pulse w-40 h-40 md:w-56 md:h-56 rounded-full bg-error flex flex-col items-center justify-center text-on-error gap-2 active:scale-95 transition-transform cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-5xl md:text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>emergency_share</span>
                    <span className="text-lg md:text-xl font-headline font-black tracking-tighter uppercase">Emergency SOS</span>
                  </button>
                  <p className="mt-6 md:mt-8 text-on-surface-variant text-center max-w-sm text-xs md:text-sm">
                    Press to alert emergency services and all registered family contacts. You'll have 3 seconds to cancel.
                  </p>
                </>
              )}
            </div>

            {/* Emergency History */}
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-surface-container-low flex justify-between items-center">
                <h3 className="font-headline text-lg font-bold">Emergency History</h3>
                <span className="text-xs font-bold text-primary">{emergencyHistory.length} records</span>
              </div>
              <div className="divide-y divide-surface-container-low">
                {emergencyHistory.length === 0 && (
                  <div className="p-8 text-center text-on-surface-variant text-sm">No emergency history</div>
                )}
                {emergencyHistory.slice(0, 5).map(item => {
                  const resolved = item.status === 'resolved' || item.status === 'false_alarm'
                  return (
                    <div key={item.id} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-container-low/30 transition-colors">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${resolved ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-error-container text-error'}`}>
                        <span className="material-symbols-outlined">{resolved ? 'check_circle' : 'warning'}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-on-surface text-sm">{item.trigger_type === 'manual' ? 'Manual SOS' : item.trigger_type}</h4>
                        <p className="text-xs text-on-surface-variant">{formatTimestamp(item.created_at)}</p>
                      </div>
                      <span className={`text-xs font-bold ${resolved ? 'text-primary' : 'text-error'}`}>
                        {resolved ? 'Resolved' : 'Active'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: Nearby Help + Contacts */}
          <div className="lg:col-span-5 space-y-8">
            {/* Nearby Help */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold font-headline">Nearby Help</h4>
              </div>
              <div className="space-y-4">
                {(nearbyPolice.length > 0 ? nearbyPolice : nearbyHelp.police).slice(0, 3).map((s, i) => (
                  <div key={i} className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border-l-4 border-primary-container">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-fixed-dim flex items-center justify-center">
                          <span className="material-symbols-outlined text-on-primary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>local_police</span>
                        </div>
                        <div>
                          <h5 className="font-bold text-sm">{s.name}</h5>
                          <p className="text-xs text-on-surface-variant">{s.distance ? `${s.distance}m away` : 'Helpline'}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-primary bg-primary-fixed px-2 py-1 rounded-lg">{s.phone}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <a href={`tel:${s.phone}`} className="flex items-center justify-center gap-1.5 md:gap-2 py-2 bg-surface-container-high rounded-xl text-xs md:text-sm font-bold text-on-surface no-underline hover:bg-surface-container-highest transition-colors">
                        <span className="material-symbols-outlined text-base md:text-lg">call</span> <span className="hidden sm:inline">Call</span> {s.phone}
                      </a>
                      <button onClick={() => navigateToSafetyMap(s)} className="flex items-center justify-center gap-2 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                        <span className="material-symbols-outlined text-lg">near_me</span> Go
                      </button>
                    </div>
                  </div>
                ))}
                {nearbyHelp.hospitals.slice(0, 1).map((s, i) => (
                  <div key={i} className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border-l-4 border-error">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-error-container flex items-center justify-center">
                          <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
                        </div>
                        <div>
                          <h5 className="font-bold text-sm">{s.name}</h5>
                          <p className="text-xs text-on-surface-variant">{s.distance}m away</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <a href={`tel:${s.phone}`} className="flex items-center justify-center gap-2 py-2 bg-surface-container-high rounded-xl text-sm font-bold text-on-surface no-underline hover:bg-surface-container-highest transition-colors">
                        <span className="material-symbols-outlined text-lg">call</span> Call
                      </a>
                      <button onClick={() => navigateToSafetyMap(s)} className="flex items-center justify-center gap-2 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                        <span className="material-symbols-outlined text-lg">near_me</span> Go
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Emergency Contacts */}
            <section>
              <h4 className="text-lg font-bold font-headline mb-4">Emergency Contacts</h4>
              <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm">
                <div className="space-y-4">
                  {emergencyContacts.map(contact => {
                    const isEditing = editingId === contact.id
                    return (
                      <div key={contact.id} className="flex items-start md:items-center justify-between gap-3">
                        {isEditing ? (
                          <div className="flex-1 space-y-2">
                            <input className="input-field" placeholder="Name" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                            <input className="input-field" placeholder="Phone" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                            <div className="flex gap-2">
                              <button onClick={saveEditing} className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-bold">Save</button>
                              <button onClick={() => setEditingId(null)} className="py-2 px-4 bg-surface-container-high rounded-xl text-sm font-bold">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                              <div className="relative shrink-0">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant font-bold text-sm md:text-base">
                                  {contact.name ? contact.name.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 md:w-3 md:h-3 bg-primary border-2 border-white rounded-full"></div>
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-on-surface text-sm truncate">{contact.name || 'Unnamed'} ({contact.relationship})</p>
                                <p className="text-xs text-primary font-medium">{contact.phone || 'No phone'}</p>
                              </div>
                            </div>
                            <div className="flex gap-1.5 md:gap-2 shrink-0">
                              <button onClick={() => { setEditingId(contact.id); setEditData({ ...contact }) }} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button onClick={() => deleteContact(contact.id)} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-error-container/30 flex items-center justify-center text-error hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button onClick={addContact} className="mt-6 w-full py-3 border-2 border-dashed border-outline-variant rounded-2xl text-on-surface-variant text-sm font-bold flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined">person_add</span>
                  Add Emergency Contact
                </button>
              </div>
            </section>

            {/* Safety Tips */}
            <section className="bg-slate-900 text-white rounded-3xl p-6 overflow-hidden relative">
              <div className="relative z-10">
                <h4 className="text-lg font-bold font-headline mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary-fixed-dim">lightbulb</span>
                  Active Safety Tips
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-4 p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/5">
                    <span className="material-symbols-outlined text-primary-fixed">wb_sunny</span>
                    <p className="text-sm">Move towards well-lit areas or established storefronts with security.</p>
                  </div>
                  <div className="flex gap-4 p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/5">
                    <span className="material-symbols-outlined text-primary-fixed">alt_route</span>
                    <p className="text-sm">Avoid isolated paths or shortcuts through alleyways.</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-primary/20 rounded-full blur-2xl"></div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
