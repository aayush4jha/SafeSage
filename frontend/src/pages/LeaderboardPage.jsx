import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import TopNavBar from '../components/TopNavBar'
import { useAuth } from '../context/AuthContext'
import { fetchLeaderboard } from '../services/api'

const TIER_STYLES = {
  scout: 'bg-slate-100 text-slate-700',
  guardian: 'bg-blue-100 text-blue-700',
  sentinel: 'bg-purple-100 text-purple-700',
  shield_champion: 'bg-amber-100 text-amber-700',
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [period, setPeriod] = useState('monthly')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchLeaderboard(period, 'global', 20)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  return (
    <div className="min-h-screen bg-surface-container-low">
      <TopNavBar title="Leaderboard" subtitle="Top Contributors" />

      <main className="p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8">
        <Link to="/rewards" className="inline-flex items-center gap-1 text-sm font-semibold text-primary mb-4 hover:underline">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Rewards
        </Link>

        {/* Period Tabs */}
        <div className="flex gap-2 mb-6">
          {['weekly', 'monthly', 'alltime'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                period === p ? 'bg-primary text-white shadow-md' : 'bg-surface-container-lowest text-on-surface-variant'
              }`}
            >
              {p === 'alltime' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Top 3 Podium */}
        {entries.length >= 3 && (
          <div className="flex items-end justify-center gap-3 mb-8">
            <PodiumCard entry={entries[1]} position={2} />
            <PodiumCard entry={entries[0]} position={1} />
            <PodiumCard entry={entries[2]} position={3} />
          </div>
        )}

        {/* Leaderboard List */}
        <div className="bg-surface-container-lowest rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10">
            <h3 className="font-bold text-on-surface">Rankings</h3>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {loading && (
              <div className="p-8 text-center text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
              </div>
            )}
            {!loading && entries.length === 0 && (
              <div className="p-8 text-center text-on-surface-variant">
                <p className="font-semibold">No entries yet</p>
                <p className="text-sm">Be the first to contribute!</p>
              </div>
            )}
            {entries.map((entry, idx) => {
              const isCurrentUser = entry.userId === user?.id
              return (
                <div
                  key={entry.userId}
                  className={`px-5 py-4 flex items-center gap-4 ${isCurrentUser ? 'bg-primary/5' : 'hover:bg-surface-container-low'} transition-colors`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0 ? 'bg-amber-400 text-white' :
                    idx === 1 ? 'bg-gray-300 text-gray-700' :
                    idx === 2 ? 'bg-orange-300 text-orange-800' :
                    'bg-surface-container text-on-surface-variant'
                  }`}>
                    {entry.rank}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {entry.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold text-sm truncate ${isCurrentUser ? 'text-primary' : 'text-on-surface'}`}>
                        {entry.name} {isCurrentUser && '(You)'}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TIER_STYLES[entry.tier] || TIER_STYLES.scout}`}>
                        {entry.tierLabel}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {entry.reportsCount} reports &middot; {entry.currentStreak}d streak
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-on-surface">{entry.lifetimeCredits}</p>
                    <p className="text-xs text-on-surface-variant">credits</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

function PodiumCard({ entry, position }) {
  const heights = { 1: 'h-32', 2: 'h-24', 3: 'h-20' }
  const medals = { 1: 'bg-amber-400', 2: 'bg-gray-300', 3: 'bg-orange-300' }
  const sizes = { 1: 'w-16 h-16 text-2xl', 2: 'w-12 h-12 text-lg', 3: 'w-12 h-12 text-lg' }

  return (
    <div className="flex flex-col items-center">
      <div className={`${sizes[position]} rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold mb-2`}>
        {entry.name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <p className="text-xs font-bold text-on-surface truncate max-w-[80px] text-center">{entry.name}</p>
      <p className="text-xs text-on-surface-variant">{entry.lifetimeCredits} pts</p>
      <div className={`${heights[position]} w-20 ${medals[position]} rounded-t-xl mt-2 flex items-start justify-center pt-2`}>
        <span className="text-white font-extrabold text-lg">#{position}</span>
      </div>
    </div>
  )
}
