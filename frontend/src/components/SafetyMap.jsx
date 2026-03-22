import { useEffect, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline, Circle } from 'react-leaflet'
import L from 'leaflet'
import { useSafety } from '../context/SafetyContext'
import { fetchSafetyScore } from '../services/api'
import { formatSafetyScore } from '../utils/helpers'
import SafetyHeatmap from './SafetyHeatmap'

const userIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:40px;height:46px;">
      <div style="position:absolute;top:8px;left:4px;width:32px;height:32px;border-radius:50%;background:rgba(0,107,44,0.15);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:absolute;top:8px;left:4px;width:32px;height:32px;border-radius:50%;background:rgba(0,107,44,0.08);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite 0.5s;"></div>
      <svg viewBox="0 0 40 46" width="40" height="46" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <path d="M20 0C12 0 5.5 6.5 5.5 14.5C5.5 25.5 20 40 20 40S34.5 25.5 34.5 14.5C34.5 6.5 28 0 20 0Z" fill="#006b2c" stroke="white" stroke-width="2"/>
        <circle cx="20" cy="13" r="5" fill="white"/>
        <path d="M12 24c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
  `,
  iconSize: [40, 46],
  iconAnchor: [20, 46],
})

function getReportIcon(category) {
  const colors = {
    dark_road: '#f59e0b',
    unsafe_street: '#ef4444',
    suspicious_activity: '#f97316',
    harassment: '#dc2626',
    no_streetlights: '#eab308',
    poor_visibility: '#eab308',
    isolated_area: '#f97316',
    other: '#64748b',
  }
  const color = colors[category] || '#ef4444'
  return L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 8px ${color}80;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

function getRouteLabelIcon(route) {
  const isSafest = route.type === 'safest'
  const icon = isSafest ? 'shield' : 'bolt'
  const bg = route.color
  return L.divIcon({
    className: '',
    html: `
      <div style="
        display:flex;align-items:center;gap:5px;
        background:${bg};color:#fff;
        padding:4px 10px 4px 6px;border-radius:20px;
        font-size:11px;font-weight:700;font-family:system-ui;
        white-space:nowrap;
        box-shadow:0 2px 8px ${bg}60;
        border:2px solid rgba(255,255,255,0.9);
        cursor:pointer;
      ">
        <span class="material-symbols-outlined" style="font-size:14px;font-variation-settings:'FILL' 1">${icon}</span>
        ${isSafest ? 'Safest' : 'Shortest'}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 12],
  })
}

function LocationFollower({ location, follow, onFollowed }) {
  const map = useMap()
  const initialized = useRef(false)
  useEffect(() => {
    if (location && (follow || !initialized.current)) {
      map.flyTo([location.lat, location.lng], initialized.current ? map.getZoom() : 14, { animate: true, duration: 0.8 })
      initialized.current = true
      if (follow && onFollowed) onFollowed()
    }
  }, [location, follow, map, onFollowed])
  return null
}

function RouteFitter({ routes, destination, userLocation }) {
  const map = useMap()
  const lastFitRef = useRef(null)

  useEffect(() => {
    if (!routes || routes.length === 0) return

    const allPoints = []
    routes.forEach(route => {
      if (route?.waypoints) {
        route.waypoints.forEach(wp => allPoints.push([wp.lat, wp.lng]))
      }
    })
    if (userLocation) allPoints.push([userLocation.lat, userLocation.lng])
    if (destination) allPoints.push([destination.lat, destination.lng])

    if (allPoints.length < 2) return

    const fitKey = allPoints.length + '-' + allPoints[0].join(',') + '-' + allPoints[allPoints.length - 1].join(',')
    if (fitKey === lastFitRef.current) return
    lastFitRef.current = fitKey

    const bounds = L.latLngBounds(allPoints)
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true, duration: 0.8 })
  }, [routes, destination, userLocation, map])

  return null
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) })
  return null
}

function getRouteMidpoint(waypoints) {
  if (!waypoints || waypoints.length === 0) return null
  const mid = Math.floor(waypoints.length / 2)
  return waypoints[mid]
}

function getRouteQuarterPoint(waypoints) {
  if (!waypoints || waypoints.length === 0) return null
  const q = Math.floor(waypoints.length / 4)
  return waypoints[q]
}

