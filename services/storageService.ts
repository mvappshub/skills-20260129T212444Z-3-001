import { supabase } from '../lib/supabase'

/**
 * Uploads a photo file to Supabase Storage and returns the public URL
 */
export async function uploadTreePhoto(file: File, treeId: string): Promise<{ url: string; path: string }> {
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${treeId}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
        .from('tree-photos')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        })

    if (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error(`Nepodařilo se nahrát fotku: ${uploadError.message}`)
    }

    const { data } = supabase.storage
        .from('tree-photos')
        .getPublicUrl(fileName)

    return { url: data.publicUrl, path: fileName }
}

/**
 * Saves a photo record to the tree_photos table
 */
export async function savePhotoRecord(treeId: string, url: string, caption?: string): Promise<void> {
    const { error } = await supabase
        .from('tree_photos')
        .insert({
            tree_id: treeId,
            url,
            caption,
            taken_at: new Date().toISOString()
        })

    if (error) {
        console.error('Save photo record error:', error)
        throw new Error(`Nepodařilo se uložit záznam fotky: ${error.message}`)
    }
}

/**
 * Uploads a photo and saves the record in one operation
 */
export async function uploadAndSavePhoto(
    file: File,
    treeId: string,
    caption?: string
): Promise<string> {
    const { url, path } = await uploadTreePhoto(file, treeId)
    try {
        await savePhotoRecord(treeId, url, caption)
        return url
    } catch (error) {
        await supabase.storage
            .from('tree-photos')
            .remove([path])
        throw error
    }
}
