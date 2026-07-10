// Position-aware text extraction shared by the browser app and the Node test harness.
// Groups pdf.js text items into visual lines (top-to-bottom, left-to-right).

export interface TextItemLike {
  str: string;
  transform: number[]; // [a, b, c, d, x, y]
}

export interface PageLines {
  lines: string[];
  raw: string;
}

const Y_TOLERANCE = 4;

export function buildLines(items: TextItemLike[]): PageLines {
  const positioned = items
    .filter((it) => it.str.trim().length > 0)
    .map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5] }));

  // Cluster into lines by y coordinate
  positioned.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; parts: { x: number; text: string }[] }[] = [];
  for (const p of positioned) {
    const line = lines.find((l) => Math.abs(l.y - p.y) <= Y_TOLERANCE);
    if (line) {
      line.parts.push({ x: p.x, text: p.text });
    } else {
      lines.push({ y: p.y, parts: [{ x: p.x, text: p.text }] });
    }
  }

  const rendered = lines.map((l) =>
    l.parts
      .sort((a, b) => a.x - b.x)
      .map((p) => p.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

  return { lines: rendered, raw: rendered.join('\n') };
}

// Browser-side loader. Extracts lines for every page of a PDF file.
// The legacy build is used deliberately: the standard pdfjs-dist v6 build
// relies on very recent JavaScript features and throws
// "undefined is not a function" on slightly older Safari.
export async function extractPdfPages(data: ArrayBuffer): Promise<PageLines[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: PageLines[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(buildLines(content.items as unknown as TextItemLike[]));
  }
  return pages;
}
