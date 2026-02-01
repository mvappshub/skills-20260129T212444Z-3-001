import { supabase } from '../lib/supabase'
import { CalendarEvent, EventType, EventStatus } from '../types'

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

        if (itemsError) throw itemsError
    }

    return {
        ...event,
        id: newEvent.id,
        items: items || []
    }
}

export async function updateEvent(
    id: string,
    updates: Partial<Omit<CalendarEvent, 'id' | 'items'>>
): Promise<CalendarEvent> {
    const updateData: Record<string, any> = {};

    if (updates.title) updateData.title = updates.title;
    if (updates.type) updateData.type = updates.type;
    if (updates.status) updateData.status = updates.status;
    if (updates.start_at) updateData.start_at = updates.start_at.toISOString();
    if (updates.end_at) updateData.end_at = updates.end_at.toISOString();
    if (updates.lat !== undefined) updateData.lat = updates.lat;
    if (updates.lng !== undefined) updateData.lng = updates.lng;
    if (updates.radius_m !== undefined) updateData.radius_m = updates.radius_m;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

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
