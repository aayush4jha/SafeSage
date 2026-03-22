/**
 * NightShield AI - Dynamic Safety Zone Grid Engine
 *
 * Divides the city into a square grid (~300m cells).
 * Aggregates safety_reports per cell from the database.
 *
 * ZONE CLASSIFICATION (based on unique users who reported):
 *   - 5+ unique users reported in a cell → RED (danger)
 *   - 3-4 unique users → ORANGE (caution)
 *   - 1-2 unique users → YELLOW (low risk)
 *   - 0 reports → cell not shown
 *
 * This means zones update dynamically as real users submit reports.
 */

const { supabase } = require('../config/db');

// Grid cell size in degrees (~300m at equator, close enough for Indian cities)
const CELL_SIZE = 0.003;

// Unique user thresholds for zone classification
const THRESHOLDS = {
  red: 5,     // 5+ unique users → Red zone
  orange: 3,  // 3-4 unique users → Orange zone
  yellow: 1,  // 1-2 unique users → Yellow (low risk)
  // 0 → not shown
};

// Severity weights per category (used for danger score display, not classification)
const CATEGORY_WEIGHTS = {
  harassment: 5,
  suspicious_activity: 4,
  unsafe_street: 3,
  dark_road: 3,
  no_streetlights: 3,
  poor_visibility: 2,
  isolated_area: 4,
  other: 1,
};

function recencyWeight(createdAt) {
  const hoursAgo = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 6) return 1.0;
  if (hoursAgo < 24) return 0.85;
  if (hoursAgo < 72) return 0.6;
  if (hoursAgo < 168) return 0.4;
  return 0.2;
}

function snapToGrid(val) {
  return Math.floor(val / CELL_SIZE) * CELL_SIZE;
}

function cellToPolygon(cellLng, cellLat) {
  const lng1 = cellLng;
  const lat1 = cellLat;
  const lng2 = cellLng + CELL_SIZE;
  const lat2 = cellLat + CELL_SIZE;
  return {
    type: 'Polygon',
    coordinates: [[
      [lng1, lat1],
      [lng2, lat1],
      [lng2, lat2],
      [lng1, lat2],
      [lng1, lat1],
    ]],
  };
}

/**
 * Compute the dynamic safety grid from safety_reports in the database.
 * Classification is based on the number of UNIQUE USERS who reported per cell.
 */
