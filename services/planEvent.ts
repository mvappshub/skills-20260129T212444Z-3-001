import { EventStatus, EventType, CalendarEvent } from '../types';
import { assertValidLngLat } from './geo';

export interface PlanEventInput {
  title: string;
  type: EventType;
  date: string;
  pickedLocation: { lat: number; lng: number } | null | undefined;
  address?: string | null;
  notes?: string;
  species?: string;
  quantity?: number;
}

export function buildPlanEvent(input: PlanEventInput): Partial<CalendarEvent> {
  if (!input.pickedLocation) {
    throw new Error('Missing location');
  }

  assertValidLngLat(input.pickedLocation.lat, input.pickedLocation.lng, 'event');

  return {
    title: input.title,
    type: input.type,
    status: EventStatus.PLANNED,
    start_at: new Date(input.date),
    lat: input.pickedLocation.lat,
    lng: input.pickedLocation.lng,
    address: input.address || undefined,
    notes: input.notes,
    items: input.type === EventType.PLANTING ? [
      {
        id: Math.random().toString(36).substr(2, 9),
        species_name_latin: input.species || 'Neurčeno',
        quantity: Number(input.quantity || 1)
      }
    ] : []
  };
}
