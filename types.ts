// Enums mirroring database definition
export enum EventType {
  PLANTING = 'planting',
  MAINTENANCE = 'maintenance',
  OTHER = 'other'
}

export enum EventStatus {
  PLANNED = 'planned',
  DONE = 'done',
  CANCELED = 'canceled'
}

export enum TaskType {
  PRUNE = 'prune',
  SPRAY = 'spray',
  WATER = 'water',
  INSPECT = 'inspect',
  OTHER = 'other'
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  DANGER = 'danger'
}

// 1.1 A) Events (Plans)
export interface CalendarEvent {
  id: string;
  type: EventType;
  status: EventStatus;
  title: string;
  start_at: Date;
  end_at?: Date;
  lat: number;
  lng: number;
  radius_m?: number;
  notes?: string;
  items: EventItem[]; // Joined from event_items
}

// 1.1 B) Event Items
export interface EventItem {
  id: string;
  species_name_latin: string;
  quantity: number;
  size_class?: string;
}

// 1.1 C) Trees (Realized)
export interface TreeRecord {
  id: string;
  event_id?: string;
  species_name_latin: string; // denormalized for UI
  planted_at: Date;
  lat: number;
  lng: number;
  notes?: string;
  photos: TreePhoto[]; // Joined from tree_photos
}

// 1.1 D) Photos
export interface TreePhoto {
  id: string;
  url: string;
  taken_at: Date;
  caption?: string;
}

// 1.1 E) Maintenance Tasks (Simplified for MVP)
export interface MaintenanceTask {
  id: string;
  title: string;
  task_type: TaskType;
  due_date: Date; // Simplified rrule for MVP
  status: 'active' | 'completed';
}

// Weather/Alerts context
export interface MeteoAlert {
  id: string;
  level: AlertLevel;
  type: 'drought' | 'storm' | 'heat' | 'frost';
  title: string;
  description: string;
  valid_from: Date;
  valid_to: Date;
  affected_area_center: { lat: number; lng: number };
}

// Aggregated View Data for Calendar
export interface DaySummary {
  date: Date;
  hasPlan: boolean;
  hasRealization: boolean;
  hasAlert: boolean;
  alertLevel?: AlertLevel;
}

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