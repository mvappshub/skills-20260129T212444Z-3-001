// services/docxService.ts
/**
 * Word document parsing service using mammoth.js
 * Extracts text content from .docx files for AI analysis
 */

import mammoth from 'mammoth';

/**
 * Extract text content from a Word document (.docx)
 * @param file - Word document to extract text from
 * @returns Extracted raw text
 */
export async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    if (result.messages.length > 0) {
      console.warn('[DocxService] Warnings:', result.messages);
    }

    if (!result.value.trim()) {
      throw new Error('Dokument neobsahuje žádný text');
    }

    return result.value;
  } catch (error) {
    console.error('[DocxService] Error extracting text:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Nepodařilo se přečíst Word dokument');
  }
}

/**
 * Check if file is a Word document (.docx)
 */
export function isDocx(mimeType: string): boolean {
  return mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

/**
 * Check if file is an old Word format (.doc)
 * Note: .doc format is not supported by mammoth
 */
export function isDoc(mimeType: string): boolean {
  return mimeType === 'application/msword';
}
