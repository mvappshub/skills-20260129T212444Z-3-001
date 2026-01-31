import React, { useRef, useEffect, useState, useMemo } from 'react'
import Map, { MapRef, Marker, Popup, NavigationControl, FullscreenControl, GeolocateControl } from 'react-map-gl/maplibre'
import { Map as MapIcon, Navigation, Maximize2, X } from 'lucide-react'
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
}

// Custom marker component
function CustomMarker({
  children,
  lng,
  lat,
  onClick,
}: {
  children: React.ReactNode
  lng: number
  lat: number
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  const [popupShown, setPopupShown] = useState(false)

  return (
    <div style={{ position: 'absolute', left: 0, top: 0 }}>
      <div
        onMouseEnter={() => setPopupShown(true)}
        onMouseLeave={() => setPopupShown(false)}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.(e)
        }}
        style={{
          transform: `translate(${lng}px, ${lat}px)`,
          cursor: 'pointer',
        }}
      >
        {children}
        {popupShown && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '8px',
              padding: '8px 12px',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap',
              zIndex: 1000,
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  )
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
}) => {
  const mapRef = useRef<MapRef>(null)
  const [viewState, setViewState] = useState({
    longitude: centerLng,
    latitude: centerLat,
    zoom: 7,
  })

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
      const bounds = {
        lng: [0, 0] as [number, number],
        lat: [0, 0] as [number, number],
      }

      const allPoints = [
        ...events.map(e => [e.lng, e.lat]),
        ...trees.map(t => [t.lng, t.lat]),
      ] as [number, number][]

      if (allPoints.length > 0) {
        bounds.lng = [
          Math.min(...allPoints.map(p => p[0])),
          Math.max(...allPoints.map(p => p[0])),
        ] as [number, number]
        bounds.lat = [
          Math.min(...allPoints.map(p => p[1])),
          Math.max(...allPoints.map(p => p[1])),
        ] as [number, number]

        mapRef.current.fitBounds(
          [
            [bounds.lng[0], bounds.lat[0]],
            [bounds.lng[1], bounds.lat[1]],
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

  // Combine all markers for clustering
  const allMarkers = useMemo(() => {
    const eventMarkers = events.map(e => ({
      type: 'event' as const,
      id: e.id,
      lng: e.lng,
      lat: e.lat,
      title: e.title,
      subtitle: e.type,
      date: new Date(e.start_at).toLocaleDateString('cs-CZ'),
      color: '#3b82f6', // blue
    }))

    const treeMarkers = trees.map(t => ({
      type: 'tree' as const,
      id: t.id,
      lng: t.lng,
      lat: t.lat,
      title: t.species_name_latin,
      subtitle: 'Vysazeno',
      date: new Date(t.planted_at).toLocaleDateString('cs-CZ'),
      color: '#10b981', // green
    }))

    return [...eventMarkers, ...treeMarkers]
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
              onEventClick(event.id)
            }}
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                <span className="text-white text-xs">📋</span>
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-2 bg-blue-600 rotate-45" />
            </div>
          </Marker>
        ))}

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
                <span className="text-white text-xs">🌳</span>
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
                <span className="text-white text-lg">📍</span>
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-3 h-3 bg-red-600 rotate-45" />
            </div>
          </Marker>
        )}

        {/* Popups handled by Marker components */}
        {/* MapLibre GL has built-in popup support, we use Marker with click handlers */}
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
          <span className="font-medium">Klikněte na mapu pro výběr místa</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (onMapClick) onMapClick(0, 0) // Signal cancel
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
