# Architektura SilvaPlan

## Přehled Systému

SilvaPlan je jednoúčelová webová aplikace (SPA) pro správu a plánování komunitní výsadby stromů. Je navržena s důrazem na tři klíčové aspekty:
1. **Čas (Kalendář):** Kdy se co děje (plánování).
2. **Prostor (Mapa):** Kde se to děje (lokalizace).
3. **Důkaz (Foto):** Jak to dopadlo (realizace).

Aplikace funguje plně v prohlížeči (client-side) a momentálně využívá mockovaná data pro demonstraci funkčnosti bez závislosti na backendu.

## Technologický Stack

- **Frontend Framework:** [React 19](https://react.dev/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Jazyk:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (v současnosti přes CDN pro rychlý prototyp)
- **Ikony:** [Lucide React](https://lucide.dev/)
- **Manipulace s časem:** [date-fns](https://date-fns.org/)

## Tok Dat (Data Flow)

Aplikace používá jednosměrný tok dat (uni-directional data flow), typický pro React aplikace.

```mermaid
graph TD
    Store[App State (App.tsx)] -->|Props| Map[MapCanvas]
    Store -->|Props| Detail[DayDetailPanel]
    Store -->|Props| Modal[PlanModal]
    
    Map -->|Callback (onEventClick)| Store
    Map -->|Callback (onMapClick)| Store
    Detail -->|Callback (onFocusMap)| Store
    Detail -->|Callback (onPlanClick)| Store
    Modal -->|Callback (onSave)| Store
```

### Hlavní State (App.tsx)
Hlavní stav aplikace je držen v kořenové komponentě `App.tsx` a zahrnuje:
- `currentMonth`: Aktuálně zobrazený měsíc v kalendáři.
- `selectedDate`: Vybraný den pro detailní pohled.
- `events`: Seznam plánovaných akcí (CalendarEvent[]).
- `isSidebarOpen`: Stav postranního panelu na mobilu.

## Adresářová Struktura

```text
silvaplan/
├── src/
│   ├── components/       # UI Komponenty
│   │   ├── DayDetailPanel.tsx  # Detail dne (pravý panel)
│   │   ├── MapCanvas.tsx       # Vizualizace mapy
│   │   └── PlanModal.tsx       # Modální okno pro plánování
│   ├── App.tsx           # Hlavní layout a stav
│   ├── types.ts          # TypeScript definice
│   └── mockData.ts       # Testovací data
├── index.html            # Entry point
└── vite.config.ts        # Konfigurace buildu
```

## Klíčová Rozhodnutí

### 1. Mockovaná Mapa
Namísto plné integrace mapového SDK (Mapbox/Google Maps) využíváme v této fázi `MapCanvas.tsx` - vlastní komponentu, která renderuje piny na abstraktní mřížku (0-100%) na základě souřadnic. To umožňuje rychlý vývoj UI bez nutnosti řešit API klíče a geolokaci.

### 2. Oddělení Plánu a Realizace
Doménový model striktně odděluje:
- **Event (Plán):** Co se má stát (např. "Výsadba aleje").
- **TreeRecord (Realizace):** Co se skutečně stalo (konkrétní zasazený strom na konkrétním místě + fotka).
Tento přístup umožňuje sledovat rozdíl mezi "plánem" a "skutečností".

### 3. Kontextové Výstrahy
Systém integruje meteorologická data (simulovaná) přímo do kalendáře. Uživatel tak při plánování výsadby vidí, zda pro daný den neplatí výstraha (např. sucho nebo mráz), což podporuje informované rozhodování.
