// services/ai/tools.ts
import { z } from 'zod';

// Schema definice pro AI tools
export const createEventSchema = z.object({
  title: z.string().describe('Název akce, např. "Výsadba dubů v parku"'),
  type: z.enum(['planting', 'maintenance', 'other']).default('planting').describe('Typ akce (výchozí: planting)'),
  date: z.string().describe('Datum ve formátu YYYY-MM-DD'),
  lat: z.number().describe('Zeměpisná šířka lokace'),
  lng: z.number().describe('Zeměpisná délka lokace'),
  address: z.string().optional().describe('Lidsky čitelná adresa nebo název místa, např. "Volarská 548/26, Praha 4"'),
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
  eventId: z.string().optional().describe('ID akce ke smaz?n?'),
  id: z.string().optional().describe('Alternativn? kl?? ID akce ke smaz?n?')
}).refine(data => Boolean(data.eventId || data.id), {
  message: 'eventId nebo id mus? b?t vypln?no'
});

export const deleteEventsSchema = z.object({
  startDate: z.string().optional().describe('Po??te?n? datum filtru YYYY-MM-DD'),
  endDate: z.string().optional().describe('Koncov? datum filtru YYYY-MM-DD'),
  type: z.enum(['planting', 'maintenance', 'other']).optional().describe('Filtr dle typu'),
  status: z.enum(['planned', 'done', 'canceled']).optional().describe('Filtr dle stavu'),
  titleContains: z.string().optional().describe('??st n?zvu akce'),
  missingAddress: z.boolean().optional().describe('Smazat jen akce bez adresy'),
  maxCount: z.number().int().positive().max(200).optional().describe('Max po?et smazan?ch z?znam? (ochrana)')
}).refine(data => Boolean(data.startDate || data.endDate || data.type || data.status || data.titleContains || data.missingAddress), {
  message: 'Mus?? zadat alespo? jeden filtr'
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

export const getMapContextSchema = z.object({});

// Tool definitions pro AI SDK
export const toolDefinitions = {
  createEvent: {
    description: 'Vytvořit novou plánovanou akci (výsadba, údržba stromů). PŘED voláním VŽDY nejprve zavolej getMapContext pro zjištění lokace.',
    parameters: createEventSchema
  },
  editEvent: {
    description: 'Upravit existující akci v kalendáři. Použij pro změnu data, stavu nebo poznámek.',
    parameters: editEventSchema
  },
  deleteEvent: {
    description: 'Smazat akci z kalend??e. Pou?ij pouze kdy? u?ivatel explicitn? po??d? o smaz?n?.',
    parameters: deleteEventSchema
  },
  deleteEvents: {
    description: 'Hromadn? smazat akce podle filtru (nap?. datum, typ, stav, chyb?j?c? adresa). Pou?ij pouze p?i explicitn?m po?adavku u?ivatele.',
    parameters: deleteEventsSchema
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
  },
  getMapContext: {
    description: 'Získat aktuální kontext mapy - vybranou lokaci, GPS pozici, nebo střed zobrazení. VŽDY volej před createEvent.',
    parameters: getMapContextSchema
  }
};

export type ToolName = keyof typeof toolDefinitions;

