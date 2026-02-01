// services/pdfService.ts
/**
 * PDF parsing service using pdf.js
 * Extracts text content from PDF files for AI analysis
 */

import * as pdfjsLib from 'pdfjs-dist';

// Set worker source from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extract text content from a PDF file
 * @param file - PDF file to extract text from
 * @returns Extracted text with page separators
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      if (pageText.trim()) {
        textParts.push(`--- Strana ${i} ---\n${pageText}`);
      }
    }

    if (textParts.length === 0) {
      throw new Error('PDF neobsahuje žádný text (možná obsahuje pouze obrázky)');
    }

    return textParts.join('\n\n');
  } catch (error) {
    console.error('[PDFService] Error extracting text:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Nepodařilo se přečíst PDF soubor');
  }
}

/**
 * Check if file is a PDF
 */
export function isPDF(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}
