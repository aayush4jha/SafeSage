/**
 * NightShield AI - Route Safety Engine
 *
 * Two-route system:
 *   1. SHORTEST route — direct OSRM path (fastest, may go through danger)
 *   2. SAFEST route — avoids danger zones by detouring through safe waypoints
 *
 * If the shortest route has no danger zone overlap, both are the same.
 */

const { calculateRoadSafetyScore, haversineDistance } = require('./safetyScoreEngine');
const { checkRouteAgainstGrid, computeSafetyGrid } = require('./zoneGridEngine');

const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';

/**
 * Fetch route(s) from OSRM.
 */
async function fetchOSRMRoute(points, alternatives = false) {
  const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM_BASE}/route/v1/foot/${coords}?alternatives=${alternatives}&overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;

    return data.routes.map((route, i) => ({
      waypoints: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      geojson: route.geometry,
      distance: Math.round(route.distance),
      duration: Math.round(route.duration / 60),
      name: i === 0 ? 'Route' : `Alternative ${i}`,
      steps: (route.legs || []).flatMap(leg =>
        (leg.steps || []).map(s => ({
          instruction: s.maneuver?.instruction || '',
          name: s.name || '',
          distance: s.distance,
          duration: s.duration,
        }))
      ),
    }));
  } catch (err) {
    console.warn('OSRM fetch failed:', err.message);
    return null;
  }
}

async function fetchOSRMRoutes(origin, destination) {
  return fetchOSRMRoute([origin, destination], true);
}

/**
 * Get danger zones in the corridor between origin and destination.
 */
async function getDangerZonesInCorridor(origin, destination) {
  const south = Math.min(origin.lat, destination.lat) - 0.015;
  const north = Math.max(origin.lat, destination.lat) + 0.015;
  const west = Math.min(origin.lng, destination.lng) - 0.015;
  const east = Math.max(origin.lng, destination.lng) + 0.015;

  const grid = await computeSafetyGrid({ south, north, west, east });
  if (!grid?.features) return [];

  return grid.features
    .filter(f => f.properties.risk_level >= 5)
    .map(f => {
      const coords = f.geometry.coordinates[0];
      return {
        lat: (coords[0][1] + coords[2][1]) / 2,
        lng: (coords[0][0] + coords[2][0]) / 2,
        riskLevel: f.properties.risk_level,
      };
    });
}

/**
 * Find safe waypoints that avoid danger zones.
 * Strategy: walk along the route, when we hit a danger zone,
 * find a point outside it on the safer side.
 */
function findSafeDetourWaypoints(routeWaypoints, dangerZones) {
  if (dangerZones.length === 0) return [];

  // Find segments of the route that pass through danger
  const dangerSegments = []; // { startIdx, endIdx, dangerCenter }
  let currentSegStart = null;

  for (let i = 0; i < routeWaypoints.length; i++) {
    const wp = routeWaypoints[i];
    const nearDanger = dangerZones.some(z =>
      Math.abs(z.lat - wp.lat) < 0.005 && Math.abs(z.lng - wp.lng) < 0.005
    );

    if (nearDanger && currentSegStart === null) {
      currentSegStart = i;
    } else if (!nearDanger && currentSegStart !== null) {
      dangerSegments.push({ startIdx: currentSegStart, endIdx: i - 1 });
      currentSegStart = null;
    }
  }
  if (currentSegStart !== null) {
    dangerSegments.push({ startIdx: currentSegStart, endIdx: routeWaypoints.length - 1 });
  }

  if (dangerSegments.length === 0) return [];

  // For each danger segment, create a waypoint that goes around it
  const safeWaypoints = [];

  for (const seg of dangerSegments) {
    const midIdx = Math.floor((seg.startIdx + seg.endIdx) / 2);
    const dangerPoint = routeWaypoints[midIdx];

    // Find nearby danger zone centers
    const nearbyDanger = dangerZones.filter(z =>
      Math.abs(z.lat - dangerPoint.lat) < 0.01 && Math.abs(z.lng - dangerPoint.lng) < 0.01
    );
    const dangerCenterLat = nearbyDanger.reduce((s, z) => s + z.lat, 0) / nearbyDanger.length;
    const dangerCenterLng = nearbyDanger.reduce((s, z) => s + z.lng, 0) / nearbyDanger.length;

    // Route direction at this segment
    const before = routeWaypoints[Math.max(0, seg.startIdx - 3)];
    const after = routeWaypoints[Math.min(routeWaypoints.length - 1, seg.endIdx + 3)];
    const dLat = after.lat - before.lat;
    const dLng = after.lng - before.lng;
    const len = Math.sqrt(dLat * dLat + dLng * dLng);
    if (len < 0.00001) continue;

    // Perpendicular
    const perpLat = -dLng / len;
    const perpLng = dLat / len;

    // Push AWAY from danger center
    const dangerSide = (dangerCenterLat - dangerPoint.lat) * perpLat +
                       (dangerCenterLng - dangerPoint.lng) * perpLng;
    const awaySign = dangerSide > 0 ? -1 : 1;

    // Offset: enough to leave the danger grid cell (~500m-1km)
    const offset = 0.008; // ~800m

    safeWaypoints.push({
      lat: dangerPoint.lat + perpLat * offset * awaySign,
      lng: dangerPoint.lng + perpLng * offset * awaySign,
    });
  }

  return safeWaypoints;
}

