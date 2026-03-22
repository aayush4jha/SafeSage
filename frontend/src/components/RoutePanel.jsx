import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, Clock, Navigation,
  AlertTriangle, X, ArrowRight, ShieldCheck, RefreshCw,
} from 'lucide-react'
import { getSafetyFirstRoute, formatZoneAnalysis } from '../services/safetyNavigation'
import { formatSafetyScore } from '../utils/helpers'
import { useSafety } from '../context/SafetyContext'

const ROUTE_CONFIGS = [
  { key: 'safestRoute', icon: Shield, label: 'Safest Route', color: '#10b981', description: 'Avoids danger zones and reported unsafe areas' },
  { key: 'fastestSafeRoute', icon: Clock, label: 'Shortest Route', color: '#0077cc', description: 'Direct path — fastest but may pass through risk areas' },
]

export default function RoutePanel({ destination, onRoutesLoaded, onClear }) {
  const { userLocation } = useSafety()
  const [selectedRouteKey, setSelectedRouteKey] = useState(null)
  const [routeData, setRouteData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [navigating, setNavigating] = useState(false)

  const onRoutesLoadedRef = useRef(onRoutesLoaded)
  useEffect(() => { onRoutesLoadedRef.current = onRoutesLoaded }, [onRoutesLoaded])

  const searchRoutes = async (dest) => {
    setLoading(true)
    setRouteData(null)
    setSelectedRouteKey(null)
    setError(null)

    const origin = userLocation || { lat: 23.0225, lng: 72.5714 }
    try {
      const data = await getSafetyFirstRoute(origin, dest)
      setRouteData(data)

      // Auto-select safest
      setSelectedRouteKey('safestRoute')

      const routes = ROUTE_CONFIGS
        .map(cfg => {
          const route = data[cfg.key]
          if (!route?.waypoints) return null
          // If routes are the same, only show safest
          if (cfg.key === 'fastestSafeRoute' && data.routesAreSame) return null
          return { ...route, key: cfg.key, color: cfg.color, selected: cfg.key === 'safestRoute' }
        })
        .filter(Boolean)

      onRoutesLoadedRef.current?.(routes)
    } catch (err) {
      console.error('Route fetch failed:', err)
      setError(err.message || 'Failed to find routes')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (destination?.lat) {
      searchRoutes(destination)
    }
  }, [destination?.lat, destination?.lng])

  const handleSelectRoute = (key) => {
    setSelectedRouteKey(key)
    if (!routeData) return
    const routes = ROUTE_CONFIGS
      .map(cfg => {
        const r = routeData[cfg.key]
        if (!r?.waypoints) return null
        if (cfg.key === 'fastestSafeRoute' && routeData.routesAreSame) return null
        return { ...r, key: cfg.key, color: cfg.color, selected: cfg.key === key }
      })
      .filter(Boolean)
    onRoutesLoadedRef.current?.(routes)
  }

  // Which configs to actually show
  const visibleConfigs = routeData?.routesAreSame
    ? ROUTE_CONFIGS.filter(c => c.key === 'safestRoute')
    : ROUTE_CONFIGS

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute bottom-4 md:bottom-8 left-4 md:left-8 right-4 md:right-8 z-30"
    >
      <div className="glass-panel rounded-3xl p-4 md:p-5 shadow-2xl border border-white/20 max-h-[60vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Navigation size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-on-surface text-sm">Safe Navigation</h3>
              <p className="text-[11px] text-on-surface-variant">
                {routeData?.routesAreSame ? 'Route is clear of danger zones' : 'Comparing safety vs speed'}
              </p>
            </div>
          </div>
          <button
            onClick={onClear}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X size={16} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-6">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
            <span className="text-sm text-on-surface-variant font-medium">Analyzing routes for safety...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="py-4 text-center">
            <div className="flex items-center justify-center gap-2 text-error mb-2">
              <AlertTriangle size={18} />
              <span className="text-sm font-semibold">Route not found</span>
            </div>
            <p className="text-xs text-on-surface-variant mb-3">{error}</p>
            <button
              onClick={() => searchRoutes(destination)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/15 transition-colors"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        {/* Route cards */}
        {routeData && !loading && (
          <div className="space-y-2">
            {visibleConfigs.map((cfg, idx) => {
              const route = routeData[cfg.key]
              if (!route) return null
              const Icon = cfg.icon
              const isSelected = selectedRouteKey === cfg.key
              const scoreInfo = formatSafetyScore(route.safetyScore)
              const distKm = ((route.distance || 0) / 1000).toFixed(1)
              const time = route.duration || Math.round((route.distance || 0) / 67)
              const zoneInfo = formatZoneAnalysis(route.zoneAnalysis)

              return (
                <motion.button
                  key={cfg.key}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectRoute(cfg.key)}
                  className="w-full text-left rounded-2xl transition-all"
                  style={{
                    padding: '12px 14px',
                    background: isSelected ? `${cfg.color}10` : 'rgba(0,0,0,0.02)',
                    border: `2px solid ${isSelected ? cfg.color + '40' : 'transparent'}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${cfg.color}12` }}
                    >
                      <Icon size={18} color={cfg.color} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-on-surface">{cfg.label}</span>
                        {isSelected && cfg.key === 'safestRoute' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-primary/10 text-primary">RECOMMENDED</span>
                        )}
                      </div>
                      <div className="text-[11px] text-on-surface-variant mt-0.5">{cfg.description}</div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="text-on-surface-variant font-medium">{time} min</span>
                        <span className="text-on-surface-variant">{distKm} km</span>
                        <span
                          className="font-bold"
                          style={{ color: route.safetyScore >= 70 ? '#006b2c' : route.safetyScore >= 50 ? '#825100' : '#ba1a1a' }}
                        >
                          {route.riskLevel === 'safe' ? 'Low' : route.riskLevel === 'moderate' ? 'Medium' : 'High'} Risk
                        </span>
                        {route.warningCount > 0 && (
                          <span className="text-error flex items-center gap-1">
                            <AlertTriangle size={10} /> {route.warningCount}
                          </span>
                        )}
                      </div>

                      {/* Zone bar */}
                      {zoneInfo && (
                        <div className="mt-2">
                          <div className="h-1 rounded-full overflow-hidden flex" style={{ background: 'rgba(0,0,0,0.06)' }}>
                            {zoneInfo.greenPct > 0 && <div style={{ width: `${zoneInfo.greenPct}%`, background: '#006b2c' }} />}
                            <div style={{ width: `${zoneInfo.safePct - (zoneInfo.greenPct || 0)}%`, background: '#bdcaba' }} />
                            {zoneInfo.orangePct > 0 && <div style={{ width: `${zoneInfo.orangePct}%`, background: '#825100' }} />}
                            {zoneInfo.redPct > 0 && <div style={{ width: `${zoneInfo.redPct}%`, background: '#ba1a1a' }} />}
                          </div>
                          {(zoneInfo.redPct > 0 || zoneInfo.orangePct > 0) && (
                            <div className="flex gap-2 mt-1 text-[9px]">
                              {zoneInfo.redPct > 0 && <span className="text-error font-medium">{zoneInfo.redPct}% danger</span>}
                              {zoneInfo.orangePct > 0 && <span className="text-tertiary font-medium">{zoneInfo.orangePct}% caution</span>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Fallback bar */}
                      {!zoneInfo && (
                        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${route.safetyScore}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1 }}
                            className="h-full rounded-full"
                            style={{ background: cfg.color }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="text-center shrink-0 pl-2">
                      <div className="text-xl font-extrabold font-headline" style={{ color: scoreInfo.color }}>
                        {route.safetyScore}
                      </div>
                      <div className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Safety</div>
                    </div>
                  </div>
                </motion.button>
              )
            })}

            {/* Destination in danger zone warning */}
            {routeData?.destinationInDangerZone && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-error/5 border border-error/15 mt-1">
                <AlertTriangle size={14} className="text-error shrink-0" />
                <span className="text-[11px] text-error font-medium">
                  Your destination is in a danger zone. Route minimizes exposure but cannot avoid it entirely. Stay alert.
                </span>
              </div>
            )}

            {/* Safest route detour info */}
            {!routeData.routesAreSame && routeData?.safestRoute && routeData?.fastestSafeRoute && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10 mt-1">
                <ShieldCheck size={14} className="text-primary shrink-0" />
                <span className="text-[11px] text-primary font-medium">
                  Safest route is {((routeData.safestRoute.distance - routeData.fastestSafeRoute.distance) / 1000).toFixed(1)}km longer but avoids{' '}
                  {routeData.fastestSafeRoute.zoneAnalysis?.redZoneMeters > 0
                    ? `${Math.round(routeData.fastestSafeRoute.zoneAnalysis.redZoneMeters)}m of danger zones`
                    : 'reported unsafe areas'
                  }
                </span>
              </div>
            )}

            {/* No danger info */}
            {routeData.routesAreSame && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10 mt-1">
                <ShieldCheck size={14} className="text-primary shrink-0" />
                <span className="text-[11px] text-primary font-medium">
                  This route has no danger zone overlap — you're on the safest path.
                </span>
              </div>
            )}

            {/* Start Navigation */}
            {selectedRouteKey && !navigating && (
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setNavigating(true)}
                className="w-full mt-2 py-3 rounded-2xl font-bold font-headline text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                style={{
                  background: ROUTE_CONFIGS.find(c => c.key === selectedRouteKey)?.color || '#006b2c',
                  color: '#fff',
                  boxShadow: `0 4px 16px ${(ROUTE_CONFIGS.find(c => c.key === selectedRouteKey)?.color || '#006b2c')}30`,
                }}
              >
                <Navigation size={16} />
                Start Navigation
                <ArrowRight size={14} />
              </motion.button>
            )}

            {navigating && (
              <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary/10 text-primary font-bold text-sm mt-2">
                <Navigation size={16} />
                Navigating — Follow the highlighted route
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