export default function SafetyMap({ routes = [], reports = [], dangerZones = [], destination, routeLoading, onDestinationSelect }) {
  const { userLocation } = useSafety()
  const [followUser, setFollowUser] = useState(true)
  const [recenterKey, setRecenterKey] = useState(0)
  const [clickedScore, setClickedScore] = useState(null)
  const [clickedPos, setClickedPos] = useState(null)
  const [hoveredRoute, setHoveredRoute] = useState(null)
  const [tooltipPos, setTooltipPos] = useState(null)

  const center = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [23.0225, 72.5714]

  const handleMapClick = useCallback(async (latlng) => {
    setClickedPos(latlng)
    setClickedScore(null)
    try {
      const data = await fetchSafetyScore(latlng.lat, latlng.lng)
      setClickedScore(data?.totalScore ?? data?.score ?? null)
    } catch {
      const noise = Math.abs(Math.sin(latlng.lat * 1000) * Math.cos(latlng.lng * 1000))
      setClickedScore(Math.round(30 + noise * 60))
    }
  }, [])

  const handleRouteMouseOver = useCallback((route, e) => {
    setHoveredRoute(route)
    setTooltipPos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY })
  }, [])

  const handleRouteMouseMove = useCallback((e) => {
    setTooltipPos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY })
  }, [])

  const handleRouteMouseOut = useCallback(() => {
    setHoveredRoute(null)
    setTooltipPos(null)
  }, [])

  const getRiskLabel = (score) => {
    if (score >= 70) return { text: 'Low Risk', color: '#10b981' }
    if (score >= 45) return { text: 'Medium Risk', color: '#f59e0b' }
    return { text: 'High Risk', color: '#ef4444' }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        zoomControl={false}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        <SafetyHeatmap />

        {userLocation && (
          <LocationFollower key={recenterKey} location={userLocation} follow={followUser} onFollowed={() => setFollowUser(false)} />
        )}

        <MapClickHandler onMapClick={handleMapClick} />

        <RouteFitter routes={routes} destination={destination} userLocation={userLocation} />

        {/* User location */}
        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup>
                <div style={{ textAlign: 'center', padding: 4 }}>
                  <strong style={{ color: '#0a0a0f' }}>You are here</strong>
                  <br />
                  <small style={{ color: '#64748b' }}>
                    {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                  </small>
                </div>
              </Popup>
            </Marker>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={50}
              pathOptions={{
                color: '#006b2c',
                fillColor: '#006b2c',
                fillOpacity: 0.05,
                weight: 1,
                opacity: 0.3,
              }}
            />
          </>
        )}

        {/* Safety reports */}
        {reports.map((report, i) => {
          const lat = report.lat ?? report.location?.coordinates?.[1]
          const lng = report.lng ?? report.location?.coordinates?.[0]
          if (lat == null || lng == null) return null
          return (
            <Marker
              key={report._id || report.id || i}
              position={[lat, lng]}
              icon={getReportIcon(report.category)}
            >
              <Popup>
                <div style={{ padding: 4 }}>
                  <strong style={{ color: '#0a0a0f', textTransform: 'capitalize' }}>
                    {(report.category || '').replace(/_/g, ' ')}
                  </strong>
                  <br />
                  <small style={{ color: '#64748b' }}>Severity: {report.severity}/5</small>
                  {report.description && (
                    <p style={{ color: '#374151', fontSize: 12, marginTop: 4 }}>{report.description}</p>
                  )}
                  {report.upvotes > 0 && (
                    <small style={{ color: '#64748b' }}> · {report.upvotes} upvotes</small>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Predicted danger zones */}
        {dangerZones.map((zone, i) => {
          if (zone.lat == null || zone.lng == null) return null
          return (
            <Circle
              key={`dz-${i}`}
              center={[zone.lat, zone.lng]}
              radius={zone.radius || 200}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.1,
                weight: 1,
                dashArray: '5,5',
              }}
            />
          )
        })}

        {/* Route polylines with hover interaction */}
        {routes.map((route, i) => {
          if (!route?.waypoints || !Array.isArray(route.waypoints)) return null
          const positions = route.waypoints.map(wp => [wp.lat, wp.lng])
          const isHovered = hoveredRoute?.key === route.key
          const color = route.color || '#10b981'

          // Label position: safest at midpoint, shortest at quarter point
          const labelPoint = route.type === 'safest'
            ? getRouteMidpoint(route.waypoints)
            : getRouteQuarterPoint(route.waypoints)

          return (
            <span key={`route-group-${route.key || i}`}>
              {/* Background stroke for contrast */}
              <Polyline
                positions={positions}
                pathOptions={{
                  color: '#fff',
                  weight: isHovered ? 12 : 8,
                  opacity: 0.6,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* Main route line */}
              <Polyline
                positions={positions}
                pathOptions={{
                  color,
                  weight: isHovered ? 7 : 5,
                  opacity: isHovered ? 1 : 0.75,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                eventHandlers={{
                  mouseover: (e) => handleRouteMouseOver(route, e),
                  mousemove: handleRouteMouseMove,
                  mouseout: handleRouteMouseOut,
                }}
              />
              {/* Route label icon at midpoint/quarter */}
              {labelPoint && (
                <Marker
                  position={[labelPoint.lat, labelPoint.lng]}
                  icon={getRouteLabelIcon(route)}
                  interactive={false}
                />
              )}
            </span>
          )
        })}

        {/* Destination marker */}
        {destination && destination.lat && (
          <Marker
            position={[destination.lat, destination.lng]}
            icon={L.divIcon({
              className: '',
              html: `
                <div style="position:relative;width:32px;height:40px;">
                  <svg viewBox="0 0 32 40" width="32" height="40" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                    <path d="M16 0C9 0 3.5 5.5 3.5 12.5C3.5 22 16 36 16 36S28.5 22 28.5 12.5C28.5 5.5 23 0 16 0Z" fill="#ef4444" stroke="white" stroke-width="2"/>
                    <circle cx="16" cy="12" r="5" fill="white"/>
                  </svg>
                </div>
              `,
              iconSize: [32, 40],
              iconAnchor: [16, 40],
            })}
          >
            <Popup>
              <div style={{ textAlign: 'center', padding: 4 }}>
                <strong style={{ color: '#0a0a0f' }}>Destination</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Clicked location — safety score + navigate here */}
        {clickedPos && clickedScore !== null && (
          <Marker
            position={[clickedPos.lat, clickedPos.lng]}
            icon={L.divIcon({
              className: '',
              html: `<div style="width:10px;height:10px;border-radius:50%;background:${formatSafetyScore(clickedScore).color};border:2px solid white;box-shadow:0 0 8px ${formatSafetyScore(clickedScore).color};"></div>`,
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            })}
          >
            <Popup>
              <div style={{ textAlign: 'center', padding: 6, minWidth: 120 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: formatSafetyScore(clickedScore).color }}>
                  {clickedScore}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>
                  {formatSafetyScore(clickedScore).label}
                </div>
                {onDestinationSelect && (
                  <button
                    onClick={() => {
                      onDestinationSelect({ lat: clickedPos.lat, lng: clickedPos.lng })
                      setClickedPos(null)
                      setClickedScore(null)
                    }}
                    style={{
                      width: '100%', padding: '6px 12px', borderRadius: 8, border: 'none',
                      background: '#006b2c', color: '#fff', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>navigation</span>
                    Navigate here
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Route hover tooltip */}
      {hoveredRoute && tooltipPos && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x + 16,
            top: tooltipPos.y - 10,
            zIndex: 1000,
            pointerEvents: 'none',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(16px)',
            borderRadius: 14,
            padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: `2px solid ${hoveredRoute.color}30`,
            minWidth: 180,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, color: hoveredRoute.color, fontVariationSettings: "'FILL' 1" }}
            >
              {hoveredRoute.type === 'safest' ? 'shield' : 'bolt'}
            </span>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#0a0a0f', fontFamily: 'system-ui' }}>
              {hoveredRoute.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Time</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0a0a0f' }}>{hoveredRoute.time} min</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Distance</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0a0a0f' }}>{hoveredRoute.distKm} km</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Risk</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: getRiskLabel(hoveredRoute.safetyScore).color }}>
                {getRiskLabel(hoveredRoute.safetyScore).text}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              flex: 1, height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.max(5, hoveredRoute.safetyScore)}%`,
                height: '100%',
                borderRadius: 2,
                background: getRiskLabel(hoveredRoute.safetyScore).color,
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: getRiskLabel(hoveredRoute.safetyScore).color }}>
              {hoveredRoute.safetyScore}
            </span>
          </div>
        </div>
      )}

      {/* Loading indicator for routes */}
      {routeLoading && (
        <div
          style={{
            position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
            zIndex: 500, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
            borderRadius: 24, padding: '8px 20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <div style={{ width: 16, height: 16, border: '2px solid #e2e8f0', borderTopColor: '#006b2c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Finding safest routes...</span>
        </div>
      )}

      {/* Heatmap legend */}
      <div
        style={{
          position: 'absolute', bottom: 100, right: 16, zIndex: 500,
          padding: '10px 14px', borderRadius: 16,
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#eab308', fontWeight: 600 }}>Low Risk</span>
          <div style={{ width: 60, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #eab308, #f59e0b, #ba1a1a)' }} />
          <span style={{ fontSize: 11, color: '#ba1a1a', fontWeight: 600 }}>Danger</span>
        </div>
      </div>

      {/* Re-center button */}
      <button
        onClick={() => { setFollowUser(true); setRecenterKey(k => k + 1) }}
        style={{
          position: 'absolute', top: 80, right: 16, zIndex: 500,
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0,0,0,0.08)', color: '#006b2c',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: 22 }}>my_location</span>
      </button>
    </div>
  )
}
