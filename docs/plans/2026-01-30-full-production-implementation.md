# SilvaPlan - Full Production Implementation Plan

> **For Agent:** REQUIRED SUB-SKILL: Use executing-plans skill to implement this plan task-by-task.

**Goal:** Replace all mock data and simulated features with real, working implementations (Supabase database, Leaflet map, GPS geolocation, camera/photo upload).

**Architecture:** Client-side React app communicating with Supabase (PostgreSQL + Auth + Storage). Real map via react-leaflet. Browser APIs for geolocation and camera capture.

**Tech Stack:** React 19, Vite, Supabase (database + storage), react-leaflet, TypeScript

---

## User Review Required

> [!IMPORTANT]
> **Before starting implementation, please confirm:**
> 1. Do you have a Supabase account? If not, create one at https://supabase.com
> 2. Should I create a new Supabase project for you, or do you have an existing one?
> 3. For maps, Leaflet is free and open-source. Is this acceptable, or do you prefer Mapbox (requires API key)?

---

## Sprint 1: Backend Setup (Supabase)

### Task 1.1: Install Supabase Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

```bash
npm install @supabase/supabase-js
```

**Step 2: Verify installation**

Run: `npm ls @supabase/supabase-js`
Expected: Shows installed version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add supabase-js dependency"
```

---

### Task 1.2: Create Supabase Client

**Files:**
- Create: `src/lib/supabase.ts`
- Modify: `.env.local`

**Step 1: Update environment variables**

```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Step 2: Create Supabase client**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Step 3: Verify import works**

Add temporary test in `App.tsx`:
```typescript
import { supabase } from './lib/supabase'
console.log('Supabase client:', supabase)
```

Run: `npm run dev`
Expected: Console shows Supabase client object, no errors

**Step 4: Commit**

```bash
git add src/lib/supabase.ts .env.local
git commit -m "feat: add supabase client configuration"
```

---

### Task 1.3: Create Database Schema (Supabase Dashboard)

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql` (for reference)

**Step 1: Run this SQL in Supabase SQL Editor**

```sql
-- Enable PostGIS extension for geography
CREATE EXTENSION IF NOT EXISTS postgis;

-- Events table (planned actions)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('planting', 'maintenance', 'other')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'canceled')),
  title TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_m INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event items (what will be planted)
CREATE TABLE event_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  species_name_latin TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  size_class TEXT
);

-- Trees table (realized plantings)
CREATE TABLE trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  species_name_latin TEXT NOT NULL,
  planted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tree photos
CREATE TABLE tree_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID REFERENCES trees(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  caption TEXT
);

-- Meteo alerts
CREATE TABLE meteo_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('drought', 'storm', 'heat', 'frost')),
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'danger')),
  title TEXT NOT NULL,
  description TEXT,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL,
  affected_lat DOUBLE PRECISION NOT NULL,
  affected_lng DOUBLE PRECISION NOT NULL
);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tree_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE meteo_alerts ENABLE ROW LEVEL SECURITY;

-- Public read policies (for MVP without auth)
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public insert events" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update events" ON events FOR UPDATE USING (true);

CREATE POLICY "Public read event_items" ON event_items FOR SELECT USING (true);
CREATE POLICY "Public insert event_items" ON event_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read trees" ON trees FOR SELECT USING (true);
CREATE POLICY "Public insert trees" ON trees FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read tree_photos" ON tree_photos FOR SELECT USING (true);
CREATE POLICY "Public insert tree_photos" ON tree_photos FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read meteo_alerts" ON meteo_alerts FOR SELECT USING (true);
```

**Step 2: Verify tables created**

Go to Supabase Dashboard → Table Editor → Verify all 5 tables exist

**Step 3: Insert test data**

```sql
INSERT INTO events (type, status, title, start_at, lat, lng) VALUES
  ('planting', 'planned', 'Test výsadba', NOW() + INTERVAL '7 days', 50.08, 14.43);
```

---

### Task 1.4: Create Data Service Layer

**Files:**
- Create: `src/services/eventService.ts`
- Create: `src/services/treeService.ts`

**Step 1: Create event service**

```typescript
// src/services/eventService.ts
import { supabase } from '../lib/supabase'
import { CalendarEvent, EventItem, EventType, EventStatus } from '../types'

