import { useState, useEffect } from 'react'
import TopNavBar from '../components/TopNavBar'
import { useSafety } from '../context/SafetyContext'
import { useAuth } from '../context/AuthContext'
import { useCache } from '../context/CacheContext'
import { fetchUserStats, fetchEmergencyHistory, fetchRewardsProfile } from '../services/api'
import { formatTimestamp } from '../utils/helpers'

export default function ProfilePage() {
  const { trackingEnabled, setTrackingEnabled, emergencyContacts, guardianMode, setGuardianMode } = useSafety()
  const { user, logout } = useAuth()
  const { get, set } = useCache()
  const [stats, setStats] = useState(() => get('profile_stats') || null)
  const [history, setHistory] = useState(() => get('profile_history') || [])
  const [rewards, setRewards] = useState(() => get('profile_rewards') || null)

  useEffect(() => {
    if (!get('profile_stats')) {
      fetchUserStats().then(d => { setStats(d); set('profile_stats', d) }).catch(() => {})
    }
    if (!get('profile_history')) {
      fetchEmergencyHistory().then(d => {
        if (Array.isArray(d)) { const sliced = d.slice(0, 3); setHistory(sliced); set('profile_history', sliced) }
      }).catch(() => {})
    }
    if (!get('profile_rewards')) {
      fetchRewardsProfile().then(d => { setRewards(d); set('profile_rewards', d) }).catch(() => {})
    }
  }, [get, set])

  // Contribution score: backend score + client-side location tracking bonus (15 pts)
  const trackingBonus = trackingEnabled ? 15 : 0
  const contributionScore = Math.min(100, (stats?.contributionScore ?? 0) + trackingBonus)


  return (
    <div className="min-h-screen bg-surface-container-low">
      <TopNavBar title="Settings" subtitle="Profile" />

      <main className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 gap-4 md:gap-6">
          <div className="flex items-center gap-4 md:gap-8">
            <div className="relative shrink-0">
              <div className="w-18 h-18 md:w-32 md:h-32 rounded-2xl md:rounded-3xl overflow-hidden ring-4 ring-white shadow-lg bg-primary flex items-center justify-center text-white text-3xl md:text-5xl font-extrabold">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 md:-bottom-2 md:-right-2 bg-primary text-white p-1.5 md:p-2 rounded-lg md:rounded-xl shadow-xl">
                <span className="material-symbols-outlined text-xs md:text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 md:gap-3 mb-1 flex-wrap">
                <h1 className="text-xl md:text-4xl font-extrabold tracking-tight text-on-surface truncate">{user?.name || 'User'}</h1>
                <span className="px-2 md:px-3 py-0.5 md:py-1 bg-primary-fixed text-on-primary-fixed-variant text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-full">{rewards?.tierLabel || 'Scout'}</span>
              </div>
              <p className="text-on-surface-variant font-medium flex items-center gap-2 text-xs md:text-sm truncate">
                <span className="material-symbols-outlined text-sm">mail</span>
                {user?.email || ''}
              </p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={logout} className="px-5 md:px-6 py-2.5 md:py-3 bg-surface-container-lowest text-error font-semibold rounded-xl md:rounded-2xl shadow-sm hover:bg-error-container/30 transition-all text-sm">
              Sign Out
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          <div className="bg-surface-container-lowest p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/10">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <span className="p-2 md:p-3 bg-primary/10 text-primary rounded-xl md:rounded-2xl">
                <span className="material-symbols-outlined text-lg md:text-2xl">volunteer_activism</span>
              </span>
            </div>
            <p className="text-xs md:text-sm text-on-surface-variant mb-1 font-medium">Contribution</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-on-surface">{contributionScore}</h2>
          </div>
          <div className="bg-surface-container-lowest p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/10">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <span className="p-2 md:p-3 bg-secondary/10 text-secondary rounded-xl md:rounded-2xl">
                <span className="material-symbols-outlined text-lg md:text-2xl">fact_check</span>
              </span>
            </div>
            <p className="text-xs md:text-sm text-on-surface-variant mb-1 font-medium">Reports</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-on-surface">{stats?.reportsSubmitted ?? '...'}</h2>
          </div>
          <div className="bg-surface-container-lowest p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/10">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <span className="p-2 md:p-3 bg-tertiary/10 text-tertiary rounded-xl md:rounded-2xl">
                <span className="material-symbols-outlined text-lg md:text-2xl">group</span>
              </span>
            </div>
            <p className="text-xs md:text-sm text-on-surface-variant mb-1 font-medium">Contacts</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-on-surface">{stats?.emergencyContacts ?? emergencyContacts.length}</h2>
          </div>
          <div className="bg-primary bg-linear-to-br from-primary to-primary-container p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl shadow-primary/10 text-white">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <span className="p-2 md:p-3 bg-white/20 text-white rounded-xl md:rounded-2xl">
                <span className="material-symbols-outlined text-lg md:text-2xl">military_tech</span>
              </span>
            </div>
            <p className="text-xs md:text-sm opacity-80 mb-1 font-medium">Days Active</p>
            <h2 className="text-2xl md:text-3xl font-extrabold">{stats?.daysActive ?? '...'}</h2>
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
          {/* Left: Activity */}
          <div className="md:col-span-8 space-y-6 md:space-y-8">
            {/* Location Tracking Toggle */}
            <div className="bg-surface-container-lowest p-5 md:p-8 rounded-2xl md:rounded-4xl shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-on-surface mb-1">Location Tracking</h3>
                  <p className="text-sm text-on-surface-variant">Share your real-time location with family network</p>
                </div>
                <button
                  onClick={() => setTrackingEnabled(!trackingEnabled)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${trackingEnabled ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${trackingEnabled ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            </div>

            {/* Recent Audit History */}
            <div className="bg-surface-container-lowest overflow-hidden rounded-2xl md:rounded-4xl shadow-sm">
              <div className="p-5 md:p-8 border-b border-outline-variant/10 flex justify-between items-center">
                <h3 className="text-lg md:text-xl font-bold text-on-surface">Recent Activity</h3>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {history.length === 0 && (
                  <div className="p-8 text-center text-on-surface-variant text-sm">No recent activity</div>
                )}
                {history.map(item => {
                  const resolved = item.status === 'resolved' || item.status === 'false_alarm'
                  return (
                    <div key={item.id} className="px-4 md:px-8 py-4 md:py-5 flex items-center gap-3 md:gap-6 hover:bg-surface-container-low transition-colors">
                      <div className={`w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl flex items-center justify-center ${
                        resolved ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                      }`}>
                        <span className="material-symbols-outlined">{resolved ? 'check_circle' : 'warning'}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-on-surface">{item.trigger_type === 'manual' ? 'Manual SOS Alert' : item.trigger_type}</h4>
                        <p className="text-sm text-on-surface-variant">{formatTimestamp(item.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${resolved ? 'text-primary' : 'text-tertiary'}`}>{resolved ? 'Resolved' : 'Active'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: Settings */}
          <div className="md:col-span-4 space-y-6 md:space-y-8">
            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-2xl md:rounded-4xl shadow-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className={`p-2.5 rounded-xl ${guardianMode ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: guardianMode ? "'FILL' 1" : "'FILL' 0" }}>shield</span>
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">Auto Guardian</h3>
                    <p className="text-xs text-on-surface-variant">Danger zone alerts & monitoring</p>
                  </div>
                </div>
                <button
                  onClick={() => setGuardianMode(!guardianMode)}
                  className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${guardianMode ? 'bg-primary' : 'bg-outline/30'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 rounded-full shadow-md transition-all duration-200 ${guardianMode ? 'left-5.5 bg-white' : 'left-0.5 bg-white'}`}></div>
                </button>
              </div>
              {guardianMode && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/8 rounded-xl mt-3">
                  <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-xs font-semibold text-primary">Active</span>
                </div>
              )}
            </div>

            {/* Rewards Summary */}
            <a href="/rewards" className="block bg-linear-to-br from-primary to-primary-container p-5 md:p-6 rounded-2xl md:rounded-4xl text-white relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{rewards?.tierIcon || 'explore'}</span>
                  <h4 className="font-bold">{rewards?.tierLabel || 'Scout'}</h4>
                </div>
                <p className="text-3xl font-extrabold">{rewards?.credits ?? 0} <span className="text-sm font-medium opacity-80">credits</span></p>
                <div className="flex items-center gap-3 mt-2 text-xs opacity-80">
                  <span>{rewards?.currentStreak ?? 0}d streak</span>
                  <span>{rewards?.tierMultiplier ?? 1}x multiplier</span>
                </div>
                <p className="text-xs mt-3 font-semibold opacity-90">View Rewards &rarr;</p>
              </div>
              <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-9xl opacity-10 group-hover:scale-110 transition-transform duration-500">military_tech</span>
            </a>

            {/* Support */}
            <div className="bg-surface-container-highest p-6 md:p-8 rounded-2xl md:rounded-4xl relative overflow-hidden group">
              <div className="relative z-10">
                <h4 className="font-bold text-on-surface mb-2">Need assistance?</h4>
                <p className="text-sm text-on-surface-variant mb-6">Our 24/7 Security Operations Center is ready to help.</p>
                <button className="w-full py-3 bg-inverse-surface text-inverse-on-surface rounded-xl font-bold text-sm">Contact Support</button>
              </div>
              <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-9xl text-on-surface/5 group-hover:scale-110 transition-transform duration-500">support_agent</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
