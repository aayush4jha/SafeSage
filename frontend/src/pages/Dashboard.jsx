import { useState, useEffect, useCallback, useRef } from 'react'
import TopNavBar from '../components/TopNavBar'
import { useSafety } from '../context/SafetyContext'
import { useAuth } from '../context/AuthContext'
import { useCache } from '../context/CacheContext'
import { fetchReports, fetchDangerPredictions, fetchDashboardScores, fetchRewardsProfile } from '../services/api'
import { formatTimestamp } from '../utils/helpers'

export default function Dashboard() {
  const { userLocation, safetyScore } = useSafety()
  const { user } = useAuth()
  const { get, set } = useCache()
  const [reports, setReports] = useState(() => get('dashboard_reports') || [])
  const [predictions, setPredictions] = useState(() => get('dashboard_predictions') || [])
  const [cityScore, setCityScore] = useState(() => get('dashboard_cityScore') ?? null)
  const [personalScore, setPersonalScore] = useState(() => get('dashboard_personalScore') ?? null)
  const [cityName, setCityName] = useState(() => get('dashboard_cityName') || 'City')
  const [rewards, setRewards] = useState(() => get('dashboard_rewards') || null)
  const lastLocationRef = useRef(null)

  // Reverse geocode to get city name
  useEffect(() => {
    if (!userLocation) return
    const locKey = `${userLocation.lat.toFixed(3)}_${userLocation.lng.toFixed(3)}`
    if (lastLocationRef.current === locKey && get('dashboard_cityName')) return
    lastLocationRef.current = locKey

    let cancelled = false
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLocation.lat}&lon=${userLocation.lng}&zoom=10&accept-language=en`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.state_district || 'City'
        setCityName(city)
        set('dashboard_cityName', city, 10 * 60 * 1000)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [userLocation?.lat, userLocation?.lng, get, set])

  const loadData = useCallback(async (force = false) => {
    const center = userLocation || { lat: 23.0225, lng: 72.5714 }
    // Skip fetch if we already have cached data and not forcing
    if (!force && get('dashboard_reports')) return

    try {
      const data = await fetchReports(center.lat, center.lng, 500)
      if (Array.isArray(data)) {
        const sliced = data.slice(0, 5)
        setReports(sliced)
        set('dashboard_reports', sliced)
      }
    } catch {}
    try {
      const preds = await fetchDangerPredictions()
      if (Array.isArray(preds)) {
        const sliced = preds.slice(0, 3)
        setPredictions(sliced)
        set('dashboard_predictions', sliced)
      }
    } catch {}
    try {
      const scores = await fetchDashboardScores(center.lat, center.lng)
      if (scores) {
        setCityScore(scores.cityScore)
        setPersonalScore(scores.personalScore)
        set('dashboard_cityScore', scores.cityScore)
        set('dashboard_personalScore', scores.personalScore)
      }
    } catch {}
  }, [userLocation, get, set])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!get('dashboard_rewards')) {
      fetchRewardsProfile().then(d => { setRewards(d); set('dashboard_rewards', d) }).catch(() => {})
    }
  }, [get, set])

  const cScore = cityScore ?? 50
  const pScore = personalScore ?? 72

  const categoryLabels = {
    dark_road: 'Dark Road', unsafe_street: 'Unsafe Street',
    suspicious_activity: 'Suspicious Activity', harassment: 'Harassment',
    no_streetlights: 'No Streetlights', poor_visibility: 'Poor Visibility',
    isolated_area: 'Isolated Area', other: 'Other',
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      <TopNavBar title="Dashboard" subtitle="Overview" />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-8">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          {/* City Safety Score Card */}
          <div className="relative overflow-hidden bg-primary p-5 md:p-8 rounded-2xl md:rounded-4xl text-white shadow-lg shadow-primary/10 flex flex-col justify-between min-h-60 md:min-h-80">
            <div className="relative z-10">
              <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-wider uppercase border border-white/10">
                City Safety
              </span>
              <h2 className="mt-4 md:mt-6 font-headline text-2xl md:text-4xl font-extrabold tracking-tight">
                {cityName} Safety Score: {cScore}
              </h2>
              <p className="mt-2 text-primary-fixed-dim font-medium max-w-md text-sm md:text-base">
                Based on 30-day incident trends — tracks whether report clusters are accelerating or slowing down.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <span className={`text-sm font-bold ${cScore >= 65 ? 'text-green-300' : cScore >= 40 ? 'text-yellow-300' : 'text-red-300'}`}>
                  {cScore >= 65 ? 'Improving Trend' : cScore >= 40 ? 'Moderate Activity' : 'Escalating Risk'}
                </span>
                <span className="material-symbols-outlined text-sm" style={{ color: cScore >= 65 ? '#86efac' : cScore >= 40 ? '#fde047' : '#fca5a5' }}>
                  {cScore >= 65 ? 'trending_down' : cScore >= 40 ? 'trending_flat' : 'trending_up'}
                </span>
              </div>
            </div>
            <div className="relative z-10 flex flex-wrap gap-3 md:gap-4 mt-6 md:mt-8">
              <a href="/report" className="px-4 md:px-6 py-2.5 md:py-3 bg-surface-container-lowest text-primary rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform no-underline text-sm md:text-base">
                <span className="material-symbols-outlined text-sm md:text-base" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                Report Concern
              </a>
              <a href="/map" className="px-4 md:px-6 py-2.5 md:py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl font-bold hover:bg-white/20 transition-all no-underline text-white text-sm md:text-base">
                View Map
              </a>
            </div>
            <div className="absolute -right-16 -bottom-16 w-48 md:w-80 h-48 md:h-80 bg-primary-container rounded-full opacity-50 blur-3xl"></div>
            <div className="absolute right-4 md:right-12 top-4 md:top-12">
              <span className="material-symbols-outlined text-7xl md:text-9xl opacity-10">location_city</span>
            </div>
          </div>

          {/* Personal Safety Score Card */}
          <div className="relative overflow-hidden bg-surface-container-lowest p-5 md:p-8 rounded-2xl md:rounded-4xl shadow-lg border border-outline-variant/5 flex flex-col justify-between min-h-60 md:min-h-80">
            <div className="relative z-10">
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border ${
                pScore >= 65 ? 'bg-green-50 text-green-700 border-green-200' :
                pScore >= 40 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                Personal Safety
              </span>
              <h2 className="mt-4 md:mt-6 font-headline text-2xl md:text-4xl font-extrabold tracking-tight text-on-surface">
                Nearby Safety Score: {pScore}
              </h2>
              <p className="mt-2 text-on-surface-variant font-medium max-w-md text-sm md:text-base">
                Based on danger zones within 2 km of your current location. Welcome back, {user?.name || 'Guardian'}.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <span className={`text-sm font-bold ${pScore >= 65 ? 'text-primary' : pScore >= 40 ? 'text-tertiary' : 'text-error'}`}>
                  {pScore >= 65 ? 'Safe Zone' : pScore >= 40 ? 'Stay Alert' : 'High Risk Area'}
                </span>
                <span className="material-symbols-outlined text-sm" style={{ color: pScore >= 65 ? '#006b2c' : pScore >= 40 ? '#825100' : '#ba1a1a' }}>
                  {pScore >= 65 ? 'verified_user' : pScore >= 40 ? 'warning' : 'emergency'}
                </span>
              </div>
            </div>
            <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-primary-fixed-dim/10 rounded-full blur-3xl"></div>
            <div className="absolute right-4 md:right-12 top-4 md:top-12">
              <span className="material-symbols-outlined text-7xl md:text-9xl opacity-5 text-on-surface">person_pin_circle</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
          <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/5">
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider mb-4">City / Personal</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-headline font-extrabold">{cScore}</span>
                <span className="text-on-surface-variant text-lg font-bold mb-0.5">/</span>
                <span className="text-3xl font-headline font-extrabold">{pScore}</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/5">
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider mb-4">Nearby Reports</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-xl">fact_check</span>
                </div>
                <span className="text-3xl font-headline font-extrabold">{reports.length}</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/5">
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider mb-4">Risk Zones</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-headline font-extrabold">{predictions.length}</span>
                <span className="text-xs font-bold mb-1 text-error">Active</span>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/5 flex flex-col justify-between">
            <div>
              <h4 className="font-headline font-bold text-sm">Location</h4>
              <p className="text-[11px] text-on-surface-variant mt-1">Current position</p>
            </div>
            <div className="mt-4">
              <div className="text-sm font-bold text-on-surface">
                {userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'Acquiring...'}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-primary text-sm">my_location</span>
                <span className="text-[10px] font-bold text-primary">Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rewards Quick Access */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
          <a href="/rewards" className="md:col-span-2 bg-surface-container-lowest p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/5 flex items-center gap-4 hover:bg-surface-container-low transition-colors no-underline">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{rewards?.tierIcon || 'military_tech'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">{rewards?.tierLabel || 'Scout'} &middot; {rewards?.currentStreak || 0}d streak</p>
              <p className="text-2xl font-extrabold text-on-surface">{rewards?.credits ?? 0} <span className="text-sm font-medium text-on-surface-variant">credits</span></p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </a>
          <a href="/leaderboard" className="bg-surface-container-lowest p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/5 flex items-center gap-3 hover:bg-surface-container-low transition-colors no-underline">
            <span className="material-symbols-outlined text-primary text-xl">leaderboard</span>
            <div>
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Leaderboard</p>
              <p className="text-sm font-bold text-on-surface">Top Contributors</p>
            </div>
          </a>
          <a href="/bounties" className="bg-surface-container-lowest p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/5 flex items-center gap-3 hover:bg-surface-container-low transition-colors no-underline">
            <span className="material-symbols-outlined text-primary text-xl">explore</span>
            <div>
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Bounties</p>
              <p className="text-sm font-bold text-on-surface">Earn Bonus Credits</p>
            </div>
          </a>
        </div>

        {/* Recent Reports */}
        <div className="bg-surface-container-lowest rounded-2xl md:rounded-4xl shadow-sm border border-outline-variant/5 overflow-hidden">
          <div className="p-4 md:p-8 border-b border-surface-container-low flex justify-between items-center">
            <h3 className="font-headline text-lg md:text-xl font-bold">Recent Safety Reports</h3>
            <a href="/report" className="text-xs md:text-sm font-bold text-primary flex items-center gap-1 hover:underline no-underline">
              Report New
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
          </div>
          {reports.length === 0 ? (
            <div className="p-8 md:p-12 text-center text-on-surface-variant text-sm">
              No reports nearby. Your area appears safe.
            </div>
          ) : (
            <>
              {/* Mobile: Card layout */}
              <div className="md:hidden divide-y divide-surface-container-low">
                {reports.map((report, i) => {
                  const sev = report.severity || 3
                  const statusColor = sev >= 4 ? 'error' : sev >= 3 ? 'tertiary' : 'primary'
                  const statusLabel = sev >= 4 ? 'Risk' : sev >= 3 ? 'Caution' : 'Secure'
                  return (
                    <div key={report._id || i} className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-sm text-on-surface-variant">location_on</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold truncate">{categoryLabels[report.category] || report.category}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                            statusColor === 'error' ? 'bg-error-container/40 text-on-error-container' :
                            statusColor === 'tertiary' ? 'bg-tertiary-fixed/40 text-on-tertiary-fixed-variant' :
                            'bg-primary-fixed/40 text-on-primary-fixed-variant'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              statusColor === 'error' ? 'bg-error' : statusColor === 'tertiary' ? 'bg-tertiary' : 'bg-primary'
                            }`}></span>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5">{formatTimestamp(report.timestamp)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Desktop: Table layout */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-8 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Category</th>
                      <th className="px-8 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Timestamp</th>
                      <th className="px-8 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Severity</th>
                      <th className="px-8 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {reports.map((report, i) => {
                      const sev = report.severity || 3
                      const statusColor = sev >= 4 ? 'error' : sev >= 3 ? 'tertiary' : 'primary'
                      const statusLabel = sev >= 4 ? 'Risk' : sev >= 3 ? 'Caution' : 'Secure'
                      return (
                        <tr key={report._id || i} className="hover:bg-surface-container-low/30 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center">
                                <span className="material-symbols-outlined text-sm text-on-surface-variant">location_on</span>
                              </div>
                              <span className="text-sm font-bold">{categoryLabels[report.category] || report.category}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-sm text-on-surface-variant">{formatTimestamp(report.timestamp)}</td>
                          <td className="px-8 py-5">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                              statusColor === 'error' ? 'bg-error-container/40 text-on-error-container' :
                              statusColor === 'tertiary' ? 'bg-tertiary-fixed/40 text-on-tertiary-fixed-variant' :
                              'bg-primary-fixed/40 text-on-primary-fixed-variant'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                statusColor === 'error' ? 'bg-error' : statusColor === 'tertiary' ? 'bg-tertiary' : 'bg-primary'
                              }`}></span>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                              <span className="text-xs font-medium">Verified</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
