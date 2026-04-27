// Loads parsed quarterly regulatory updates from JSON files committed under
// `script/regulatoryUpdates/`. Each file represents one quarter and is
// produced by `script/parseRegulatoryUpdatesDocx.py`. The dashboard uses
// these as the in-memory fallback when Supabase isn't configured.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { RegulatoryUpdate, RegulatoryUpdateLink } from "../shared/schema";

declare const __dirname: string | undefined;
const moduleDir: string | undefined =
  typeof __dirname === "string" ? __dirname : undefined;

interface ParsedUpdate {
  section: "regulatory" | "enforcement";
  date_published: string;
  date_published_label?: string | null;
  category?: string | null;
  title: string;
  body: string;
  effective_date?: string | null;
  effective_date_label?: string | null;
  useful_links?: RegulatoryUpdateLink[];
}

interface ParsedQuarter {
  quarter: string;
  year: number;
  label?: string;
  source_document?: string | null;
  imported_at?: string;
  updates: ParsedUpdate[];
}

function candidateDirs(): string[] {
  const dirs: string[] = [];
  if (moduleDir) {
    dirs.push(join(moduleDir, "regulatoryUpdates"));
    dirs.push(join(moduleDir, "..", "script", "regulatoryUpdates"));
  }
  dirs.push(join(process.cwd(), "script", "regulatoryUpdates"));
  dirs.push(join(process.cwd(), "dist", "regulatoryUpdates"));
  return dirs;
}

function locateLegacyFile(): string | null {
  // Backwards-compatible single-file location used during the initial Q1 2026
  // import before the per-quarter directory was introduced.
  const candidates: string[] = [];
  if (moduleDir) {
    candidates.push(join(moduleDir, "regulatoryUpdatesData.json"));
    candidates.push(join(moduleDir, "..", "script", "regulatoryUpdatesData.json"));
  }
  candidates.push(join(process.cwd(), "script", "regulatoryUpdatesData.json"));
  candidates.push(join(process.cwd(), "dist", "regulatoryUpdatesData.json"));
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function loadParsedQuarters(): ParsedQuarter[] {
  const found: ParsedQuarter[] = [];
  const seenDirs = new Set<string>();
  for (const dir of candidateDirs()) {
    if (seenDirs.has(dir) || !existsSync(dir)) continue;
    seenDirs.add(dir);
    for (const name of readdirSync(dir)) {
      if (!name.toLowerCase().endsWith(".json")) continue;
      try {
        const raw = readFileSync(join(dir, name), "utf8");
        const parsed = JSON.parse(raw) as ParsedQuarter;
        if (parsed && Array.isArray(parsed.updates)) found.push(parsed);
      } catch (e) {
        console.warn(
          `[regulatoryUpdatesSeed] failed to parse ${name}:`,
          (e as Error).message,
        );
      }
    }
    if (found.length > 0) break;
  }
  if (found.length === 0) {
    const legacy = locateLegacyFile();
    if (legacy) {
      try {
        const parsed = JSON.parse(readFileSync(legacy, "utf8")) as ParsedQuarter;
        if (parsed && Array.isArray(parsed.updates)) found.push(parsed);
      } catch (e) {
        console.warn(
          `[regulatoryUpdatesSeed] failed to parse legacy ${legacy}:`,
          (e as Error).message,
        );
      }
    }
  }
  return found;
}

function quarterLabel(q: ParsedQuarter): string {
  return q.label ?? `${q.quarter} ${q.year}`;
}

export function buildSeedRegulatoryUpdates(): RegulatoryUpdate[] {
  const quarters = loadParsedQuarters();
  if (quarters.length === 0) {
    console.warn(
      "[regulatoryUpdatesSeed] no regulatory updates JSON found; tab will be empty.",
    );
  }
  const rows: RegulatoryUpdate[] = [];
  let id = 1;
  for (const q of quarters) {
    const label = quarterLabel(q);
    const importedAt = q.imported_at ?? new Date().toISOString();
    for (const u of q.updates) {
      rows.push({
        id: id++,
        quarter: q.quarter,
        year: q.year,
        quarter_label: label,
        section: u.section ?? "regulatory",
        date_published: u.date_published,
        date_published_label: u.date_published_label ?? null,
        category: u.category ?? null,
        title: u.title,
        body: u.body ?? "",
        effective_date: u.effective_date ?? null,
        effective_date_label: u.effective_date_label ?? null,
        useful_links: Array.isArray(u.useful_links) ? u.useful_links : [],
        source_document: q.source_document ?? null,
        imported_at: importedAt,
      });
    }
  }
  return rows;
}
