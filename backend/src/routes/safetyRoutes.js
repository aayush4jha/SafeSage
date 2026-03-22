const express = require('express');
const router = express.Router();
const { supabase } = require('../config/db');
const { calculateRoadSafetyScore, generateHeatmapData, predictDangerZones } = require('../ai/safetyScoreEngine');
const { optionalAuth } = require('../middleware/auth');
const { onReportSubmitted, onReportUpvoted } = require('../ai/rewardsEngine');

function getTimeOfDayFromHour(hour) {
  if (hour >= 0 && hour < 5) return 'late_night';
  if (hour >= 5 && hour < 7) return 'early_morning';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20) return 'night';
  return 'day';
}

function rowToReport(r) {
  return {
    _id: r.id,
    location: { type: 'Point', coordinates: [r.longitude, r.latitude] },
    category: r.category,
    severity: r.severity,
    description: r.description,
    timestamp: r.created_at,
    timeOfDay: r.time_of_day,
    verified: r.verified,
    upvotes: r.upvotes,
    anonymous: r.anonymous,
  };
}

// POST /api/reports — stores the logged-in user's ID with the report
router.post('/reports', optionalAuth, async (req, res) => {
  try {
    const { latitude, longitude, lat, lng, category, severity, description } = req.body;
    const rLat = parseFloat(latitude || lat);
    const rLng = parseFloat(longitude || lng);
    if (!rLat || !rLng || !category) {
      return res.status(400).json({ error: 'location (lat/lng) and category are required' });
    }
    const hour = new Date().getHours();
    const insertData = {
      latitude: rLat,
      longitude: rLng,
      location: `POINT(${rLng} ${rLat})`,
      category,
      severity: severity || 3,
      description: description || '',
      time_of_day: getTimeOfDayFromHour(hour),
      anonymous: false,
    };

    // Attach user_id if the user is authenticated
    if (req.userId) {
      insertData.user_id = req.userId;
    }

    const { data, error } = await supabase.from('safety_reports')
      .insert(insertData).select().single();

    if (error) throw error;

    // Award credits for report submission
    if (req.userId && data) {
      onReportSubmitted(req.userId, data.id, data.verified).catch(() => {});
    }

    res.status(201).json({ message: 'Report submitted successfully', report: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports
router.get('/reports', async (req, res) => {
  try {
    const { lat, lng, radius = 2, timeFilter } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    let query = supabase.from('safety_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (timeFilter && timeFilter !== 'all') {
      query = query.eq('time_of_day', timeFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filter by distance in JS
    const radiusKm = parseFloat(radius);
    const radiusM = radiusKm * 1000;
    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);

    // If radius is very large (>100km), skip distance filter and return all
    const filtered = radiusKm >= 100
      ? (data || [])
      : (data || []).filter(r => {
          const d = haversineM(centerLat, centerLng, r.latitude, r.longitude);
          return d <= radiusM;
        });

    res.json(filtered.map(rowToReport));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reports/:id/upvote
router.post('/reports/:id/upvote', async (req, res) => {
  try {
    const { data: existing } = await supabase.from('safety_reports').select('upvotes, user_id').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ error: 'Report not found' });

    const { data, error } = await supabase.from('safety_reports')
      .update({ upvotes: (existing.upvotes || 0) + 1 })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;

    // Award credits to the report author
    if (existing.user_id) {
      onReportUpvoted(existing.user_id, req.params.id).catch(() => {});
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/heatmap
router.get('/heatmap', async (req, res) => {
  try {
    const { north, south, east, west, timeOfDay } = req.query;

    let query = supabase.from('safety_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (timeOfDay && timeOfDay !== 'all') {
      query = query.eq('time_of_day', timeOfDay);
    }

    const { data, error } = await query;
    if (error) throw error;

    let reports = (data || []).map(rowToReport);

    // Filter by bounds if provided
    if (north && south && east && west) {
      const bounds = {
        north: parseFloat(north), south: parseFloat(south),
        east: parseFloat(east), west: parseFloat(west),
      };
      reports = reports.filter(r => {
        const [lng, lat] = r.location.coordinates;
        return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
      });
    }

    const heatmapData = generateHeatmapData(reports, null, timeOfDay);
    res.json(heatmapData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/safety-score
router.get('/safety-score', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

    const { data, error } = await supabase.from('safety_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    // Use 5km radius for safety score calculation to capture nearby report clusters
    const nearby = (data || []).filter(r => haversineM(centerLat, centerLng, r.latitude, r.longitude) <= 5000).map(rowToReport);

    const timeOfDay = getTimeOfDayFromHour(new Date().getHours());
    const score = calculateRoadSafetyScore(centerLat, centerLng, timeOfDay, nearby);
    res.json(score);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Trend-based City Safety Score Algorithm ---
// Splits the last 30 days into weekly windows, measures severity-weighted
// incident volume per week, then checks whether clusters are accelerating
// (getting worse) or decelerating (improving). The score reflects the TREND,
// not raw totals.
function computeTrendScore(reports) {
  const now = Date.now();
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  // 4 weekly buckets: [week4=most recent ... week1=oldest]
  const weeks = [0, 0, 0, 0];
  for (const r of reports) {
    const age = now - new Date(r.created_at).getTime();
    if (age > 4 * MS_PER_WEEK) continue; // older than 30 days — ignore
    const bucket = Math.min(3, Math.floor(age / MS_PER_WEEK));
    // bucket 0 = this week, 3 = oldest week
    const sevWeight = (r.severity || 3) / 5;
    weeks[bucket] += sevWeight;
  }

  // Reverse so index 0 = oldest week, index 3 = most recent
  weeks.reverse();

  // Velocities: week-to-week change (positive = worsening)
  const v1 = weeks[1] - weeks[0]; // week1→week2
  const v2 = weeks[2] - weeks[1]; // week2→week3
  const v3 = weeks[3] - weeks[2]; // week3→week4 (most recent change)

  // Acceleration: is the rate of change itself increasing or decreasing?
  // Positive acceleration = clusters growing faster = bad
  // Negative acceleration = clusters slowing down = good
  const a1 = v2 - v1;
  const a2 = v3 - v2;
  // Weight recent acceleration more
  const acceleration = a1 * 0.4 + a2 * 0.6;

  // Current week volume relative to the 4-week average
  const avgWeekly = (weeks[0] + weeks[1] + weeks[2] + weeks[3]) / 4;
  const currentRatio = avgWeekly > 0 ? weeks[3] / avgWeekly : 1;

  // Base score: 65 (neutral-ish)
  let score = 65;

  // Trend adjustment (±25 pts): negative acceleration = improving = bonus
  const trendAdj = -acceleration * 3;
  score += Math.max(-25, Math.min(25, trendAdj));

  // Volume adjustment (±15 pts): if current week is way above/below average
  if (avgWeekly > 0) {
    const volAdj = -(currentRatio - 1) * 15;
    score += Math.max(-15, Math.min(15, volAdj));
  }

  // Velocity penalty (±10 pts): if most recent week spiked
  const velAdj = -v3 * 2;
  score += Math.max(-10, Math.min(10, velAdj));

  // Clamp to [15, 95] — never show 0
  return Math.max(15, Math.min(95, Math.round(score)));
}

// GET /api/dashboard-scores — city score + personal score (zones within 2km)
router.get('/dashboard-scores', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const centerLat = parseFloat(lat) || 23.0225;
    const centerLng = parseFloat(lng) || 72.5714;

    // Fetch last 30 days of reports
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: allReports, error } = await supabase
      .from('safety_reports')
      .select('*')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) throw error;
    const reports = allReports || [];

    // --- City Safety Score (trend-based) ---
    const cityScore = computeTrendScore(reports);

    // --- Personal Safety Score (distance-weighted with exponential decay) ---
    // Reports closer to user have much higher influence on the score.
    // Weight = e^(-distance / decayRate), so influence drops off exponentially.
    const RADIUS_M = 2000;
    const DECAY_RATE = 400; // ~400m — at 400m weight is ~37%, at 800m ~13%, at 1200m ~5%

    const nearbyReports = [];
    let totalWeightedThreat = 0;
    let totalWeight = 0;

    for (const r of reports) {
      const dist = haversineM(centerLat, centerLng, r.latitude, r.longitude);
      if (dist > RADIUS_M) continue;
      nearbyReports.push(r);

      // Exponential decay: closer reports matter much more
      const distWeight = Math.exp(-dist / DECAY_RATE);
      const severity = (r.severity || 3) / 5; // normalize to 0-1

      // Category weights (high-risk categories penalize more)
      const catWeights = {
        harassment: 1.0, suspicious_activity: 0.8, unsafe_street: 0.6,
        dark_road: 0.5, no_streetlights: 0.5, isolated_area: 0.5,
        poor_visibility: 0.4, other: 0.3,
      };
      const catWeight = catWeights[r.category] || 0.3;

      // Recency: recent reports matter more (last 7 days = full, decays over 30 days)
      const ageMs = Date.now() - new Date(r.created_at).getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      const recency = Math.exp(-ageDays / 10); // half-life ~7 days

      const threat = severity * catWeight * recency * distWeight;
      totalWeightedThreat += threat;
      totalWeight += distWeight;
    }

    let personalScore;
    if (nearbyReports.length === 0) {
      personalScore = 85; // no nearby reports = safe
    } else {
      // Normalize: higher threat = lower score
      // Scale threat sum to a 0-100 penalty
      // With exponential decay, a single severe report at 0m contributes ~1.0
      // Multiple close severe reports stack up quickly
      const threatPenalty = Math.min(70, totalWeightedThreat * 12);
      personalScore = Math.max(15, Math.min(95, Math.round(85 - threatPenalty)));
    }

    res.json({
      cityScore,
      personalScore,
      totalReports: reports.length,
      nearbyReports: nearbyReports.length,
      nearbyDangerZones: nearbyReports.filter(r => (r.severity || 1) >= 4).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/danger-prediction
router.get('/danger-prediction', async (req, res) => {
  try {
    const { data, error } = await supabase.from('safety_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;
    const reports = (data || []).map(rowToReport);
    const predictions = predictDangerZones(reports);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
