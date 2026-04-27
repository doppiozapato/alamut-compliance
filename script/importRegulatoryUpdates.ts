// Import quarterly Alamut Regulatory Updates into Supabase.
//
// Consumes the JSON files produced by `script/parseRegulatoryUpdatesDocx.py`
// (default `script/regulatoryUpdates/*.json`) and upserts one row per update
// into `public.regulatory_updates`.
//
// Usage:
//   # 1. Parse a quarterly DOCX (writes script/regulatoryUpdates/<Q>-<YYYY>.json):
//   python3 script/parseRegulatoryUpdatesDocx.py \
//       /path/to/Alamut-Q2-2026-Regulatory-Updates.docx
//
//   # 2. Push every quarter under script/regulatoryUpdates/ to Supabase:
//   SUPABASE_SERVICE_ROLE_KEY=... npx tsx script/importRegulatoryUpdates.ts
//
//   # Or push a single file:
//   SUPABASE_SERVICE_ROLE_KEY=... npx tsx script/importRegulatoryUpdates.ts \
//       script/regulatoryUpdates/Q1-2026.json
//
// Environment:
//   SUPABASE_URL                — required
//   SUPABASE_SERVICE_ROLE_KEY   — preferred (bypasses RLS for upserts)
//   SUPABASE_ANON_KEY           — fallback (only works if RLS allows write)

import "dotenv/config";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface ParsedUpdate {
  section: "regulatory" | "enforcement";
  date_published: string;
  date_published_label?: string | null;
  category?: string | null;
  title: string;
  body: string;
  effective_date?: string | null;
  effective_date_label?: string | null;
  useful_links?: { label: string; url: string }[];
}

interface ParsedQuarter {
  quarter: string;
  year: number;
  label?: string;
  source_document?: string | null;
  imported_at?: string;
  updates: ParsedUpdate[];
}

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY env vars.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadQuarterFiles(target: string): Promise<string[]> {
  const abs = resolve(target);
  const s = await stat(abs);
  if (s.isDirectory()) {
    const names = await readdir(abs);
    return names
      .filter((n) => extname(n).toLowerCase() === ".json")
      .map((n) => join(abs, n));
  }
  return [abs];
}

async function importQuarter(
  client: SupabaseClient,
  filePath: string,
): Promise<number> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as ParsedQuarter;
  if (!parsed.updates || !Array.isArray(parsed.updates)) {
    console.warn(`[skip] ${filePath} has no updates[]`);
    return 0;
  }
  const importedAt = parsed.imported_at ?? new Date().toISOString();
  const rows = parsed.updates.map((u) => ({
    quarter: parsed.quarter,
    year: parsed.year,
    section: u.section ?? "regulatory",
    date_published: u.date_published,
    date_published_label: u.date_published_label ?? null,
    category: u.category ?? null,
    title: u.title,
    body: u.body ?? "",
    effective_date: u.effective_date ?? null,
    effective_date_label: u.effective_date_label ?? null,
    useful_links: Array.isArray(u.useful_links) ? u.useful_links : [],
    source_document: parsed.source_document ?? null,
    imported_at: importedAt,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client.from("regulatory_updates").upsert(rows, {
    onConflict: "year,quarter,section,date_published,title",
  });
  if (error) {
    throw new Error(`upsert failed for ${filePath}: ${error.message}`);
  }
  console.log(
    `[ok] ${filePath} → ${rows.length} updates (${parsed.quarter} ${parsed.year})`,
  );
  return rows.length;
}

async function main() {
  const target = process.argv[2] ?? "script/regulatoryUpdates";
  const files = await loadQuarterFiles(target);
  if (files.length === 0) {
    console.warn(`No JSON files found at ${target}`);
    return;
  }
  const client = getClient();
  let total = 0;
  for (const f of files) {
    total += await importQuarter(client, f);
  }
  console.log(`\nDone — upserted ${total} regulatory updates from ${files.length} quarter file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
