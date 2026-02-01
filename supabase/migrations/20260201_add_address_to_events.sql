-- Add address column to events table for human-readable location names
-- This column stores addresses like "Volarská 548/26, Praha 4"

ALTER TABLE events ADD COLUMN IF NOT EXISTS address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN events.address IS 'Human-readable location name or address';
