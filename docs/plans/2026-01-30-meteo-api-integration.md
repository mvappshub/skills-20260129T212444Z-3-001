# Meteorologická API Integrace - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrovat Open-Meteo (předpověď počasí, půdní vlhkost) a MeteoAlarm (oficiální výstrahy) do SilvaPlan aplikace pro reálná meteorologická data namísto mock dat.

**Architecture:** Dvou-zdrojová architektura - Open-Meteo poskytuje forecast data a půdní vlhkost, MeteoAlarm poskytuje oficiální výstrahy z ČHMÚ. Data se načítají přímo z API (client-side) s cachováním v localStorage. Existující `MeteoAlert` typ zůstává beze změny.

**Tech Stack:** React 19, TypeScript, Open-Meteo SDK (`openmeteo`), MeteoAlarm REST API, date-fns

---

## Přehled tasků

| Task | Popis | Závislosti |
|------|-------|------------|
| 1 | Nainstalovat Open-Meteo SDK | - |
| 2 | Vytvořit WeatherService (Open-Meteo) | Task 1 |
| 3 | Vytvořit typy pro rozšířená weather data | Task 2 |
| 4 | Upravit AlertService pro MeteoAlarm | Task 3 |
| 5 | Přidat drought detection z půdní vlhkosti | Task 2, 4 |
| 6 | Vytvořit WeatherDisplay komponentu | Task 2, 3 |
| 7 | Integrovat do DayDetailPanel | Task 4, 6 |
| 8 | Přidat caching vrstvu | Task 7 |

---

## Task 1: Nainstalovat Open-Meteo SDK

**Files:**
- Modify: `package.json`

**Step 1: Nainstalovat závislost**

Run:
```bash
npm install openmeteo
```

Expected: Package added to dependencies

**Step 2: Ověřit instalaci**

Run:
```bash
npm list openmeteo
```

Expected: `openmeteo@x.x.x` zobrazeno

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add openmeteo SDK for weather data

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Vytvořit WeatherService (Open-Meteo)

**Files:**
- Create: `services/weatherService.ts`

**Step 1: Vytvořit weatherService.ts**

