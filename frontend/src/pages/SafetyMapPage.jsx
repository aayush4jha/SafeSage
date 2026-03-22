import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import SafetyMap from '../components/SafetyMap'
import { useSafety } from '../context/SafetyContext'
import { useCache } from '../context/CacheContext'
import { fetchReports, fetchDangerPredictions } from '../services/api'
import { getSafetyFirstRoute } from '../services/safetyNavigation'

export default function SafetyMapPage() {
  const { userLocation } = useSafety()
  const { get, set } = useCache()
  const [searchParams] = useSearchParams()
  const [reports, setReports] = useState(() => get('map_reports') || [])
  const [dangerZones, setDangerZones] = useState(() => get('map_dangerZones') || [])
  const [routes, setRoutes] = useState(() => get('map_routes') || [])
  const [destination, setDestination] = useState(() => get('map_destination') || null)
  const [routeLoading, setRouteLoading] = useState(false)

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = useState(() => get('map_searchQuery') || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const debounceRef = useRef(null)
  const searchContainerRef = useRef(null)

  const loadData = useCallback(async (force = false) => {
    if (!force && get('map_reports')) return

    const center = userLocation || { lat: 23.0225, lng: 72.5714 }
    try {
      const data = await fetchReports(center.lat, center.lng, 500)
      if (Array.isArray(data)) {
        const mapped = data.map(r => {
          const [lng, lat] = r.location?.coordinates || [0, 0]
          return { ...r, lat, lng }
        })
        setReports(mapped)
        set('map_reports', mapped)
      }
    } catch {}
    try {
      const preds = await fetchDangerPredictions()
      if (Array.isArray(preds)) {
        const zones = preds.map(p => ({
          lat: p.lat, lng: p.lng,
          radius: 250 + (p.predictedRisk || 0.5) * 200,
        }))
        setDangerZones(zones)
        set('map_dangerZones', zones)
      }
    } catch {}
  }, [userLocation, get, set])

  useEffect(() => { loadData() }, [loadData])

  // Auto-set destination from URL params
  useEffect(() => {
    const destLat = searchParams.get('destLat')
    const destLng = searchParams.get('destLng')
    const destName = searchParams.get('destName')
    if (destLat && destLng) {
      const lat = parseFloat(destLat)
      const lng = parseFloat(destLng)
      if (!isNaN(lat) && !isNaN(lng)) {
        setDestination({ lat, lng })
        setSearchQuery(destName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      }
    }
  }, [searchParams])

  // Fetch routes when destination changes
  useEffect(() => {
    if (!destination?.lat) {
      setRoutes([])
      return
    }
    const origin = userLocation || { lat: 23.0225, lng: 72.5714 }
    let cancelled = false

    const fetchRoutes = async () => {
      setRouteLoading(true)
      try {
        const data = await getSafetyFirstRoute(origin, destination)
        if (cancelled) return

        const ROUTE_CONFIGS = [
          { key: 'safestRoute', label: 'Safest Route', color: '#10b981', type: 'safest' },
          { key: 'fastestSafeRoute', label: 'Shortest Route', color: '#3b82f6', type: 'shortest' },
        ]

        const built = ROUTE_CONFIGS
          .map(cfg => {
            const route = data[cfg.key]
            if (!route?.waypoints) return null
            if (cfg.key === 'fastestSafeRoute' && data.routesAreSame) return null
            const distKm = ((route.distance || 0) / 1000).toFixed(1)
            const time = route.duration || Math.round((route.distance || 0) / 67)
            return {
              ...route,
              key: cfg.key,
              color: cfg.color,
              label: cfg.label,
              type: cfg.type,
              distKm,
              time,
            }
          })
          .filter(Boolean)

        setRoutes(built)
        set('map_routes', built)
      } catch (err) {
        console.error('Route fetch failed:', err)
        if (!cancelled) { setRoutes([]); set('map_routes', []) }
      }
      if (!cancelled) setRouteLoading(false)
    }
    fetchRoutes()
    return () => { cancelled = true }
  }, [destination?.lat, destination?.lng, userLocation])

  // Debounced autocomplete search
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([])
      return
    }
    setLoadingSuggestions(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      )
      const results = await res.json()
      setSuggestions(results.map(r => {
        const addr = r.address || {}
        const primary = addr.road || addr.neighbourhood || addr.suburb || addr.village || addr.town || addr.city || r.name || ''
        const secondary = [addr.suburb, addr.city || addr.town, addr.state].filter(Boolean).join(', ')
        return {
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          displayName: r.display_name,
          primary: primary || r.display_name.split(',')[0].trim(),
          secondary: secondary || r.display_name.split(',').slice(1, 4).join(',').trim(),
        }
      }))
    } catch {
      setSuggestions([])
    }
    setLoadingSuggestions(false)
  }, [])

  const handleSearchInput = (e) => {
    const val = e.target.value
    setSearchQuery(val)
    setShowSuggestions(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350)
  }

  const handleSelectSuggestion = (suggestion) => {
    setSearchQuery(suggestion.primary)
    set('map_searchQuery', suggestion.primary)
    setSuggestions([])
    setShowSuggestions(false)
    const dest = { lat: suggestion.lat, lng: suggestion.lng }
    setDestination(dest)
    set('map_destination', dest)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    set('map_searchQuery', '')
    setSuggestions([])
    setShowSuggestions(false)
    setDestination(null)
    set('map_destination', null)
    setRoutes([])
    set('map_routes', [])
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-surface relative overflow-hidden">
      {/* Top bar */}
      <header className="flex justify-between items-center h-14 md:h-16 px-3 md:px-8 absolute top-0 left-0 w-full z-40 bg-white/80 backdrop-blur-md shadow-sm shadow-slate-200/50">
        <div className="flex items-center gap-2 md:gap-4 flex-1">
          <div ref={searchContainerRef} className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
            <input
              className="w-full bg-surface-container-highest border-none rounded-full py-2 pl-10 pr-10 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              placeholder="Search location, district, or street..."
              value={searchQuery}
              onChange={handleSearchInput}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && (searchQuery.trim().length >= 2) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl shadow-black/10 border border-slate-100 overflow-hidden z-50">
                {loadingSuggestions && (
                  <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                    Searching...
                  </div>
                )}
                {!loadingSuggestions && suggestions.length === 0 && searchQuery.trim().length >= 2 && (
                  <div className="px-4 py-3 text-sm text-slate-400">
                    No locations found
                  </div>
                )}
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 border-b border-slate-50 last:border-b-0"
                  >
                    <span className="material-symbols-outlined text-primary mt-0.5 text-lg">location_on</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-on-surface">{s.primary}</div>
                      <div className="text-xs text-on-surface-variant truncate mt-0.5">{s.secondary}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="hover:bg-slate-100 rounded-full p-2 text-slate-600 transition-all">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </header>

      {/* Full-screen map */}
      <div className="w-full h-full relative">
        <SafetyMap
          routes={routes}
          reports={reports}
          dangerZones={dangerZones}
          destination={destination}
          routeLoading={routeLoading}
          onDestinationSelect={(dest) => {
            setSearchQuery(`${dest.lat.toFixed(4)}, ${dest.lng.toFixed(4)}`)
            setDestination(dest)
          }}
        />
      </div>
    </div>
  )
}
