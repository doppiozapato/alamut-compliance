// Loads parsed executed Firm policies from the JSON produced by
// `script/parseExecutedPolicies.py`. Used as the in-memory fallback when
// Supabase isn't configured, and shipped alongside the production bundle
// so the Policies tab is populated even before Supabase is provisioned.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ExecutedPolicy } from "../shared/schema";

declare const __dirname: string | undefined;
const moduleDir: string | undefined =
  typeof __dirname === "string" ? __dirname : undefined;

interface ParsedPolicy {
  title: string;
  slug: string;
  category: string;
  year: number;
  version?: string | null;
  effective_date_label?: string | null;
  effective_date?: string | null;
  source_filename?: string | null;
  page_count: number;
  summary?: string | null;
  content: string;
}

interface ParsedFile {
  meta?: { title?: string; generated_at?: string; policy_count?: number };
  policies: ParsedPolicy[];
}

function locateDataFile(): string | null {
  const candidates: string[] = [];
  if (moduleDir) {
    candidates.push(join(moduleDir, "executedPoliciesData.json"));
    candidates.push(join(moduleDir, "..", "script", "executedPoliciesData.json"));
    candidates.push(join(moduleDir, "..", "executedPoliciesData.json"));
  }
  candidates.push(join(process.cwd(), "script", "executedPoliciesData.json"));
  candidates.push(join(process.cwd(), "dist", "executedPoliciesData.json"));
  candidates.push(join(process.cwd(), "executedPoliciesData.json"));
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function loadParsed(): ParsedFile | null {
  const path = locateDataFile();
  if (!path) {
    console.warn(
      "[executedPoliciesSeed] executedPoliciesData.json not found; executed policies tab will be empty.",
    );
    return null;
  }
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as ParsedFile;
    if (!parsed || !Array.isArray(parsed.policies)) return null;
    return parsed;
  } catch (e) {
    console.warn(
      `[executedPoliciesSeed] failed to parse ${path}:`,
      (e as Error).message,
    );
    return null;
  }
}

const PARSED = loadParsed();

export function buildSeedExecutedPolicies(): ExecutedPolicy[] {
  if (!PARSED) return [];
  const importedAt = PARSED.meta?.generated_at ?? new Date().toISOString();
  return PARSED.policies.map((p, idx) => ({
    id: idx + 1,
    slug: p.slug,
    title: p.title,
    category: p.category,
    year: p.year,
    version: p.version ?? null,
    effective_date_label: p.effective_date_label ?? null,
    effective_date: p.effective_date ?? null,
    source_filename: p.source_filename ?? null,
    page_count: p.page_count,
    summary: p.summary ?? null,
    content: p.content,
    review_status: "current",
    imported_at: importedAt,
    updated_at: importedAt,
  }));
}