```typescript
// services/weatherService.ts
import { fetchWeatherApi } from 'openmeteo';

export interface WeatherForecast {
  date: Date;
  temperatureMax: number;
  temperatureMin: number;
  precipitation: number;
  precipitationProbability: number;
  soilMoisture0to1cm: number;
  soilTemperature0cm: number;
  weatherCode: number;
}

export interface CurrentWeather {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  precipitation: number;
  soilMoisture: number;
}

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: 'Jasno',
  1: 'Převážně jasno',
  2: 'Polojasno',
  3: 'Zataženo',
  45: 'Mlha',
  48: 'Námraza',
  51: 'Mrholení - slabé',
  53: 'Mrholení - mírné',
  55: 'Mrholení - silné',
  61: 'Déšť - slabý',
  63: 'Déšť - mírný',
  65: 'Déšť - silný',
  66: 'Mrznoucí déšť - slabý',
  67: 'Mrznoucí déšť - silný',
  71: 'Sněžení - slabé',
  73: 'Sněžení - mírné',
  75: 'Sněžení - silné',
  77: 'Sněhové krupky',
  80: 'Přeháňky - slabé',
  81: 'Přeháňky - mírné',
  82: 'Přeháňky - silné',
  85: 'Sněhové přeháňky - slabé',
  86: 'Sněhové přeháňky - silné',
  95: 'Bouřka',
  96: 'Bouřka s krupobitím - slabá',
  99: 'Bouřka s krupobitím - silná',
};

export function getWeatherDescription(code: number): string {
  return WEATHER_CODE_DESCRIPTIONS[code] || 'Neznámé';
}

export async function fetchWeatherForecast(
  lat: number,
  lng: number,
  days: number = 7
): Promise<WeatherForecast[]> {
  const params = {
    latitude: [lat],
    longitude: [lng],
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'weather_code',
    ],
    hourly: [
      'soil_moisture_0_to_1cm',
      'soil_temperature_0cm',
    ],
    timezone: 'Europe/Prague',
    forecast_days: days,
  };

  try {
    const responses = await fetchWeatherApi(
      'https://api.open-meteo.com/v1/forecast',
      params
    );

    const response = responses[0];
    const daily = response.daily()!;
    const hourly = response.hourly()!;

    const forecasts: WeatherForecast[] = [];
    const dailyLength = daily.time().length;

    for (let i = 0; i < dailyLength; i++) {
      // Average soil moisture for the day (from hourly data)
      const hourlyStartIndex = i * 24;
      let soilMoistureSum = 0;
      let soilTempSum = 0;
      let count = 0;

      for (let h = hourlyStartIndex; h < hourlyStartIndex + 24 && h < hourly.time().length; h++) {
        const moisture = hourly.variables(0)!.valuesArray()![h];
        const temp = hourly.variables(1)!.valuesArray()![h];
        if (!isNaN(moisture)) {
          soilMoistureSum += moisture;
          soilTempSum += temp;
          count++;
        }
      }

      forecasts.push({
        date: new Date(Number(daily.time()) * 1000 + i * 86400000),
        temperatureMax: daily.variables(0)!.valuesArray()![i],
        temperatureMin: daily.variables(1)!.valuesArray()![i],
        precipitation: daily.variables(2)!.valuesArray()![i],
        precipitationProbability: daily.variables(3)!.valuesArray()![i],
        weatherCode: daily.variables(4)!.valuesArray()![i],
        soilMoisture0to1cm: count > 0 ? soilMoistureSum / count : 0,
        soilTemperature0cm: count > 0 ? soilTempSum / count : 0,
      });
    }

    return forecasts;
  } catch (error) {
    console.error('Failed to fetch weather forecast:', error);
    return [];
  }
}

export async function fetchCurrentWeather(
  lat: number,
  lng: number
): Promise<CurrentWeather | null> {
  const params = {
    latitude: [lat],
    longitude: [lng],
    current: [
      'temperature_2m',
      'weather_code',
      'wind_speed_10m',
      'precipitation',
    ],
    hourly: ['soil_moisture_0_to_1cm'],
    timezone: 'Europe/Prague',
    forecast_days: 1,
  };

  try {
    const responses = await fetchWeatherApi(
      'https://api.open-meteo.com/v1/forecast',
      params
    );

    const response = responses[0];
    const current = response.current()!;
    const hourly = response.hourly()!;

    // Get current hour's soil moisture
    const now = new Date();
    const hourIndex = now.getHours();
    const soilMoistureValues = hourly.variables(0)!.valuesArray()!;
    const soilMoisture = soilMoistureValues[hourIndex] || soilMoistureValues[0] || 0;

    return {
      temperature: current.variables(0)!.value(),
      weatherCode: current.variables(1)!.value(),
      windSpeed: current.variables(2)!.value(),
      precipitation: current.variables(3)!.value(),
      soilMoisture,
    };
  } catch (error) {
    console.error('Failed to fetch current weather:', error);
    return null;
  }
}
```

**Step 2: Ověřit TypeScript kompilaci**

Run:
```bash
npx tsc --noEmit
```

Expected: Žádné chyby

**Step 3: Commit**

```bash
git add services/weatherService.ts
git commit -m "feat: add weatherService with Open-Meteo integration

- Fetch 7-day forecast with soil moisture data
- Get current weather conditions
- Czech weather code descriptions

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Rozšířit typy pro weather data

**Files:**
- Modify: `types.ts`

**Step 1: Přidat nové typy na konec types.ts**

Přidat za existující kód (za `DaySummary` interface):

```typescript
// Weather forecast context
export interface DayWeather {
  date: Date;
  temperatureMax: number;
  temperatureMin: number;
  precipitation: number;
  precipitationProbability: number;
  soilMoisture: number; // 0-1 scale
  weatherCode: number;
  weatherDescription: string;
}

