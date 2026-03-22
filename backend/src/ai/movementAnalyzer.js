/**
 * NightShield AI - Movement Anomaly Detection Engine
 * Detects panic movement, sudden running, abnormal stops, erratic behavior
 */

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function analyzeMovement(locationHistory) {
  if (!locationHistory || locationHistory.length < 2) {
    return {
      speed: 0, acceleration: 0, isRunning: false, isStopped: true,
      isErratic: false, anomalyScore: 0, anomalyType: null
    };
  }

  const sorted = [...locationHistory].sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  const speeds = [];
  const bearings = [];
  const accelerations = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const dist = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;

    if (timeDiff > 0) {
      const speed = (dist / timeDiff) * 3.6; // km/h
      speeds.push(speed);
      bearings.push(calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng));

      if (speeds.length >= 2) {
        const accel = (speed - speeds[speeds.length - 2]) / timeDiff;
        accelerations.push(accel);
      }
    }
  }

  if (speeds.length === 0) {
    return {
      speed: 0, acceleration: 0, isRunning: false, isStopped: true,
      isErratic: false, anomalyScore: 0, anomalyType: null
    };
  }

  const currentSpeed = speeds[speeds.length - 1];
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const currentAccel = accelerations.length > 0 ? accelerations[accelerations.length - 1] : 0;

  // Detect sudden running (speed > 12 km/h with rapid acceleration)
  const isRunning = currentSpeed > 12 && accelerations.some(a => a > 3);

  // Detect stopped (very low speed for extended period)
  const recentSpeeds = speeds.slice(-5);
  const isStopped = recentSpeeds.every(s => s < 0.5) && recentSpeeds.length >= 3;

  // Detect erratic movement (frequent large direction changes)
  let directionChanges = 0;
  for (let i = 1; i < bearings.length; i++) {
    let diff = Math.abs(bearings[i] - bearings[i - 1]);
    if (diff > 180) diff = 360 - diff;
    if (diff > 60) directionChanges++;
  }
  const isErratic = bearings.length > 3 && (directionChanges / bearings.length) > 0.5;

  // Calculate anomaly score (0-100)
  let anomalyScore = 0;
  let anomalyType = null;

  // Sudden speed change
  if (speeds.length >= 3) {
    const recentAvg = speeds.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const priorAvg = speeds.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, speeds.length - 3);
    const speedChange = Math.abs(recentAvg - priorAvg);

    if (speedChange > 10) {
      anomalyScore += 40;
      anomalyType = recentAvg > priorAvg ? 'sudden_run' : 'sudden_stop';
    } else if (speedChange > 5) {
      anomalyScore += 20;
    }
  }

  if (isErratic) {
    anomalyScore += 30;
    anomalyType = anomalyType || 'erratic_movement';
  }

  if (currentSpeed > 20) {
    anomalyScore += 20;
    anomalyType = anomalyType || 'unusual_speed';
  }

  if (isRunning && !isErratic) {
    anomalyScore += 15;
    anomalyType = anomalyType || 'sudden_run';
  }

  anomalyScore = Math.min(100, anomalyScore);

  return {
    speed: Math.round(currentSpeed * 10) / 10,
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    acceleration: Math.round(currentAccel * 100) / 100,
    isRunning,
    isStopped,
    isErratic,
    anomalyScore,
    anomalyType,
    dataPoints: sorted.length
  };
}

function detectPanicMovement(locationHistory) {
  if (!locationHistory || locationHistory.length < 5) {
    return { isPanic: false, confidence: 0 };
  }

  const analysis = analyzeMovement(locationHistory);
  let confidence = 0;

  // Rapid acceleration followed by direction changes = panic
  if (analysis.isRunning && analysis.isErratic) {
    confidence += 0.6;
  }

  // Sudden speed spike from walking to running
  if (analysis.anomalyType === 'sudden_run') {
    confidence += 0.3;
  }

  // High anomaly score
  if (analysis.anomalyScore > 60) {
    confidence += 0.2;
  }

  // Sudden stop after running (could indicate being caught)
  const sorted = [...locationHistory].sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );
  const speeds = [];
  for (let i = 1; i < sorted.length; i++) {
    const dist = haversineDistance(sorted[i - 1].lat, sorted[i - 1].lng, sorted[i].lat, sorted[i].lng);
    const time = (new Date(sorted[i].timestamp) - new Date(sorted[i - 1].timestamp)) / 1000;
    if (time > 0) speeds.push((dist / time) * 3.6);
  }

  if (speeds.length >= 4) {
    const wasRunning = speeds.slice(-4, -1).some(s => s > 10);
    const nowStopped = speeds[speeds.length - 1] < 1;
    if (wasRunning && nowStopped) {
      confidence += 0.3;
    }
  }

  confidence = Math.min(0.99, confidence);

  return {
    isPanic: confidence > 0.5,
    confidence: Math.round(confidence * 100) / 100,
    analysis
  };
}

module.exports = { analyzeMovement, detectPanicMovement };
