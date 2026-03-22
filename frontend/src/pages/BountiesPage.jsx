import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import TopNavBar from '../components/TopNavBar'
import { useSafety } from '../context/SafetyContext'
import { fetchBounties, claimBounty } from '../services/api'

export default function BountiesPage() {
  const { userLocation } = useSafety()
  const [bounties, setBounties] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const lat = userLocation?.lat || 23.0225
    const lng = userLocation?.lng || 72.5714
    fetchBounties(lat, lng, 50)
      .then(setBounties)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userLocation])

  const handleClaim = async (bountyId) => {
    setClaimingId(bountyId)
    setMessage('')
    try {
      const result = await claimBounty(bountyId)
      setMessage(result.message)
      setBounties(prev => prev.map(b =>
        b.id === bountyId ? { ...b, status: 'claimed' } : b
      ))
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to claim bounty')
    }
    setClaimingId(null)
  }

  const formatDistance = (meters) => {
    if (!meters) return ''
    if (meters < 1000) return `${Math.round(meters)}m away`
    return `${(meters / 1000).toFixed(1)}km away`
  }

  const timeLeft = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date()
    if (diff <= 0) return 'Expired'
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (days > 0) return `${days}d ${hours}h left`
    return `${hours}h left`
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      <TopNavBar title="Bounties" subtitle="Verification Missions" />

      <main className="p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8">
        <Link to="/rewards" className="inline-flex items-center gap-1 text-sm font-semibold text-primary mb-4 hover:underline">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Rewards
        </Link>

        {/* Info Banner */}
        <div className="bg-linear-to-r from-primary to-primary-container p-5 rounded-2xl md:rounded-3xl mb-6 text-white">
          <h2 className="text-lg font-bold mb-1">How Bounties Work</h2>
          <p className="text-sm opacity-90">
            Areas with stale or missing safety data need fresh reports.
            Claim a bounty, visit the location, and submit a report to earn bonus credits.
          </p>
        </div>

        {message && (
          <div className="bg-primary-fixed text-on-primary-fixed-variant px-4 py-3 rounded-xl mb-4 text-sm font-medium">
            {message}
          </div>
        )}

        {loading && (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-3xl block mb-2">progress_activity</span>
            <p>Finding bounties near you...</p>
          </div>
        )}

        {!loading && bounties.length === 0 && (
          <div className="bg-surface-container-lowest p-10 rounded-2xl text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-3 block">explore_off</span>
            <p className="font-bold text-lg mb-1">No bounties available</p>
            <p className="text-sm">All areas are well-covered! Check back later.</p>
          </div>
        )}

        <div className="space-y-4">
          {bounties.map(bounty => (
            <div key={bounty.id} className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/5 overflow-hidden">
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary">location_on</span>
                      <h3 className="font-bold text-on-surface">{bounty.area_name || 'Unnamed Area'}</h3>
                    </div>
                    <p className="text-sm text-on-surface-variant">{bounty.description}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-xl font-extrabold text-primary">+{bounty.reward_credits}</span>
                    <p className="text-xs text-on-surface-variant">credits</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-on-surface-variant mb-3">
                  {bounty.distance != null && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">near_me</span>
                      {formatDistance(bounty.distance)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {timeLeft(bounty.expires_at)}
                  </span>
                  {bounty.time_window && bounty.time_window !== 'any' && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">dark_mode</span>
                      {bounty.time_window.replace('_', ' ')}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {bounty.status === 'open' && (
                    <button
                      onClick={() => handleClaim(bounty.id)}
                      disabled={claimingId === bounty.id}
                      className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {claimingId === bounty.id ? 'Claiming...' : 'Claim Bounty'}
                    </button>
                  )}
                  {bounty.status === 'claimed' && (
                    <Link
                      to="/report"
                      className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm text-center hover:bg-green-600 transition-colors"
                    >
                      Submit Report to Complete
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