// Soil moisture thresholds for drought detection
export const SOIL_MOISTURE_THRESHOLDS = {
  CRITICAL: 0.1,  // <10% = DANGER
  LOW: 0.2,       // <20% = WARNING
  NORMAL: 0.3,    // <30% = INFO
} as const;
```

**Step 2: Ověřit TypeScript kompilaci**

Run:
```bash
npx tsc --noEmit
```

Expected: Žádné chyby

**Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add DayWeather type and soil moisture thresholds

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Upravit AlertService pro MeteoAlarm + drought detection

**Files:**
- Modify: `services/alertService.ts`

**Step 1: Přepsat alertService.ts**

```typescript
// services/alertService.ts
import { supabase } from '../lib/supabase';
import { MeteoAlert, AlertLevel, SOIL_MOISTURE_THRESHOLDS } from '../types';
import { fetchCurrentWeather } from './weatherService';

// MeteoAlarm severity mapping
const METEOALARM_LEVEL_MAP: Record<string, AlertLevel> = {
  'Minor': AlertLevel.INFO,
  'Moderate': AlertLevel.WARNING,
  'Severe': AlertLevel.DANGER,
  'Extreme': AlertLevel.DANGER,
};

// MeteoAlarm event type mapping
const METEOALARM_TYPE_MAP: Record<string, 'drought' | 'storm' | 'heat' | 'frost'> = {
  'Wind': 'storm',
  'Thunderstorm': 'storm',
  'Rain': 'storm',
  'Flood': 'storm',
  'Snow/Ice': 'frost',
  'Extreme low temperature': 'frost',
  'Frost': 'frost',
  'Extreme high temperature': 'heat',
  'Heat wave': 'heat',
  'Forest fire': 'heat',
  'Coastal event': 'storm',
  'Fog': 'frost',
  'Avalanche': 'frost',
};

interface MeteoAlarmWarning {
  id: string;
  awareness_level: string;
  awareness_type: string;
  event: string;
  headline: string;
  description: string;
  onset: string;
  expires: string;
  geometry?: {
    type: string;
    coordinates: number[];
  };
}

/**
 * Fetch alerts from MeteoAlarm API for Czech Republic
 */
async function fetchMeteoAlarmAlerts(): Promise<MeteoAlert[]> {
  try {
    // MeteoAlarm Atom feed for Czechia
    const response = await fetch(
      'https://feeds.meteoalarm.org/api/v1/warnings/feeds-czechia'
    );

    if (!response.ok) {
      console.warn('MeteoAlarm API unavailable:', response.status);
      return [];
    }

    const data = await response.json();
    const warnings: MeteoAlarmWarning[] = data.warnings || [];

    return warnings.map((warning): MeteoAlert => {
      const type = METEOALARM_TYPE_MAP[warning.awareness_type] || 'storm';
      const level = METEOALARM_LEVEL_MAP[warning.awareness_level] || AlertLevel.INFO;

      // Default center for Czech Republic if no geometry
      let center = { lat: 49.8175, lng: 15.4730 };
      if (warning.geometry?.coordinates) {
        // GeoJSON format: [lng, lat]
        center = {
          lat: warning.geometry.coordinates[1],
          lng: warning.geometry.coordinates[0],
        };
      }

      return {
        id: `meteoalarm-${warning.id}`,
        type,
        level,
        title: warning.headline || `${warning.awareness_type} výstraha`,
        description: warning.description || '',
        valid_from: new Date(warning.onset),
        valid_to: new Date(warning.expires),
        affected_area_center: center,
      };
    });
  } catch (error) {
    console.warn('Failed to fetch MeteoAlarm alerts:', error);
    return [];
  }
}

/**
 * Generate drought alert from soil moisture data
 */
