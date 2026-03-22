export function isNightTime() {
  const hour = new Date().getHours()
  return hour >= 19 || hour < 6
}

export function getTimeOfDay() {
  const hour = new Date().getHours()
  if (hour >= 0 && hour < 5) return 'late_night'
  if (hour >= 5 && hour < 7) return 'early_morning'
  if (hour >= 7 && hour < 17) return 'day'
  if (hour >= 17 && hour < 19) return 'evening'
  return 'night'
}

export function formatSafetyScore(score) {
  if (score >= 75) return { color: '#10b981', label: 'Safe', emoji: 'safe' }
  if (score >= 50) return { color: '#f59e0b', label: 'Moderate', emoji: 'warning' }
  if (score >= 25) return { color: '#f97316', label: 'Unsafe', emoji: 'danger' }
  return { color: '#ef4444', label: 'Dangerous', emoji: 'danger' }
}

export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatTimestamp(date) {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now - d
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

export function getScoreGradient(score) {
  if (score >= 75) return 'linear-gradient(135deg, #10b981, #059669)'
  if (score >= 50) return 'linear-gradient(135deg, #f59e0b, #d97706)'
  if (score >= 25) return 'linear-gradient(135deg, #f97316, #ea580c)'
  return 'linear-gradient(135deg, #ef4444, #dc2626)'
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function generateId() {
  return Math.random().toString(36).substring(2, 11)
}