async function computeSafetyGrid(bounds) {
  const padding = CELL_SIZE * 2;

  // Select all columns — user_id will be present if the column exists
  const { data: reports, error } = await supabase
    .from('safety_reports')
    .select('*')
    .gte('latitude', bounds.south - padding)
    .lte('latitude', bounds.north + padding)
    .gte('longitude', bounds.west - padding)
    .lte('longitude', bounds.east + padding)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.warn('Failed to fetch reports for grid:', error.message);
    return { type: 'FeatureCollection', features: [] };
  }

  if (!reports || reports.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }

  // Aggregate reports into grid cells
  const cells = {};

  for (const r of reports) {
    if (r.latitude == null || r.longitude == null) continue;

    const cellLng = snapToGrid(r.longitude);
    const cellLat = snapToGrid(r.latitude);
    const key = `${cellLng.toFixed(6)},${cellLat.toFixed(6)}`;

    if (!cells[key]) {
      cells[key] = {
        cellLng,
        cellLat,
        dangerScore: 0,
        reportCount: 0,
        maxSeverity: 0,
        categories: {},
        uniqueUsers: new Set(),
      };
    }

    const cell = cells[key];
    const catWeight = CATEGORY_WEIGHTS[r.category] || 1;
    const recency = recencyWeight(r.created_at);
    const score = (r.severity || 1) * catWeight * recency;

    cell.dangerScore += score;
    cell.reportCount += 1;
    cell.maxSeverity = Math.max(cell.maxSeverity, r.severity || 1);
    cell.categories[r.category] = (cell.categories[r.category] || 0) + 1;

    // Track unique users — use user_id if available, fall back to report id
    // (for legacy/seeded data without user_id, each report counts as a unique reporter)
    const userId = r.user_id || `anon_${r.id}`;
    cell.uniqueUsers.add(userId);
  }

  // Convert cells to GeoJSON features — classify by unique user count
  const features = [];

  for (const cell of Object.values(cells)) {
    const uniqueUserCount = cell.uniqueUsers.size;

    let risk_level;
    let safety_label;

    if (uniqueUserCount >= THRESHOLDS.red) {
      risk_level = 10;
      safety_label = 'red';
    } else if (uniqueUserCount >= THRESHOLDS.orange) {
      risk_level = 5;
      safety_label = 'orange';
    } else {
      risk_level = 2;
      safety_label = 'yellow';
    }

    const topCategories = Object.entries(cell.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, count]) => `${cat.replace(/_/g, ' ')} (${count})`)
      .join(', ');

    features.push({
      type: 'Feature',
      properties: {
        risk_level,
        safety_label,
        zone_name: `${safety_label.charAt(0).toUpperCase() + safety_label.slice(1)} Zone`,
        report_count: cell.reportCount,
        unique_users: uniqueUserCount,
        danger_score: Math.round(cell.dangerScore * 10) / 10,
        max_severity: cell.maxSeverity,
        description: `${uniqueUserCount} user${uniqueUserCount > 1 ? 's' : ''} reported (${cell.reportCount} total): ${topCategories}`,
      },
      geometry: cellToPolygon(cell.cellLng, cell.cellLat),
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Check a route against the dynamic grid.
 */
async function checkRouteAgainstGrid(waypoints) {
  if (!waypoints || waypoints.length < 2) {
    return {
      risk_score: 0,
      total_route_meters: 0,
      red_zone_meters: 0,
      orange_zone_meters: 0,
      green_zone_meters: 0,
      intersecting_zones: [],
    };
  }

  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const wp of waypoints) {
    south = Math.min(south, wp.lat);
    north = Math.max(north, wp.lat);
    west = Math.min(west, wp.lng);
    east = Math.max(east, wp.lng);
  }

  const grid = await computeSafetyGrid({ south, north, west, east });

  const cellLookup = {};
  for (const f of grid.features) {
    const coords = f.geometry.coordinates[0];
    const key = `${coords[0][0].toFixed(6)},${coords[0][1].toFixed(6)}`;
    cellLookup[key] = f.properties;
  }

  let totalMeters = 0;
  let redMeters = 0;
  let orangeMeters = 0;
  let greenMeters = 0;
  const hitZones = new Map();

  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];

    const dLat = (curr.lat - prev.lat) * 111320;
    const dLng = (curr.lng - prev.lng) * 111320 * Math.cos(prev.lat * Math.PI / 180);
    const segLen = Math.sqrt(dLat * dLat + dLng * dLng);
    totalMeters += segLen;

    const midLat = (prev.lat + curr.lat) / 2;
    const midLng = (prev.lng + curr.lng) / 2;
    const cellLng = snapToGrid(midLng);
    const cellLat = snapToGrid(midLat);
    const key = `${cellLng.toFixed(6)},${cellLat.toFixed(6)}`;
    const cell = cellLookup[key];

    if (cell) {
      if (cell.risk_level === 10) redMeters += segLen;
      else if (cell.risk_level === 5) orangeMeters += segLen;
      else greenMeters += segLen;

      const zoneKey = `${key}_${cell.risk_level}`;
      if (!hitZones.has(zoneKey)) {
        hitZones.set(zoneKey, {
          zone_name: cell.zone_name,
          risk_level: cell.risk_level,
          safety_label: cell.safety_label,
          overlap_meters: 0,
        });
      }
      hitZones.get(zoneKey).overlap_meters += segLen;
    }
  }

  const riskScore = totalMeters > 0
    ? ((redMeters * 10) + (orangeMeters * 5)) / (totalMeters / 1000)
    : 0;

  const intersecting_zones = Array.from(hitZones.values())
    .map(z => ({ ...z, overlap_meters: Math.round(z.overlap_meters) }))
    .filter(z => z.risk_level >= 5);

  return {
    risk_score: Math.round(riskScore * 100) / 100,
    total_route_meters: Math.round(totalMeters),
    red_zone_meters: Math.round(redMeters),
    orange_zone_meters: Math.round(orangeMeters),
    green_zone_meters: Math.round(greenMeters),
    intersecting_zones,
  };
}

module.exports = { computeSafetyGrid, checkRouteAgainstGrid, CELL_SIZE, THRESHOLDS };