async function generateDroughtAlert(
  lat: number,
  lng: number
): Promise<MeteoAlert | null> {
  const weather = await fetchCurrentWeather(lat, lng);

  if (!weather) return null;

  const moisture = weather.soilMoisture;

  if (moisture < SOIL_MOISTURE_THRESHOLDS.CRITICAL) {
    return {
      id: `drought-critical-${Date.now()}`,
      type: 'drought',
      level: AlertLevel.DANGER,
      title: 'Kritické sucho',
      description: `Vlhkost půdy je pouze ${(moisture * 100).toFixed(0)}%. Okamžitá zálivka nutná!`,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      affected_area_center: { lat, lng },
    };
  }

  if (moisture < SOIL_MOISTURE_THRESHOLDS.LOW) {
    return {
      id: `drought-warning-${Date.now()}`,
      type: 'drought',
      level: AlertLevel.WARNING,
      title: 'Riziko sucha',
      description: `Vlhkost půdy klesla na ${(moisture * 100).toFixed(0)}%. Doporučena zálivka.`,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      affected_area_center: { lat, lng },
    };
  }

  if (moisture < SOIL_MOISTURE_THRESHOLDS.NORMAL) {
    return {
      id: `drought-info-${Date.now()}`,
      type: 'drought',
      level: AlertLevel.INFO,
      title: 'Nízká vlhkost půdy',
      description: `Vlhkost půdy je ${(moisture * 100).toFixed(0)}%. Sledujte vývoj.`,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      affected_area_center: { lat, lng },
    };
  }

  return null;
}

/**
 * Fetch alerts from Supabase cache (if exists)
 */
async function fetchCachedAlerts(): Promise<MeteoAlert[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('meteo_alerts')
    .select('*')
    .gte('valid_to', now)
    .order('valid_from', { ascending: true });

  if (error) {
    // Table doesn't exist yet - that's OK
    return [];
  }

  return (data || []).map((a) => ({
    id: a.id,
    type: a.type as 'drought' | 'storm' | 'heat' | 'frost',
    level: a.level as AlertLevel,
    title: a.title,
    description: a.description,
    valid_from: new Date(a.valid_from),
    valid_to: new Date(a.valid_to),
    affected_area_center: {
      lat: a.affected_lat,
      lng: a.affected_lng,
    },
  }));
}

/**
 * Main function to fetch all alerts
 * Combines: MeteoAlarm (official) + Drought detection + Supabase cache
 */
export async function fetchAlerts(
  userLat: number = 50.0755, // Default: Praha
  userLng: number = 14.4378
): Promise<MeteoAlert[]> {
  const [meteoAlarmAlerts, cachedAlerts, droughtAlert] = await Promise.all([
    fetchMeteoAlarmAlerts(),
    fetchCachedAlerts(),
    generateDroughtAlert(userLat, userLng),
  ]);

  // Combine all alerts, deduplicate by id
  const allAlerts = [...meteoAlarmAlerts, ...cachedAlerts];

  if (droughtAlert) {
    allAlerts.push(droughtAlert);
  }

  // Deduplicate
  const seen = new Set<string>();
  const uniqueAlerts = allAlerts.filter((alert) => {
    if (seen.has(alert.id)) return false;
    seen.add(alert.id);
    return true;
  });

  // Sort by severity (DANGER first) then by date
  return uniqueAlerts.sort((a, b) => {
    const levelOrder = { [AlertLevel.DANGER]: 0, [AlertLevel.WARNING]: 1, [AlertLevel.INFO]: 2 };
    const levelDiff = levelOrder[a.level] - levelOrder[b.level];
    if (levelDiff !== 0) return levelDiff;
    return a.valid_from.getTime() - b.valid_from.getTime();
  });
}
```

**Step 2: Ověřit TypeScript kompilaci**

Run:
```bash
npx tsc --noEmit
```

Expected: Žádné chyby

**Step 3: Commit**

```bash
git add services/alertService.ts
git commit -m "feat: integrate MeteoAlarm API and drought detection

- Fetch official warnings from MeteoAlarm EUMETNET
- Generate drought alerts from soil moisture data
- Combine with Supabase cache
- Sort by severity

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Vytvořit WeatherCard komponentu

