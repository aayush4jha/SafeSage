/**
 * NightShield AI - Safety Score Engine
 * Core innovation: Real-time road safety scoring using multi-factor analysis
 */

const TIME_MULTIPLIERS = {
  late_night: 0.6,
  night: 0.75,
  early_morning: 0.8,
  evening: 0.9,
  day: 1.0
};

const CATEGORY_WEIGHTS = {
  harassment: 5,
  suspicious_activity: 4,
  unsafe_street: 3,
  dark_road: 3,
  no_streetlights: 3,
  poor_visibility: 2,
  isolated_area: 4,
  other: 1
};

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function recencyWeight(reportDate) {
  const hoursAgo = (Date.now() - new Date(reportDate).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 1) return 1.0;
  if (hoursAgo < 6) return 0.9;
  if (hoursAgo < 24) return 0.7;
  if (hoursAgo < 72) return 0.5;
  if (hoursAgo < 168) return 0.3;
  return 0.1;
}

function calculateRoadSafetyScore(lat, lng, timeOfDay, reports, crowdData = null) {
  const nearbyReports = reports.filter(r => {
    const [rLng, rLat] = r.location.coordinates;
    return haversineDistance(lat, lng, rLat, rLng) < 0.5;
  });

  // Lighting Score (0-25): Higher when well-lit (day/evening), lower at night
  const baseLighting = timeOfDay === 'day' ? 25 : timeOfDay === 'evening' ? 20 : timeOfDay === 'night' ? 10 : 5;
  const lightingReports = nearbyReports.filter(r =>
    ['dark_road', 'no_streetlights', 'poor_visibility'].includes(r.category)
  );
  const lightingPenalty = Math.min(baseLighting, lightingReports.length * 3);
  const lightingScore = Math.max(0, baseLighting - lightingPenalty);

  // Crowd Score (0-25): Based on crowd density
  let crowdScore = 15;
  if (crowdData) {
    crowdScore = Math.min(25, Math.round(crowdData.density * 25));
  }
  if (timeOfDay === 'late_night') crowdScore = Math.min(crowdScore, 8);
  else if (timeOfDay === 'night') crowdScore = Math.min(crowdScore, 12);

  // Incident Score (0-25): Inverse of incident count, weighted by severity and recency
  const incidentReports = nearbyReports.filter(r =>
    ['harassment', 'suspicious_activity', 'unsafe_street'].includes(r.category)
  );
  let incidentWeight = 0;
  incidentReports.forEach(r => {
    const catWeight = CATEGORY_WEIGHTS[r.category] || 1;
    const recency = recencyWeight(r.timestamp);
    incidentWeight += r.severity * catWeight * recency;
  });
  const incidentScore = Math.max(0, 25 - Math.min(25, incidentWeight * 0.5));

  // Isolation Score (0-25): Based on nearby isolation reports
  const isolationReports = nearbyReports.filter(r => r.category === 'isolated_area');
  const isolationPenalty = isolationReports.length * 5;
  let isolationScore = Math.max(0, 25 - isolationPenalty);
  if (timeOfDay === 'late_night' || timeOfDay === 'night') {
    isolationScore = Math.round(isolationScore * 0.7);
  }

  const rawScore = lightingScore + crowdScore + incidentScore + isolationScore;
  const timeMultiplier = TIME_MULTIPLIERS[timeOfDay] || 1.0;
  const totalScore = Math.round(Math.min(100, rawScore * timeMultiplier));

  let riskLevel = 'safe';
  if (totalScore < 40) riskLevel = 'unsafe';
  else if (totalScore < 65) riskLevel = 'moderate';

  return {
    totalScore,
    breakdown: {
      lighting: lightingScore,
      crowd: crowdScore,
      incident: incidentScore,
      isolation: isolationScore
    },
    riskLevel,
    timeMultiplier,
    nearbyReportCount: nearbyReports.length
  };
}

function generateHeatmapData(reports, bounds, timeOfDay) {
  let filtered = reports;

  if (bounds) {
    filtered = reports.filter(r => {
      const [lng, lat] = r.location.coordinates;
      return lat >= bounds.south && lat <= bounds.north &&
        lng >= bounds.west && lng <= bounds.east;
    });
  }

  if (timeOfDay && timeOfDay !== 'all') {
    filtered = filtered.filter(r => r.timeOfDay === timeOfDay);
  }

  const clusters = [];
  const processed = new Set();

  filtered.forEach((report, i) => {
    if (processed.has(i)) return;
    processed.add(i);

    const [lng, lat] = report.location.coordinates;
    let clusterSeverity = report.severity * recencyWeight(report.timestamp) * (CATEGORY_WEIGHTS[report.category] || 1);
    let clusterLat = lat;
    let clusterLng = lng;
    let count = 1;

    filtered.forEach((other, j) => {
      if (i === j || processed.has(j)) return;
      const [oLng, oLat] = other.location.coordinates;
      if (haversineDistance(lat, lng, oLat, oLng) < 0.2) {
        processed.add(j);
        clusterSeverity += other.severity * recencyWeight(other.timestamp) * (CATEGORY_WEIGHTS[other.category] || 1);
        clusterLat = (clusterLat * count + oLat) / (count + 1);
        clusterLng = (clusterLng * count + oLng) / (count + 1);
        count++;
      }
    });

    const intensity = Math.min(1.0, clusterSeverity / 20);
    clusters.push({ lat: clusterLat, lng: clusterLng, intensity, reportCount: count });
  });

  return clusters;
}

function predictDangerZones(reports, currentTime = new Date()) {
  const currentHour = currentTime.getHours();
  const targetHours = [(currentHour + 1) % 24, (currentHour + 2) % 24];

  function getHourBucket(date) {
    return new Date(date).getHours();
  }

  // Group reports by approximate location (grid cells)
  const gridSize = 0.005; // ~500m
  const grid = {};

  reports.forEach(r => {
    const [lng, lat] = r.location.coordinates;
    const cellKey = `${Math.round(lat / gridSize) * gridSize},${Math.round(lng / gridSize) * gridSize}`;
    if (!grid[cellKey]) grid[cellKey] = [];
    grid[cellKey].push(r);
  });

  const predictions = [];

  Object.entries(grid).forEach(([cellKey, cellReports]) => {
    const [lat, lng] = cellKey.split(',').map(Number);

    // Check if this area has recurring incidents at target hours
    const relevantReports = cellReports.filter(r =>
      targetHours.includes(getHourBucket(r.timestamp))
    );

    if (relevantReports.length >= 2) {
      const avgSeverity = relevantReports.reduce((sum, r) => sum + r.severity, 0) / relevantReports.length;
      const categories = [...new Set(relevantReports.map(r => r.category))];
      const confidence = Math.min(0.95, relevantReports.length * 0.15);

      predictions.push({
        lat, lng,
        predictedRisk: Math.min(1.0, avgSeverity / 5),
        confidence,
        categories,
        reportCount: relevantReports.length,
        predictedTimeRange: targetHours.map(h => `${h}:00`),
        riskLevel: avgSeverity > 3.5 ? 'high' : avgSeverity > 2 ? 'medium' : 'low'
      });
    }
  });

  return predictions.sort((a, b) => b.predictedRisk - a.predictedRisk);
}

module.exports = {
  calculateRoadSafetyScore,
  generateHeatmapData,
  predictDangerZones,
  haversineDistance
};
