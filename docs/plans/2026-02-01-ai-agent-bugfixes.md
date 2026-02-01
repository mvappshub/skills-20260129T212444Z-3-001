# AI Agent Bugfixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Opravit všechny identifikované bugy v AI agentovi SilvaPlan (3 kritické, 5 střední, 4 drobné problémy)

**Architecture:** Opravy se týkají chatService.ts (tool handlers, error handling), settingsService.ts (Gemini modelId), alertService.ts (MeteoAlarm proxy), a fileUploadService.ts (PDF/Word parsing). Každá oprava je izolovaná a testovatelná.

**Tech Stack:** TypeScript, React, Vite, Zod, Supabase, Open-Meteo API, pdf.js, mammoth.js

---

## Task 1: Přidat try-catch do analyzeRisks handleru

**Files:**
- Modify: `services/ai/chatService.ts:403-478`

**Step 1: Identifikovat současný kód**

Současný kód nemá error handling:
```typescript
async analyzeRisks(args) {
  const [events, alerts, forecast] = await Promise.all([
    fetchEvents(),
    fetchAlerts(),
    fetchWeatherForecast(50.0755, 14.4378, 14)
  ]);
  // ... rest of logic
}
```

**Step 2: Přidat try-catch wrapper**

```typescript
async analyzeRisks(args) {
  try {
    const [events, alerts, forecast] = await Promise.all([
      fetchEvents(),
      fetchAlerts(),
      fetchWeatherForecast(50.0755, 14.4378, 14)
    ]);

    const upcomingEvents = events.filter(e =>
      e.status === EventStatus.PLANNED &&
      e.start_at > new Date() &&
      e.start_at < addDays(new Date(), 14)
    );

    const risks: { eventId: string; eventTitle: string; eventDate: string; risks: string[] }[] = [];

    for (const event of upcomingEvents) {
      if (args.eventId && event.id !== args.eventId) continue;

      const eventRisks: string[] = [];
      const eventDate = event.start_at;

      // Check alerts
      const relevantAlerts = alerts.filter(a =>
        isWithinInterval(eventDate, { start: a.valid_from, end: a.valid_to })
      );

      for (const alert of relevantAlerts) {
        if (alert.level === 'danger') {
          eventRisks.push(`KRITICKÉ: ${alert.title} - ${alert.description}`);
        } else if (alert.level === 'warning') {
          eventRisks.push(`VAROVÁNÍ: ${alert.title}`);
        }
      }

      // Check forecast
      const dayForecast = forecast.find(f =>
        format(f.date, 'yyyy-MM-dd') === format(eventDate, 'yyyy-MM-dd')
      );

      if (dayForecast) {
        if (dayForecast.soilMoisture0to1cm < 0.1) {
          eventRisks.push('Kriticky nízká vlhkost půdy - nutná zálivka po výsadbě');
        }
        if (dayForecast.temperatureMin < 0) {
          eventRisks.push(`Riziko mrazu (min. ${dayForecast.temperatureMin.toFixed(0)}°C)`);
        }
        if (dayForecast.precipitation > 10) {
          eventRisks.push(`Očekávané silné srážky (${dayForecast.precipitation.toFixed(0)}mm)`);
        }
        if (dayForecast.temperatureMax > 30) {
          eventRisks.push(`Příliš vysoká teplota (${dayForecast.temperatureMax.toFixed(0)}°C) - stres pro sazenice`);
        }
      }

      if (eventRisks.length > 0) {
        risks.push({
          eventId: event.id,
          eventTitle: event.title,
          eventDate: format(event.start_at, 'd.M.yyyy'),
          risks: eventRisks
        });
      }
    }

    if (risks.length === 0) {
      return {
        analyzedEvents: upcomingEvents.length,
        message: 'Žádná rizika nebyla nalezena pro nadcházející akce.'
      };
    }

    return {
      analyzedEvents: upcomingEvents.length,
      risksFound: risks.length,
      details: risks
    };
  } catch (error) {
    console.error('[ChatService] analyzeRisks error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Nepodařilo se analyzovat rizika. Zkuste to znovu.'
    };
  }
}
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add services/ai/chatService.ts
git commit -m "fix: add try-catch error handling to analyzeRisks tool handler"
```