**Files:**
- Create: `components/WeatherCard.tsx`

**Step 1: Vytvořit WeatherCard.tsx**

```typescript
// components/WeatherCard.tsx
import React from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Thermometer,
  Droplets,
  Wind,
} from 'lucide-react';
import { CurrentWeather, getWeatherDescription } from '../services/weatherService';

interface WeatherCardProps {
  weather: CurrentWeather | null;
  loading?: boolean;
}

function getWeatherIcon(code: number) {
  if (code === 0 || code === 1) return <Sun className="w-8 h-8 text-yellow-500" />;
  if (code === 2 || code === 3) return <Cloud className="w-8 h-8 text-slate-400" />;
  if (code >= 45 && code <= 48) return <CloudFog className="w-8 h-8 text-slate-400" />;
  if (code >= 51 && code <= 67) return <CloudRain className="w-8 h-8 text-blue-500" />;
  if (code >= 71 && code <= 86) return <CloudSnow className="w-8 h-8 text-blue-300" />;
  if (code >= 95) return <CloudLightning className="w-8 h-8 text-purple-500" />;
  return <Cloud className="w-8 h-8 text-slate-400" />;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ weather, loading }) => {
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg p-4 border border-slate-200 animate-pulse">
        <div className="h-8 w-8 bg-slate-200 rounded-full mb-2" />
        <div className="h-6 w-20 bg-slate-200 rounded mb-1" />
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
        <p className="text-sm text-slate-400">Počasí nedostupné</p>
      </div>
    );
  }

  const moisturePercent = (weather.soilMoisture * 100).toFixed(0);
  const moistureColor =
    weather.soilMoisture < 0.1
      ? 'text-red-600'
      : weather.soilMoisture < 0.2
      ? 'text-amber-600'
      : 'text-emerald-600';

  return (
    <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg p-4 border border-slate-200">
      <div className="flex items-start justify-between">
        <div>
          {getWeatherIcon(weather.weatherCode)}
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-800">
              {weather.temperature.toFixed(1)}°C
            </span>
          </div>
          <p className="text-sm text-slate-600">
            {getWeatherDescription(weather.weatherCode)}
          </p>
        </div>

        <div className="text-right space-y-2">
          <div className="flex items-center justify-end gap-1 text-sm text-slate-600">
            <Wind className="w-4 h-4" />
            <span>{weather.windSpeed.toFixed(0)} km/h</span>
          </div>
          <div className="flex items-center justify-end gap-1 text-sm text-slate-600">
            <CloudRain className="w-4 h-4" />
            <span>{weather.precipitation.toFixed(1)} mm</span>
          </div>
          <div className={`flex items-center justify-end gap-1 text-sm font-medium ${moistureColor}`}>
            <Droplets className="w-4 h-4" />
            <span>Půda: {moisturePercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Ověřit TypeScript kompilaci**

Run:
```bash
npx tsc --noEmit
```

Expected: Žádné chyby

**Step 3: Commit**

```bash
git add components/WeatherCard.tsx
git commit -m "feat: add WeatherCard component for current conditions

- Display temperature, weather icon, wind, precipitation
- Show soil moisture with color coding
- Loading and error states

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Vytvořit ForecastRow komponentu

**Files:**
- Create: `components/ForecastRow.tsx`

**Step 1: Vytvořit ForecastRow.tsx**

