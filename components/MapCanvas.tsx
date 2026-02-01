import React, { useRef, useEffect, useState, useMemo } from 'react'
import Map, { MapRef, Marker, Popup, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre'
import { Navigation, X } from 'lucide-react'
import { CalendarEvent, TreeRecord } from '../types'
import 'maplibre-gl/dist/maplibre-gl.css'

interface MapCanvasProps {
  events: CalendarEvent[]
  trees: TreeRecord[]
  centerLat?: number
  centerLng?: number
  onEventClick: (id: string) => void
  onTreeClick: (id: string) => void
  onMapClick?: (lat: number, lng: number) => void
  isPickingLocation?: boolean
  className?: string
  tempPinLocation?: { lat: number; lng: number } | null
  focusLocation?: { lat: number; lng: number; zoom?: number } | null
  onBoundsReady?: (bounds: any) => void
  onCancelPick?: () => void
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  events,
  trees,
  centerLat = 50.08,
  centerLng = 14.43,
  onEventClick,
  onTreeClick,
  onMapClick,
  isPickingLocation = false,
  className,
  tempPinLocation,
  focusLocation,
  onBoundsReady,
  onCancelPick,
}) => {
  const mapRef = useRef<MapRef>(null)
  const [viewState, setViewState] = useState({
    longitude: centerLng,
    latitude: centerLat,
    zoom: 7,
  })
  const [popupEventId, setPopupEventId] = useState<string | null>(null)

  // Handle focus location changes
  useEffect(() => {
    if (focusLocation) {
      setViewState({
        longitude: focusLocation.lng,
        latitude: focusLocation.lat,
        zoom: focusLocation.zoom || 14,
      })
    }
  }, [focusLocation])

  // Fit bounds when data changes
  useEffect(() => {
    if (mapRef.current && (events.length > 0 || trees.length > 0)) {
      const allPoints: [number, number][] = [
        ...events.map(e => [e.lng, e.lat] as [number, number]),
        ...trees.map(t => [t.lng, t.lat] as [number, number]),
      ]

      if (allPoints.length > 0) {
        const lngs = allPoints.map(p => p[0])
        const lats = allPoints.map(p => p[1])
        mapRef.current.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 100, maxZoom: 12 }
        )
      }
    }
  }, [events, trees])

  const handleClick = (e: any) => {
    if (isPickingLocation && onMapClick) {
      onMapClick(e.lngLat.lat, e.lngLat.lng)
    }
  }

  // Combine markers (kept for potential clustering use)
  useMemo(() => {
    return [
      ...events.map(e => ({ id: e.id, lng: e.lng, lat: e.lat })),
      ...trees.map(t => ({ id: t.id, lng: t.lng, lat: t.lat })),
    ]
  }, [events, trees])

  return (
    <div className={`relative ${className || ''} ${isPickingLocation ? 'cursor-crosshair' : ''}`}>
      <Map
        ref={mapRef as React.RefObject<any>}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        onClick={handleClick}
        attributionControl={false}
      >
        {/* Controls */}
        <NavigationControl position="top-right" />
        <FullscreenControl position="top-right" />

        {/* Event markers */}
        {events.map((event) => (
          <Marker
            key={event.id}
            longitude={event.lng}
            latitude={event.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              setPopupEventId(event.id)
              onEventClick(event.id)
            }}
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                <span className="text-white text-xs">P</span>
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-2 bg-blue-600 rotate-45" />
            </div>
          </Marker>
        ))}

        {/* Event popup with address */}
        {popupEventId && (() => {
          const ev = events.find(e => e.id === popupEventId)
          if (!ev) return null
          return (
            <Popup
              anchor="top"
              longitude={ev.lng}
              latitude={ev.lat}
              onClose={() => setPopupEventId(null)}
              closeButton={true}
              closeOnClick={false}
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold">{ev.title}</p>
                {ev.address ? (
                  <p className="text-xs text-slate-600">{ev.address}</p>
                ) : (
                  <p className="text-xs text-slate-500">{ev.lat.toFixed(5)}, {ev.lng.toFixed(5)}</p>
                )}
                <p className="text-xs text-slate-500">
                  {new Date(ev.start_at).toLocaleString('cs-CZ')}
                </p>
              </div>
            </Popup>
          )
        })()}

        {/* Tree markers */}
        {trees.map((tree) => (
          <Marker
            key={tree.id}
            longitude={tree.lng}
            latitude={tree.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onTreeClick(tree.id)
            }}
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                <span className="text-white text-xs">S</span>
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-2 bg-emerald-600 rotate-45" />
            </div>
          </Marker>
        ))}

        {/* Temp pin */}
        {tempPinLocation && (
          <Marker
            longitude={tempPinLocation.lng}
            latitude={tempPinLocation.lat}
            anchor="bottom"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-red-500 border-3 border-white shadow-xl flex items-center justify-center animate-pulse">
                <span className="text-white text-lg">+</span>
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-3 h-3 bg-red-600 rotate-45" />
            </div>
          </Marker>
        )}
      </Map>

      {/* Custom UI overlay */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg p-3 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Plánované akce ({events.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Vysazené stromy ({trees.length})</span>
        </div>
      </div>

      {/* Picking mode indicator */}
      {isPickingLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Navigation size={16} />
          <span className="font-medium">Kliknìte na mapu pro výbìr místa</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCancelPick?.()
            }}
            className="ml-2 p-1 hover:bg-blue-700 rounded"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
