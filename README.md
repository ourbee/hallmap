# Seating Studio

Exam seating arrangements, from top sheets to printable room sheets — built for exam-centre Officers-in-Charge.

Everything runs **locally in the browser**: PDFs are parsed on your machine, work is saved to the browser's local storage, and no data is uploaded anywhere.

## What it does

1. **Setup** — enter (or auto-fill) the exam centre profile and examination details.
2. **Rooms** — enter each room's capacity; optionally add bench data (number of benches × seats per bench). A blank CSV template can be downloaded, filled and re-uploaded.
3. **Import** — upload top-sheet PDFs. Each PDF may contain several subject sheets; each is detected separately, duplicate copies are ignored, and every extracted field is editable before use. A scanned PDF can be run through OCR as a fallback, or a sheet can be typed in manually. Optionally upload the centre allotment letter: it fills in centre details and validates roll numbers against the allotted ranges.
4. **Arrange** — sessions are grouped automatically by date + session. One click allocates all students to rooms without exceeding capacity, keeping subjects together and splitting a subject across rooms when needed. Move subject blocks between rooms, lock rooms, and regenerate. Rooms with bench data get a bench-level plan with a choice of **keep subjects together** or **mix subjects per bench** (anti-copying interleave).
5. **Export** — per-room seating sheets in editable **Word (.docx)** and print-ready **PDF**, combined or as one file per room (ZIP). Rooms with bench data get a Bench Plan annex page. Roll numbers print either in full or grouped by roll-code prefix with short serials.

## Validation built in

- top-sheet stated count vs extracted roll count
- duplicate roll numbers across sheets in a session
- top-sheet centre code vs the active centre
- roll numbers outside allotment ranges
- session total vs total room capacity
- room totals always reconciled against the session pool

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # production build in dist/
npx tsx scripts/test-parse.mts    # parser harness against sample PDFs (local paths)
npx tsx scripts/test-export.mts   # export harness (writes test PDFs/DOCX)
```

## Deployment

Static output — deploy `dist/` anywhere:

- **Vercel**: import the repo; framework preset *Vite*; build `npm run build`, output `dist`.
- **GitHub Pages**: `npm run build`, publish `dist/` (asset paths are relative, so a project subpath works).

## Stack

Vite + React + TypeScript · pdfjs-dist (PDF text extraction) · tesseract.js (lazy OCR fallback) · docx (Word export) · jsPDF (PDF export) · JSZip (per-room bundles). No backend, no API keys.
