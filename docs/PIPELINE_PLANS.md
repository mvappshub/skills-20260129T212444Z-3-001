# Pipeline: plán výsadby (kalendář + mapa)

Tento dokument popisuje end‑to‑end tok vytvoření plánu výsadby v aplikaci SilvaPlan
a vazbu mezi kalendářem, seznamem plánovaných akcí a mapou.

## 1) Datový model (MVP)

### events (plánovaná akce)
- `id` UUID PK
- `type` (planting/maintenance/other)
- `status` (planned/done/canceled)
- `title`
- `start_at`, `end_at`
- `lat`, `lng`
- `address` (text)
- `radius_m`, `notes`
- `created_at`, `updated_at`

### event_items (co se bude sázet)
- `event_id` -> `events.id` (FK, ON DELETE CASCADE)
- `species_name_latin`, `quantity`, `size_class`

### trees (realizace)
- `event_id` -> `events.id` (FK, ON DELETE SET NULL)
- `species_name_latin`, `planted_at`, `lat`, `lng`, `notes`

### tree_photos (důkaz)
- `tree_id` -> `trees.id` (FK, ON DELETE CASCADE)
- `url`, `taken_at`, `caption`

### meteo_alerts (kontext)
- `type`, `level`, `valid_from`, `valid_to`, `affected_lat/lng`

## 2) Vytvoření plánu (UI -> DB)

1) Uživatel otevře modál „Nová akce“ (`components/PlanModal.tsx`).
2) Vyplní:
   - název,
   - datum/čas,
   - typ (výsadba/údržba),
   - zvolí místo na mapě nebo GPS.
   - **Adresa se doplní automaticky** (reverse‑geocoding).
3) `PlanModal` sestaví `CalendarEvent` a zavolá `onSave`.
4) `App.tsx` -> `createEvent` (`services/eventService.ts`) uloží:
   - záznam do `events` (včetně `address`, `lat`, `lng`, `start_at`),
   - položky do `event_items`.

## 3) Zobrazení v kalendáři

- `fetchEvents()` načte `events` + `event_items`.
- Kalendář v `App.tsx` označí dny s plánem podle `start_at`.
- Klik na den otevře detail dne (`DayDetailPanel`).

## 4) Zobrazení na mapě + adresa

- `MapCanvas` vykreslí pin pro každý `events` záznam.
- Po kliknutí na pin se otevře popup s:
  - `title`
  - `address` (automaticky doplněná)
  - fallback: souřadnice
  - datum/čas

## 5) Propojení seznam ↔ mapa

### A) Klik v seznamu plánovaných akcí
- `HistorySidebar` volá `onItemFocus` -> `App.handleMapFocus(lat,lng,zoom)`
- Aplikace přepne na mapu a vycentruje na akci.

### B) Klik na pin v mapě
- `MapCanvas` volá `onEventClick` -> `App` nastaví `selectedEventId`
- Pravý panel zobrazí detail akce (adresu, poznámky, položky).

## 6) Výsledná realizace (volitelně)

- Po skutečné výsadbě vzniká `trees` záznam (může odkazovat na `event_id`)
- K němu lze připojit `tree_photos`.
- Mapa pak zobrazuje plány i realizace odlišnou ikonou.

## 7) Očekávaný uživatelský výsledek

- Nový plán se objeví **v kalendáři** i **na mapě**.
- Klik na mapový pin ukáže **adresu místa výsadby**.
- Klik na položku v seznamu plánovaných akcí **přepne mapu na lokaci**.
