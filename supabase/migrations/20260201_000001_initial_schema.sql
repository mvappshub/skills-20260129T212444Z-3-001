-- Initial schema for SilvaPlan
-- Creates core tables, PostGIS support, and basic RLS policies

-- Enable PostGIS for spatial queries and indexes
CREATE EXTENSION IF NOT EXISTS postgis;

-- Timestamp trigger helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Events (plans)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('planting', 'maintenance', 'other')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'canceled')),
  title TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT, -- human-readable location
  radius_m INTEGER,
  notes TEXT,
  geom geography(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep geom in sync with lat/lng
CREATE OR REPLACE FUNCTION events_sync_geom()
RETURNS trigger AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_events_geom
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION events_sync_geom();

CREATE TRIGGER trg_events_updated
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS events_geom_idx ON events USING GIST (geom);
CREATE INDEX IF NOT EXISTS events_start_idx ON events (start_at);

-- Event items (what will be planted)
CREATE TABLE IF NOT EXISTS event_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  species_name_latin TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  size_class TEXT
);

-- Trees (realized plantings)
CREATE TABLE IF NOT EXISTS trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  species_name_latin TEXT NOT NULL,
  planted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  notes TEXT,
  geom geography(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION trees_sync_geom()
RETURNS trigger AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trees_geom
BEFORE INSERT OR UPDATE ON trees
FOR EACH ROW EXECUTE FUNCTION trees_sync_geom();

CREATE TRIGGER trg_trees_updated
BEFORE UPDATE ON trees
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS trees_geom_idx ON trees USING GIST (geom);
CREATE INDEX IF NOT EXISTS trees_planted_idx ON trees (planted_at DESC);

-- Tree photos
CREATE TABLE IF NOT EXISTS tree_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID REFERENCES trees(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  caption TEXT
);

-- Meteo alerts
CREATE TABLE IF NOT EXISTS meteo_alerts (
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

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tree_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE meteo_alerts ENABLE ROW LEVEL SECURITY;

-- Public read/write (MVP, no auth)
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public insert events" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update events" ON events FOR UPDATE USING (true);

CREATE POLICY "Public read event_items" ON event_items FOR SELECT USING (true);
CREATE POLICY "Public insert event_items" ON event_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read trees" ON trees FOR SELECT USING (true);
CREATE POLICY "Public insert trees" ON trees FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update trees" ON trees FOR UPDATE USING (true);

CREATE POLICY "Public read tree_photos" ON tree_photos FOR SELECT USING (true);
CREATE POLICY "Public insert tree_photos" ON tree_photos FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read meteo_alerts" ON meteo_alerts FOR SELECT USING (true);

COMMENT ON COLUMN events.address IS 'Human-readable location name or address';
