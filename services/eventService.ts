import { supabase } from '../lib/supabase'
import { CalendarEvent, EventType, EventStatus } from '../types'
import { assertValidLngLat, isValidLatitude, isValidLongitude } from './geo'

export type EventUpdateInput = Partial<Omit<CalendarEvent, 'id' | 'items'>> & {
    end_at?: Date | null;
    start_at?: Date | null;
};

export function buildEventUpdatePayload(updates: EventUpdateInput): Record<string, any> {
    const updateData: Record<string, any> = {};

    if (Object.prototype.hasOwnProperty.call(updates, 'title')) updateData.title = updates.title;
    if (Object.prototype.hasOwnProperty.call(updates, 'type')) updateData.type = updates.type;
    if (Object.prototype.hasOwnProperty.call(updates, 'status')) updateData.status = updates.status;
    if (Object.prototype.hasOwnProperty.call(updates, 'start_at')) {
        updateData.start_at = updates.start_at ? updates.start_at.toISOString() : null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'end_at')) {
        updateData.end_at = updates.end_at ? updates.end_at.toISOString() : null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'lat')) updateData.lat = updates.lat;
    if (Object.prototype.hasOwnProperty.call(updates, 'lng')) updateData.lng = updates.lng;
    if (Object.prototype.hasOwnProperty.call(updates, 'radius_m')) updateData.radius_m = updates.radius_m;
    if (Object.prototype.hasOwnProperty.call(updates, 'address')) updateData.address = updates.address;
    if (Object.prototype.hasOwnProperty.call(updates, 'notes')) updateData.notes = updates.notes;

    return updateData;
}

export async function fetchEvents(): Promise<CalendarEvent[]> {
    const { data: events, error } = await supabase
        .from('events')
        .select(`
      *,
      items:event_items(*)
    `)
        .order('start_at', { ascending: true })

    if (error) throw error

    return (events || []).map(e => ({
        id: e.id,
        type: e.type as EventType,
        status: e.status as EventStatus,
        title: e.title,
        start_at: new Date(e.start_at),
        end_at: e.end_at ? new Date(e.end_at) : undefined,
        lat: e.lat,
        lng: e.lng,
        address: e.address,
        radius_m: e.radius_m,
        notes: e.notes,
        items: (e.items || []).map((item: any) => ({
            id: item.id,
            species_name_latin: item.species_name_latin,
            quantity: item.quantity,
            size_class: item.size_class
        }))
    }))
}

export async function createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const { items, ...eventData } = event
    assertValidLngLat(eventData.lat, eventData.lng, 'event')

    const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
            type: eventData.type,
            status: eventData.status,
            title: eventData.title,
            start_at: eventData.start_at.toISOString(),
            end_at: eventData.end_at ? eventData.end_at.toISOString() : null,
            lat: eventData.lat,
            lng: eventData.lng,
            address: eventData.address,
            radius_m: eventData.radius_m,
            notes: eventData.notes
        })
        .select()
        .single()

    if (eventError) throw eventError

    // Insert items if any
    if (items && items.length > 0) {
        const { error: itemsError } = await supabase
            .from('event_items')
            .insert(items.map(item => ({
                event_id: newEvent.id,
                species_name_latin: item.species_name_latin,
                quantity: item.quantity,
                size_class: item.size_class
            })))

        if (itemsError) {
            await supabase
                .from('events')
                .delete()
                .eq('id', newEvent.id);
            throw itemsError
        }
    }

    return {
        ...event,
        id: newEvent.id,
        items: items || []
    }
}

export async function updateEvent(
    id: string,
    updates: EventUpdateInput
): Promise<CalendarEvent> {
    if (updates.lat !== undefined && !isValidLatitude(updates.lat)) {
        throw new Error('Invalid event coordinates')
    }
    if (updates.lng !== undefined && !isValidLongitude(updates.lng)) {
        throw new Error('Invalid event coordinates')
    }
    const updateData = buildEventUpdatePayload(updates);

    const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', id)
        .select(`*, items:event_items(*)`)
        .single();

    if (error) throw error;

    return {
        id: data.id,
        type: data.type as EventType,
        status: data.status as EventStatus,
        title: data.title,
        start_at: new Date(data.start_at),
        end_at: data.end_at ? new Date(data.end_at) : undefined,
        lat: data.lat,
        lng: data.lng,
        address: data.address,
        radius_m: data.radius_m,
        notes: data.notes,
        items: (data.items || []).map((item: any) => ({
            id: item.id,
            species_name_latin: item.species_name_latin,
            quantity: item.quantity,
            size_class: item.size_class
        }))
    };
}

export async function deleteEvent(id: string): Promise<void> {
    // First delete related items
    await supabase
        .from('event_items')
        .delete()
        .eq('event_id', id);

    // Then delete the event
    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
