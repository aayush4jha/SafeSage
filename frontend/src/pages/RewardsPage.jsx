import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import TopNavBar from '../components/TopNavBar'
import { useAuth } from '../context/AuthContext'
import { useCache } from '../context/CacheContext'
import {
  fetchRewardsProfile,
  fetchImpactStats,
  fetchCreditTransactions,
  fetchWeeklyChallenges,
  fetchRewardsStore,
  redeemStoreItem,
  applyReferralCode,
} from '../services/api'

const TIER_COLORS = {
  scout: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-300', gradient: 'from-slate-400 to-slate-600' },
  guardian: { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-300', gradient: 'from-blue-400 to-blue-600' },
  sentinel: { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-300', gradient: 'from-purple-400 to-purple-600' },
  shield_champion: { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-300', gradient: 'from-amber-400 to-amber-600' },
}

const TIER_LABELS = {
  scout: 'Scout',
  guardian: 'Guardian',
  sentinel: 'Sentinel',
  shield_champion: 'Shield Champion',
}

const STORE_CATEGORY_LABELS = {
  partner_coupons: 'Partner Coupons',
  gift_cards: 'Gift Cards & Recharges',
  premium_features: 'Premium Features',
}

export default function RewardsPage() {
  const { user } = useAuth()
  const { get, set } = useCache()
  const [profile, setProfile] = useState(() => get('rewards_profile') || null)
  const [impact, setImpact] = useState(() => get('rewards_impact') || null)
  const [transactions, setTransactions] = useState([])
  const [challenges, setChallenges] = useState([])
  const [storeItems, setStoreItems] = useState([])
  const [referralInput, setReferralInput] = useState('')
  const [referralMsg, setReferralMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [storeFilter, setStoreFilter] = useState('all')
  const [redeemingId, setRedeemingId] = useState(null)
  const [redeemMsg, setRedeemMsg] = useState('')

  useEffect(() => {
    fetchRewardsProfile().then(d => { setProfile(d); set('rewards_profile', d) }).catch(() => {})
    fetchImpactStats().then(d => { setImpact(d); set('rewards_impact', d) }).catch(() => {})
    fetchCreditTransactions(10).then(setTransactions).catch(() => {})
    fetchWeeklyChallenges().then(setChallenges).catch(() => {})
    fetchRewardsStore().then(setStoreItems).catch(() => {})
  }, [set])

  const tierColor = TIER_COLORS[profile?.tier] || TIER_COLORS.scout

  const copyReferral = () => {
    if (profile?.referralCode) {
      navigator.clipboard.writeText(profile.referralCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleApplyReferral = async () => {
    if (!referralInput.trim()) return
    try {
      const result = await applyReferralCode(referralInput.trim())
      setReferralMsg(result.message)
      fetchRewardsProfile().then(d => { setProfile(d); set('rewards_profile', d) })
    } catch (err) {
      setReferralMsg(err.response?.data?.error || 'Failed to apply referral')
    }
  }

  const handleRedeem = async (item) => {
    if ((profile?.credits ?? 0) < item.cost) {
      setRedeemMsg('Insufficient credits')
      return
    }
    setRedeemingId(item.id)
    setRedeemMsg('')
    try {
      const result = await redeemStoreItem(item.id, item.name, item.cost)
      setRedeemMsg(`${result.message} Code: ${result.redemptionCode}`)
      // Refresh profile
      fetchRewardsProfile().then(d => { setProfile(d); set('rewards_profile', d) })
    } catch (err) {
      setRedeemMsg(err.response?.data?.error || 'Redemption failed')
    }
    setRedeemingId(null)
  }

  const filteredStore = storeFilter === 'all'
    ? storeItems
    : storeItems.filter(i => i.category === storeFilter)

  return (
    <div className="min-h-screen bg-surface-container-low">
      <TopNavBar title="Rewards" subtitle="Your Contributions" />

      <main className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
        {/* Tier Hero Card */}
        <div className={`relative overflow-hidden rounded-2xl md:rounded-4xl p-6 md:p-10 mb-6 bg-linear-to-br ${tierColor.gradient} text-white shadow-xl shadow-primary/10`}>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-3xl md:text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {profile?.tierIcon || 'explore'}
                </span>
                <div>
                  <p className="text-sm opacity-80 font-medium">Current Tier</p>
                  <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">{profile?.tierLabel || 'Scout'}</h1>
                </div>
              </div>
              <p className="text-sm opacity-80 mt-1">
                {profile?.tierMultiplier}x credit multiplier &middot; {profile?.streakMultiplier}x streak bonus
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">Total Credits</p>
              <h2 className="text-3xl md:text-5xl font-extrabold">{profile?.credits ?? 0}</h2>
              <p className="text-xs opacity-60">Lifetime: {profile?.lifetimeCredits ?? 0}</p>
            </div>
          </div>

          {profile?.nextTier && (
            <div className="relative z-10 mt-6">
              <div className="flex justify-between text-sm mb-1">
                <span className="opacity-80">Next: {profile.nextTier.label}</span>
                <span className="font-bold">{profile.nextTier.creditsRemaining} credits to go</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div className="bg-white rounded-full h-3 transition-all duration-500" style={{ width: `${profile.nextTier.progress}%` }} />
              </div>
            </div>
          )}

          <span className="material-symbols-outlined absolute -bottom-6 -right-6 text-[120px] opacity-10">
            {profile?.tierIcon || 'explore'}
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {['overview', 'store', 'impact', 'challenges', 'history'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* =================== OVERVIEW TAB =================== */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <StatCard icon="local_fire_department" label="Streak" value={`${profile?.currentStreak ?? 0}d`} color="text-orange-500" />
                <StatCard icon="fact_check" label="Reports" value={profile?.reportsSubmitted ?? 0} color="text-blue-500" />
                <StatCard icon="verified" label="Verified" value={profile?.reportsVerified ?? 0} color="text-green-500" />
                <StatCard icon="target" label="Bounties" value={profile?.bountiesCompleted ?? 0} color="text-purple-500" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <QuickLink to="/leaderboard" icon="leaderboard" label="Leaderboard" />
                <QuickLink to="/bounties" icon="explore" label="Bounties" />
                <QuickLink to="/zones" icon="location_on" label="My Zones" />
                <QuickLink to="/plans" icon="workspace_premium" label="Plans" />
                <QuickLink to="/report" icon="add_circle" label="New Report" />
              </div>

              {/* Streak Visual */}
              <div className="bg-surface-container-lowest p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/5">
                <h3 className="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                  Safety Streak
                </h3>
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <p className="text-3xl font-extrabold text-on-surface">{profile?.currentStreak ?? 0} days</p>
                    <p className="text-sm text-on-surface-variant">Best: {profile?.longestStreak ?? 0} days</p>
                  </div>
                  <div className="flex-1 text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      (profile?.streakMultiplier ?? 1) >= 3 ? 'bg-orange-100 text-orange-700' :
                      (profile?.streakMultiplier ?? 1) >= 2 ? 'bg-amber-100 text-amber-700' :
                      (profile?.streakMultiplier ?? 1) >= 1.5 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-surface-container text-on-surface-variant'
                    }`}>
                      {profile?.streakMultiplier ?? 1}x multiplier
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2 rounded-full ${
                        i < (profile?.currentStreak ?? 0) % 7 || (profile?.currentStreak ?? 0) >= 7
                          ? 'bg-orange-400'
                          : 'bg-surface-container-highest'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-on-surface-variant mt-2">
                  {(profile?.currentStreak ?? 0) < 3 ? 'Reach 3 days for 1.5x multiplier' :
                   (profile?.currentStreak ?? 0) < 7 ? 'Reach 7 days for 2x multiplier + 25 bonus credits' :
                   (profile?.currentStreak ?? 0) < 14 ? 'Reach 14 days for 2.5x multiplier' :
                   (profile?.currentStreak ?? 0) < 30 ? 'Reach 30 days for 3x multiplier + 100 bonus credits' :
                   'Max streak multiplier active!'}
                </p>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="md:col-span-4 space-y-6">
              <div className="bg-surface-container-lowest p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/5">
                <h3 className="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">share</span>
                  Referral Code
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-surface-container p-3 rounded-xl text-center font-mono font-bold text-lg tracking-wider text-on-surface">
                    {profile?.referralCode || '...'}
                  </div>
                  <button onClick={copyReferral} className="p-3 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors">
                    <span className="material-symbols-outlined text-lg">{copied ? 'check' : 'content_copy'}</span>
                  </button>
                </div>
                <p className="text-xs text-on-surface-variant mb-3">
                  Share with friends. Earn 50 credits per signup + 30 when they report.
                </p>
                <p className="text-sm font-semibold text-primary">{profile?.referralCount ?? 0} referrals</p>
              </div>

              <div className="bg-surface-container-lowest p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/5">
                <h3 className="text-base font-bold text-on-surface mb-3">Have a referral code?</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referralInput}
                    onChange={e => setReferralInput(e.target.value)}
                    placeholder="SS-XXXXXX"
                    className="flex-1 px-3 py-2 bg-surface-container rounded-xl text-sm font-mono uppercase"
                  />
                  <button onClick={handleApplyReferral} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold">
                    Apply
                  </button>
                </div>
                {referralMsg && <p className="text-xs mt-2 text-on-surface-variant">{referralMsg}</p>}
              </div>

              <div className="bg-surface-container-lowest p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-outline-variant/5">
                <h3 className="text-lg font-bold text-on-surface mb-4">Tier Progression</h3>
                <div className="space-y-3">
                  {Object.entries(TIER_LABELS).map(([key, label]) => {
                    const isActive = key === profile?.tier
                    const isPast = profile ? Object.keys(TIER_LABELS).indexOf(key) < Object.keys(TIER_LABELS).indexOf(profile.tier) : false
                    return (
                      <div key={key} className={`flex items-center gap-3 p-2 rounded-xl ${isActive ? `${TIER_COLORS[key].bg} ${TIER_COLORS[key].ring} ring-2` : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isActive ? `bg-linear-to-br ${TIER_COLORS[key].gradient} text-white` :
                          isPast ? 'bg-green-100 text-green-600' : 'bg-surface-container text-on-surface-variant'
                        }`}>
                          {isPast ? (
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                          ) : (
                            <span className="material-symbols-outlined text-sm">{key === 'scout' ? 'explore' : key === 'guardian' ? 'shield' : key === 'sentinel' ? 'security' : 'military_tech'}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${isActive ? TIER_COLORS[key].text : 'text-on-surface'}`}>{label}</p>
                        </div>
                        {isActive && <span className="text-xs font-bold text-primary">Current</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================== STORE TAB =================== */}
        {activeTab === 'store' && (
          <div className="space-y-6">
            <div className="bg-primary p-5 md:p-8 rounded-2xl md:rounded-3xl text-white relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mb-1">Rewards Store</h2>
                <p className="text-sm opacity-80">Redeem your credits for real rewards, discounts, and premium features.</p>
                <p className="text-lg font-extrabold mt-3">Your balance: {profile?.credits ?? 0} credits</p>
              </div>
              <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-[100px] opacity-10">storefront</span>
            </div>

            {redeemMsg && (
              <div className="bg-primary-fixed text-on-primary-fixed-variant px-4 py-3 rounded-xl text-sm font-medium">
                {redeemMsg}
              </div>
            )}

            {/* Store Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[{ key: 'all', label: 'All' }, ...Object.entries(STORE_CATEGORY_LABELS).map(([key, label]) => ({ key, label }))].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setStoreFilter(cat.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all uppercase tracking-wider ${
                    storeFilter === cat.key
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container border border-outline-variant/10'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Store Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStore.map(item => {
                const canAfford = (profile?.credits ?? 0) >= item.cost
                return (
                  <div key={item.id} className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/5 overflow-hidden flex flex-col">
                    <div className="p-5 flex-1">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-on-surface text-sm leading-tight">{item.name}</h4>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-0.5">{item.partner}</p>
                        </div>
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed">{item.description}</p>
                      {item.terms && (
                        <p className="text-[10px] text-on-surface-variant/60 mt-2 leading-relaxed">{item.terms}</p>
                      )}
                    </div>
                    <div className="px-5 py-3 bg-surface-container-low/50 border-t border-outline-variant/5 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
                        <span className="font-extrabold text-on-surface">{item.cost}</span>
                        <span className="text-xs text-on-surface-variant">credits</span>
                      </div>
                      <button
                        onClick={() => handleRedeem(item)}
                        disabled={!canAfford || redeemingId === item.id}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          canAfford
                            ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
                            : 'bg-surface-container text-on-surface-variant cursor-not-allowed'
                        }`}
                      >
                        {redeemingId === item.id ? 'Redeeming...' : canAfford ? 'Redeem' : 'Not enough'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* =================== IMPACT TAB =================== */}
        {activeTab === 'impact' && (
          <div className="space-y-6">
            <div className="bg-linear-to-br from-green-500 to-emerald-600 rounded-2xl md:rounded-3xl p-6 md:p-10 text-white shadow-xl shadow-green-500/10">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">Your Impact</h2>
              <p className="text-lg opacity-90">
                Your contributions helped an estimated <span className="font-extrabold text-3xl">{impact?.peopleHelped ?? 0}</span> people navigate safely.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <ImpactCard icon="fact_check" label="Reports Submitted" value={impact?.reportsSubmitted ?? 0} />
              <ImpactCard icon="verified" label="Verified Reports" value={impact?.reportsVerified ?? 0} />
              <ImpactCard icon="thumb_up" label="Total Upvotes" value={impact?.totalUpvotes ?? 0} />
              <ImpactCard icon="target" label="Bounties Done" value={impact?.bountiesCompleted ?? 0} />
              <ImpactCard icon="group_add" label="People Referred" value={impact?.referralCount ?? 0} />
              <ImpactCard icon="groups" label="People Helped" value={impact?.peopleHelped ?? 0} />
            </div>
          </div>
        )}

        {/* =================== CHALLENGES TAB =================== */}
        {activeTab === 'challenges' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-on-surface font-headline">Weekly Challenges</h2>
            {challenges.length === 0 && (
              <div className="bg-surface-container-lowest p-8 rounded-2xl text-center text-on-surface-variant border border-outline-variant/5">
                <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">event_busy</span>
                <p className="font-semibold">No active challenges this week</p>
                <p className="text-sm">Challenges refresh automatically — check back soon!</p>
              </div>
            )}
            {challenges.map(c => (
              <div key={c.id} className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-on-surface">{c.title}</h3>
                    <p className="text-sm text-on-surface-variant">{c.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ml-3 ${
                    c.completed ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-primary/10 text-primary'
                  }`}>
                    {c.completed ? 'Completed' : `+${c.reward_credits}`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-surface-container rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${c.completed ? 'bg-primary' : 'bg-primary/70'}`}
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-on-surface-variant">
                    {c.currentCount}/{c.target_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* =================== HISTORY TAB =================== */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-on-surface font-headline">Credit History</h2>
            {transactions.length === 0 && (
              <div className="bg-surface-container-lowest p-8 rounded-2xl text-center text-on-surface-variant border border-outline-variant/5">
                <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">receipt_long</span>
                <p className="font-semibold">No transactions yet</p>
                <p className="text-sm">Start contributing to earn credits!</p>
              </div>
            )}
            {transactions.map(txn => (
              <div key={txn.id} className="bg-surface-container-lowest px-5 py-4 rounded-2xl shadow-sm border border-outline-variant/5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${txn.amount >= 0 ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-error-container/40 text-on-error-container'}`}>
                  <span className="material-symbols-outlined">{txn.amount >= 0 ? 'add_circle' : 'remove_circle'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface text-sm truncate">{txn.description}</p>
                  <p className="text-xs text-on-surface-variant">{new Date(txn.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`font-bold text-lg ${txn.amount >= 0 ? 'text-primary' : 'text-error'}`}>
                  {txn.amount >= 0 ? '+' : ''}{txn.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-outline-variant/5">
      <span className={`material-symbols-outlined text-lg ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <p className="text-xs text-on-surface-variant mt-2 font-medium">{label}</p>
      <p className="text-2xl font-extrabold text-on-surface">{value}</p>
    </div>
  )
}

function ImpactCard({ icon, label, value }) {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/5 text-center">
      <span className="material-symbols-outlined text-3xl text-primary mb-2 block" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <p className="text-2xl font-extrabold text-on-surface">{value}</p>
      <p className="text-xs text-on-surface-variant font-medium mt-1">{label}</p>
    </div>
  )
}

function QuickLink({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-outline-variant/5 flex flex-col items-center gap-2 hover:bg-surface-container-low transition-colors"
    >
      <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
      <span className="text-xs font-semibold text-on-surface">{label}</span>
    </Link>
  )
}
