// Import the Firm Compliance Manual from a directory of markdown files into
// Supabase. Each file becomes a chapter; the first H1/H2 is the title.
//
// Usage:
//   npx tsx script/importManual.ts ./manual/
//
// Conventions:
//   * Directory listing order is preserved as `order_index`.
//   * The filename `01-introduction.md` maps to `number = "01"` and
//     `slug = "introduction"`.
//   * Optional YAML-ish front matter at the top of the file is parsed:
//       ---
//       fca_refs: SYSC, COBS 2.1
//       owner: Compliance Officer
//       version: v1.0
//       effective_date: 2026-01-01
//       ---

import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

interface ChapterRow {
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

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
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

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Usage: tsx script/importManual.ts <dir>");
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL and a key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY) are required.");
    process.exit(1);
  }
  const sb = createClient(url, key);

  const files = (await readdir(dir))
    .filter((f) => extname(f).toLowerCase() === ".md")
    .sort();

  if (files.length === 0) {
    console.error(`No .md files found in ${dir}`);
    process.exit(1);
  }

  const rows: ChapterRow[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const raw = await readFile(join(dir, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const stem = file.replace(/\.md$/, "");
    const m = stem.match(/^(\d+(?:[._-]\d+)?)[._\- ]+(.+)$/);
    const number = m ? m[1].replace(/_/g, ".") : String(i + 1);
    const slug = m ? m[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : stem.toLowerCase();
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

  console.log(`Importing ${rows.length} chapter(s)…`);
  const { error } = await sb.from("manual_chapters").upsert(rows, { onConflict: "slug" });
  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }
  console.log(`Imported ${rows.length} chapters successfully.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
