import { useState, useEffect, useCallback, useRef } from 'react'
import TopNavBar from '../components/TopNavBar'
import { useSafety } from '../context/SafetyContext'
import { useCache } from '../context/CacheContext'
import { fetchReports, submitReport, analyzeReportImage } from '../services/api'
import { formatTimestamp } from '../utils/helpers'

const categories = [
  { id: 'dark_road', label: 'Dark Road', icon: 'dark_mode' },
  { id: 'unsafe_street', label: 'Unsafe Street', icon: 'warning' },
  { id: 'suspicious_activity', label: 'Suspicious Activity', icon: 'visibility' },
  { id: 'harassment', label: 'Harassment', icon: 'report' },
  { id: 'poor_visibility', label: 'Poor Visibility', icon: 'wb_cloudy' },
  { id: 'other', label: 'Other', icon: 'help' },
]

const severityLabels = ['Low', 'Minor', 'Moderate', 'High', 'Critical']

export default function ReportPage() {
  const { userLocation } = useSafety()
  const { get, set, invalidate } = useCache()
  const [recentReports, setRecentReports] = useState(() => get('report_recentReports') || [])
  const [category, setCategory] = useState(null)
  const [severity, setSeverity] = useState(3)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Image state
  const [imageData, setImageData] = useState(null) // base64
  const [imagePreview, setImagePreview] = useState(null) // preview URL
  const [imageAnalysis, setImageAnalysis] = useState(null) // API result
  const [analyzingImage, setAnalyzingImage] = useState(false)
  const fileInputRef = useRef(null)

  const loadReports = useCallback(async (force = false) => {
    if (!userLocation) return
    if (!force && get('report_recentReports')) return
    try {
      const data = await fetchReports(userLocation.lat, userLocation.lng, 5)
      if (Array.isArray(data)) {
        const sliced = data.slice(0, 5)
        setRecentReports(sliced)
        set('report_recentReports', sliced)
      }
    } catch {}
  }, [userLocation, get, set])

  useEffect(() => { loadReports() }, [loadReports])

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type and size
    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) {
      setImageAnalysis({ accepted: false, reason: 'Image is too large. Please use an image under 10MB.' })
      return
    }

    // Read as base64
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target.result
      setImagePreview(base64)
      setImageData(base64)
      setImageAnalysis(null)

      // Analyze the image
      setAnalyzingImage(true)
      try {
        const result = await analyzeReportImage(base64)
        setImageAnalysis(result)
      } catch (err) {
        setImageAnalysis({ accepted: false, reason: 'Failed to analyze image. Please try again.' })
      }
      setAnalyzingImage(false)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageData(null)
    setImagePreview(null)
    setImageAnalysis(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!category) return

    // If image was added but rejected, block submission
    if (imageData && imageAnalysis && !imageAnalysis.accepted) return

    setSubmitting(true)
    try {
      await submitReport({
        category,
        severity,
        description: description.trim() || undefined,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
        imageVerified: imageAnalysis?.accepted || false,
        imageAnalysis: imageAnalysis?.accepted ? {
          darkness: imageAnalysis.darkness,
          visibility: imageAnalysis.visibility,
          crowdPresence: imageAnalysis.crowdPresence,
          credibilityModifier: imageAnalysis.credibilityModifier,
        } : undefined,
      })
    } catch {}
    setSubmitting(false)
    setSubmitted(true)
    // Invalidate caches so dashboard/map get fresh data too
    invalidate('report_recentReports')
    invalidate('dashboard_reports')
    invalidate('map_reports')
    loadReports(true)
    setTimeout(() => {
      setSubmitted(false)
      setCategory(null)
      setSeverity(3)
      setDescription('')
      handleRemoveImage()
    }, 3000)
  }

  const statusColor = (sev) => sev >= 4 ? 'error' : sev >= 3 ? 'tertiary' : 'primary'
  const statusLabel = (sev) => sev >= 4 ? 'Risk' : sev >= 3 ? 'Caution' : 'Secure'

  const categoryLabels = { dark_road: 'Dark Road', unsafe_street: 'Unsafe Street', suspicious_activity: 'Suspicious Activity', harassment: 'Harassment', poor_visibility: 'Poor Visibility', isolated_area: 'Isolated Area', no_streetlights: 'No Streetlights', other: 'Other' }

  // Can submit: category selected, and if image is present it must be accepted (or still analyzing)
  const canSubmit = category && !submitting && !(imageData && imageAnalysis && !imageAnalysis.accepted)

  return (
    <div className="min-h-screen bg-surface-container-low">
      <TopNavBar title="Safety Map" subtitle="Report Concern" />

      <main className="p-4 md:p-8 max-w-5xl mx-auto pb-24 md:pb-8">
        {/* Banner */}
        <div className="mb-6 md:mb-8 p-4 md:p-6 rounded-2xl md:rounded-3xl bg-linear-to-r from-primary/5 to-tertiary/5 border border-outline-variant/10 text-center">
          <p className="text-xs md:text-sm text-on-surface-variant">
            <span className="text-primary font-bold">Your reports help keep others safe.</span> Every report strengthens the safety network.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          {/* Report Form */}
          <div className="lg:col-span-7">
            {submitted ? (
              <div className="bg-surface-container-lowest p-10 md:p-16 rounded-2xl md:rounded-3xl shadow-sm text-center">
                <span className="material-symbols-outlined text-primary text-6xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <h3 className="text-2xl font-bold text-on-surface mt-4">Report Submitted</h3>
                <p className="text-on-surface-variant mt-2">
                  {imageAnalysis?.accepted
                    ? 'Your verified report has been submitted. Thank you!'
                    : 'Thank you for keeping the community safe.'}
                </p>
                {imageAnalysis?.accepted && (
                  <span className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    Photo Verified
                  </span>
                )}
              </div>
            ) : (
              <div className="bg-surface-container-lowest p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-sm">
                <h3 className="text-xl font-bold text-on-surface mb-2">Report a Safety Concern</h3>
                <p className="text-sm text-on-surface-variant mb-6">Your report is anonymous and helps keep others safe</p>

                {/* Category */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 block">Category</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                          category === cat.id
                            ? 'border-primary bg-primary-fixed/20 text-primary'
                            : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:border-outline-variant/50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                        <span className="text-[11px] font-bold">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Severity */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Severity</label>
                    <span className={`text-xs font-bold ${severity >= 4 ? 'text-error' : severity >= 3 ? 'text-tertiary' : 'text-primary'}`}>
                      {severityLabels[severity - 1]}
                    </span>
                  </div>
                  <input type="range" min={1} max={5} value={severity} onChange={e => setSeverity(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-surface-container-high" />
                  <div className="flex justify-between mt-1">
                    {[1,2,3,4,5].map(n => <span key={n} className={`text-[10px] ${severity === n ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>{n}</span>)}
                  </div>
                </div>

                {/* Image Evidence */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 block">
                    Photo Evidence <span className="normal-case font-normal">(optional — adds verification)</span>
                  </label>

                  {!imagePreview ? (
                    <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-6 text-center hover:border-primary/30 transition-colors">
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-2">add_a_photo</span>
                      <p className="text-sm text-on-surface-variant mb-3">Upload a photo of the location</p>
                      <div className="flex gap-3 justify-center">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/15 transition-colors flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-base">photo_library</span>
                          Choose Photo
                        </button>
                        <button
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.setAttribute('capture', 'environment')
                              fileInputRef.current.click()
                              fileInputRef.current.removeAttribute('capture')
                            }
                          }}
                          className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/15 transition-colors flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-base">photo_camera</span>
                          Take Photo
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden border-2 border-outline-variant/20">
                      {/* Preview */}
                      <div className="relative">
                        <img src={imagePreview} alt="Evidence" className="w-full h-48 object-cover" />
                        <button
                          onClick={handleRemoveImage}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      </div>

                      {/* Analysis result */}
                      <div className="p-3">
                        {analyzingImage && (
                          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                            <div className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                            Analyzing image...
                          </div>
                        )}

                        {imageAnalysis && imageAnalysis.accepted && (
                          <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                            <div>
                              <p className="text-sm font-bold text-primary">Image Verified</p>
                              <p className="text-[11px] text-on-surface-variant mt-0.5">
                                {imageAnalysis.environment?.timeOfDay === 'night' ? 'Night' : imageAnalysis.environment?.timeOfDay === 'dusk' ? 'Dusk' : 'Daytime'} outdoor photo
                                {imageAnalysis.darkness?.level === 'very_dark' || imageAnalysis.darkness?.level === 'dark' ? ' — poor lighting detected' : ''}
                                {imageAnalysis.crowdPresence?.level === 'likely_empty' ? ' — area appears empty' : ''}
                              </p>
                              <div className="flex gap-3 mt-2">
                                {imageAnalysis.darkness && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    imageAnalysis.darkness.score > 50 ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
                                  }`}>
                                    Darkness: {imageAnalysis.darkness.score}%
                                  </span>
                                )}
                                {imageAnalysis.visibility && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    imageAnalysis.visibility.score < 45 ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'
                                  }`}>
                                    Visibility: {imageAnalysis.visibility.level}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {imageAnalysis && !imageAnalysis.accepted && (
                          <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-error text-lg">cancel</span>
                            <div>
                              <p className="text-sm font-bold text-error">Image Rejected</p>
                              <p className="text-[11px] text-on-surface-variant mt-0.5">
                                {imageAnalysis.reason}
                              </p>
                              <button
                                onClick={handleRemoveImage}
                                className="mt-2 text-xs text-primary font-bold hover:underline"
                              >
                                Upload a different photo
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 block">Description (optional)</label>
                  <textarea className="input-field" rows={3} placeholder="Describe the safety concern..." value={description} onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical', minHeight: 80 }} />
                </div>

                {/* Location */}
                <div className="flex items-center gap-3 p-4 bg-primary-fixed/10 rounded-2xl border border-primary/10 mb-6 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary">my_location</span>
                  {userLocation ? `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}` : 'Acquiring location...'}
                </div>

                {/* Submit */}
                <button onClick={handleSubmit} disabled={!canSubmit}
                  className="w-full py-4 bg-primary text-on-primary rounded-2xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  ) : analyzingImage ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      Analyzing image...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">send</span>
                      {imageAnalysis?.accepted ? 'Submit Verified Report' : 'Report'}
                    </>
                  )}
                </button>

                {/* Rejected image hint */}
                {imageData && imageAnalysis && !imageAnalysis.accepted && (
                  <p className="text-xs text-error mt-2 text-center">
                    Remove or replace the rejected image before submitting
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Recent Reports */}
          <div className="lg:col-span-5">
            <div className="bg-surface-container-lowest rounded-3xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-surface-container-low">
                <h3 className="font-headline text-lg font-bold">Recent Reports Nearby</h3>
              </div>
              <div className="divide-y divide-surface-container-low">
                {recentReports.length === 0 && (
                  <div className="p-8 text-center text-on-surface-variant text-sm">No reports found nearby. Be the first to report!</div>
                )}
                {recentReports.map((report, i) => {
                  const sev = report.severity || 3
                  const sc = statusColor(sev)
                  return (
                    <div key={report._id || i} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-container-low/30 transition-colors">
                      <div className={`w-2 h-2 rounded-full ${sc === 'error' ? 'bg-error' : sc === 'tertiary' ? 'bg-tertiary' : 'bg-primary'}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-on-surface">{categoryLabels[report.category] || report.category}</span>
                          {report.image_verified && (
                            <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                          )}
                        </div>
                        <div className="text-[11px] text-on-surface-variant mt-0.5">{formatTimestamp(report.timestamp || report.created_at)}</div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        sc === 'error' ? 'bg-error-container/40 text-on-error-container' :
                        sc === 'tertiary' ? 'bg-tertiary-fixed/40 text-on-tertiary-fixed-variant' :
                        'bg-primary-fixed/40 text-on-primary-fixed-variant'
                      }`}>{statusLabel(sev)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
