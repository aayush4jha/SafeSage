import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { fetchSafetyZones } from '../services/api'

/**
 * Renders circular safety zones on the map from real DB data.
 * Each circle = one grid cell from the dynamic safety grid.
 * Color is based on unique user report count:
 *   Red (5+ users), Orange (3-4 users), Yellow (1-2 users)
 * No green/safe zones are shown — any report means some level of risk.
 */
export default function SafetyHeatmap() {
  const map = useMap()
  const circlesRef = useRef([])
  const [zones, setZones] = useState([])

  // Fetch safety grid zones from backend
  useEffect(() => {
    async function loadZones() {
      try {
        const bounds = map.getBounds()
        const expanded = bounds.pad(0.5)
        const data = await fetchSafetyZones({
          min_lng: expanded.getWest(),
          min_lat: expanded.getSouth(),
          max_lng: expanded.getEast(),
          max_lat: expanded.getNorth(),
        })
        if (data && data.features) {
          setZones(data.features)
        } else {
          setZones([])
        }
      } catch {
        setZones([])
      }
    }

    loadZones()
    map.on('moveend', loadZones)
    return () => map.off('moveend', loadZones)
  }, [map])

  // Draw circles for each zone cell
  useEffect(() => {
    // Clear old circles
    circlesRef.current.forEach(c => {
      try { map.removeLayer(c) } catch {}
    })
    circlesRef.current = []

    if (!zones.length) return

    const circles = zones.map(feature => {
      const props = feature.properties
      const coords = feature.geometry.coordinates[0]
      // Center of the grid cell polygon
      const centerLng = (coords[0][0] + coords[2][0]) / 2
      const centerLat = (coords[0][1] + coords[2][1]) / 2

      const riskLevel = props.risk_level
      const uniqueUsers = props.unique_users || 1

      // Color based on risk level — no green zones, even 1 report = mild risk
      let color, fillOpacity, strokeOpacity
      if (riskLevel === 10) {
        color = '#ef4444'
        fillOpacity = 0.15 + Math.min(0.15, uniqueUsers * 0.02)
        strokeOpacity = 0.7
      } else if (riskLevel === 5) {
        color = '#f59e0b'
        fillOpacity = 0.10 + Math.min(0.10, uniqueUsers * 0.02)
        strokeOpacity = 0.5
      } else {
        color = '#eab308'
        fillOpacity = 0.08 + Math.min(0.08, uniqueUsers * 0.02)
        strokeOpacity = 0.4
      }

      // Radius scales with report density — base 200m, max ~450m
      const baseRadius = 200
      const radius = baseRadius + Math.min(250, (props.report_count || 1) * 20)

      const circle = L.circle([centerLat, centerLng], {
        radius,
        color,
        fillColor: color,
        fillOpacity,
        weight: 2,
        opacity: strokeOpacity,
        dashArray: riskLevel === 10 ? '6 4' : undefined,
      })

      // Popup with zone info
      const label = riskLevel === 10 ? 'Danger Zone' : riskLevel === 5 ? 'Caution Zone' : 'Low Risk Zone'
      circle.bindPopup(`
        <div style="padding:6px;text-align:center;min-width:150px;">
          <strong style="color:${color};font-size:13px;">${label}</strong>
          <div style="margin:4px 0;font-size:11px;color:#374151;">
            <b>${uniqueUsers}</b> user${uniqueUsers !== 1 ? 's' : ''} reported &middot; <b>${props.report_count}</b> report${props.report_count !== 1 ? 's' : ''}
          </div>
          ${props.description ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">${props.description}</div>` : ''}
        </div>
      `)

      circle.addTo(map)
      return circle
    })

    circlesRef.current = circles

    return () => {
      circlesRef.current.forEach(c => {
        try { map.removeLayer(c) } catch {}
      })
    }
  }, [zones, map])

  return null
}
