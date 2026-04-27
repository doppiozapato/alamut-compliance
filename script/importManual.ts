// Import the parsed Alamut Compliance Manual into Supabase.
//
// This script consumes the JSON produced by `script/parseManualPdf.py`
// (default `script/manualData.json`) and upserts:
//   * manual_chapters  — one row per chapter / appendix
//   * manual_sections  — one row per numbered section under a chapter
//
// Usage:
//   # 1. Parse the PDF (or any newer manual revision):
//   python3 script/parseManualPdf.py [./path/to/Manual.pdf] [./script/manualData.json]
//
//   # 2. Push to Supabase:
//   npx tsx script/importManual.ts                 # uses script/manualData.json
//   npx tsx script/importManual.ts ./other.json    # explicit path
//
// Environment:
//   SUPABASE_URL                — required
//   SUPABASE_SERVICE_ROLE_KEY   — preferred (bypasses RLS for upserts)
//   SUPABASE_ANON_KEY           — fallback (only works if RLS allows write)
//
// Backwards-compat: a directory argument is still accepted and treated as a
// folder of markdown files, which are upserted as chapter rows only (legacy).

import "dotenv/config";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are required.",
    );
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[importManual] using anon key; upserts will fail if RLS write is restricted. " +
        "Set SUPABASE_SERVICE_ROLE_KEY for production imports.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function importParsedJson(jsonPath: string): Promise<void> {
  const raw = await readFile(jsonPath, "utf8");
  const data = JSON.parse(raw) as ParsedManual;
  if (!data.chapters?.length) {
    console.error("Parsed manual has no chapters; aborting.");
    process.exit(1);
  }

  const sb = getClient();
  console.log(
    `[importManual] importing ${data.chapters.length} chapter(s) from ` +
      `${data.meta.source_file} (version ${data.meta.version}).`,
  );

  // 1. Upsert chapters and capture their generated IDs by slug.
  const chapterRows = data.chapters.map((c) => ({
    number: c.number,
    title: c.title,
    slug: c.slug,
    summary: c.summary || null,
    content: c.content,
    order_index: c.order_index,
    version: data.meta.version,
    effective_date: null,
    owner: null,
    fca_refs: c.fca_refs ?? [],
    tags: c.tags ?? [],
    kind: c.kind,
    start_page: c.start_page,
    end_page: c.end_page,
    source_pdf: data.meta.source_file,
    updated_at: new Date().toISOString(),
  }));

  const { data: upsertedChapters, error: chapterErr } = await sb
    .from("manual_chapters")
    .upsert(chapterRows, { onConflict: "slug" })
    .select("id, slug");
  if (chapterErr) {
    console.error("Chapter upsert failed:", chapterErr.message);
    process.exit(1);
  }
  const idBySlug = new Map<string, number>();
  for (const r of upsertedChapters ?? []) idBySlug.set(r.slug, r.id);
  console.log(`[importManual] upserted ${idBySlug.size} chapter rows.`);

  // 2. Replace sections per chapter (delete then insert) to keep ordering simple.
  let totalSections = 0;
  for (const ch of data.chapters) {
    const chapterId = idBySlug.get(ch.slug);
    if (!chapterId) continue;
    await sb.from("manual_sections").delete().eq("chapter_id", chapterId);
    if (ch.sections.length === 0) continue;
    const sectionRows = ch.sections.map((s, idx) => ({
      chapter_id: chapterId,
      number: s.number,
      title: s.title,
      slug: slugify(`${s.number}-${s.title}`),
      page: s.page ?? null,
      content: s.content || "",
      order_index: idx + 1,
      updated_at: new Date().toISOString(),
    }));
    const { error: secErr } = await sb.from("manual_sections").insert(sectionRows);
    if (secErr) {
      console.error(`Sections insert failed for ${ch.slug}:`, secErr.message);
      process.exit(1);
    }
    totalSections += sectionRows.length;
  }
  console.log(`[importManual] inserted ${totalSections} section rows.`);
  console.log("[importManual] done.");
}

// ─── Legacy markdown-folder mode (unchanged) ────────────────────────────────

interface LegacyChapterRow {
  number: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  order_index: number;
  version: string | null;
  effective_date: string | null;
  owner: string | null;
  fca_refs: string[];
  tags: string[];
}

function parseFrontmatter(rawText: string): { meta: Record<string, string>; body: string } {
  const m = rawText.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: rawText };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const [k, ...rest] = line.split(":");
    if (!k || rest.length === 0) continue;
    meta[k.trim()] = rest.join(":").trim();
  }
  return { meta, body: m[2] };
}

function deriveTitle(body: string, fallback: string): string {
  const h = body.match(/^#{1,2}\s+(.+)$/m);
  return h ? h[1].trim() : fallback;
}

async function importMarkdownDir(dir: string): Promise<void> {
  const files = (await readdir(dir))
    .filter((f) => extname(f).toLowerCase() === ".md")
    .sort();
  if (files.length === 0) {
    console.error(`No .md files found in ${dir}`);
    process.exit(1);
  }
  const sb = getClient();
  const rows: LegacyChapterRow[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const raw = await readFile(join(dir, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const stem = file.replace(/\.md$/, "");
    const m = stem.match(/^(\d+(?:[._-]\d+)?)[._\- ]+(.+)$/);
    const number = m ? m[1].replace(/_/g, ".") : String(i + 1);
    const slug = m
      ? m[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : stem.toLowerCase();
    const title = deriveTitle(body, slug);
    rows.push({
      number,
      title,
      slug,
      summary: meta.summary ?? null,
      content: body.trim(),
      order_index: i + 1,
      version: meta.version ?? null,
      effective_date: meta.effective_date ?? null,
      owner: meta.owner ?? null,
      fca_refs: (meta.fca_refs ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      tags: (meta.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    });
  }
  console.log(`[importManual:legacy] importing ${rows.length} markdown chapter(s)…`);
  const { error } = await sb.from("manual_chapters").upsert(rows, { onConflict: "slug" });
  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }
  console.log(`[importManual:legacy] done.`);
}

// ─── Entry point ────────────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2] ?? resolve(process.cwd(), "script", "manualData.json");
  let isDir = false;
  try {
    const s = await stat(arg);
    isDir = s.isDirectory();
  } catch {
    console.error(`Path not found: ${arg}`);
    process.exit(1);
  }
  if (isDir) {
    await importMarkdownDir(arg);
  } else {
    await importParsedJson(arg);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