async function checkRouteSafetyZones(waypoints) {
  return checkRouteAgainstGrid(waypoints);
}

function scoreRouteSegment(waypoint, reports, timeOfDay) {
  return calculateRoadSafetyScore(waypoint.lat, waypoint.lng, timeOfDay, reports);
}

/**
 * Score a single route.
 */
async function scoreRoute(route, reports, timeOfDay) {
  const sampleRate = Math.max(1, Math.floor(route.waypoints.length / 30));
  const sampledWaypoints = route.waypoints.filter((_, i) => i % sampleRate === 0);

  const segmentScores = sampledWaypoints.map(wp =>
    scoreRouteSegment(wp, reports, timeOfDay)
  );

  const reportBasedScore = Math.round(
    segmentScores.reduce((sum, s) => sum + s.totalScore, 0) / segmentScores.length
  );

  const zoneResult = await checkRouteSafetyZones(route.waypoints);
  const zonePenalty = Math.min(40, zoneResult.risk_score * 0.4);
  const totalScore = Math.max(0, Math.min(100, Math.round(reportBasedScore - zonePenalty)));

  const warnings = segmentScores
    .map((s, i) => ({ ...s, waypointIndex: i * sampleRate, waypoint: sampledWaypoints[i] }))
    .filter(s => s.riskLevel === 'unsafe');

  const zoneWarnings = (zoneResult.intersecting_zones || [])
    .filter(z => z.risk_level >= 5)
    .map(z => ({
      type: 'zone',
      zone_name: z.zone_name,
      risk_level: z.risk_level,
      safety_label: z.safety_label,
      overlap_meters: z.overlap_meters,
    }));

  let riskLevel = 'safe';
  if (totalScore < 40) riskLevel = 'unsafe';
  else if (totalScore < 65) riskLevel = 'moderate';

  return {
    ...route,
    safetyScore: totalScore,
    reportScore: reportBasedScore,
    riskLevel,
    segments: segmentScores,
    warnings,
    zoneWarnings,
    warningCount: warnings.length + zoneWarnings.length,
    zoneAnalysis: {
      riskScore: zoneResult.risk_score,
      totalRouteMeters: zoneResult.total_route_meters,
      redZoneMeters: zoneResult.red_zone_meters,
      orangeZoneMeters: zoneResult.orange_zone_meters,
      greenZoneMeters: zoneResult.green_zone_meters,
    },
    breakdown: {
      avgLighting: Math.round(segmentScores.reduce((s, v) => s + v.breakdown.lighting, 0) / segmentScores.length),
      avgCrowd: Math.round(segmentScores.reduce((s, v) => s + v.breakdown.crowd, 0) / segmentScores.length),
      avgIncident: Math.round(segmentScores.reduce((s, v) => s + v.breakdown.incident, 0) / segmentScores.length),
      avgIsolation: Math.round(segmentScores.reduce((s, v) => s + v.breakdown.isolation, 0) / segmentScores.length),
    },
  };
}

/**
 * Main entry: produces two routes — SAFEST and SHORTEST.
 *
 * 1. Get the shortest (direct) route from OSRM
 * 2. Score it against danger zones
 * 3. If it passes through danger → generate a safe detour route via OSRM waypoints
 * 4. If no danger → both are the same route
 */
