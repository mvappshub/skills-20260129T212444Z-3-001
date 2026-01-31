# Strategie Integrace API

Tento dokument slouží jako technická specifikace pro přechod z Mock Data na reálný Backend (Supabase/PostgreSQL).

## Klient

Pro komunikaci s databází bude použit `supabase-js` klient.

### Inicializace
Vytvořit `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## Databázové Schéma (DRAFT)

Navrhovaná struktura tabulek v PostgreSQL:

### Tabulka: `events`
| Sloupec | Typ | Poznámka |
|---------|-----|----------|
| id | uuid | PK |
| type | text | planting/maintenance |
| status | text | planned/done |
| title | text | |
| start_at | timestamptz | |
| location | geography(Point) | PostGIS point |

### Tabulka: `trees`
| Sloupec | Typ | Poznámka |
|---------|-----|----------|
| id | uuid | PK |
| event_id | uuid | FK -> events.id (nullable) |
| species | text | |
| planted_at | timestamptz | |
| location | geography(Point) | PostGIS point |
| photos | jsonb[] | Array of photo objects |

## API Endpoints (Supabase RPC/Queries)

Místo REST API budeme volat přímo Supabase klienta.

### Načtení eventů v oblasti (Viewport)
```typescript
const { data, error } = await supabase
  .from('events')
  .select('*')
  .gte('lat', bounds.minLat)
  .lte('lat', bounds.maxLat)
  // ... a pro lng
```

### Vytvoření nové akce
```typescript
const { data, error } = await supabase
  .from('events')
  .insert({ title: 'Výsadba', ... })
```

## Migrační Strategie

1. **Setup Supabase**: Založit projekt a tabulky.
2. **Dual-Write**: Dočasně zapisovat do mock state i console.log pro simlaci.
3. **Data Service Layer**: Vytvořit abstrakci `DataService`, která odstíní komponenty od toho, zda data tečou z mocku nebo z API.
4. **Switch**: Přepnout implementaci `DataService` na Supabase.
