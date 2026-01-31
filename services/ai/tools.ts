// services/ai/tools.ts
import { z } from 'zod';

// Schema definice pro AI tools
export const createEventSchema = z.object({
  title: z.string().describe('Název akce, např. "Výsadba dubů v parku"'),
  type: z.enum(['planting', 'maintenance', 'other']).describe('Typ akce'),
  date: z.string().describe('Datum ve formátu YYYY-MM-DD'),
  lat: z.number().describe('Zeměpisná šířka lokace'),
  lng: z.number().describe('Zeměpisná délka lokace'),
  notes: z.string().optional().describe('Poznámky k akci'),
  items: z.array(z.object({
    species: z.string().describe('Latinský název druhu, např. "Quercus robur"'),
    quantity: z.number().describe('Počet kusů'),
    sizeClass: z.string().optional().describe('Velikostní třída, např. "150-200cm"')
  })).optional().describe('Seznam rostlin k výsadbě')
});

export const editEventSchema = z.object({
  eventId: z.string().describe('ID existující akce'),
  title: z.string().optional().describe('Nový název'),
  date: z.string().optional().describe('Nové datum YYYY-MM-DD'),
  status: z.enum(['planned', 'done', 'canceled']).optional().describe('Nový stav'),
  notes: z.string().optional().describe('Nové poznámky')
});

export const deleteEventSchema = z.object({
  eventId: z.string().describe('ID akce ke smazání')
});

export const getEventsSchema = z.object({
  startDate: z.string().optional().describe('Počáteční datum filtru YYYY-MM-DD'),
  endDate: z.string().optional().describe('Koncové datum filtru YYYY-MM-DD'),
  type: z.enum(['planting', 'maintenance', 'other']).optional().describe('Filtr dle typu')
});

export const getWeatherSchema = z.object({
  lat: z.number().optional().describe('Zeměpisná šířka (default: Praha)'),
  lng: z.number().optional().describe('Zeměpisná délka (default: Praha)'),
  days: z.number().optional().describe('Počet dní předpovědi (default: 7)')
});

export const getAlertsSchema = z.object({});

export const analyzeRisksSchema = z.object({
  eventId: z.string().optional().describe('ID konkrétní akce k analýze, nebo všechny nadcházející')
});

export const suggestPlantingDateSchema = z.object({
  species: z.string().describe('Latinský název druhu'),
  lat: z.number().optional().describe('Zeměpisná šířka'),
  lng: z.number().optional().describe('Zeměpisná délka')
});

// Tool definitions pro AI SDK
export const toolDefinitions = {
  createEvent: {
    description: 'Vytvořit novou plánovanou akci (výsadba, údržba stromů). Použij když uživatel chce naplánovat novou činnost.',
    parameters: createEventSchema
  },
  editEvent: {
    description: 'Upravit existující akci v kalendáři. Použij pro změnu data, stavu nebo poznámek.',
    parameters: editEventSchema
  },
  deleteEvent: {
    description: 'Smazat akci z kalendáře. Použij pouze když uživatel explicitně požádá o smazání.',
    parameters: deleteEventSchema
  },
  getEvents: {
    description: 'Získat seznam akcí z kalendáře. Použij pro zobrazení plánu nebo hledání konkrétních akcí.',
    parameters: getEventsSchema
  },
  getWeather: {
    description: 'Získat předpověď počasí včetně půdní vlhkosti. Použij pro plánování nebo kontrolu podmínek.',
    parameters: getWeatherSchema
  },
  getAlerts: {
    description: 'Získat aktuální meteorologické výstrahy (sucho, mráz, bouřky, horko).',
    parameters: getAlertsSchema
  },
  analyzeRisks: {
    description: 'Analyzovat rizika pro plánované akce na základě počasí. Proaktivně upozorni na problémy.',
    parameters: analyzeRisksSchema
  },
  suggestPlantingDate: {
    description: 'Navrhnout optimální datum výsadby pro daný druh na základě počasí.',
    parameters: suggestPlantingDateSchema
  }
};

export type ToolName = keyof typeof toolDefinitions;
