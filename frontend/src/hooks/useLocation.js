import { useState, useEffect, useRef, useCallback } from 'react'

const MAX_HISTORY = 50

export default function useLocation() {
  const [location, setLocation] = useState(null)
  const [locationHistory, setLocationHistory] = useState([])
  const [error, setError] = useState(null)
  const [isTracking, setIsTracking] = useState(false)
  const watchIdRef = useRef(null)

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    setIsTracking(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        const newLocation = { lat: latitude, lng: longitude, accuracy, timestamp: position.timestamp }
        setLocation(newLocation)
        setError(null)
        setLocationHistory((prev) => [...prev, newLocation].slice(-MAX_HISTORY))
      },
      (err) => {
        setError(err.message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
  }, [])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)
  }, [])

  useEffect(() => {
    startTracking()
    return () => stopTracking()
  }, [startTracking, stopTracking])

  return { location, locationHistory, error, isTracking, startTracking, stopTracking }
}
