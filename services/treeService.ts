import { supabase } from '../lib/supabase'
import { TreeRecord } from '../types'
import { assertValidLngLat } from './geo'

export async function fetchTrees(): Promise<TreeRecord[]> {
    const { data, error } = await supabase
        .from('trees')
        .select(`
      *,
      photos:tree_photos(*)
    `)
        .order('planted_at', { ascending: false })

    if (error) throw error

    return (data || []).map(t => ({
        id: t.id,
        event_id: t.event_id,
        species_name_latin: t.species_name_latin,
        planted_at: new Date(t.planted_at),
        lat: t.lat,
        lng: t.lng,
        notes: t.notes,
        photos: (t.photos || []).map((photo: any) => ({
            id: photo.id,
            url: photo.url,
            taken_at: new Date(photo.taken_at),
            caption: photo.caption
        }))
    }))
}

export async function createTree(tree: Omit<TreeRecord, 'id' | 'photos'>): Promise<TreeRecord> {
    assertValidLngLat(tree.lat, tree.lng, 'tree')
    const { data, error } = await supabase
        .from('trees')
        .insert({
            event_id: tree.event_id,
            species_name_latin: tree.species_name_latin,
            planted_at: tree.planted_at.toISOString(),
            lat: tree.lat,
            lng: tree.lng,
            notes: tree.notes
        })
        .select()
        .single()

    if (error) throw error

    return { ...tree, id: data.id, photos: [] }
}
