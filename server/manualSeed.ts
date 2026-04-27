// Loads the parsed Alamut Compliance Manual (September 2025) from the
// JSON produced by `script/parseManualPdf.py`.
//
// The JSON file is committed to the repo under `script/manualData.json` so
// the dashboard can render the real manual without a network round-trip.
// To refresh the manual, re-run the Python parser and rebuild — the JSON is
// resolved relative to the repo root at boot time.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ManualChapter, ManualSection } from "../shared/schema";

// Resolved at module load — `__dirname` is defined in CJS (production
// bundle); in ESM (dev) we fall back to process.cwd() locations.
declare const __dirname: string | undefined;
const moduleDir: string | undefined =
  typeof __dirname === "string" ? __dirname : undefined;

interface ParsedSection {
  number: string;
  title: string;
  page: number | null;
  content: string;
}

interface ParsedChapter {
  kind: "chapter" | "appendix";
  number: string;
  title: string;
  slug: string;
  order_index: number;
  start_page: number;
  end_page: number;
  summary: string;
  content: string;
  fca_refs: string[];
  tags: string[];
  sections: ParsedSection[];
}

interface ParsedManual {
  meta: {
    title: string;
    version: string;
    page_count: number;
    source_file: string;
    generated_at: string;
  };
  chapters: ParsedChapter[];
}

function locateDataFile(): string | null {
  // Resolve the JSON across both dev (tsx, ESM) and prod (esbuild CJS bundle).
  // When bundled, __dirname is `dist/` and the build step copies the JSON
  // next to the bundle. In dev, the working directory is the repo root.
  const candidates: string[] = [];
  if (moduleDir) {
    candidates.push(join(moduleDir, "manualData.json"));
    candidates.push(join(moduleDir, "..", "script", "manualData.json"));
    candidates.push(join(moduleDir, "..", "manualData.json"));
  }
  candidates.push(join(process.cwd(), "script", "manualData.json"));
  candidates.push(join(process.cwd(), "dist", "manualData.json"));
  candidates.push(join(process.cwd(), "manualData.json"));
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function loadParsed(): ParsedManual | null {
  const path = locateDataFile();
  if (!path) {
    console.warn("[manualSeed] manualData.json not found; using legacy fallback chapters.");
    return null;
  }
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as ParsedManual;
  } catch (e) {
    console.warn(`[manualSeed] failed to parse ${path}:`, (e as Error).message);
    return null;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const PARSED = loadParsed();

export const MANUAL_SOURCE = PARSED?.meta ?? {
  title: "Alamut Compliance Manual",
  version: "September 2025",
  page_count: 0,
  source_file: "Alamut-Compliance-Manual_SEP25.pdf",
  generated_at: new Date(0).toISOString(),
};

export function buildSeedChaptersFromPdf(): {
  chapters: ManualChapter[];
  sections: ManualSection[];
} {
  if (!PARSED) return { chapters: [], sections: [] };
  const updatedAt = PARSED.meta.generated_at;
  const chapters: ManualChapter[] = [];
  const sections: ManualSection[] = [];

  for (const c of PARSED.chapters) {
    const chapterId = c.order_index;
    chapters.push({
      id: chapterId,
      number: c.number,
      title: c.title,
      slug: c.slug,
      summary: c.summary || null,
      content: c.content,
      parent_id: null,
      order_index: c.order_index,
      version: PARSED.meta.version,
      effective_date: null,
      owner: null,
      fca_refs: c.fca_refs ?? [],
      tags: c.tags ?? [],
      updated_at: updatedAt,
      kind: c.kind,
      start_page: c.start_page,
      end_page: c.end_page,
      source_pdf: PARSED.meta.source_file,
    });
    c.sections.forEach((s, idx) => {
      sections.push({
        id: chapterId * 1000 + idx + 1,
        chapter_id: chapterId,
        chapter_slug: c.slug,
        number: s.number,
        title: s.title,
        slug: slugify(`${s.number}-${s.title}`),
        page: s.page,
        content: s.content || "",
        order_index: idx + 1,
      });
    });
  }
  return { chapters, sections };
}
