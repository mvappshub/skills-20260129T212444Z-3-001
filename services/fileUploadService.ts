// services/fileUploadService.ts
/**
 * File upload service for chat attachments
 * Stores files in Supabase Storage and provides base64 encoding for AI
 */

import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'chat-attachments';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = [
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/json',
    // Microsoft Office
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/msword', // .doc
    'application/vnd.ms-excel', // .xls
    // OpenDocument
    'application/vnd.oasis.opendocument.text', // .odt
    'application/vnd.oasis.opendocument.spreadsheet', // .ods
];

export interface UploadedFile {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    base64?: string; // For AI processing
    mimeType: string;
}

export interface FileUploadResult {
    success: boolean;
    file?: UploadedFile;
    error?: string;
}

/**
 * Check if file type is allowed
 */
export function isAllowedFileType(mimeType: string): boolean {
    return [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES].includes(mimeType);
}

/**
 * Check if file is an image
 */
export function isImageFile(mimeType: string): boolean {
    return ALLOWED_IMAGE_TYPES.includes(mimeType);
}

/**
 * Check if file is a document
 */
export function isDocumentFile(mimeType: string): boolean {
    return ALLOWED_DOC_TYPES.includes(mimeType);
}

/**
 * Get file extension from name
 */
export function getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Convert File to base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * Read text content from a file
 * For text-based files (txt, csv, json, md)
 */
export async function fileToText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
            resolve(reader.result as string);
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * Check if file can be read as text directly
 */
export function isTextReadable(mimeType: string): boolean {
    return [
        'text/plain',
        'text/csv',
        'text/markdown',
        'application/json'
    ].includes(mimeType);
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(file: File): Promise<FileUploadResult> {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            success: false,
            error: `Soubor je příliš velký. Maximum je ${MAX_FILE_SIZE / 1024 / 1024}MB.`
        };
    }

    // Validate file type
    if (!isAllowedFileType(file.type)) {
        return {
            success: false,
            error: 'Nepodporovaný typ souboru. Povolené jsou: obrázky (JPEG, PNG, GIF, WebP), PDF a textové soubory.'
        };
    }

    try {
        // Generate unique filename
        const ext = file.name.split('.').pop() || '';
        const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const path = `uploads/${uniqueName}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('[FileUpload] Storage error:', error);
            return {
                success: false,
                error: 'Nepodařilo se nahrát soubor.'
            };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(path);

        // Get base64 for AI processing (only for images)
        let base64: string | undefined;
        if (isImageFile(file.type)) {
            base64 = await fileToBase64(file);
        }

        return {
            success: true,
            file: {
                id: data.path,
                name: file.name,
                type: isImageFile(file.type) ? 'image' : 'document',
                size: file.size,
                url: urlData.publicUrl,
                base64,
                mimeType: file.type
            }
        };
    } catch (err) {
        console.error('[FileUpload] Error:', err);
        return {
            success: false,
            error: 'Nastala chyba při nahrávání souboru.'
        };
    }
}

/**
 * Delete file from storage
 */
export async function deleteFile(path: string): Promise<boolean> {
    try {
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([path]);

        return !error;
    } catch {
        return false;
    }
}
