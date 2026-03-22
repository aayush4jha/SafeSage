import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { isNightTime, getTimeOfDay } from '../utils/helpers'
import { fetchDashboardScores, triggerEmergencyAlert, resolveEmergencyAlert, updateEmergencyContacts as updateContactsAPI, fetchProfile, fetchFamilyNetwork } from '../services/api'
import { connectSocket, emitEmergencyAlert, emitLocationUpdate, joinFamilyRooms } from '../services/socket'
import { useAuth } from './AuthContext'

const SafetyContext = createContext(null)

const DEFAULT_LOCATION = { lat: 23.0225, lng: 72.5714 }

export function SafetyProvider({ children }) {
  const { user, token, setUser } = useAuth()

  const [userLocation, setUserLocation] = useState(DEFAULT_LOCATION)
  const [locationHistory, setLocationHistory] = useState([])
  const [locationError, setLocationError] = useState(null)
  const [isTracking, setIsTracking] = useState(false)
  const [nightMode, setNightMode] = useState(isNightTime())
  const [safetyScore, setSafetyScore] = useState(null)
  const [activeEmergency, setActiveEmergency] = useState(false)
  const [emergencyId, setEmergencyId] = useState(null)
  const [trackingEnabled, setTrackingEnabled] = useState(true)
  const [guardianMode, setGuardianMode] = useState(() => {
    try { return localStorage.getItem('guardianMode') === 'true' } catch { return false }
  })

  const [nearbyPolice, setNearbyPolice] = useState([])

  // Emergency contacts from user profile (Supabase)
  const [emergencyContacts, setEmergencyContactsLocal] = useState(user?.emergencyContacts || [])

  // Sync contacts from user on mount
  useEffect(() => {
    if (user?.emergencyContacts) {
      setEmergencyContactsLocal(user.emergencyContacts)
    }
  }, [user])

  // Save contacts to Supabase when they change
  const setEmergencyContacts = useCallback(async (contacts) => {
    setEmergencyContactsLocal(contacts)
    if (token) {
      try {
        const result = await updateContactsAPI(contacts)
        if (result?.emergencyContacts) {
          setEmergencyContactsLocal(result.emergencyContacts)
        }
      } catch (err) {
        console.warn('Failed to save contacts to server:', err.message)
      }
    }
  }, [token])

  const watchIdRef = useRef(null)

  // Persist guardian mode to localStorage
  useEffect(() => {
    try { localStorage.setItem('guardianMode', guardianMode) } catch {}
  }, [guardianMode])

  const isInDangerZone = safetyScore !== null && safetyScore < 40

  // Night mode check every minute
  useEffect(() => {
    const interval = setInterval(() => setNightMode(isNightTime()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Connect socket and join family rooms for real-time alerts
  useEffect(() => {
    try { connectSocket() } catch (e) { console.warn('Socket connection failed:', e) }
    if (token) {
      fetchFamilyNetwork()
        .then(data => {
          if (data?.circles?.length) {
            joinFamilyRooms(data.circles.map(c => c.id))
          }
        })
        .catch(() => {})
    }
  }, [token])

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => setUserLocation(DEFAULT_LOCATION),
      { enableHighAccuracy: true }
    )

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }
        setUserLocation({ lat: loc.lat, lng: loc.lng })
        setLocationHistory(prev => [...prev.slice(-49), loc])
        setIsTracking(true)
        setLocationError(null)
      },
      (err) => {
        setLocationError(err.message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
    watchIdRef.current = id

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  // Emit location updates via socket + persist to DB for family circles
  const lastDbPushRef = useRef(null)
  useEffect(() => {
    if (userLocation && trackingEnabled) {
      emitLocationUpdate(userLocation)

      // Push location to DB every 30s for family circle tracking
      const now = Date.now()
      if (!lastDbPushRef.current || now - lastDbPushRef.current > 30000) {
        lastDbPushRef.current = now
        import('../services/api').then(({ updateFamilyLocation }) => {
          updateFamilyLocation(userLocation.lat, userLocation.lng).catch(() => {})
        })
      }
    }
  }, [userLocation, trackingEnabled])

  // Fetch safety score using the same endpoint as Dashboard (personalScore)
  const lastFetchRef = useRef(null)
  const updateSafetyScore = useCallback(async (lat, lng) => {
    try {
      const data = await fetchDashboardScores(lat, lng)
      if (data?.personalScore != null) setSafetyScore(data.personalScore)
    } catch {
      // Leave score as null if backend unavailable
    }
  }, [])

  useEffect(() => {
    if (!userLocation) return
    const now = Date.now()
    if (lastFetchRef.current && now - lastFetchRef.current < 30000) return
    lastFetchRef.current = now
    updateSafetyScore(userLocation.lat, userLocation.lng)
  }, [userLocation, updateSafetyScore])

  const triggerEmergency = useCallback(async () => {
    setActiveEmergency(true)
    try {
      const res = await triggerEmergencyAlert({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        triggerType: 'manual',
      })
      setEmergencyId(res?.alert?.id || null)
      if (res?.nearbyServices?.police) {
        setNearbyPolice(res.nearbyServices.police)
      }
    } catch {
      setEmergencyId(null)
    }
    emitEmergencyAlert({
      location: userLocation,
      timestamp: new Date().toISOString(),
      timeOfDay: getTimeOfDay(),
    })
  }, [userLocation])

  const resolveEmergency = useCallback(async () => {
    setActiveEmergency(false)
    setNearbyPolice([])
    if (emergencyId) {
      try { await resolveEmergencyAlert(emergencyId) } catch {}
      setEmergencyId(null)
    }
  }, [emergencyId])

  const updateLocation = useCallback((newLocation) => {
    if (trackingEnabled) emitLocationUpdate(newLocation)
  }, [trackingEnabled])

  const value = {
    userLocation,
    locationHistory,
    locationError,
    isTracking,
    trackingEnabled,
    setTrackingEnabled,
    updateLocation,
    safetyScore,
    setSafetyScore,
    updateSafetyScore,
    isNightMode: nightMode,
    activeEmergency,
    emergencyId,
    triggerEmergency,
    resolveEmergency,
    emergencyContacts,
    setEmergencyContacts,
    nearbyPolice,
    guardianMode,
    setGuardianMode,
    isInDangerZone,
  }

  return (
    <SafetyContext.Provider value={value}>
      {children}
    </SafetyContext.Provider>
  )
}

export function useSafety() {
  const ctx = useContext(SafetyContext)
  if (!ctx) throw new Error('useSafety must be used within SafetyProvider')
  return ctx
}

export default SafetyContext