export async function fetchEvents(): Promise<CalendarEvent[]> {
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      *,
      items:event_items(*)
    `)
    .order('start_at', { ascending: true })

  if (error) throw error

  return events.map(e => ({
    id: e.id,
    type: e.type as EventType,
    status: e.status as EventStatus,
    title: e.title,
    start_at: new Date(e.start_at),
    end_at: e.end_at ? new Date(e.end_at) : undefined,
    lat: e.lat,
    lng: e.lng,
    radius_m: e.radius_m,
    notes: e.notes,
    items: e.items || []
  }))
}

export async function createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
  const { items, ...eventData } = event

  const { data: newEvent, error: eventError } = await supabase
    .from('events')
    .insert({
      type: eventData.type,
      status: eventData.status,
      title: eventData.title,
      start_at: eventData.start_at.toISOString(),
      lat: eventData.lat,
      lng: eventData.lng,
      notes: eventData.notes
    })
    .select()
    .single()

  if (eventError) throw eventError

  // Insert items
  if (items && items.length > 0) {
    const { error: itemsError } = await supabase
      .from('event_items')
      .insert(items.map(item => ({
        event_id: newEvent.id,
        species_name_latin: item.species_name_latin,
        quantity: item.quantity,
        size_class: item.size_class
      })))

    if (itemsError) throw itemsError
  }

  return { ...event, id: newEvent.id }
}
```

**Step 2: Create tree service**

```typescript
// src/services/treeService.ts
import { supabase } from '../lib/supabase'
import { TreeRecord, TreePhoto } from '../types'

export async function fetchTrees(): Promise<TreeRecord[]> {
  const { data, error } = await supabase
    .from('trees')
    .select(`
      *,
      photos:tree_photos(*)
    `)
    .order('planted_at', { ascending: false })

  if (error) throw error

  return data.map(t => ({
    id: t.id,
    event_id: t.event_id,
    species_name_latin: t.species_name_latin,
    planted_at: new Date(t.planted_at),
    lat: t.lat,
    lng: t.lng,
    notes: t.notes,
    photos: t.photos || []
  }))
}

export async function createTree(tree: Omit<TreeRecord, 'id' | 'photos'>): Promise<TreeRecord> {
  const { data, error } = await supabase
    .from('trees')
    .insert({
      event_id: tree.event_id,
      species_name_latin: tree.species_name_latin,
      planted_at: tree.planted_at.toISOString(),
      lat: tree.lat,
      lng: tree.lng,
      notes: tree.notes
    })
    .select()
    .single()

  if (error) throw error

  return { ...tree, id: data.id, photos: [] }
}
```

**Step 3: Commit**

```bash
git add src/services/
git commit -m "feat: add data service layer for Supabase"
```

---

### Task 1.5: Replace Mock Data in App

**Files:**
- Modify: `App.tsx`

**Step 1: Replace mock imports with service calls**

```typescript
// App.tsx - Replace these lines:
// import { MOCK_EVENTS, MOCK_TREES, MOCK_ALERTS } from './mockData';

// With:
import { fetchEvents, createEvent } from './services/eventService'
import { fetchTrees } from './services/treeService'
import { useEffect } from 'react'

// Inside App component, replace useState initializers:
const [events, setEvents] = useState<CalendarEvent[]>([])
const [trees, setTrees] = useState<TreeRecord[]>([])
const [isLoading, setIsLoading] = useState(true)
const [error, setError] = useState<Error | null>(null)

// Add useEffect for data loading:
useEffect(() => {
  async function loadData() {
    try {
      setIsLoading(true)
      const [eventsData, treesData] = await Promise.all([
        fetchEvents(),
        fetchTrees()
      ])
      setEvents(eventsData)
      setTrees(treesData)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }
  loadData()
}, [])

// Update handleSaveEvent to use service:
const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
  try {
    const newEvent = await createEvent({
      title: eventData.title || 'Nová akce',
      type: eventData.type || EventType.OTHER,
      status: eventData.status!,
      start_at: eventData.start_at!,
      lat: eventData.lat!,
      lng: eventData.lng!,
      items: eventData.items || [],
      notes: eventData.notes
    })
    setEvents(prev => [...prev, newEvent])
    setIsModalOpen(false)
    // ... rest of handler
  } catch (err) {
    console.error('Failed to create event:', err)
  }
}
```

**Step 2: Verify app loads real data**

Run: `npm run dev`  
Expected: App shows events from Supabase (or empty if no data)

**Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat: replace mock data with Supabase API calls"
```

---

## Sprint 2: Real Map Integration (Leaflet)

### Task 2.1: Install Leaflet Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

```bash
npm install leaflet react-leaflet @types/leaflet
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add leaflet dependencies"
```

---

### Task 2.2: Replace MapCanvas with Real Leaflet Map

**Files:**
- Modify: `components/MapCanvas.tsx`
- Modify: `index.html`

**Step 1: Add Leaflet CSS to index.html**

```html
<!-- Add to <head> in index.html -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

**Step 2: Rewrite MapCanvas with react-leaflet**

```typescript
// components/MapCanvas.tsx
import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { CalendarEvent, TreeRecord } from '../types'

// Fix default marker icon issue
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Custom icons
const eventIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const treeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

interface MapCanvasProps {
  events: CalendarEvent[]
  trees: TreeRecord[]
  onEventClick: (id: string) => void
  onTreeClick: (id: string) => void
  onMapClick?: (lat: number, lng: number) => void
  isPickingLocation?: boolean
  className?: string
  tempPinLocation?: { lat: number; lng: number } | null
}

function ClickHandler({ onClick, isActive }: { onClick?: (lat: number, lng: number) => void; isActive: boolean }) {
  useMapEvents({
    click: (e) => {
      if (isActive && onClick) {
        onClick(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  events,
  trees,
  onEventClick,
  onTreeClick,
  onMapClick,
  isPickingLocation = false,
  className,
  tempPinLocation,
}) => {
  const defaultCenter: [number, number] = [50.08, 14.43] // Prague

  return (
    <div className={`relative ${className} ${isPickingLocation ? 'cursor-crosshair' : ''}`}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <ClickHandler onClick={onMapClick} isActive={isPickingLocation} />

        {/* Event markers */}
        {events.map((event) => (
          <Marker
            key={event.id}
            position={[event.lat, event.lng]}
            icon={eventIcon}
            eventHandlers={{ click: () => onEventClick(event.id) }}
          >
            <Popup>
              <strong>{event.title}</strong>
              <br />
              {event.type}
            </Popup>
          </Marker>
        ))}

        {/* Tree markers */}
        {trees.map((tree) => (
          <Marker
            key={tree.id}
            position={[tree.lat, tree.lng]}
            icon={treeIcon}
            eventHandlers={{ click: () => onTreeClick(tree.id) }}
          >
            <Popup>
              <em>{tree.species_name_latin}</em>
            </Popup>
          </Marker>
        ))}

        {/* Temp pin for picking */}
        {tempPinLocation && (
          <Marker position={[tempPinLocation.lat, tempPinLocation.lng]}>
            <Popup>Nové místo</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
```

**Step 3: Verify map shows OpenStreetMap tiles**

Run: `npm run dev`  
Expected: Real map with street tiles visible, markers on events/trees

**Step 4: Commit**

```bash
git add components/MapCanvas.tsx index.html
git commit -m "feat: replace mock map with real Leaflet map"
```

---

## Sprint 3: GPS Geolocation

### Task 3.1: Create Geolocation Hook

**Files:**
- Create: `src/hooks/useGeolocation.ts`

**Step 1: Create custom hook**

```typescript
// src/hooks/useGeolocation.ts
import { useState, useCallback } from 'react'

interface GeolocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  loading: boolean
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
  })

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: 'Geolokace není podporována' }))
      return
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          loading: false,
        })
      },
      (error) => {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error.message,
        }))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }, [])

  return { ...state, getCurrentPosition }
}
```

**Step 2: Add "Use My Location" button to PlanModal**

Modify `components/PlanModal.tsx`:

```typescript
import { useGeolocation } from '../hooks/useGeolocation'

// Inside component:
const { latitude, longitude, loading: geoLoading, getCurrentPosition, error: geoError } = useGeolocation()

// Add useEffect to update pickedLocation when GPS returns
useEffect(() => {
  if (latitude && longitude) {
    // Parent should handle this via callback
  }
}, [latitude, longitude])

// Add button next to "Vybrat na mapě":
<button
  type="button"
  onClick={getCurrentPosition}
  disabled={geoLoading}
  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-md text-sm"
>
  {geoLoading ? 'Načítám...' : '📍 Moje poloha'}
</button>
```

**Step 3: Verify GPS works**

- Open app on mobile or allow location in browser
- Click "Moje poloha" button
- Expected: Coordinates populate

**Step 4: Commit**

```bash
git add src/hooks/useGeolocation.ts components/PlanModal.tsx
git commit -m "feat: add real GPS geolocation"
```

---

## Sprint 4: Camera & Photo Upload

### Task 4.1: Create Supabase Storage Bucket

**Step 1: In Supabase Dashboard → Storage → Create bucket**

- Name: `tree-photos`
- Public: Yes

**Step 2: Add storage policy**

```sql
-- In SQL Editor
CREATE POLICY "Public upload tree photos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'tree-photos');

CREATE POLICY "Public read tree photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tree-photos');
```

---

### Task 4.2: Create Photo Upload Service

**Files:**
- Create: `src/services/storageService.ts`

**Step 1: Create storage service**

```typescript
// src/services/storageService.ts
import { supabase } from '../lib/supabase'

export async function uploadPhoto(file: File, treeId: string): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${treeId}/${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('tree-photos')
    .upload(fileName, file)

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('tree-photos')
    .getPublicUrl(fileName)

  return data.publicUrl
}

export async function savePhotoRecord(treeId: string, url: string, caption?: string) {
  const { error } = await supabase
    .from('tree_photos')
    .insert({
      tree_id: treeId,
      url,
      caption,
      taken_at: new Date().toISOString()
    })

  if (error) throw error
}
```

**Step 2: Commit**

```bash
git add src/services/storageService.ts
git commit -m "feat: add photo upload service"
```

---

### Task 4.3: Create Camera Capture Component

**Files:**
- Create: `src/components/PhotoCapture.tsx`

**Step 1: Create component**

```typescript
// src/components/PhotoCapture.tsx
import React, { useRef } from 'react'
import { Camera } from 'lucide-react'

interface PhotoCaptureProps {
  onCapture: (file: File) => void
  disabled?: boolean
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({ onCapture, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onCapture(file)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
      >
        <Camera size={18} />
        Vyfotit strom
      </button>
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/PhotoCapture.tsx
git commit -m "feat: add camera capture component"
```

---

## Verification Plan

### Manual Verification Checklist

| Feature | Test Steps | Expected Result |
|---------|-----------|-----------------|
| **Database** | 1. Open app 2. Open DevTools → Network | Requests to `supabase.co` visible |
| **Create Event** | 1. Click "+ Nová akce" 2. Fill form 3. Submit | Event appears in calendar AND in Supabase Table Editor |
| **Real Map** | 1. Open app 2. Look at sidebar map | OpenStreetMap tiles visible (streets, buildings) |
| **Map Click** | 1. Click "+ Nová akce" 2. Click "Vybrat na mapě" 3. Click on map | Real coordinates appear in form |
| **GPS** | 1. Open on phone 2. Allow location 3. Click "Moje poloha" | Your real coordinates show |
| **Photo Upload** | 1. Create tree 2. Click "Vyfotit" 3. Take photo | Photo appears in Supabase Storage bucket |

---

## Summary

| Sprint | Est. Time | Deliverable |
|--------|-----------|-------------|
| 1 | ~2 hours | Working Supabase backend |
| 2 | ~1 hour | Real OpenStreetMap |
| 3 | ~30 min | GPS geolocation |
| 4 | ~1 hour | Camera + cloud storage |

**Total:** ~4-5 hours for full production.
