import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle as LeafletCircle } from 'react-leaflet'
import L from 'leaflet'
import TopNavBar from '../components/TopNavBar'
import { useSafety } from '../context/SafetyContext'
import { useCache } from '../context/CacheContext'
import { fetchFamilyNetwork, createCircle, joinCircle, leaveCircle, deleteCircle } from '../services/api'
import { formatTimestamp } from '../utils/helpers'

function memberIcon(name, color = '#006b2c') {
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;border-radius:12px;background:${color};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:14px;">${name.charAt(0).toUpperCase()}</div>`,
    iconSize: [36, 36], iconAnchor: [18, 18],
  })
}

const STATUS = {
  colors: { safe: '#10b981', moderate: '#f59e0b', unsafe: '#ef4444', unknown: '#94a3b8' },
  labels: { safe: 'SAFE', moderate: 'CAUTION', unsafe: 'DANGER', unknown: 'UNKNOWN' },
}

export default function FamilyDashboard() {
  const { userLocation } = useSafety()
  const { get, set } = useCache()
  const [network, setNetwork] = useState(() => get('family_network') || null)
  const [loading, setLoading] = useState(() => !get('family_network'))
  const [activeCircleId, setActiveCircleId] = useState(null)

  const [showModal, setShowModal] = useState(null)
  const [circleName, setCircleName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinRelationship, setJoinRelationship] = useState('Family')
  const [submitting, setSubmitting] = useState(false)
  const [resultMsg, setResultMsg] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'leave'|'delete', circleId, circleName }

  const loadNetwork = useCallback(async (force = false) => {
    if (!force && get('family_network')) { setLoading(false); return }
    try {
      const data = await fetchFamilyNetwork()
      setNetwork(data)
      set('family_network', data)
    } catch {}
    setLoading(false)
  }, [get, set])
  useEffect(() => { loadNetwork() }, [loadNetwork])

  const circles = network?.circles || []
  const allMembers = network?.members || []
  const alerts = (network?.safetyAlerts || []).filter(a => !a.acknowledged)

  const activeCircle = circles.find(c => c.id === activeCircleId)
  const circleMembers = allMembers.filter(m => m.circleId === activeCircleId)
  const mappableMembers = circleMembers.filter(m => {
    const [lng, lat] = m.lastLocation?.coordinates || [0, 0]
    return lat !== 0 || lng !== 0
  })

  const copyCode = (code) => navigator.clipboard.writeText(code).catch(() => {})

  const handleCreateCircle = async () => {
    setSubmitting(true); setResultMsg(null)
    try {
      const res = await createCircle(circleName.trim() || 'My Safety Circle')
      setResultMsg({ type: 'success', text: 'Circle created! Share this code:', code: res.circle.code })
      loadNetwork(true)
    } catch (err) {
      setResultMsg({ type: 'error', text: err.response?.data?.error || 'Failed to create circle' })
    }
    setSubmitting(false)
  }

  const handleJoinCircle = async () => {
    if (joinCode.trim().length !== 6) { setResultMsg({ type: 'error', text: 'Enter a valid 6-digit code' }); return }
    setSubmitting(true); setResultMsg(null)
    try {
      const res = await joinCircle(joinCode.trim(), joinRelationship)
      setResultMsg({ type: 'success', text: res.message })
      setTimeout(() => { setShowModal(null); resetForm(); loadNetwork(true) }, 1500)
    } catch (err) {
      setResultMsg({ type: 'error', text: err.response?.data?.error || 'Failed to join' })
    }
    setSubmitting(false)
  }

  const handleLeaveCircle = async (circleId) => {
    try {
      await leaveCircle(circleId)
      setActiveCircleId(null)
      setConfirmAction(null)
      loadNetwork(true)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to leave circle')
      setConfirmAction(null)
    }
  }

  const handleDeleteCircle = async (circleId) => {
    try {
      await deleteCircle(circleId)
      setActiveCircleId(null)
      setConfirmAction(null)
      loadNetwork(true)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete circle')
      setConfirmAction(null)
    }
  }

  const resetForm = () => { setCircleName(''); setJoinCode(''); setJoinRelationship('Family'); setResultMsg(null) }
  const closeModal = () => { setShowModal(null); resetForm() }

  // ─── LEFT: CIRCLE LIST ───
  const renderCircleList = () => (
    <>
      <div className="p-6 border-b border-outline-variant/10">
        <h3 className="font-headline text-xl font-bold mb-1">Safety Circles</h3>
        <p className="text-xs text-on-surface-variant">{circles.length} circle{circles.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>}
        {circles.map(circle => (
          <button key={circle.id} onClick={() => setActiveCircleId(circle.id)}
            className="w-full text-left p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 hover:border-primary/20 hover:bg-primary-fixed/5 transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">groups</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-on-surface truncate">{circle.name}</h4>
                  {circle.isOwner && <span className="text-[8px] font-bold px-1.5 py-0.5 bg-primary-fixed text-on-primary-fixed-variant rounded-full shrink-0">OWNER</span>}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">{circle.memberCount || 0} member{(circle.memberCount || 0) !== 1 ? 's' : ''}</p>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">chevron_right</span>
            </div>
          </button>
        ))}
        {!loading && circles.length === 0 && (
          <div className="p-8 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl opacity-20 mb-3 block">group_add</span>
            <p className="text-sm font-medium mb-1">No circles yet</p>
            <p className="text-xs">Create a circle and share the code, or join one.</p>
          </div>
        )}
      </div>
      <div className="p-4 bg-surface-container-low/50 flex gap-2">
        <button onClick={() => setShowModal('create')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm">
          <span className="material-symbols-outlined text-base">add_circle</span> Create
        </button>
        <button onClick={() => setShowModal('join')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary/30 text-primary font-semibold text-sm">
          <span className="material-symbols-outlined text-base">login</span> Join
        </button>
      </div>
    </>
  )

  // ─── LEFT: CIRCLE DETAIL ───
  const renderCircleDetail = () => (
    <>
      <div className="p-4 border-b border-outline-variant/10">
        <button onClick={() => setActiveCircleId(null)} className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary mb-2 transition-colors">
          <span className="material-symbols-outlined text-sm">arrow_back</span> All Circles
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-lg">groups</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-headline text-lg font-bold text-on-surface truncate">{activeCircle?.name}</h3>
            <p className="text-xs text-on-surface-variant">{circleMembers.length} member{circleMembers.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Invite code — only visible to the owner */}
      {activeCircle?.isOwner && activeCircle?.code && (
        <div className="px-4 pt-3">
          <div className="p-3 bg-primary-fixed/10 rounded-xl border border-primary/10">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Invite Code (only you can see this)</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface-container-highest rounded-lg px-3 py-2 font-mono text-base font-bold tracking-[0.35em] text-center text-on-surface select-all">
                {activeCircle.code}
              </div>
              <button onClick={() => copyCode(activeCircle.code)} className="p-2 rounded-lg hover:bg-surface-container-high transition-colors" title="Copy">
                <span className="material-symbols-outlined text-on-surface-variant text-lg">content_copy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 px-1">Members</p>
        {circleMembers.length === 0 && (
          <div className="p-6 text-center text-on-surface-variant text-xs">No other members yet. Share the invite code.</div>
        )}
        {circleMembers.map((member, i) => {
          const risk = member.areaRiskLevel || 'unknown'
          const hasLocation = member.lastLocation?.coordinates?.[0] !== 0 || member.lastLocation?.coordinates?.[1] !== 0
          return (
            <div key={member._id || i} className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white text-base" style={{ background: STATUS.colors[risk] }}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: hasLocation ? STATUS.colors[risk] : '#94a3b8' }}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-on-surface truncate">{member.name}</h4>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      risk === 'safe' ? 'bg-primary-fixed text-primary' :
                      risk === 'moderate' ? 'bg-tertiary-fixed text-tertiary' :
                      risk === 'unsafe' ? 'bg-error-container text-error' :
                      'bg-surface-container-high text-on-surface-variant'
                    }`}>{STATUS.labels[risk]}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{member.relationship}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">{hasLocation ? 'location_on' : 'location_off'}</span>
                    {hasLocation
                      ? `Last seen ${formatTimestamp(member.lastLocationTimestamp || member.lastActivityTimestamp)}`
                      : 'Location not available'}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Leave / Delete button */}
      <div className="p-4 border-t border-outline-variant/10">
        {activeCircle?.isOwner ? (
          <button
            onClick={() => setConfirmAction({ type: 'delete', circleId: activeCircle.id, circleName: activeCircle.name })}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-error-container/30 text-error font-semibold text-sm hover:bg-error-container/50 transition-all"
          >
            <span className="material-symbols-outlined text-base">delete</span> Delete Circle
          </button>
        ) : (
          <button
            onClick={() => setConfirmAction({ type: 'leave', circleId: activeCircle.id, circleName: activeCircle.name })}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container-high text-on-surface-variant font-semibold text-sm hover:bg-error-container/20 hover:text-error transition-all"
          >
            <span className="material-symbols-outlined text-base">logout</span> Leave Circle
          </button>
        )}
      </div>
    </>
  )

  // ─── CENTER: MAP ───
  const renderMap = () => {
    if (!activeCircle) {
      return (
        <div className="absolute inset-0 bg-surface-container flex items-center justify-center">
          <div className="text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-6xl opacity-20">map</span>
            <p className="mt-4 text-sm font-medium">Select a circle to see members on the map</p>
          </div>
        </div>
      )
    }

    const center = userLocation ? [userLocation.lat, userLocation.lng]
      : mappableMembers.length > 0 ? [mappableMembers[0].lastLocation.coordinates[1], mappableMembers[0].lastLocation.coordinates[0]]
      : [21.1702, 72.8311]

    return (
      <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="CARTO" subdomains="abcd" maxZoom={19} />

        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lng]}
              icon={L.divIcon({ className: '', html: `<div style="width:18px;height:18px;border-radius:50%;background:#006b2c;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })}>
              <Popup><div style={{ textAlign: 'center', padding: 2 }}><strong>You</strong></div></Popup>
            </Marker>
            <LeafletCircle center={[userLocation.lat, userLocation.lng]} radius={40}
              pathOptions={{ color: '#006b2c', fillColor: '#006b2c', fillOpacity: 0.08, weight: 1, opacity: 0.3 }} />
          </>
        )}

        {mappableMembers.map((member, i) => {
          const [lng, lat] = member.lastLocation.coordinates
          const risk = member.areaRiskLevel || 'unknown'
          const color = STATUS.colors[risk]
          return (
            <Marker key={member._id || i} position={[lat, lng]} icon={memberIcon(member.name, color)}>
              <Popup>
                <div style={{ textAlign: 'center', padding: 4, minWidth: 120 }}>
                  <strong style={{ fontSize: 14 }}>{member.name}</strong><br />
                  <span style={{ fontSize: 11, color: '#64748b' }}>{member.relationship}</span><br />
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{STATUS.labels[risk]}</span><br />
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>
                    {formatTimestamp(member.lastLocationTimestamp || member.lastActivityTimestamp)}
                  </span>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {mappableMembers.length === 0 && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
            padding: '10px 20px', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            fontSize: 12, color: '#64748b', fontWeight: 500,
          }}>
            Member locations will appear as they use the app
          </div>
        )}
      </MapContainer>
    )
  }

  // ─── RIGHT PANEL ───
  const displayMembers = activeCircle ? circleMembers : allMembers

  return (
    <div className="min-h-screen flex flex-col bg-surface-container-low">
      <TopNavBar
        title={activeCircle ? activeCircle.name : 'Safety Circle'}
        statusBadge={circles.length > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-fixed text-on-primary-fixed-variant rounded-full text-xs font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            LIVE PROTECTION ACTIVE
          </div>
        ) : null}
      />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden pb-20 md:pb-0">
        <section className="w-full md:w-80 bg-surface-container-lowest shadow-sm z-10 flex flex-col shrink-0 max-h-[50vh] md:max-h-none overflow-y-auto md:overflow-y-hidden">
          {activeCircle ? renderCircleDetail() : renderCircleList()}
        </section>

        <section className="flex-1 relative bg-surface-container-low overflow-hidden hidden md:block">
          {renderMap()}
        </section>

        <section className="w-full md:w-72 bg-surface p-4 md:p-6 flex flex-col gap-4 md:gap-6 shrink-0 overflow-y-auto">
          <div>
            <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface-variant/60 mb-4">Alerts</h3>
            <div className="space-y-3">
              {alerts.length === 0 && <p className="text-xs text-on-surface-variant">No active alerts</p>}
              {alerts.slice(0, 5).map((alert, i) => (
                <div key={i} className="flex gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${alert.severity === 'critical' ? 'bg-error' : alert.severity === 'warning' ? 'bg-tertiary' : 'bg-primary'}`}></div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">{alert.memberName}: {alert.message}</p>
                    <p className="text-[10px] text-on-surface-variant">{formatTimestamp(alert.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface-variant/60 mb-4">
              {activeCircle ? `${activeCircle.name} Stats` : 'Network Stats'}
            </h3>
            <div className="space-y-3">
              {['safe', 'moderate', 'unsafe'].map(level => {
                const icons = { safe: 'shield', moderate: 'warning', unsafe: 'dangerous' }
                const colors = { safe: 'text-primary', moderate: 'text-tertiary', unsafe: 'text-error' }
                const labels = { safe: 'Safe', moderate: 'Caution', unsafe: 'Danger' }
                return (
                  <div key={level} className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
                    <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined ${colors[level]} text-lg`}>{icons[level]}</span>
                      <span className="text-sm font-bold">{displayMembers.filter(m => m.areaRiskLevel === level).length} {labels[level]}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-auto p-4 bg-primary text-white rounded-2xl relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-headline font-bold text-sm mb-1">{activeCircle ? activeCircle.name : 'Safety Network'}</h4>
              <p className="text-[10px] text-on-primary-container opacity-80">
                {activeCircle ? `${circleMembers.length} member${circleMembers.length !== 1 ? 's' : ''}`
                  : circles.length > 0 ? `${circles.length} circle${circles.length !== 1 ? 's' : ''}`
                  : 'Create a circle to start.'}
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-20">
              <span className="material-symbols-outlined text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
          </div>
        </section>
      </div>

      {/* ─── CREATE / JOIN MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={closeModal}>
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            {showModal === 'create' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-2xl">add_circle</span>
                  </div>
                  <div><h3 className="font-headline text-lg font-bold">Create a Circle</h3><p className="text-xs text-on-surface-variant">You'll get a 6-digit code to share</p></div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Circle Name</label>
                  <input className="input-field w-full" placeholder="e.g. Jha Family" value={circleName} onChange={e => setCircleName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateCircle()} />
                </div>
                {resultMsg?.type === 'success' && (
                  <div className="p-4 bg-primary-fixed/20 rounded-2xl border border-primary/10 text-center space-y-2">
                    <span className="material-symbols-outlined text-primary text-3xl">check_circle</span>
                    <p className="text-sm font-medium">{resultMsg.text}</p>
                    {resultMsg.code && (
                      <div className="flex items-center justify-center gap-3 mt-2">
                        <div className="bg-surface-container-highest rounded-xl px-6 py-3 font-mono text-2xl font-bold tracking-[0.4em] select-all">{resultMsg.code}</div>
                        <button onClick={() => copyCode(resultMsg.code)} className="p-2 rounded-xl hover:bg-surface-container-high">
                          <span className="material-symbols-outlined text-on-surface-variant">content_copy</span>
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-on-surface-variant">Share this code with your family</p>
                  </div>
                )}
                {resultMsg?.type === 'error' && (
                  <div className="flex items-start gap-2 p-3 bg-error-container/30 rounded-xl">
                    <span className="material-symbols-outlined text-error text-base mt-0.5">error</span>
                    <span className="text-xs font-medium">{resultMsg.text}</span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {!resultMsg?.code
                    ? <button onClick={handleCreateCircle} disabled={submitting} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-50">{submitting ? 'Creating...' : 'Create Circle'}</button>
                    : <button onClick={closeModal} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm">Done</button>
                  }
                  {!resultMsg?.code && <button onClick={closeModal} className="py-3 px-5 bg-surface-container-high rounded-xl font-bold text-sm text-on-surface-variant">Cancel</button>}
                </div>
              </>
            )}
            {showModal === 'join' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-2xl">login</span>
                  </div>
                  <div><h3 className="font-headline text-lg font-bold">Join a Circle</h3><p className="text-xs text-on-surface-variant">Enter the 6-digit code</p></div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Circle Code</label>
                  <input className="input-field w-full text-center font-mono text-xl tracking-[0.4em] uppercase" placeholder="A B C 1 2 3" maxLength={6}
                    value={joinCode} onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setResultMsg(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleJoinCircle()} style={{ letterSpacing: '0.4em', fontSize: 20 }} />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Your relationship</label>
                  <select className="input-field w-full" value={joinRelationship} onChange={e => setJoinRelationship(e.target.value)}>
                    {['Family','Father','Mother','Son','Daughter','Brother','Sister','Husband','Wife','Friend'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {resultMsg?.type === 'success' && <div className="flex items-start gap-2 p-3 bg-primary-fixed/30 rounded-xl"><span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span><span className="text-xs font-medium">{resultMsg.text}</span></div>}
                {resultMsg?.type === 'error' && <div className="flex items-start gap-2 p-3 bg-error-container/30 rounded-xl"><span className="material-symbols-outlined text-error text-base mt-0.5">error</span><span className="text-xs font-medium">{resultMsg.text}</span></div>}
                <div className="flex gap-2 pt-2">
                  <button onClick={handleJoinCircle} disabled={submitting || joinCode.length !== 6} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-50">{submitting ? 'Joining...' : 'Join Circle'}</button>
                  <button onClick={closeModal} className="py-3 px-5 bg-surface-container-high rounded-xl font-bold text-sm text-on-surface-variant">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── CONFIRM LEAVE / DELETE MODAL ─── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setConfirmAction(null)}>
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <span className={`material-symbols-outlined text-4xl ${confirmAction.type === 'delete' ? 'text-error' : 'text-on-surface-variant'}`}>
                {confirmAction.type === 'delete' ? 'delete_forever' : 'logout'}
              </span>
              <h3 className="font-headline text-lg font-bold mt-2">
                {confirmAction.type === 'delete' ? 'Delete Circle?' : 'Leave Circle?'}
              </h3>
              <p className="text-sm text-on-surface-variant mt-1">
                {confirmAction.type === 'delete'
                  ? `This will permanently delete "${confirmAction.circleName}" and remove all members.`
                  : `You will be removed from "${confirmAction.circleName}".`
                }
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => confirmAction.type === 'delete' ? handleDeleteCircle(confirmAction.circleId) : handleLeaveCircle(confirmAction.circleId)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm ${confirmAction.type === 'delete' ? 'bg-error text-white' : 'bg-surface-container-high text-on-surface'}`}
              >
                {confirmAction.type === 'delete' ? 'Delete' : 'Leave'}
              </button>
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-3 bg-surface-container-high rounded-xl font-bold text-sm text-on-surface-variant">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
