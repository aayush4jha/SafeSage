/**
 * NightShield AI - Safety Escalation Engine
 * 6-Stage progressive safety response system
 *
 * Stage 0: Normal - User is safe
 * Stage 1: Warning - User entered risk area, show warning
 * Stage 2: Reminder - Ask for codeword verification
 * Stage 3: Audio Recording - Start recording, notify contacts
 * Stage 4: Emergency Contacts - Full notification with audio
 * Stage 5: Nearby Services - Show police stations, hospitals
 * Stage 6: Live Tracking - Continuous tracking shared with family
 */

const STAGE_CONFIG = {
  0: { name: 'normal', timeout: null, action: 'none' },
  1: { name: 'warning', timeout: 60000, action: 'show_warning' }, // 1 min
  2: { name: 'reminder', timeout: 60000, action: 'request_codeword' }, // 1 min
  3: { name: 'recording', timeout: 60000, action: 'start_recording' }, // 1 min
  4: { name: 'contacts_notified', timeout: 60000, action: 'notify_contacts' }, // 1 min
  5: { name: 'nearby_services', timeout: 120000, action: 'show_services' }, // 2 min
  6: { name: 'live_tracking', timeout: null, action: 'continuous_tracking' }
};

function getStageConfig(stage) {
  return STAGE_CONFIG[stage] || STAGE_CONFIG[0];
}

function evaluateEscalation(currentState, areaRiskLevel, timeSinceLastResponse) {
  const { stage, reminderCount, resolved } = currentState;

  if (resolved) return { shouldEscalate: false, nextStage: 0 };

  // Determine if we should escalate
  const config = getStageConfig(stage);
  const shouldEscalate = config.timeout && timeSinceLastResponse > config.timeout;

  if (!shouldEscalate) {
    return { shouldEscalate: false, nextStage: stage, action: config.action };
  }

  const nextStage = Math.min(6, stage + 1);
  const nextConfig = getStageConfig(nextStage);

  return {
    shouldEscalate: true,
    nextStage,
    action: nextConfig.action,
    stageName: nextConfig.name,
    reminderCount: reminderCount + 1,
    notifications: getStageNotifications(nextStage, currentState)
  };
}

function getStageNotifications(stage, state) {
  const notifications = [];

  switch (stage) {
    case 1:
      notifications.push({
        target: 'user',
        type: 'warning',
        title: 'Safety Alert',
        message: 'You have entered a medium-risk area. Stay aware of your surroundings.',
        priority: 'medium'
      });
      break;
    case 2:
      notifications.push({
        target: 'user',
        type: 'codeword_challenge',
        title: 'Safety Check',
        message: 'Are you safe? Please enter your safety codeword to confirm.',
        priority: 'high'
      });
      break;
    case 3:
      notifications.push({
        target: 'user',
        type: 'recording_started',
        title: 'Audio Recording Started',
        message: 'For your safety, audio recording has been activated.',
        priority: 'critical'
      });
      notifications.push({
        target: 'contacts',
        type: 'danger_alert',
        title: 'Safety Concern',
        message: `${state.userName || 'A family member'} may be in danger. Audio recording has started.`,
        priority: 'critical',
        actions: ['listen_recording', 'ignore', 'call_user']
      });
      break;
    case 4:
      notifications.push({
        target: 'contacts',
        type: 'emergency_notification',
        title: 'Emergency Alert',
        message: `${state.userName || 'A family member'} has not responded to safety checks. Location tracking active.`,
        priority: 'critical',
        actions: ['view_location', 'call_user', 'call_police']
      });
      break;
    case 5:
      notifications.push({
        target: 'user',
        type: 'nearby_services',
        title: 'Help Nearby',
        message: 'Showing nearby police stations, hospitals, and emergency contacts.',
        priority: 'critical',
        showServices: true
      });
      break;
    case 6:
      notifications.push({
        target: 'family',
        type: 'live_tracking',
        title: 'Live Tracking Active',
        message: `Live location tracking is now shared with all family members.`,
        priority: 'critical'
      });
      break;
  }

  return notifications;
}

function shouldTriggerChallenge(areaRiskLevel, movementStatus, timeInArea) {
  // Trigger codeword challenge when:
  if (areaRiskLevel === 'unsafe') return true;
  if (areaRiskLevel === 'moderate' && movementStatus === 'stopped' && timeInArea > 120000) return true;
  if (movementStatus === 'stopped' && timeInArea > 300000) return true; // 5 min stopped anywhere
  return false;
}

function generateSafetyAnalysis(member) {
  const analyses = [];
  const { areaRiskLevel, movementStatus, lastActivityTimestamp, safetyScore } = member;
  const inactiveMinutes = (Date.now() - new Date(lastActivityTimestamp).getTime()) / 60000;

  if (areaRiskLevel === 'unsafe' || areaRiskLevel === 'moderate') {
    analyses.push({
      type: 'entered_risk_area',
      severity: areaRiskLevel === 'unsafe' ? 'critical' : 'warning',
      message: `Has entered a ${areaRiskLevel}-risk area`,
      icon: 'alert-triangle'
    });
  }

  if (movementStatus === 'stopped' && (areaRiskLevel === 'unsafe' || areaRiskLevel === 'moderate')) {
    analyses.push({
      type: 'stopped_in_risk',
      severity: 'critical',
      message: `Has stopped moving in a ${areaRiskLevel}-risk area`,
      icon: 'pause-circle'
    });
  }

  if (inactiveMinutes > 5 && areaRiskLevel !== 'safe') {
    analyses.push({
      type: 'inactive_in_risk',
      severity: 'warning',
      message: `Has been inactive for ${Math.round(inactiveMinutes)} minutes in a risky zone`,
      icon: 'clock'
    });
  }

  if (safetyScore > 70 && movementStatus === 'walking') {
    analyses.push({
      type: 'safer_route',
      severity: 'info',
      message: 'Is taking a safer route',
      icon: 'shield-check'
    });
  }

  if (movementStatus === 'running') {
    analyses.push({
      type: 'running_detected',
      severity: 'warning',
      message: 'Rapid movement detected',
      icon: 'activity'
    });
  }

  return analyses;
}