```typescript
// components/ForecastRow.tsx
import React from 'react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Droplets,
} from 'lucide-react';
import { WeatherForecast, getWeatherDescription } from '../services/weatherService';

interface ForecastRowProps {
  forecast: WeatherForecast;
  isToday?: boolean;
}

function getWeatherIcon(code: number, size: string = 'w-5 h-5') {
  if (code === 0 || code === 1) return <Sun className={`${size} text-yellow-500`} />;
  if (code === 2 || code === 3) return <Cloud className={`${size} text-slate-400`} />;
  if (code >= 45 && code <= 48) return <CloudFog className={`${size} text-slate-400`} />;
  if (code >= 51 && code <= 67) return <CloudRain className={`${size} text-blue-500`} />;
  if (code >= 71 && code <= 86) return <CloudSnow className={`${size} text-blue-300`} />;
  if (code >= 95) return <CloudLightning className={`${size} text-purple-500`} />;
  return <Cloud className={`${size} text-slate-400`} />;
}

export const ForecastRow: React.FC<ForecastRowProps> = ({ forecast, isToday }) => {
  const dayName = isToday ? 'Dnes' : format(forecast.date, 'EEEE', { locale: cs });
  const dateStr = format(forecast.date, 'd.M.', { locale: cs });

  const moisturePercent = (forecast.soilMoisture0to1cm * 100).toFixed(0);
  const moistureColor =
    forecast.soilMoisture0to1cm < 0.1
      ? 'text-red-600 bg-red-50'
      : forecast.soilMoisture0to1cm < 0.2
      ? 'text-amber-600 bg-amber-50'
      : 'text-emerald-600 bg-emerald-50';

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 rounded-lg ${
        isToday ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {getWeatherIcon(forecast.weatherCode)}
        <div className="min-w-0">
          <div className="font-medium text-slate-800 capitalize truncate">
            {dayName}
          </div>
          <div className="text-xs text-slate-500">{dateStr}</div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="text-right">
          <span className="font-semibold text-slate-800">
            {forecast.temperatureMax.toFixed(0)}°
          </span>
          <span className="text-slate-400 mx-1">/</span>
          <span className="text-slate-500">
            {forecast.temperatureMin.toFixed(0)}°
          </span>
        </div>

        {forecast.precipitation > 0 && (
          <div className="flex items-center gap-1 text-blue-600">
            <CloudRain className="w-4 h-4" />
            <span>{forecast.precipitation.toFixed(1)}</span>
          </div>
        )}

        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${moistureColor}`}
        >
          <Droplets className="w-3 h-3" />
          <span>{moisturePercent}%</span>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Ověřit TypeScript kompilaci**

Run:
```bash
npx tsc --noEmit
```

Expected: Žádné chyby

**Step 3: Commit**

