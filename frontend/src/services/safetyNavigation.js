/**
 * NightShield - Safety First Navigation Service
 *
 * Fetches multiple route alternatives and scores them against
 * PostGIS safety zones to pick the route with the lowest risk.
 * Falls back to direct OSRM routing with avoidance if backend is unreachable.
 */

import { fetchSafeRoutes, fetchSafetyZones, fetchReports, fetchDangerPredictions } from './api'
import { getTimeOfDay } from '../utils/helpers'

const OSRM_BASE = 'https://router.project-osrm.org'

/**
 * Fetch a route from OSRM via a list of points.
 */
async function fetchOSRM(points, alternatives = false) {
  const coords = points.map(p => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_BASE}/route/v1/foot/${coords}?alternatives=${alternatives}&overview=full&geometries=geojson&steps=true`

  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) return null

  return data.routes.map((route, i) => ({
    waypoints: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distance: Math.round(route.distance),
    duration: Math.round(route.duration / 60),
    name: i === 0 ? 'Route' : `Alternative ${i}`,
    safetyScore: 50,
    riskLevel: 'moderate',
    warningCount: 0,
    segments: [],
    zoneWarnings: [],
    zoneAnalysis: null,
  }))
}

/**
 * Haversine distance between two points in meters.
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Score a route against known danger zones and reports.
 * Returns a score 0-100 where 100 is safest.
 */
function scoreRouteAgainstThreats(route, dangerZones, reports) {
  const waypoints = route.waypoints
  if (!waypoints || waypoints.length === 0) return 50

  let totalDangerExposure = 0
  let totalReportExposure = 0
  const sampleStep = Math.max(1, Math.floor(waypoints.length / 80))

  for (let i = 0; i < waypoints.length; i += sampleStep) {
    const wp = waypoints[i]

    // Check proximity to danger zones
    for (const zone of dangerZones) {
      const dist = haversine(wp.lat, wp.lng, zone.lat, zone.lng)
      const radius = zone.radius || 300
      if (dist < radius) {
        // Inside danger zone — heavy penalty
        totalDangerExposure += 1.0
      } else if (dist < radius * 2) {
        // Near danger zone — partial penalty
        totalDangerExposure += 0.3 * (1 - (dist - radius) / radius)
      }
    }

    // Check proximity to reported incidents
    for (const report of reports) {
      const rLat = report.lat ?? report.location?.coordinates?.[1]
      const rLng = report.lng ?? report.location?.coordinates?.[0]
      if (rLat == null || rLng == null) continue
      const dist = haversine(wp.lat, wp.lng, rLat, rLng)
      const severity = (report.severity || 3) / 5
      if (dist < 200) {
        totalReportExposure += severity
      } else if (dist < 500) {
        totalReportExposure += severity * 0.3 * (1 - (dist - 200) / 300)
      }
    }
  }

  const sampledPoints = Math.ceil(waypoints.length / sampleStep)
  const dangerRatio = sampledPoints > 0 ? totalDangerExposure / sampledPoints : 0
  const reportRatio = sampledPoints > 0 ? totalReportExposure / sampledPoints : 0

  // Combine: danger zones weigh more than individual reports
  const combinedRisk = Math.min(1, dangerRatio * 0.7 + reportRatio * 0.3)

  // Convert to 0-100 score (100 = safest)
  const score = Math.round(Math.max(5, 95 - combinedRisk * 90))

  return score
}

/**
 * Generate detour points at multiple offsets and positions along the route.
 */
function generateDetourPoints(start, end) {
  const dLat = end.lat - start.lat
  const dLng = end.lng - start.lng
  const len = Math.sqrt(dLat * dLat + dLng * dLng)
  if (len < 0.0001) return []

  const perpLat = -dLng / len
  const perpLng = dLat / len

  const detours = []
  // Multiple offsets: small, medium, large
  const offsets = [0.004, 0.008, 0.015]
  // Multiple positions along the route: 1/3 and 2/3
  const fractions = [0.33, 0.5, 0.67]

  for (const offset of offsets) {
    for (const frac of fractions) {
      const ptLat = start.lat + dLat * frac
      const ptLng = start.lng + dLng * frac
      // Both sides of the route
      detours.push([{ lat: ptLat + perpLat * offset, lng: ptLng + perpLng * offset }])
      detours.push([{ lat: ptLat - perpLat * offset, lng: ptLng - perpLng * offset }])
    }
  }

  return detours
}

/**
 * Fetch threat data (danger zones + reports) for scoring.
 */
async function fetchThreats(start, end) {
  const centerLat = (start.lat + end.lat) / 2
  const centerLng = (start.lng + end.lng) / 2

  let dangerZones = []
  let reports = []

  try {
    const preds = await fetchDangerPredictions()
    if (Array.isArray(preds)) {
      dangerZones = preds.map(p => ({
        lat: p.lat, lng: p.lng,
        radius: 250 + (p.predictedRisk || 0.5) * 200,
      }))
    }
  } catch {}

  try {
    const data = await fetchReports(centerLat, centerLng, 500)
    if (Array.isArray(data)) {
      reports = data.map(r => {
        const [lng, lat] = r.location?.coordinates || [0, 0]
        return { ...r, lat, lng }
      })
    }
  } catch {}

  return { dangerZones, reports }
}

/**
 * Client-side fallback: fetch multiple different routes from OSRM
 * and score them against known threats.
 */
async function fetchFallbackRoutes(start, end) {
  // Fetch routes and threat data in parallel
  const [directRoutes, threats] = await Promise.all([
    fetchOSRM([start, end], true).then(r => r || []),
    fetchThreats(start, end),
  ])

  // Generate detour routes
  const detours = generateDetourPoints(start, end)
  const detourPromises = detours.map(async (viaPoints) => {
    try {
      const routes = await fetchOSRM([start, ...viaPoints, end], false)
      return routes?.[0] || null
    } catch {
      return null
    }
  })
  const detourRoutes = (await Promise.all(detourPromises)).filter(Boolean)

  const allRoutes = [...directRoutes, ...detourRoutes]
  if (allRoutes.length === 0) return null

  // Deduplicate by distance (routes within 100m of each other are same)
  const unique = []
  for (const r of allRoutes) {
    if (!unique.some(u => Math.abs(u.distance - r.distance) < 100)) {
      unique.push(r)
    }
  }

  // Score each route against actual threat data
  for (const route of unique) {
    route.safetyScore = scoreRouteAgainstThreats(route, threats.dangerZones, threats.reports)
    route.riskLevel = route.safetyScore >= 70 ? 'safe' : route.safetyScore >= 45 ? 'moderate' : 'unsafe'
    route.warningCount = threats.dangerZones.filter(z => {
      return route.waypoints.some(wp => haversine(wp.lat, wp.lng, z.lat, z.lng) < (z.radius || 300))
    }).length
  }

  return unique
}

/**
 * Main entry point: get the safest route between two points.
 */
export async function getSafetyFirstRoute(start, end) {
  const timeOfDay = getTimeOfDay()

  // Try backend first (has full safety scoring + avoidance)
  try {
    const data = await fetchSafeRoutes(start, end, timeOfDay)
    if (data?.safestRoute) {
      return {
        ...data,
        safetyFirstRoute: data.safestRoute,
      }
    }
  } catch (err) {
    console.warn('Backend route fetch failed, falling back to OSRM:', err.message)
  }

  // Fallback: fetch different routes from OSRM directly
  const routes = await fetchFallbackRoutes(start, end)
  if (!routes || routes.length === 0) {
    throw new Error('Could not find any routes to destination')
  }

  // Sort by safety score descending — safest first
  routes.sort((a, b) => b.safetyScore - a.safetyScore)

  const safestRoute = routes[0]
  const shortestRoute = [...routes].sort((a, b) => a.distance - b.distance)[0]
  const routesAreSame = safestRoute === shortestRoute ||
    Math.abs(safestRoute.distance - shortestRoute.distance) < 100

  return {
    safestRoute: { ...safestRoute, label: 'Safest Route' },
    fastestSafeRoute: { ...shortestRoute, label: 'Shortest Route' },
    allRoutes: routes,
    destinationInDangerZone: false,
    routesAreSame,
  }
}

/**
 * Fetch GeoJSON safety zones for the current map viewport.
 */
export async function getSafetyZonesGeoJSON(bounds) {
  return fetchSafetyZones({
    min_lng: bounds.west,
    min_lat: bounds.south,
    max_lng: bounds.east,
    max_lat: bounds.north,
  })
}

/**
 * Get the zone color for rendering on the map.
 */
export function getZoneColor(riskLevel) {
  switch (riskLevel) {
    case 10: return { fill: '#ef4444', stroke: '#dc2626', label: 'Danger Zone' }
    case 5: return { fill: '#f59e0b', stroke: '#d97706', label: 'Caution Zone' }
    case 0: return { fill: '#10b981', stroke: '#059669', label: 'Safe Zone' }
    default: return { fill: '#94a3b8', stroke: '#64748b', label: 'Unknown' }
  }
}

/**
 * Format zone analysis data for display.
 */
export function formatZoneAnalysis(zoneAnalysis) {
  if (!zoneAnalysis) return null

  const { totalRouteMeters, redZoneMeters, orangeZoneMeters, greenZoneMeters } = zoneAnalysis
  const totalKm = (totalRouteMeters / 1000).toFixed(1)
  const redPct = totalRouteMeters > 0 ? Math.round((redZoneMeters / totalRouteMeters) * 100) : 0
  const orangePct = totalRouteMeters > 0 ? Math.round((orangeZoneMeters / totalRouteMeters) * 100) : 0
  const greenPct = totalRouteMeters > 0 ? Math.round((greenZoneMeters / totalRouteMeters) * 100) : 0

  return {
    totalKm,
    redPct,
    orangePct,
    greenPct,
    safePct: Math.max(0, 100 - redPct - orangePct),
  }
}
