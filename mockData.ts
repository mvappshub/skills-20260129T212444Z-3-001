import { 
  CalendarEvent, 
  TreeRecord, 
  MeteoAlert, 
  EventType, 
  EventStatus, 
  AlertLevel 
} from './types';
import { addDays, subDays, startOfMonth, setHours } from 'date-fns';

const TODAY = new Date();
const CURRENT_MONTH_START = startOfMonth(TODAY);

// Mock Events (Plány - CO BUDE)
export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    type: EventType.PLANTING,
    status: EventStatus.PLANNED,
    title: 'Výsadba aleje - Duby',
    start_at: addDays(CURRENT_MONTH_START, 14), // Middle of month
    lat: 50.08,
    lng: 14.43,
    items: [
      { id: 'ei-1', species_name_latin: 'Quercus robur', quantity: 10, size_class: '150-200cm' }
    ]
  },
  {
    id: 'evt-2',
    type: EventType.MAINTENANCE,
    status: EventStatus.PLANNED,
    title: 'Kontrola po zimě',
    start_at: addDays(CURRENT_MONTH_START, 5),
    lat: 50.07,
    lng: 14.41,
    items: []
  },
  {
    id: 'evt-3',
    type: EventType.PLANTING,
    status: EventStatus.PLANNED,
    title: 'Komunitní sázení',
    start_at: addDays(CURRENT_MONTH_START, 20),
    lat: 50.09,
    lng: 14.45,
    items: [
      { id: 'ei-2', species_name_latin: 'Tilia cordata', quantity: 5 }
    ]
  }
];

// Mock Trees (Realizace - CO BYLO)
export const MOCK_TREES: TreeRecord[] = [
  {
    id: 'tree-1',
    species_name_latin: 'Acer platanoides',
    planted_at: subDays(TODAY, 2), // 2 days ago
    lat: 50.085,
    lng: 14.425,
    notes: 'Vysazeno dobrovolníky, mírně suchá půda.',
    photos: [
      { 
        id: 'ph-1', 
        url: 'https://picsum.photos/400/600?random=1', 
        taken_at: subDays(TODAY, 2),
        caption: 'Detail kmínku'
      },
      { 
        id: 'ph-2', 
        url: 'https://picsum.photos/400/600?random=2', 
        taken_at: subDays(TODAY, 2),
        caption: 'Celkový pohled'
      }
    ]
  },
  {
    id: 'tree-2',
    species_name_latin: 'Tilia cordata',
    planted_at: addDays(CURRENT_MONTH_START, 2), // Early in the month
    lat: 50.075,
    lng: 14.415,
    notes: 'Náhradní výsadba.',
    photos: [
       { 
        id: 'ph-3', 
        url: 'https://picsum.photos/400/600?random=3', 
        taken_at: addDays(CURRENT_MONTH_START, 2)
      }
    ]
  }
];

// Mock Alerts (Výstrahy - CO SE DĚJE)
export const MOCK_ALERTS: MeteoAlert[] = [
  {
    id: 'alert-1',
    type: 'drought',
    level: AlertLevel.WARNING,
    title: 'Riziko sucha',
    description: 'Vlhkost půdy klesla pod 30%. Doporučena zálivka.',
    valid_from: subDays(TODAY, 1),
    valid_to: addDays(TODAY, 3),
    affected_area_center: { lat: 50.08, lng: 14.43 }
  },
  {
    id: 'alert-2',
    type: 'frost',
    level: AlertLevel.INFO,
    title: 'Přízemní mrazíky',
    description: 'V noci očekávána teplota -2°C.',
    valid_from: addDays(CURRENT_MONTH_START, 13),
    valid_to: addDays(CURRENT_MONTH_START, 15),
    affected_area_center: { lat: 50.08, lng: 14.43 }
  }
];
