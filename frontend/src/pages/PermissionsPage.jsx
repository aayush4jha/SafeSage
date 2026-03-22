import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Camera } from '@capacitor/camera'

const PERMISSIONS_KEY = 'safesage_permissions_granted'

const permissionsList = [
  {
    id: 'location',
    icon: 'location_on',
    title: 'Location Access',
    description: 'Required for safety maps, route guidance, and sharing your location during emergencies.',
    required: true,
  },
  {
    id: 'camera',
    icon: 'photo_camera',
    title: 'Camera Access',
    description: 'Used for image verification and capturing evidence during unsafe situations.',
    required: false,
  },
]

export function hasGrantedPermissions() {
  return localStorage.getItem(PERMISSIONS_KEY) === 'true'
}

export default function PermissionsPage() {
  const navigate = useNavigate()
  const [statuses, setStatuses] = useState({})
  const [requesting, setRequesting] = useState(null)
  const [allDone, setAllDone] = useState(false)

  const isNative = Capacitor.isNativePlatform()

  useEffect(() => {
    if (!isNative) {
      localStorage.setItem(PERMISSIONS_KEY, 'true')
      navigate('/auth', { replace: true })
    }
  }, [isNative, navigate])

  async function requestPermission(id) {
    setRequesting(id)
    try {
      let status
      if (id === 'location') {
        const result = await Geolocation.requestPermissions()
        status = result.location
      } else if (id === 'camera') {
        const result = await Camera.requestPermissions()
        status = result.camera
      }
      setStatuses(prev => ({ ...prev, [id]: status }))
    } catch {
      setStatuses(prev => ({ ...prev, [id]: 'denied' }))
    }
    setRequesting(null)
  }

  async function handleGrantAll() {
    for (const perm of permissionsList) {
      if (!statuses[perm.id] || statuses[perm.id] === 'denied' || statuses[perm.id] === 'prompt') {
        await requestPermission(perm.id)
      }
    }
  }

  useEffect(() => {
    const locationGranted = statuses.location === 'granted'
    if (locationGranted) {
      setAllDone(true)
    }
  }, [statuses])

  function handleContinue() {
    localStorage.setItem(PERMISSIONS_KEY, 'true')
    navigate('/auth', { replace: true })
  }

  function getStatusColor(id) {
    const s = statuses[id]
    if (s === 'granted') return 'text-primary bg-primary/10'
    if (s === 'denied') return 'text-error bg-error/10'
    return 'text-on-surface-variant bg-surface-container-high'
  }

  function getStatusIcon(id) {
    const s = statuses[id]
    if (s === 'granted') return 'check_circle'
    if (s === 'denied') return 'cancel'
    return 'radio_button_unchecked'
  }

  if (!isNative) return null

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface flex flex-col safe-area-inset">
      {/* Header area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center mb-8 shadow-lg">
          <span
            className="material-symbols-outlined text-white"
            style={{ fontSize: '2.5rem', fontVariationSettings: "'FILL' 1" }}
          >
            shield_with_heart
          </span>
        </div>

        <h1 className="font-headline text-3xl font-bold text-center mb-3">
          App Permissions
        </h1>
        <p className="text-on-surface-variant text-center text-base max-w-sm mb-10 leading-relaxed">
          SafeSage needs a few permissions to keep you safe. These are only used for your protection.
        </p>

        {/* Permission cards */}
        <div className="w-full max-w-sm space-y-4">
          {permissionsList.map(perm => (
            <div
              key={perm.id}
              className="bg-surface-container-low rounded-2xl p-5 flex items-start gap-4"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getStatusColor(perm.id)}`}>
                <span
                  className="material-symbols-outlined text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {perm.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-on-surface">{perm.title}</h3>
                  {perm.required && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-error bg-error/10 px-2 py-0.5 rounded-full">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">{perm.description}</p>
                {!statuses[perm.id] || statuses[perm.id] === 'prompt' ? (
                  <button
                    onClick={() => requestPermission(perm.id)}
                    disabled={requesting === perm.id}
                    className="mt-3 px-4 py-2 text-sm font-semibold text-primary bg-primary/10 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    {requesting === perm.id ? 'Requesting...' : 'Grant Access'}
                  </button>
                ) : (
                  <div className="mt-3 flex items-center gap-1.5">
                    <span
                      className={`material-symbols-outlined text-lg ${statuses[perm.id] === 'granted' ? 'text-primary' : 'text-error'}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {getStatusIcon(perm.id)}
                    </span>
                    <span className={`text-sm font-medium ${statuses[perm.id] === 'granted' ? 'text-primary' : 'text-error'}`}>
                      {statuses[perm.id] === 'granted' ? 'Granted' : 'Denied'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-6 pb-10 pt-4 space-y-3 max-w-sm mx-auto w-full">
        {!allDone ? (
          <button
            onClick={handleGrantAll}
            disabled={requesting !== null}
            className="w-full py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-lg rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            Grant All Permissions
          </button>
        ) : (
          <button
            onClick={handleContinue}
            className="w-full py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-lg rounded-2xl shadow-lg active:scale-95 transition-all"
          >
            Continue to SafeSage
          </button>
        )}
        {!allDone && (
          <button
            onClick={handleContinue}
            className="w-full py-3 text-on-surface-variant font-medium text-sm rounded-xl hover:bg-surface-container-high transition-all"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}