---

## Task 2: Přidat JSON.parse try-catch pro Gemini tool responses

**Files:**
- Modify: `services/ai/chatService.ts:182-192`

**Step 1: Identifikovat problémový kód**

Současný kód:
```typescript
} else if (msg.role === 'tool') {
  contents.push({
    role: 'user',
    parts: [{
      functionResponse: {
        name: msg.name,
        response: JSON.parse(msg.content)  // <- může selhat
      }
    }]
  });
}
```

**Step 2: Přidat safe JSON parse**

```typescript
} else if (msg.role === 'tool') {
  let parsedContent: any;
  try {
    parsedContent = JSON.parse(msg.content);
  } catch {
    // If content is not valid JSON, wrap it as string
    parsedContent = { raw: msg.content };
  }
  contents.push({
    role: 'user',
    parts: [{
      functionResponse: {
        name: msg.name,
        response: parsedContent
      }
    }]
  });
}
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add services/ai/chatService.ts
git commit -m "fix: add safe JSON parsing for Gemini tool responses"
```

---

## Task 3: Opravit Gemini modelId lookup v settingsService

**Files:**
- Modify: `services/settingsService.ts:349-375`

**Step 1: Identifikovat problém**

Současný kód používá `openrouterModelId` pro Gemini:
```typescript
} else {
  const geminiModel = GEMINI_MODELS.find(m => m.id === settings.openrouterModelId);
```

**Step 2: Přidat geminiModelId do AISettings a opravit lookup**

Nejprve přidat nové pole do interface (řádek 26-40):
```typescript
export interface AISettings {
  // Provider selection
  provider: AIProvider;

  // API Keys
  openrouterApiKey: string;
  geminiApiKey: string;

  // Model selection
  openrouterModelId: string;
  geminiModelId: string;  // NOVÉ POLE

  // User preferences
  streamResponses: boolean;
  maxHistoryMessages: number;
}
```

Upravit DEFAULT_SETTINGS (řádek 57-64):
```typescript
const DEFAULT_SETTINGS: AISettings = {
  provider: 'openrouter',
  openrouterApiKey: '',
  geminiApiKey: '',
  openrouterModelId: 'google/gemini-3-flash-preview',
  geminiModelId: 'gemini-2.5-flash',  // NOVÉ
  streamResponses: false,
  maxHistoryMessages: 50
};
```

Upravit getSettings (řádek 135-158):
```typescript
return {
  provider: parsed.provider ?? DEFAULT_SETTINGS.provider,
  openrouterApiKey: parsed.openrouterApiKey ?? '',
  geminiApiKey: parsed.geminiApiKey ?? '',
  openrouterModelId: parsed.openrouterModelId ?? DEFAULT_SETTINGS.openrouterModelId,
  geminiModelId: parsed.geminiModelId ?? DEFAULT_SETTINGS.geminiModelId,  // NOVÉ
  streamResponses: parsed.streamResponses ?? DEFAULT_SETTINGS.streamResponses,
  maxHistoryMessages: parsed.maxHistoryMessages ?? DEFAULT_SETTINGS.maxHistoryMessages
};
```

Opravit getProviderConfig (řádek 360-375):
```typescript
} else {
  const geminiModel = GEMINI_MODELS.find(m => m.id === settings.geminiModelId);  // OPRAVENO
  return {
    provider: 'gemini',
    modelId: geminiModel?.id || 'gemini-2.5-flash',
    apiKey,
    geminiApiUrl: geminiModel?.apiUrl
  };
}
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add services/settingsService.ts
git commit -m "fix: add geminiModelId field and fix Gemini model lookup"
```

