import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import TopNavBar from '../components/TopNavBar'
import { useSafety } from '../context/SafetyContext'
import { fetchAdoptedZones, adoptZone, deactivateZone } from '../services/api'

export default function AdoptZonePage() {
  const { userLocation } = useSafety()
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ zoneName: '', latitude: '', longitude: '', radiusMeters: 500 })
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadZones = () => {
    fetchAdoptedZones()
      .then(setZones)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadZones() }, [])

  useEffect(() => {
    if (userLocation && !form.latitude) {
      setForm(prev => ({ ...prev, latitude: userLocation.lat?.toString() || '', longitude: userLocation.lng?.toString() || '' }))
    }
  }, [userLocation, form.latitude])

  const handleAdopt = async (e) => {
    e.preventDefault()
    if (!form.zoneName || !form.latitude || !form.longitude) {
      setMessage('Please fill all fields')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      await adoptZone(form.zoneName, parseFloat(form.latitude), parseFloat(form.longitude), parseInt(form.radiusMeters))
      setMessage('Zone adopted successfully!')
      setShowForm(false)
      setForm({ zoneName: '', latitude: userLocation?.lat?.toString() || '', longitude: userLocation?.lng?.toString() || '', radiusMeters: 500 })
      loadZones()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to adopt zone')
    }
    setSubmitting(false)
  }

  const handleDeactivate = async (zoneId) => {
    try {
      await deactivateZone(zoneId)
      loadZones()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to deactivate zone')
    }
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      <TopNavBar title="Adopt a Zone" subtitle="Keep Your Area Safe" />

      <main className="p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8">
        <Link to="/rewards" className="inline-flex items-center gap-1 text-sm font-semibold text-primary mb-4 hover:underline">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Rewards
        </Link>

        {/* Info Card */}
        <div className="bg-linear-to-br from-emerald-500 to-teal-600 p-6 rounded-2xl md:rounded-3xl mb-6 text-white shadow-xl shadow-emerald-500/10">
          <h2 className="text-xl font-bold mb-2">Be a Zone Keeper</h2>
          <p className="text-sm opacity-90 mb-3">
            Claim responsibility for a neighborhood. Keep its safety data fresh by submitting reports regularly.
            Earn bonus credits when you submit 5+ reports in your zone each month.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">pin_drop</span>
              <span>Max 3 zones</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">monetization_on</span>
              <span>75 credits/month bonus</span>
            </div>
          </div>
        </div>

        {message && (
          <div className="bg-primary-fixed text-on-primary-fixed-variant px-4 py-3 rounded-xl mb-4 text-sm font-medium">
            {message}
          </div>
        )}

        {/* Adopt Button */}
        {!showForm && zones.length < 3 && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 bg-primary text-white rounded-2xl font-bold text-sm mb-6 flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined">add_location_alt</span>
            Adopt a New Zone
          </button>
        )}

        {/* Adopt Form */}
        {showForm && (
          <form onSubmit={handleAdopt} className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm mb-6 space-y-4">
            <h3 className="font-bold text-on-surface">New Zone</h3>
            <div>
              <label className="text-sm font-medium text-on-surface-variant block mb-1">Zone Name</label>
              <input
                type="text"
                value={form.zoneName}
                onChange={e => setForm(prev => ({ ...prev, zoneName: e.target.value }))}
                placeholder="e.g., MG Road, Connaught Place"
                className="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={e => setForm(prev => ({ ...prev, latitude: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={e => setForm(prev => ({ ...prev, longitude: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-on-surface-variant block mb-1">Radius (meters)</label>
              <select
                value={form.radiusMeters}
                onChange={e => setForm(prev => ({ ...prev, radiusMeters: e.target.value }))}
                className="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm"
              >
                <option value={250}>250m</option>
                <option value={500}>500m</option>
                <option value={1000}>1km</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {submitting ? 'Adopting...' : 'Adopt Zone'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-surface-container text-on-surface-variant rounded-xl text-sm font-semibold">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* My Zones */}
        <h3 className="text-lg font-bold text-on-surface mb-3">My Zones ({zones.length}/3)</h3>

        {loading && (
          <div className="p-8 text-center text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
          </div>
        )}

        {!loading && zones.length === 0 && (
          <div className="bg-surface-container-lowest p-10 rounded-2xl text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-3 block">location_off</span>
            <p className="font-bold text-lg mb-1">No zones adopted yet</p>
            <p className="text-sm">Adopt a zone to start earning zone keeper rewards!</p>
          </div>
        )}

        <div className="space-y-4">
          {zones.map(zone => (
            <div key={zone.id} className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">location_on</span>
                    {zone.zone_name}
                    {zone.badge_earned && (
                      <span className="material-symbols-outlined text-amber-500 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                    )}
                  </h4>
                  <p className="text-xs text-on-surface-variant">{zone.radius_meters}m radius</p>
                </div>
                <button
                  onClick={() => handleDeactivate(zone.id)}
                  className="text-xs text-error font-semibold hover:underline"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 bg-surface-container rounded-xl">
                  <p className="text-lg font-extrabold text-on-surface">{zone.reports_this_month || 0}</p>
                  <p className="text-[10px] text-on-surface-variant">This Month</p>
                </div>
                <div className="text-center p-2 bg-surface-container rounded-xl">
                  <p className="text-lg font-extrabold text-on-surface">{zone.total_reports || 0}</p>
                  <p className="text-[10px] text-on-surface-variant">All Time</p>
                </div>
                <div className="text-center p-2 bg-surface-container rounded-xl">
                  <p className="text-lg font-extrabold text-on-surface">{zone.reports_this_month >= 5 ? '5/5' : `${zone.reports_this_month || 0}/5`}</p>
                  <p className="text-[10px] text-on-surface-variant">Monthly Goal</p>
                </div>
              </div>

              {/* Monthly goal progress */}
              <div className="w-full bg-surface-container rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${zone.reports_this_month >= 5 ? 'bg-green-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, ((zone.reports_this_month || 0) / 5) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                {zone.reports_this_month >= 5 ? 'Monthly bonus earned!' : `${5 - (zone.reports_this_month || 0)} more reports for monthly bonus`}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
