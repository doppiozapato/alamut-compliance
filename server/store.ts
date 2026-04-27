// Data access layer. Wraps Supabase when configured; otherwise serves the
// in-memory seed data. The seed branch lets the dashboard run end-to-end on
// Railway/locally before Supabase is provisioned.

import { supabase, supabaseEnabled } from "./supabase";
import {
  SEED_USERS,
  SEED_CHAPTERS,
  SEED_SECTIONS,
  SEED_OBLIGATIONS,
  SEED_ATTESTATIONS,
  SEED_TEMPLATES,
  SEED_REGULATORY_UPDATES,
  SeedUser,
} from "./seedData";
import type {
  TeamMember,
  ManualChapter,
  ManualSection,
  ComplianceObligation,
  Attestation,
  AttestationTemplate,
  RegulatoryUpdate,
  RegulatoryUpdateQuarter,
} from "../shared/schema";

// In-memory mirrors used when Supabase is unavailable.
const memUsers: SeedUser[] = [...SEED_USERS];
const memChapters: ManualChapter[] = [...SEED_CHAPTERS];
const memSections: ManualSection[] = [...SEED_SECTIONS];
const memObligations: ComplianceObligation[] = [...SEED_OBLIGATIONS];
const memAttestations: Attestation[] = [...SEED_ATTESTATIONS];
const memTemplates: AttestationTemplate[] = [...SEED_TEMPLATES];
const memRegulatoryUpdates: RegulatoryUpdate[] = [...SEED_REGULATORY_UPDATES];

function nextId<T extends { id: number }>(rows: T[]): number {
  return rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
}

// ─── Users ───────────────────────────────────────────────────────────────────

// Role-based env password fallback. Mirrors the seed-mode behaviour so a
// Supabase-backed deployment with a NULL `password_hash` can still log in via
// ADMIN_DEV_PASSWORD / TEAM_DEV_PASSWORD until real bcrypt hashes are
// provisioned. Read fresh on every call so Railway env changes apply without
// a process restart.
function envPasswordForRole(role: string | null | undefined): string | null {
  const adminPw = process.env.ADMIN_DEV_PASSWORD || null;
  const teamPw = process.env.TEAM_DEV_PASSWORD || null;
  return role === "admin" || role === "compliance" ? adminPw : teamPw;
}

export async function findUserByEmail(email: string): Promise<SeedUser | null> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("team_members")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (!data) return null;
    const row = data as SeedUser & { password_hash?: string | null };
    // Supabase rows do not carry a `password` plaintext column. Provide one
    // from the role-based env fallback so the auth handler can apply the same
    // login path as seed mode when `password_hash` is NULL.
    return { ...row, password: envPasswordForRole(row.role) };
  }
  return memUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("team_members")
      .select("id, email, full_name, role, is_active, created_at")
      .order("id");
    return (data as TeamMember[]) ?? [];
  }
  return memUsers.map(({ password: _p, ...u }) => u);
}

// ─── Manual chapters ─────────────────────────────────────────────────────────

export async function listChapters(): Promise<ManualChapter[]> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("manual_chapters")
      .select("*")
      .order("order_index");
    return (data as ManualChapter[]) ?? [];
  }
  // Strip heavy `content` from the list view — clients fetch one chapter at a
  // time via getChapter(slug) when they need full text.
  return [...memChapters]
    .sort((a, b) => a.order_index - b.order_index)
    .map((c) => ({ ...c, content: "" }));
}

export async function getChapter(slug: string): Promise<ManualChapter | null> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("manual_chapters")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    const chapter = data as ManualChapter;
    const { data: secs } = await supabase
      .from("manual_sections")
      .select("*")
      .eq("chapter_id", chapter.id)
      .order("order_index");
    chapter.sections = (secs as ManualSection[]) ?? [];
    return chapter;
  }
  const chapter = memChapters.find((c) => c.slug === slug);
  if (!chapter) return null;
  return {
    ...chapter,
    sections: memSections
      .filter((s) => s.chapter_id === chapter.id)
      .sort((a, b) => a.order_index - b.order_index),
  };
}

export async function listSectionsForChapter(slug: string): Promise<ManualSection[]> {
  const chapter = await getChapter(slug);
  return chapter?.sections ?? [];
}

export async function upsertChapter(c: Partial<ManualChapter> & { slug: string; title: string; content: string; number: string }): Promise<ManualChapter> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("manual_chapters")
      .upsert(c, { onConflict: "slug" })
      .select()
      .single();
    if (error) throw error;
    return data as ManualChapter;
  }
  const existing = memChapters.findIndex((x) => x.slug === c.slug);
  const now = new Date().toISOString();
  if (existing >= 0) {
    memChapters[existing] = { ...memChapters[existing], ...c, updated_at: now } as ManualChapter;
    return memChapters[existing];
  }
  const created: ManualChapter = {
    id: nextId(memChapters),
    parent_id: null,
    order_index: memChapters.length + 1,
    summary: null,
    version: null,
    effective_date: null,
    owner: null,
    fca_refs: [],
    tags: [],
    updated_at: now,
    ...c,
  } as ManualChapter;
  memChapters.push(created);
  return created;
}