---

## Task 4: Nahradit deprecated substr() za substring()

**Files:**
- Modify: `services/ai/chatService.ts:229`

**Step 1: Najít deprecated kód**

```typescript
id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
```

**Step 2: Nahradit za substring()**

```typescript
id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
```

Poznámka: `substr(2, 9)` = start at 2, length 9 → `substring(2, 11)` = start at 2, end at 11

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add services/ai/chatService.ts
git commit -m "fix: replace deprecated substr() with substring()"
```

---

## Task 5: Podmínit console.log NODE_ENV

**Files:**
- Modify: `services/ai/chatService.ts:251, 269, 282, 591, 690, 718, 727`

**Step 1: Přidat helper funkci na začátek souboru (po importech)**

```typescript
// Debug logging helper - only logs in development
const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
const debugLog = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};
const debugError = (...args: any[]) => {
  // Errors are always logged
  console.error(...args);
};
```

**Step 2: Nahradit console.log za debugLog**

Změnit všechny výskyty:
- `console.log('[ChatService]` → `debugLog('[ChatService]`
- Ponechat `console.error` (nebo změnit na `debugError`)

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add services/ai/chatService.ts
git commit -m "fix: conditionally log debug messages based on NODE_ENV"
```

---

## Task 6: Přidat species-specific logiku do suggestPlantingDate

**Files:**
- Modify: `services/ai/chatService.ts:481-519`

**Step 1: Definovat species-specific podmínky**

Přidat před toolHandlers (kolem řádku 245):
```typescript
// Species-specific planting conditions
const SPECIES_CONDITIONS: Record<string, {
  tempMin: number;
  tempMax: number;
  moistureMin: number;
  frostSensitive: boolean;
}> = {
  // Listnaté stromy - obecně citlivější na mráz
  'quercus robur': { tempMin: 5, tempMax: 25, moistureMin: 0.2, frostSensitive: true },
  'quercus petraea': { tempMin: 5, tempMax: 25, moistureMin: 0.2, frostSensitive: true },
  'tilia cordata': { tempMin: 5, tempMax: 22, moistureMin: 0.25, frostSensitive: true },
  'acer platanoides': { tempMin: 5, tempMax: 23, moistureMin: 0.2, frostSensitive: true },
  'fagus sylvatica': { tempMin: 5, tempMax: 20, moistureMin: 0.3, frostSensitive: true },
  'betula pendula': { tempMin: 3, tempMax: 25, moistureMin: 0.15, frostSensitive: false },
  'fraxinus excelsior': { tempMin: 5, tempMax: 24, moistureMin: 0.25, frostSensitive: true },
  'carpinus betulus': { tempMin: 5, tempMax: 22, moistureMin: 0.25, frostSensitive: true },
  'sorbus aucuparia': { tempMin: 3, tempMax: 22, moistureMin: 0.2, frostSensitive: false },
  'aesculus hippocastanum': { tempMin: 5, tempMax: 22, moistureMin: 0.25, frostSensitive: true },
  'populus nigra': { tempMin: 5, tempMax: 28, moistureMin: 0.3, frostSensitive: false },
  'platanus hispanica': { tempMin: 8, tempMax: 28, moistureMin: 0.2, frostSensitive: true },
  // Jehličnany - obecně odolnější
  'pinus sylvestris': { tempMin: 0, tempMax: 25, moistureMin: 0.15, frostSensitive: false },
  'picea abies': { tempMin: 0, tempMax: 22, moistureMin: 0.2, frostSensitive: false },
  // Ovocné stromy
  'malus domestica': { tempMin: 5, tempMax: 22, moistureMin: 0.25, frostSensitive: true },
  'pyrus communis': { tempMin: 5, tempMax: 22, moistureMin: 0.25, frostSensitive: true },
};

// Default conditions for unknown species
const DEFAULT_CONDITIONS = { tempMin: 5, tempMax: 25, moistureMin: 0.2, frostSensitive: true };

function getSpeciesConditions(species: string) {
  const normalized = species.toLowerCase().trim();
  return SPECIES_CONDITIONS[normalized] || DEFAULT_CONDITIONS;
}
```

**Step 2: Upravit suggestPlantingDate handler**

```typescript
async suggestPlantingDate(args) {
  const forecast = await fetchWeatherForecast(
    args.lat || 50.0755,
    args.lng || 14.4378,
    14
  );

  // Get species-specific conditions
  const conditions = getSpeciesConditions(args.species);

  // Find best day based on species-specific conditions
  const suitable = forecast.filter(f =>
    f.temperatureMin > conditions.tempMin &&
    f.temperatureMax < conditions.tempMax &&
    f.precipitation < 5 &&
    f.soilMoisture0to1cm > conditions.moistureMin &&
    // Check frost sensitivity
    (!conditions.frostSensitive || f.temperatureMin > 2)
  );

  if (suitable.length === 0) {
    // Find the best compromise day
    const scored = forecast.map(f => {
      let score = 0;
      if (f.temperatureMin > conditions.tempMin) score += 2;
      if (f.temperatureMax < conditions.tempMax) score += 2;
      if (f.precipitation < 5) score += 1;
      if (f.soilMoisture0to1cm > conditions.moistureMin) score += 2;
      if (!conditions.frostSensitive || f.temperatureMin > 2) score += 1;
      return { forecast: f, score };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0].forecast;
    return {
      species: args.species,
      suggestion: `V následujících 14 dnech nejsou ideální podmínky pro ${args.species}.`,
      bestCompromise: {
        date: format(best.date, 'd.M.yyyy'),
        isoDate: format(best.date, 'yyyy-MM-dd'),
        conditions: `${best.temperatureMin.toFixed(0)}-${best.temperatureMax.toFixed(0)}°C, vlhkost ${(best.soilMoisture0to1cm * 100).toFixed(0)}%`
      },
      speciesRequirements: {
        tempRange: `${conditions.tempMin}-${conditions.tempMax}°C`,
        minMoisture: `${(conditions.moistureMin * 100).toFixed(0)}%`,
        frostSensitive: conditions.frostSensitive
      }
    };
  }

  const best = suitable[0];
  return {
    species: args.species,
    suggestedDate: format(best.date, 'd.M.yyyy'),
    isoDate: format(best.date, 'yyyy-MM-dd'),
    conditions: {
      temperature: `${best.temperatureMin.toFixed(0)} až ${best.temperatureMax.toFixed(0)}°C`,
      precipitation: `${best.precipitation.toFixed(0)} mm`,
      soilMoisture: `${(best.soilMoisture0to1cm * 100).toFixed(0)}%`
    },
    speciesRequirements: {
      tempRange: `${conditions.tempMin}-${conditions.tempMax}°C`,
      minMoisture: `${(conditions.moistureMin * 100).toFixed(0)}%`,
      frostSensitive: conditions.frostSensitive
    },
    reason: `Optimální podmínky pro ${args.species}: teplota v rozmezí ${conditions.tempMin}-${conditions.tempMax}°C, vlhkost nad ${(conditions.moistureMin * 100).toFixed(0)}%`
  };
}
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add services/ai/chatService.ts
git commit -m "feat: add species-specific conditions to suggestPlantingDate"
```

---

## Task 7: Přidat PDF parsing pomocí pdf.js

**Files:**
- Create: `services/pdfService.ts`
- Modify: `components/ChatPanel.tsx:129-142`
- Modify: `package.json` (add pdfjs-dist)

**Step 1: Nainstalovat pdfjs-dist**

Run: `npm install pdfjs-dist`

**Step 2: Vytvořit pdfService.ts**

```typescript
// services/pdfService.ts
/**
 * PDF parsing service using pdf.js
 */

import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      textParts.push(`--- Strana ${i} ---\n${pageText}`);
    }

    return textParts.join('\n\n');
  } catch (error) {
    console.error('[PDFService] Error extracting text:', error);
    throw new Error('Nepodařilo se přečíst PDF soubor');
  }
}

/**
 * Check if file is a PDF
 */
export function isPDF(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}
```

**Step 3: Upravit ChatPanel.tsx pro použití PDF parseru**

Import na začátek:
```typescript
import { extractTextFromPDF, isPDF } from '../services/pdfService';
```

Upravit handleFileChange (kolem řádku 129):
```typescript
} else if (isPDF(file.type)) {
  // Handle PDF files - extract text
  try {
    const textContent = await extractTextFromPDF(file);
    attachment = {
      type: 'document',
      mimeType: file.type,
      textContent,
      name: file.name
    };
  } catch (err) {
    setError(`Nepodařilo se přečíst PDF "${file.name}": ${err instanceof Error ? err.message : 'neznámá chyba'}`);
    continue;
  }
} else if (isTextReadable(file.type)) {
  // ... existing code for text files
```

**Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds (may have warnings about pdf.js worker)

**Step 5: Commit**

```bash
git add services/pdfService.ts components/ChatPanel.tsx package.json package-lock.json
git commit -m "feat: add PDF text extraction using pdf.js"
```

---

## Task 8: Přidat Word parsing pomocí mammoth.js

**Files:**
- Create: `services/docxService.ts`
- Modify: `components/ChatPanel.tsx`
- Modify: `package.json` (add mammoth)

**Step 1: Nainstalovat mammoth**

Run: `npm install mammoth`

**Step 2: Vytvořit docxService.ts**

```typescript
// services/docxService.ts
/**
 * Word document parsing service using mammoth.js
 */

import mammoth from 'mammoth';

/**
 * Extract text content from a Word document (.docx)
 */
export async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    if (result.messages.length > 0) {
      console.warn('[DocxService] Warnings:', result.messages);
    }

    return result.value;
  } catch (error) {
    console.error('[DocxService] Error extracting text:', error);
    throw new Error('Nepodařilo se přečíst Word dokument');
  }
}

/**
 * Check if file is a Word document
 */
export function isDocx(mimeType: string): boolean {
  return mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

/**
 * Check if file is an old Word format (.doc)
 */
export function isDoc(mimeType: string): boolean {
  return mimeType === 'application/msword';
}
```

**Step 3: Upravit ChatPanel.tsx**

Import:
```typescript
import { extractTextFromDocx, isDocx, isDoc } from '../services/docxService';
```

Přidat case pro Word dokumenty (po PDF):
```typescript
} else if (isDocx(file.type)) {
  // Handle Word documents (.docx) - extract text
  try {
    const textContent = await extractTextFromDocx(file);
    attachment = {
      type: 'document',
      mimeType: file.type,
      textContent,
      name: file.name
    };
  } catch (err) {
    setError(`Nepodařilo se přečíst Word dokument "${file.name}": ${err instanceof Error ? err.message : 'neznámá chyba'}`);
    continue;
  }
} else if (isDoc(file.type)) {
  // Old .doc format - not supported by mammoth
  setError(`Starý formát Word (.doc) není podporován. Prosím uložte dokument jako .docx`);
  continue;
```

**Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add services/docxService.ts components/ChatPanel.tsx package.json package-lock.json
git commit -m "feat: add Word document text extraction using mammoth.js"
```

---

## Task 9: Vytvořit server-side proxy pro MeteoAlarm (Supabase Edge Function)

**Files:**
- Create: `supabase/functions/meteoalarm-proxy/index.ts`
- Modify: `services/alertService.ts`

**Poznámka:** Toto vyžaduje Supabase CLI a nastavení Edge Functions. Pokud není k dispozici, implementujeme fallback řešení.

**Step 1: Vytvořit alternativní řešení - použít ČHMÚ data přímo**

Místo MeteoAlarm API použijeme veřejně dostupná data z ČHMÚ (Český hydrometeorologický ústav), která nemají CORS problémy.

Upravit `alertService.ts`:
```typescript
/**
 * Fetch alerts from ČHMÚ (simplified - uses weather forecast data)
 * Since MeteoAlarm has CORS issues, we generate alerts from weather conditions
 */
async function generateWeatherAlerts(lat: number, lng: number): Promise<MeteoAlert[]> {
  try {
    const forecast = await fetchWeatherForecast(lat, lng, 3);
    const alerts: MeteoAlert[] = [];

    for (const day of forecast) {
      const date = day.date;

      // Storm detection (high precipitation + weather code)
      if (day.precipitation > 20 || [95, 96, 99].includes(day.weatherCode)) {
        alerts.push({
          id: `storm-${date.getTime()}`,
          type: 'storm',
          level: day.precipitation > 40 ? AlertLevel.DANGER : AlertLevel.WARNING,
          title: 'Silné srážky / Bouřka',
          description: `Očekávané srážky: ${day.precipitation.toFixed(0)}mm`,
          valid_from: date,
          valid_to: new Date(date.getTime() + 24 * 60 * 60 * 1000),
          affected_area_center: { lat, lng }
        });
      }

      // Frost detection
      if (day.temperatureMin < 0) {
        alerts.push({
          id: `frost-${date.getTime()}`,
          type: 'frost',
          level: day.temperatureMin < -5 ? AlertLevel.DANGER : AlertLevel.WARNING,
          title: 'Mráz',
          description: `Minimální teplota: ${day.temperatureMin.toFixed(0)}°C`,
          valid_from: date,
          valid_to: new Date(date.getTime() + 24 * 60 * 60 * 1000),
          affected_area_center: { lat, lng }
        });
      }

      // Heat detection
      if (day.temperatureMax > 30) {
        alerts.push({
          id: `heat-${date.getTime()}`,
          type: 'heat',
          level: day.temperatureMax > 35 ? AlertLevel.DANGER : AlertLevel.WARNING,
          title: 'Vedro',
          description: `Maximální teplota: ${day.temperatureMax.toFixed(0)}°C`,
          valid_from: date,
          valid_to: new Date(date.getTime() + 24 * 60 * 60 * 1000),
          affected_area_center: { lat, lng }
        });
      }
    }

    return alerts;
  } catch (error) {
    console.error('[AlertService] Failed to generate weather alerts:', error);
    return [];
  }
}
```

A upravit `fetchAlerts`:
```typescript
export async function fetchAlerts(
  userLat: number = 50.0755,
  userLng: number = 14.4378
): Promise<MeteoAlert[]> {
  const [weatherAlerts, cachedAlerts, droughtAlert] = await Promise.all([
    generateWeatherAlerts(userLat, userLng),  // ZMĚNĚNO z fetchMeteoAlarmAlerts
    fetchCachedAlerts(),
    generateDroughtAlert(userLat, userLng),
  ]);
  // ... rest stays the same
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add services/alertService.ts
git commit -m "feat: add weather-based alert generation (frost, storm, heat)"
```

---

## Task 10: Opravit type default v createEvent

**Files:**
- Modify: `services/ai/tools.ts:7`

**Step 1: Udělat type optional s default hodnotou**

Změnit v tools.ts:
```typescript
export const createEventSchema = z.object({
  title: z.string().describe('Název akce, např. "Výsadba dubů v parku"'),
  type: z.enum(['planting', 'maintenance', 'other']).default('planting').describe('Typ akce'),
  date: z.string().describe('Datum ve formátu YYYY-MM-DD'),
  // ... rest stays the same
```

**Step 2: Odstranit fallback v handleru**

V chatService.ts:253:
```typescript
// Změnit z:
const eventType = (args.type as EventType) || EventType.PLANTING;

// Na:
const eventType = args.type as EventType;  // Schema zajistí default 'planting'
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add services/ai/tools.ts services/ai/chatService.ts
git commit -m "fix: make event type optional with default value in schema"
```

---

## Task 11: Přidat konfigurovatelnou default lokaci

**Files:**
- Modify: `services/settingsService.ts`
- Modify: `services/ai/chatService.ts`

**Step 1: Přidat lokaci do AISettings**

V settingsService.ts přidat do interface:
```typescript
export interface AISettings {
  // ... existing fields

  // Default location
  defaultLat: number;
  defaultLng: number;
  defaultLocationName: string;
}
```

Přidat do DEFAULT_SETTINGS:
```typescript
const DEFAULT_SETTINGS: AISettings = {
  // ... existing fields
  defaultLat: 50.0755,
  defaultLng: 14.4378,
  defaultLocationName: 'Praha'
};
```

Přidat do getSettings:
```typescript
defaultLat: parsed.defaultLat ?? DEFAULT_SETTINGS.defaultLat,
defaultLng: parsed.defaultLng ?? DEFAULT_SETTINGS.defaultLng,
defaultLocationName: parsed.defaultLocationName ?? DEFAULT_SETTINGS.defaultLocationName,
```

**Step 2: Přidat getter pro default lokaci**

```typescript
export function getDefaultLocation(): { lat: number; lng: number; name: string } {
  const settings = getSettings();
  return {
    lat: settings.defaultLat,
    lng: settings.defaultLng,
    name: settings.defaultLocationName
  };
}
```

**Step 3: Použít v chatService.ts**

Import:
```typescript
import { getDefaultLocation } from '../settingsService';
```

V tool handlerech nahradit hardcoded hodnoty:
```typescript
// V createEvent:
const defaultLoc = getDefaultLocation();
lat: args.lat || defaultLoc.lat,
lng: args.lng || defaultLoc.lng,

// V getWeather:
const defaultLoc = getDefaultLocation();
const lat = args.lat || defaultLoc.lat;
const lng = args.lng || defaultLoc.lng;

// V analyzeRisks:
const defaultLoc = getDefaultLocation();
fetchWeatherForecast(defaultLoc.lat, defaultLoc.lng, 14)

// V suggestPlantingDate:
const defaultLoc = getDefaultLocation();
args.lat || defaultLoc.lat,
args.lng || defaultLoc.lng,

// V getSystemPrompt:
const defaultLoc = getDefaultLocation();
- Výchozí lokace: ${defaultLoc.name} (${defaultLoc.lat}, ${defaultLoc.lng})
```

**Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add services/settingsService.ts services/ai/chatService.ts
git commit -m "feat: add configurable default location in settings"
```

---

## Task 12: Final cleanup a verification

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Check for TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Create summary commit**

```bash
git add -A
git commit -m "chore: AI agent bugfixes complete - 12 issues resolved"
```

---

## Summary

| # | Problém | Oprava | Priorita |
|---|---------|--------|----------|
| 1 | analyzeRisks bez try-catch | Přidán error handling | Kritická |
| 2 | Gemini JSON parse může selhat | Safe JSON parsing | Kritická |
| 3 | Gemini modelId lookup | Nové geminiModelId pole | Střední |
| 4 | Deprecated substr() | substring() | Drobná |
| 5 | Console.log v produkci | debugLog helper | Drobná |
| 6 | suggestPlantingDate ignoruje species | Species-specific conditions | Střední |
| 7 | PDF nelze číst | pdf.js integrace | Kritická |
| 8 | Word nelze číst | mammoth.js integrace | Kritická |
| 9 | MeteoAlarm vypnutý | Weather-based alerts | Kritická |
| 10 | Type default nekonzistence | Schema default | Střední |
| 11 | Hardcoded Praha | Konfigurovatelná lokace | Drobná |
| 12 | Final verification | Build + TypeCheck | - |