// Fallback static data (used when Google API key is not set or API fails)
const FALLBACK_SERVICES = {
  police: [
    { name: 'Navrangpura Police Station', lat: 23.0350, lng: 72.5600, phone: '079-27913892', distance: null },
    { name: 'Ellis Bridge Police Station', lat: 23.0250, lng: 72.5650, phone: '079-26577100', distance: null },
    { name: 'Satellite Police Station', lat: 23.0150, lng: 72.5100, phone: '079-26921100', distance: null },
    { name: 'Maninagar Police Station', lat: 23.0050, lng: 72.5800, phone: '079-25461100', distance: null },
    { name: 'Sabarmati Police Station', lat: 23.0500, lng: 72.5550, phone: '079-27505100', distance: null },
    { name: 'Women Helpline', lat: 23.0225, lng: 72.5714, phone: '181', distance: null },
    { name: 'Police Control Room', lat: 23.0225, lng: 72.5714, phone: '100', distance: null },
  ],
  hospitals: [
    { name: 'Civil Hospital', lat: 23.0225, lng: 72.5710, phone: '079-22683721', distance: null },
    { name: 'VS Hospital', lat: 23.0260, lng: 72.5680, phone: '079-26578354', distance: null },
    { name: 'Sterling Hospital', lat: 23.0300, lng: 72.5170, phone: '079-40011111', distance: null },
    { name: 'Apollo Hospital', lat: 23.0500, lng: 72.5300, phone: '079-66701800', distance: null },
    { name: 'Zydus Hospital', lat: 23.0400, lng: 72.5100, phone: '079-71660000', distance: null },
    { name: 'Ambulance (108)', lat: 23.0225, lng: 72.5714, phone: '108', distance: null },
  ]
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Fetch nearby places from Google Places API (Nearby Search)
 * Docs: https://developers.google.com/maps/documentation/places/web-service/nearby-search
 */
async function fetchGoogleNearbyPlaces(lat, lng, type, radiusMeters = 5000) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=${type}&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;

  // For each result, fetch phone number via Place Details
  const places = [];
  for (const place of data.results.slice(0, 5)) {
    let phone = null;
    try {
      const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,international_phone_number&key=${apiKey}`;
      const detailRes = await fetch(detailUrl);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        phone = detailData.result?.formatted_phone_number || detailData.result?.international_phone_number || null;
      }
    } catch {
      // skip phone lookup failure
    }

    const placeLat = place.geometry.location.lat;
    const placeLng = place.geometry.location.lng;
    const dist = haversine(lat, lng, placeLat, placeLng);

    places.push({
      name: place.name,
      lat: placeLat,
      lng: placeLng,
      phone: phone || (type === 'police' ? '100' : '108'),
      distance: Math.round(dist * 1000),
      address: place.vicinity || '',
      rating: place.rating || null,
      isOpen: place.opening_hours?.open_now ?? null,
      placeId: place.place_id,
    });
  }

  places.sort((a, b) => a.distance - b.distance);
  return places;
}

/**
 * Get nearby services — tries Google Places API first, falls back to static data.
 * Returns a Promise.
 */
async function getNearbyServices(lat, lng, radiusKm = 5) {
  const radiusMeters = radiusKm * 1000;

  // Try Google Places API
  try {
    const [police, hospitals] = await Promise.all([
      fetchGoogleNearbyPlaces(lat, lng, 'police', radiusMeters),
      fetchGoogleNearbyPlaces(lat, lng, 'hospital', radiusMeters),
    ]);

    if (police || hospitals) {
      const result = {
        police: police || [],
        hospitals: hospitals || [],
        source: 'google',
      };
      // Always append emergency helplines at the end
      result.police.push(
        { name: 'Women Helpline', lat, lng, phone: '181', distance: 0 },
        { name: 'Police Control Room', lat, lng, phone: '100', distance: 0 },
      );
      result.hospitals.push(
        { name: 'Ambulance (108)', lat, lng, phone: '108', distance: 0 },
      );
      return result;
    }
  } catch (err) {
    console.warn('Google Places API failed, using fallback data:', err.message);
  }

  // Fallback to static data
  return getFallbackServices(lat, lng, radiusKm);
}

function getFallbackServices(lat, lng, radiusKm = 5) {
  const result = { police: [], hospitals: [], source: 'fallback' };

  FALLBACK_SERVICES.police.forEach(s => {
    const dist = haversine(lat, lng, s.lat, s.lng);
    if (dist <= radiusKm) {
      result.police.push({ ...s, distance: Math.round(dist * 1000) });
    }
  });

  FALLBACK_SERVICES.hospitals.forEach(s => {
    const dist = haversine(lat, lng, s.lat, s.lng);
    if (dist <= radiusKm) {
      result.hospitals.push({ ...s, distance: Math.round(dist * 1000) });
    }
  });

  result.police.sort((a, b) => a.distance - b.distance);
  result.hospitals.sort((a, b) => a.distance - b.distance);

  return result;
}

module.exports = {
  evaluateEscalation,
  shouldTriggerChallenge,
  generateSafetyAnalysis,
  getNearbyServices,
  getStageConfig,
  STAGE_CONFIG
};
