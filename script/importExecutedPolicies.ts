// Import parsed executed Firm policies into Supabase.
//
// Consumes the JSON produced by `script/parseExecutedPolicies.py`
// (default `script/executedPoliciesData.json`) and upserts one row per
// policy into `public.executed_policies`.
//
// Usage:
//   # 1. Parse the source PDFs (writes script/executedPoliciesData.json):
//   python3 script/parseExecutedPolicies.py /path/to/executed_policies_dir
//
//   # 2. Push to Supabase:
//   SUPABASE_SERVICE_ROLE_KEY=... npx tsx script/importExecutedPolicies.ts
//
// Environment:
//   SUPABASE_URL                — required
//   SUPABASE_SERVICE_ROLE_KEY   — preferred (bypasses RLS for upserts)
//   SUPABASE_ANON_KEY           — fallback (only works if RLS allows write)

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface ParsedPolicy {
  title: string;
  slug: string;
  category: string;
  year: number;
  version?: string | null;
  effective_date?: string | null;
  effective_date_label?: string | null;
  source_filename?: string | null;
  page_count: number;
  summary?: string | null;
  content: string;
}

interface ParsedFile {
  meta?: { generated_at?: string };
  policies: ParsedPolicy[];
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

async function main() {
  const target = process.argv[2] ?? "script/executedPoliciesData.json";
  const abs = resolve(target);
  const raw = await readFile(abs, "utf8");
  const parsed = JSON.parse(raw) as ParsedFile;
  if (!parsed.policies || !Array.isArray(parsed.policies)) {
    throw new Error(`No policies[] in ${abs}`);
  }

  const importedAt = parsed.meta?.generated_at ?? new Date().toISOString();
  const rows = parsed.policies.map((p) => ({
    slug: p.slug,
    title: p.title,
    category: p.category,
    year: p.year,
    version: p.version ?? null,
    effective_date: p.effective_date ?? null,
    effective_date_label: p.effective_date_label ?? null,
    source_filename: p.source_filename ?? null,
    page_count: p.page_count ?? 0,
    summary: p.summary ?? null,
    content: p.content ?? "",
    review_status: "current",
    imported_at: importedAt,
    updated_at: new Date().toISOString(),
  }));

  const client = getClient();
  const { error } = await client
    .from("executed_policies")
    .upsert(rows, { onConflict: "slug" });
  if (error) throw new Error(`upsert failed: ${error.message}`);

  console.log(
    `[ok] upserted ${rows.length} executed policies from ${abs} into Supabase.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