```bash
git add components/ForecastRow.tsx
git commit -m "feat: add ForecastRow component for daily forecast display

- Show day name, temperatures, precipitation
- Soil moisture indicator with color coding
- Highlight today

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Integrovat do DayDetailPanel

**Files:**
- Modify: `components/DayDetailPanel.tsx`

**Step 1: Přidat importy na začátek souboru**

Přidat za existující importy:

```typescript
import { WeatherCard } from './WeatherCard';
import { ForecastRow } from './ForecastRow';
import { CurrentWeather, WeatherForecast } from '../services/weatherService';
```

**Step 2: Rozšířit interface DayDetailPanelProps**

Nahradit existující interface:

```typescript
interface DayDetailPanelProps {
  date: Date;
  events: CalendarEvent[];
  trees: TreeRecord[];
  alerts: MeteoAlert[];
  currentWeather: CurrentWeather | null;
  forecast: WeatherForecast[];
  weatherLoading?: boolean;
  onFocusMap: (lat: number, lng: number) => void;
  onPlanClick: () => void;
}
```

**Step 3: Přidat props do komponenty**

Nahradit destructuring v komponentě:

```typescript
export const DayDetailPanel: React.FC<DayDetailPanelProps> = ({
  date,
  events,
  trees,
  alerts,
  currentWeather,
  forecast,
  weatherLoading,
  onFocusMap,
  onPlanClick
}) => {
```

**Step 4: Přidat Weather sekci před "CO SE DĚJE"**

Přidat novou sekci hned za `<div className="flex-1 overflow-y-auto p-6 space-y-8">`:

```typescript
        {/* Weather Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-blue-600 font-semibold uppercase text-xs tracking-wider">
            <Thermometer className="w-4 h-4" />
            <span>Počasí</span>
          </div>

          <WeatherCard weather={currentWeather} loading={weatherLoading} />

          {forecast.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs text-slate-500 mb-2">Předpověď na 7 dní:</p>
              {forecast.slice(0, 7).map((day, index) => (
                <ForecastRow
                  key={day.date.toISOString()}
                  forecast={day}
                  isToday={index === 0}
                />
              ))}
            </div>
          )}
        </section>

        <hr className="border-slate-100" />
```

**Step 5: Ověřit TypeScript kompilaci**

Run:
```bash
npx tsc --noEmit
```

Expected: Žádné chyby

**Step 6: Commit**

```bash
git add components/DayDetailPanel.tsx
git commit -m "feat: integrate weather display into DayDetailPanel

- Add WeatherCard for current conditions
- Add 7-day forecast with ForecastRow
- New weather section above alerts

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Integrovat do App.tsx

**Files:**
- Modify: `App.tsx`

**Step 1: Přidat importy**

Přidat za existující importy:

```typescript
import {
  fetchWeatherForecast,
  fetchCurrentWeather,
  CurrentWeather,
  WeatherForecast
} from './services/weatherService';
```

**Step 2: Přidat state pro weather data**

Přidat za existující useState deklarace:

```typescript
const [currentWeather, setCurrentWeather] = useState<CurrentWeather | null>(null);
const [forecast, setForecast] = useState<WeatherForecast[]>([]);
const [weatherLoading, setWeatherLoading] = useState(true);
```

**Step 3: Přidat useEffect pro načítání weather dat**

Přidat nový useEffect (ideálně za existující data loading effect):

```typescript
// Load weather data
useEffect(() => {
  async function loadWeather() {
    setWeatherLoading(true);
    try {
      // Use user location or default to Praha
      const lat = 50.0755;
      const lng = 14.4378;

      const [weather, forecastData] = await Promise.all([
        fetchCurrentWeather(lat, lng),
        fetchWeatherForecast(lat, lng, 7)
      ]);

      setCurrentWeather(weather);
      setForecast(forecastData);
    } catch (error) {
      console.error('Failed to load weather:', error);
    } finally {
      setWeatherLoading(false);
    }
  }

  loadWeather();

  // Refresh weather every 30 minutes
  const interval = setInterval(loadWeather, 30 * 60 * 1000);
  return () => clearInterval(interval);
}, []);
```

**Step 4: Upravit fetchAlerts volání**

Najít existující volání `fetchAlerts()` a upravit na:

```typescript
const alertsData = await fetchAlerts(50.0755, 14.4378);
```

**Step 5: Předat props do DayDetailPanel**

Najít `<DayDetailPanel` a přidat nové props:

```typescript
<DayDetailPanel
  date={selectedDate}
  events={dayEvents}
  trees={dayTrees}
  alerts={dayAlerts}
  currentWeather={currentWeather}
  forecast={forecast}
  weatherLoading={weatherLoading}
  onFocusMap={handleFocusMap}
  onPlanClick={() => setShowPlanModal(true)}
/>
```

**Step 6: Ověřit TypeScript kompilaci**

Run:
```bash
npx tsc --noEmit
```

Expected: Žádné chyby

**Step 7: Spustit aplikaci a ověřit**

Run:
```bash
npm run dev
```

Expected: Aplikace se spustí, v DayDetailPanel se zobrazí sekce Počasí s aktuálními daty

**Step 8: Commit**

```bash
git add App.tsx
git commit -m "feat: integrate weather data loading into App

- Fetch current weather and 7-day forecast
- Pass to DayDetailPanel
- Auto-refresh every 30 minutes
- Use Prague coordinates as default

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Přidat localStorage caching

**Files:**
- Create: `services/cacheService.ts`
- Modify: `services/weatherService.ts`

**Step 1: Vytvořit cacheService.ts**

```typescript
// services/cacheService.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const CACHE_PREFIX = 'silvaplan_';

export function setCache<T>(key: string, data: T, ttlMinutes: number): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  };

  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (error) {
    console.warn('Failed to cache data:', error);
  }
}

export function getCache<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(CACHE_PREFIX + key);
    if (!stored) return null;

    const entry: CacheEntry<T> = JSON.parse(stored);

    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn('Failed to read cache:', error);
    return null;
  }
}

export function clearCache(keyPattern?: string): void {
  const keys = Object.keys(localStorage).filter(k =>
    k.startsWith(CACHE_PREFIX) &&
    (!keyPattern || k.includes(keyPattern))
  );

  keys.forEach(k => localStorage.removeItem(k));
}
```

**Step 2: Přidat caching do weatherService.ts**

Přidat import na začátek:

```typescript
import { getCache, setCache } from './cacheService';
```

Upravit `fetchWeatherForecast` funkci - přidat na začátek:

```typescript
export async function fetchWeatherForecast(
  lat: number,
  lng: number,
  days: number = 7
): Promise<WeatherForecast[]> {
  const cacheKey = `forecast_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const cached = getCache<WeatherForecast[]>(cacheKey);

  if (cached) {
    // Convert date strings back to Date objects
    return cached.map(f => ({ ...f, date: new Date(f.date) }));
  }

  // ... zbytek existujícího kódu ...

  // Před return přidat:
  setCache(cacheKey, forecasts, 60); // Cache na 1 hodinu

  return forecasts;
}
```

Upravit `fetchCurrentWeather` podobně:

```typescript
export async function fetchCurrentWeather(
  lat: number,
  lng: number
): Promise<CurrentWeather | null> {
  const cacheKey = `current_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const cached = getCache<CurrentWeather>(cacheKey);

  if (cached) {
    return cached;
  }

  // ... zbytek existujícího kódu ...

  // Před return přidat:
  setCache(cacheKey, result, 15); // Cache na 15 minut

  return result;
}
```

**Step 3: Ověřit TypeScript kompilaci**

Run:
```bash
npx tsc --noEmit
```

Expected: Žádné chyby

**Step 4: Commit**

```bash
git add services/cacheService.ts services/weatherService.ts
git commit -m "feat: add localStorage caching for weather data

- Cache forecast for 1 hour
- Cache current weather for 15 minutes
- Reduce API calls and improve performance

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Finální verifikace

**Step 1: Spustit aplikaci**

```bash
npm run dev
```

**Step 2: Ověřit funkcionalitu**

Checklist:
- [ ] Počasí sekce se zobrazuje v DayDetailPanel
- [ ] Aktuální teplota a podmínky jsou viditelné
- [ ] 7-denní předpověď se zobrazuje
- [ ] Půdní vlhkost má barevné kódování
- [ ] MeteoAlarm výstrahy se načítají (pokud existují)
- [ ] Drought alert se generuje při nízké vlhkosti
- [ ] Data se cachují (zkontrolovat v DevTools > Application > Local Storage)

**Step 3: Finální commit**

```bash
git add .
git commit -m "feat: complete meteo API integration

- Open-Meteo for weather forecast and soil moisture
- MeteoAlarm for official Czech weather warnings
- Automatic drought detection from soil data
- localStorage caching to reduce API calls

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Shrnutí implementace

| Komponenta | Soubor | Funkce |
|------------|--------|--------|
| WeatherService | `services/weatherService.ts` | Open-Meteo API integrace |
| AlertService | `services/alertService.ts` | MeteoAlarm + drought detection |
| CacheService | `services/cacheService.ts` | localStorage caching |
| WeatherCard | `components/WeatherCard.tsx` | Aktuální počasí UI |
| ForecastRow | `components/ForecastRow.tsx` | Denní předpověď UI |
| Types | `types.ts` | DayWeather, thresholds |

## Možná budoucí rozšíření

1. **Geolokace uživatele** - použít skutečnou polohu místo Praha default
2. **Supabase Edge Function** - background fetch alertů
3. **Push notifikace** - PWA notifications při nových výstrahách
4. **Historická data** - analýza trendů z Open-Meteo Historical API
5. **Mapa vrstvy** - vizualizace půdní vlhkosti na mapě