// ─── Obligations / calendar ──────────────────────────────────────────────────

export async function listObligations(): Promise<ComplianceObligation[]> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("compliance_obligations")
      .select("*")
      .order("next_due");
    return (data as ComplianceObligation[]) ?? [];
  }
  return [...memObligations].sort((a, b) => a.next_due.localeCompare(b.next_due));
}

export async function updateObligation(id: number, patch: Partial<ComplianceObligation>): Promise<ComplianceObligation | null> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("compliance_obligations")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return null;
    return data as ComplianceObligation;
  }
  const idx = memObligations.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  memObligations[idx] = { ...memObligations[idx], ...patch, updated_at: new Date().toISOString() };
  return memObligations[idx];
}

// ─── Attestations ────────────────────────────────────────────────────────────

export async function listAttestations(opts: { user_id?: number } = {}): Promise<Attestation[]> {
  if (supabaseEnabled && supabase) {
    let q = supabase
      .from("attestations")
      .select("*, user:team_members(id, email, full_name, role, is_active, created_at)")
      .order("due_date");
    if (opts.user_id) q = q.eq("user_id", opts.user_id);
    const { data } = await q;
    return (data as Attestation[]) ?? [];
  }
  const users = await listTeamMembers();
  const usersById = new Map(users.map((u) => [u.id, u]));
  let rows = memAttestations.map((a) => ({ ...a, user: usersById.get(a.user_id) }));
  if (opts.user_id) rows = rows.filter((a) => a.user_id === opts.user_id);
  return rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export async function completeAttestation(id: number, userId: number, comment: string | null): Promise<Attestation | null> {
  const now = new Date().toISOString();
  const patch = {
    status: "completed" as const,
    completed_at: now,
    comment,
    updated_at: now,
  };
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("attestations")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) return null;
    return data as Attestation;
  }
  const idx = memAttestations.findIndex((a) => a.id === id && a.user_id === userId);
  if (idx < 0) return null;
  memAttestations[idx] = { ...memAttestations[idx], ...patch };
  return memAttestations[idx];
}

export async function listAttestationTemplates(): Promise<AttestationTemplate[]> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase.from("attestation_templates").select("*").order("id");
    return (data as AttestationTemplate[]) ?? [];
  }
  return memTemplates;
}

// ─── Regulatory updates ──────────────────────────────────────────────────────

function decorateUpdates(rows: RegulatoryUpdate[]): RegulatoryUpdate[] {
  // Newest quarter first; within a quarter, newest dates first; regulatory
  // entries before enforcement entries (a stable secondary key).
  return [...rows].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.quarter !== b.quarter) return b.quarter.localeCompare(a.quarter);
    if (a.section !== b.section) return a.section === "regulatory" ? -1 : 1;
    return b.date_published.localeCompare(a.date_published);
  });
}

export async function listRegulatoryUpdates(opts: {
  quarter?: string;
  year?: number;
  section?: "regulatory" | "enforcement";
} = {}): Promise<RegulatoryUpdate[]> {
  if (supabaseEnabled && supabase) {
    let q = supabase.from("regulatory_updates").select("*");
    if (opts.year != null) q = q.eq("year", opts.year);
    if (opts.quarter) q = q.eq("quarter", opts.quarter);
    if (opts.section) q = q.eq("section", opts.section);
    const { data, error } = await q
      .order("year", { ascending: false })
      .order("quarter", { ascending: false })
      .order("date_published", { ascending: false });
    if (error) {
      console.warn(`[store] regulatory_updates query failed: ${error.message}`);
      return [];
    }
    const rows = (data ?? []).map((r: any) => ({
      ...r,
      quarter_label: `${r.quarter} ${r.year}`,
      useful_links: Array.isArray(r.useful_links) ? r.useful_links : [],
    })) as RegulatoryUpdate[];
    return decorateUpdates(rows);
  }
  let rows = memRegulatoryUpdates;
  if (opts.year != null) rows = rows.filter((r) => r.year === opts.year);
  if (opts.quarter) rows = rows.filter((r) => r.quarter === opts.quarter);
  if (opts.section) rows = rows.filter((r) => r.section === opts.section);
  return decorateUpdates(rows);
}

export async function listRegulatoryQuarters(): Promise<RegulatoryUpdateQuarter[]> {
  const rows = await listRegulatoryUpdates();
  const map = new Map<string, RegulatoryUpdateQuarter>();
  for (const r of rows) {
    const key = `${r.year}-${r.quarter}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        quarter: r.quarter,
        year: r.year,
        label: r.quarter_label || `${r.quarter} ${r.year}`,
        count: 1,
        source_document: r.source_document ?? null,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.quarter.localeCompare(a.quarter);
  });
}
