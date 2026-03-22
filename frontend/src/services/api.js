import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('nightshield_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fetchHeatmapData = (bounds, timeOfDay) =>
  api.get('/heatmap', { params: { ...bounds, timeOfDay } }).then(r => r.data);

export const fetchSafetyScore = (lat, lng) =>
  api.get('/safety-score', { params: { lat, lng } }).then(r => r.data);

export const submitReport = (data) =>
  api.post('/reports', data).then(r => r.data);

export const fetchReports = (lat, lng, radius = 2) =>
  api.get('/reports', { params: { lat, lng, radius } }).then(r => r.data);

export const fetchSafeRoutes = (origin, destination, timeOfDay) =>
  api.post('/routes/safe', { origin, destination, timeOfDay }).then(r => r.data);

export const triggerEmergencyAlert = (data) =>
  api.post('/emergency/alert', data).then(r => r.data);

export const resolveEmergencyAlert = (id, status = 'resolved') =>
  api.put(`/emergency/alert/${encodeURIComponent(id)}/resolve`, { status }).then(r => r.data);

export const checkMovement = (locationHistory) =>
  api.post('/emergency/movement-check', { locationHistory }).then(r => r.data);

export const sendEmergencyPhotos = (photos) =>
  api.post('/emergency/photos', { photos }).then(r => r.data);

export const fetchDangerPredictions = () =>
  api.get('/danger-prediction').then(r => r.data);

export const fetchDashboardScores = (lat, lng) =>
  api.get('/dashboard-scores', { params: { lat, lng } }).then(r => r.data);

export const fetchEmergencyHistory = () =>
  api.get('/emergency/history').then(r => r.data);

export const fetchActiveEmergencies = () =>
  api.get('/emergency/active').then(r => r.data);

export const registerUser = (data) =>
  api.post('/users/register', data).then(r => r.data);

export const loginUser = (data) =>
  api.post('/users/login', data).then(r => r.data);

export const updateEmergencyContacts = (contacts) =>
  api.put('/users/emergency-contacts', { emergencyContacts: contacts }).then(r => r.data);

export const fetchProfile = () =>
  api.get('/users/profile').then(r => r.data);

export const fetchUserStats = () =>
  api.get('/users/stats').then(r => r.data);

// Family Circle APIs
export const fetchFamilyNetwork = () =>
  api.get('/family/network').then(r => r.data);

export const createCircle = (name) =>
  api.post('/family/circle/create', { name }).then(r => r.data);

export const joinCircle = (code, relationship) =>
  api.post('/family/circle/join', { code, relationship }).then(r => r.data);

export const leaveCircle = (circleId) =>
  api.post('/family/circle/leave', { circleId }).then(r => r.data);

export const deleteCircle = (circleId) =>
  api.delete(`/family/circle/${encodeURIComponent(circleId)}`).then(r => r.data);

export const updateFamilyLocation = (lat, lng) =>
  api.post('/family/location-update', { lat, lng }).then(r => r.data);

export const acknowledgeFamilyAlert = (alertId) =>
  api.post('/family/acknowledge-alert', { alertId }).then(r => r.data);

// Image Verification APIs
export const analyzeReportImage = (imageData) =>
  api.post('/reports/analyze-image', { imageData }).then(r => r.data);

// Codeword APIs
export const setupCodeword = (codeword) =>
  api.post('/codeword/setup', { codeword }).then(r => r.data);

export const verifyCodeword = (codeword, lat, lng) =>
  api.post('/codeword/verify', { codeword, lat, lng }).then(r => r.data);

export const checkAreaForChallenge = (data) =>
  api.post('/codeword/check-area', data).then(r => r.data);

export const escalateCodeword = (data) =>
  api.post('/codeword/escalate', data).then(r => r.data);

export const getCodewordStatus = () =>
  api.get('/codeword/status').then(r => r.data);

export const getNearbyServices = (lat, lng) =>
  api.get('/codeword/nearby-services', { params: { lat, lng } }).then(r => r.data);

// Safety Zones APIs
export const fetchSafetyZones = (bounds) =>
  api.get('/safety-zones', { params: bounds }).then(r => r.data);

export const createSafetyZone = (data) =>
  api.post('/safety-zones', data).then(r => r.data);

export const checkRouteSafety = (waypoints) =>
  api.post('/routes/check-safety', { waypoints }).then(r => r.data);

export const fetchZoneAtPoint = (lng, lat) =>
  api.get('/zone-at-point', { params: { lng, lat } }).then(r => r.data);

export default api;
