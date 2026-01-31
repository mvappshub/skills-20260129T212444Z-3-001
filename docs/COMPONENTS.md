# Dokumentace Komponent

Přehled hlavních UI komponent ve složce `src/components/`.

## 1. DayDetailPanel
Zobrazuje detailní informace pro konkrétní vybraný den. Je rozdělen do tří logických vrstev.

### Umístění
`src/components/DayDetailPanel.tsx`

### Props
| Prop | Typ | Popis |
|------|-----|-------|
| `date` | Date | Vybraný den k zobrazení |
| `events` | CalendarEvent[] | Seznam plánovaných akcí pro tento den |
| `trees` | TreeRecord[] | Seznam realizovaných výsadeb (důkazy) |
| `alerts` | MeteoAlert[] | Platné výstrahy pro daný den |
| `onFocusMap` | (lat, lng) => void | Callback pro vycentrování mapy na bod |
| `onPlanClick` | () => void | Callback pro otevření modalu plánování |

## 2. MapCanvas
Vlastní implementace mapového podkladu pro MVP. Místo mapových dlaždic používá abstraktní grid a přepočítává GPS souřadnice na procentuální pozici v kontejneru.

### Umístění
`src/components/MapCanvas.tsx`

### Props
| Prop | Typ | Popis |
|------|-----|-------|
| `events` | CalendarEvent[] | Akce k zobrazení (piny) |
| `trees` | TreeRecord[] | Stromy k zobrazení (piny) |
| `isPickingLocation` | boolean | Režim výběru souřadnic kliknutím |
| `onEventClick` | (id) => void | Kliknutí na pin události |
| `onTreeClick` | (id) => void | Kliknutí na pin stromu |
| `onMapClick` | (lat, lng) => void | Kliknutí do plochy mapy (pro výběr místa) |

## 3. PlanModal
Formulářové okno pro vytvoření nové plánované události. Podporuje dva režimy: Výsadba a Údržba.

### Umístění
`src/components/PlanModal.tsx`

### Props
| Prop | Typ | Popis |
|------|-----|-------|
| `isOpen` | boolean | Viditelnost modalu |
| `initialDate` | Date | Předvyplněné datum (z kontextu výběru) |
| `pickedLocation` | {lat, lng}? | Souřadnice vybrané z mapy |
| `onClose` | () => void | Zavření okna |
| `onSave` | (event) => void | Uložení nové akce |
| `onPickLocation` | () => void | Přepnutí do režimu výběru na mapě |
