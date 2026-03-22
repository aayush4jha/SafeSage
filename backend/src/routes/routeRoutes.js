const express = require('express');
const router = express.Router();
const { supabase } = require('../config/db');
const { rankRoutes, generateAlternativeRoutes, fetchOSRMRoutes } = require('../ai/routeSafetyEngine');
const { computeSafetyGrid, checkRouteAgainstGrid } = require('../ai/zoneGridEngine');

function rowToReport(r) {
  return {
    _id: r.id,
    location: { type: 'Point', coordinates: [r.longitude, r.latitude] },
    category: r.category,
    severity: r.severity,
    timestamp: r.created_at,
    timeOfDay: r.time_of_day,
  };
}

// POST /api/routes/safe — Main safe routing endpoint
router.post('/routes/safe', async (req, res) => {
  try {
    const { origin, destination, timeOfDay } = req.body;
    if (!origin || !destination) {
      return res.status(400).json({ error: 'origin and destination are required' });
    }

    const { data, error } = await supabase.from('safety_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    const reports = (data || []).map(rowToReport);

    const hour = new Date().getHours();
    const currentTimeOfDay = timeOfDay || (
      hour >= 0 && hour < 5 ? 'late_night' :
      hour >= 5 && hour < 7 ? 'early_morning' :
      hour >= 17 && hour < 20 ? 'evening' :
      hour >= 20 ? 'night' : 'day'
    );

    // Try OSRM (OpenStreetMap) routing first, fall back to generated routes
    let routes = await fetchOSRMRoutes(origin, destination);
    if (!routes) {
      routes = generateAlternativeRoutes(origin, destination, 3);
    }

    const rankedRoutes = await rankRoutes(routes, reports, currentTimeOfDay, origin, destination);
    res.json(rankedRoutes);
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/routes/check-safety — Check a route against dynamic safety grid
router.post('/routes/check-safety', async (req, res) => {
  try {
    const { waypoints } = req.body;
    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({ error: 'waypoints array with at least 2 points is required' });
    }
    const result = await checkRouteAgainstGrid(waypoints);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/safety-zones — Dynamic safety grid computed from safety_reports
router.get('/safety-zones', async (req, res) => {
  try {
    const { min_lng, min_lat, max_lng, max_lat } = req.query;

    if (!min_lng || !min_lat || !max_lng || !max_lat) {
      return res.status(400).json({ error: 'Bounds required: min_lng, min_lat, max_lng, max_lat' });
    }

    const grid = await computeSafetyGrid({
      south: parseFloat(min_lat),
      north: parseFloat(max_lat),
      west: parseFloat(min_lng),
      east: parseFloat(max_lng),
    });

    res.json(grid);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/zone-at-point — Check which dynamic grid cell a point falls in
router.get('/zone-at-point', async (req, res) => {
  try {
    const { lng, lat } = req.query;
    if (!lng || !lat) {
      return res.status(400).json({ error: 'lng and lat are required' });
    }

    const pLng = parseFloat(lng);
    const pLat = parseFloat(lat);

    // Compute a tiny grid around the point
    const grid = await computeSafetyGrid({
      south: pLat - 0.005,
      north: pLat + 0.005,
      west: pLng - 0.005,
      east: pLng + 0.005,
    });

    // Find the cell containing this point
    const matching = grid.features.filter(f => {
      const coords = f.geometry.coordinates[0];
      const [minLng, minLat] = coords[0];
      const [maxLng, maxLat] = coords[2];
      return pLng >= minLng && pLng <= maxLng && pLat >= minLat && pLat <= maxLat;
    });

    res.json(matching.map(f => f.properties));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
