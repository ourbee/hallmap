/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// OCR fallback for scanned PDFs. tesseract.js is heavy, so it is only loaded
// when the user explicitly asks for OCR.

export async function ocrPdfPages(
  data: ArrayBuffer,
  onProgress?: (msg: string) => void,
): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const { default: Tesseract } = await import('tesseract.js');

  const doc = await pdfjs.getDocument({ data }).promise;
  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(`Rendering page ${i} of ${doc.numPages}…`);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    onProgress?.(`Running OCR on page ${i} of ${doc.numPages}… (this can take a while)`);
    const result = await Tesseract.recognize(canvas, 'eng');
    texts.push(result.data.text);
  }
  return texts;
}

// OCR a plain image file (photo or scan of a top sheet).
export async function ocrImage(file: Blob, onProgress?: (msg: string) => void): Promise<string> {
  const { default: Tesseract } = await import('tesseract.js');
  onProgress?.('Running OCR on image… (this can take a while)');
  const result = await Tesseract.recognize(file as File, 'eng');
  return result.data.text;
}
