import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { joinRewardsRoom, onRewardEarned } from '../services/socket'

export default function RewardToast() {
  const { user } = useAuth()
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((data) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, ...data }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    joinRewardsRoom(user.id)
    const cleanup = onRewardEarned((data) => {
      addToast(data)
    })
    return cleanup
  }, [user?.id, addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-3 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/10 p-4 flex items-center gap-3 min-w-[280px] max-w-[360px] animate-slide-in"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              {toast.type === 'tier_promotion' ? 'upgrade' :
               toast.type === 'streak_bonus' ? 'local_fire_department' :
               toast.type === 'bounty_completed' ? 'explore' :
               toast.type === 'weekly_challenge' ? 'emoji_events' :
               'monetization_on'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-on-surface truncate">{toast.description}</p>
            <p className="text-xs text-on-surface-variant">Balance: {toast.totalCredits} credits</p>
          </div>
          <span className="text-lg font-extrabold text-primary shrink-0">+{toast.amount}</span>
        </div>
      ))}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