async function rankRoutes(routes, reports, timeOfDay, origin, destination) {
  // Score the shortest/direct route
  const shortestRoute = await scoreRoute({ ...routes[0], routeIndex: 0 }, reports, timeOfDay);

  // Also score any OSRM alternatives
  const otherRoutes = await Promise.all(
    routes.slice(1).map((r, i) => scoreRoute({ ...r, routeIndex: i + 1 }, reports, timeOfDay))
  );

  const allRoutes = [shortestRoute, ...otherRoutes];

  // Check if the direct route hits danger zones
  const hasDanger = shortestRoute.zoneAnalysis.redZoneMeters > 0 ||
                    shortestRoute.zoneAnalysis.orangeZoneMeters > 0;

  let safestRoute = shortestRoute;

  if (hasDanger && origin && destination) {
    try {
      const dangerZones = await getDangerZonesInCorridor(origin, destination);

      if (dangerZones.length > 0) {
        // Find safe detour waypoints based on where the route hits danger
        const safeWaypoints = findSafeDetourWaypoints(shortestRoute.waypoints, dangerZones);

        if (safeWaypoints.length > 0) {
          // Route through safe waypoints via OSRM
          const detourRoutes = await fetchOSRMRoute(
            [origin, ...safeWaypoints, destination],
            false
          );

          if (detourRoutes && detourRoutes.length > 0) {
            const detour = detourRoutes[0];
            // Only accept if not absurdly longer (< 3x distance)
            if (detour.distance < shortestRoute.distance * 3) {
              const scoredDetour = await scoreRoute(
                { ...detour, routeIndex: allRoutes.length, name: 'Safe Detour' },
                reports, timeOfDay
              );

              // Use the detour as safest if it actually has a better safety score
              if (scoredDetour.safetyScore > shortestRoute.safetyScore ||
                  scoredDetour.zoneAnalysis.redZoneMeters < shortestRoute.zoneAnalysis.redZoneMeters) {
                safestRoute = scoredDetour;
                allRoutes.push(scoredDetour);
              }
            }
          }
        }

        // Also check if any OSRM alternative is safer
        for (const alt of otherRoutes) {
          if (alt.safetyScore > safestRoute.safetyScore) {
            safestRoute = alt;
          }
        }
      }
    } catch (err) {
      console.warn('Safe route generation failed:', err.message);
    }
  } else {
    // No danger zones — pick the best scoring route from OSRM alternatives
    for (const alt of otherRoutes) {
      if (alt.safetyScore > safestRoute.safetyScore) {
        safestRoute = alt;
      }
    }
  }

  // Check if destination itself is in a danger zone
  let destInDanger = false;
  if (origin && destination) {
    try {
      const dangerZones = await getDangerZonesInCorridor(origin, destination);
      destInDanger = dangerZones.some(z =>
        Math.abs(z.lat - destination.lat) < 0.003 &&
        Math.abs(z.lng - destination.lng) < 0.003 &&
        z.riskLevel >= 10
      );
    } catch {}
  }

  // Are the two routes actually different?
  const routesAreSame = Math.abs(safestRoute.distance - shortestRoute.distance) < 100;

  return {
    safestRoute: { ...safestRoute, label: 'Safest Route' },
    fastestSafeRoute: { ...shortestRoute, label: 'Shortest Route' },
    allRoutes: allRoutes.sort((a, b) => b.safetyScore - a.safetyScore),
    destinationInDangerZone: destInDanger,
    routesAreSame,
  };
}

function generateAlternativeRoutes(origin, destination, numRoutes = 2) {
  const directLat = destination.lat - origin.lat;
  const directLng = destination.lng - origin.lng;
  const distance = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  const steps = Math.max(5, Math.round(distance * 2));

  const directWaypoints = [];
  for (let i = 0; i <= steps; i++) {
    directWaypoints.push({
      lat: origin.lat + (directLat * i) / steps,
      lng: origin.lng + (directLng * i) / steps,
    });
  }

  const routes = [{
    waypoints: directWaypoints,
    distance: Math.round(distance * 1000),
    duration: Math.round(distance / 4 * 60),
    name: 'Direct Route',
  }];

  // One offset alternative
  const waypoints = [];
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const bulge = Math.sin(progress * Math.PI) * 0.005;
    waypoints.push({
      lat: origin.lat + directLat * progress + bulge,
      lng: origin.lng + directLng * progress + bulge,
    });
  }
  const routeDistance = waypoints.reduce((total, wp, j) => {
    if (j === 0) return 0;
    return total + haversineDistance(waypoints[j - 1].lat, waypoints[j - 1].lng, wp.lat, wp.lng);
  }, 0);
  routes.push({
    waypoints,
    distance: Math.round(routeDistance * 1000),
    duration: Math.round(routeDistance / 4 * 60),
    name: 'Alternative',
  });

  return routes;
}

module.exports = { rankRoutes, generateAlternativeRoutes, fetchOSRMRoutes, checkRouteSafetyZones };
