import useGuardianMode from '../hooks/useGuardianMode'
import { useSafety } from '../context/SafetyContext'

export default function GuardianAlert() {
  const { guardianMode } = useSafety()
  const { guardianState, timeRemaining, dismissAlert, isInDangerZone } = useGuardianMode()

  if (!guardianMode || guardianState === 'idle') return null

  // Danger zone entered — yellow banner
  if (guardianState === 'danger_zone' && isInDangerZone) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9998] flex justify-center pointer-events-none">
        <div className="mt-20 mx-4 px-6 py-4 bg-yellow-50 border border-yellow-300 rounded-2xl shadow-lg flex items-center gap-3 pointer-events-auto max-w-lg">
          <span className="material-symbols-outlined text-yellow-600" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <div>
            <p className="font-bold text-yellow-800 text-sm">You are in a danger zone</p>
            <p className="text-xs text-yellow-700">Stay alert. Guardian Mode is monitoring your movement.</p>
          </div>
        </div>
      </div>
    )
  }

  // Speed dropped — red alert with I'm OK button
  if (guardianState === 'alert') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="mx-4 p-8 bg-white rounded-[2rem] shadow-2xl max-w-sm w-full text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-600 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">Movement Slowed</h2>
          <p className="text-sm text-gray-600 mb-6">
            Your movement has slowed in a danger zone. If you don't respond, your emergency contacts will be notified.
          </p>

          {/* Countdown */}
          <div className="mb-6">
            <div className="relative w-24 h-24 mx-auto">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#fee2e2" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke="#dc2626" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - timeRemaining / 60)}`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-extrabold text-red-600">{timeRemaining}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">seconds remaining</p>
          </div>

          {/* I'm OK button */}
          <button
            onClick={dismissAlert}
            className="w-full py-4 bg-primary text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            I'm OK
          </button>
        </div>
      </div>
    )
  }

  // Emergency triggered
  if (guardianState === 'emergency') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="mx-4 p-8 bg-white rounded-[2rem] shadow-2xl max-w-sm w-full text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-600 flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>sos</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">Emergency Alert Sent</h2>
          <p className="text-sm text-gray-600 mb-4">
            Your emergency contacts have been notified with your current location. Help is on the way.
          </p>
          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 rounded-xl">
            <span className="material-symbols-outlined text-red-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>radio_button_checked</span>
            <span className="text-xs font-bold text-red-700">Live tracking shared with contacts</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}
