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
            lat: eventData.lat,
            lng: eventData.lng,
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
