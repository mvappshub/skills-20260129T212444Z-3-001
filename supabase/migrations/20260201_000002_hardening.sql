-- Performance + integrity hardening for planning pipeline

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.trees
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_events_updated_at'
  ) THEN
    CREATE TRIGGER trg_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_trees_updated_at'
  ) THEN
    CREATE TRIGGER trg_trees_updated_at
    BEFORE UPDATE ON public.trees
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Indexes for calendar + FK lookups
CREATE INDEX IF NOT EXISTS events_start_at_idx ON public.events (start_at);
CREATE INDEX IF NOT EXISTS event_items_event_id_idx ON public.event_items (event_id);
CREATE INDEX IF NOT EXISTS trees_event_id_idx ON public.trees (event_id);
CREATE INDEX IF NOT EXISTS tree_photos_tree_id_idx ON public.tree_photos (tree_id);

-- Enforce required FK relations
ALTER TABLE public.event_items
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE public.tree_photos
  ALTER COLUMN tree_id SET NOT NULL;

-- Quantity must be positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_items_quantity_check'
  ) THEN
    ALTER TABLE public.event_items
      ADD CONSTRAINT event_items_quantity_check CHECK (quantity > 0);
  END IF;
END $$;
