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
  SEED_EXECUTED_POLICIES,
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
  ExecutedPolicy,
  Role,
  TabKey,
} from "../shared/schema";
import { nextDueAfter } from "../shared/schema";

// In-memory mirrors used when Supabase is unavailable.
const memUsers: SeedUser[] = [...SEED_USERS];
const memChapters: ManualChapter[] = [...SEED_CHAPTERS];
const memSections: ManualSection[] = [...SEED_SECTIONS];
const memObligations: ComplianceObligation[] = [...SEED_OBLIGATIONS];
const memAttestations: Attestation[] = [...SEED_ATTESTATIONS];
const memTemplates: AttestationTemplate[] = [...SEED_TEMPLATES];
const memRegulatoryUpdates: RegulatoryUpdate[] = [...SEED_REGULATORY_UPDATES];
const memExecutedPolicies: ExecutedPolicy[] = [...SEED_EXECUTED_POLICIES];

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

function normaliseTabPermissions(value: unknown): TabKey[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value.filter((v): v is string => typeof v === "string");
  if (cleaned.length === 0) return null;
  return cleaned as TabKey[];
}

function pickTeamMember(row: any): TeamMember {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
    tab_permissions: normaliseTabPermissions(row.tab_permissions),
  };
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("team_members")
      .select("id, email, full_name, role, is_active, created_at, tab_permissions")
      .order("id");
    return ((data as any[]) ?? []).map(pickTeamMember);
  }
  return memUsers.map(({ password: _p, password_hash: _h, ...u }: any) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    is_active: u.is_active,
    created_at: u.created_at,
    tab_permissions: normaliseTabPermissions(u.tab_permissions),
  }));
}

export async function getTeamMember(id: number): Promise<TeamMember | null> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("team_members")
      .select("id, email, full_name, role, is_active, created_at, tab_permissions")
      .eq("id", id)
      .maybeSingle();
    return data ? pickTeamMember(data) : null;
  }
  const row = memUsers.find((u) => u.id === id);
  if (!row) return null;
  const { password: _p, password_hash: _h, ...rest } = row as any;
  return {
    id: rest.id,
    email: rest.email,
    full_name: rest.full_name,
    role: rest.role,
    is_active: rest.is_active,
    created_at: rest.created_at,
    tab_permissions: normaliseTabPermissions(rest.tab_permissions),
  };
}

export async function createTeamMember(input: {
  email: string;
  full_name: string;
  role: Role;
  password_hash: string;
  tab_permissions: TabKey[] | null;
  is_active?: boolean;
}): Promise<TeamMember> {
  const email = input.email.trim().toLowerCase();
  const payload = {
    email,
    full_name: input.full_name.trim(),
    role: input.role,
    password_hash: input.password_hash,
    tab_permissions: input.tab_permissions,
    is_active: input.is_active ?? true,
  };
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("team_members")
      .insert(payload)
      .select("id, email, full_name, role, is_active, created_at, tab_permissions")
      .single();
    if (error) throw new Error(error.message);
    return pickTeamMember(data);
  }
  if (memUsers.some((u) => u.email.toLowerCase() === email)) {
    throw new Error("A user with that email already exists");
  }
  const row: SeedUser & { password_hash?: string | null; tab_permissions?: TabKey[] | null } = {
    id: nextId(memUsers as any),
    email,
    full_name: payload.full_name,
    role: payload.role,
    is_active: payload.is_active,
    created_at: new Date().toISOString(),
    password: null,
    password_hash: payload.password_hash,
    tab_permissions: payload.tab_permissions,
  } as any;
  memUsers.push(row);
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
    tab_permissions: payload.tab_permissions,
  };
}

export async function updateTeamMember(
  id: number,
  patch: Partial<{
    email: string;
    full_name: string;
    role: Role;
    is_active: boolean;
    tab_permissions: TabKey[] | null;
  }>,
): Promise<TeamMember | null> {
  // Normalise email patches consistently with createTeamMember and login.
  const normalised: typeof patch = { ...patch };
  if (normalised.email !== undefined) {
    normalised.email = normalised.email.trim().toLowerCase();
  }
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("team_members")
      .update(normalised)
      .eq("id", id)
      .select("id, email, full_name, role, is_active, created_at, tab_permissions")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? pickTeamMember(data) : null;
  }
  const idx = memUsers.findIndex((u) => u.id === id);
  if (idx < 0) return null;
  const row: any = memUsers[idx];
  if (normalised.email !== undefined) row.email = normalised.email;
  if (normalised.full_name !== undefined) row.full_name = normalised.full_name;
  if (normalised.role !== undefined) row.role = normalised.role;
  if (normalised.is_active !== undefined) row.is_active = normalised.is_active;
  if (normalised.tab_permissions !== undefined) row.tab_permissions = normalised.tab_permissions;
  memUsers[idx] = row;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
    tab_permissions: normaliseTabPermissions(row.tab_permissions),
  };
}

export async function setTeamMemberPasswordHash(
  id: number,
  passwordHash: string,
): Promise<boolean> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("team_members")
      .update({ password_hash: passwordHash })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return !!data;
  }
  const idx = memUsers.findIndex((u) => u.id === id);
  if (idx < 0) return false;
  (memUsers[idx] as any).password_hash = passwordHash;
  return true;
}

export async function emailExists(email: string, excludeId?: number): Promise<boolean> {
  const normalised = email.trim().toLowerCase();
  if (supabaseEnabled && supabase) {
    let q = supabase.from("team_members").select("id").eq("email", normalised);
    if (excludeId != null) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    return !!data;
  }
  return memUsers.some(
    (u) => u.email.toLowerCase() === normalised && (excludeId == null || u.id !== excludeId),
  );
}

// ─── Manual chapters ─────────────────────────────────────────────────────────

// Parse a chapter "number" string (e.g. "1", "2.1", "Appendix A") into a
// sortable tuple so chapters with the same order_index — or chapters whose
// order_index was not populated by the importer — still surface in the
// expected reading order.
function chapterSortKey(c: { number: string; order_index?: number | null; kind?: string }): [number, number, string] {
  const order = c.order_index ?? 0;
  const m = (c.number ?? "").match(/^(\d+)/);
  const numeric = m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  return [order || numeric, numeric, c.number ?? ""];
}

// The Supabase response can in principle return rows with NULL on text[]
// columns (e.g. if the column was added later without a default backfill).
// Normalising here means the UI never has to guard against `c.fca_refs.map`
// throwing and the response shape is stable across seed/Supabase modes.
function normaliseChapter(c: any): ManualChapter {
  return {
    ...c,
    // Some legacy/imported rows may carry alternate field names — accept
    // those as fallbacks so a Supabase row with `chapter_number`/`sort_order`
    // (should one ever appear) still maps cleanly to the expected shape.
    number: c.number ?? c.chapter_number ?? "",
    order_index: c.order_index ?? c.sort_order ?? 0,
    fca_refs: Array.isArray(c.fca_refs) ? c.fca_refs : [],
    tags: Array.isArray(c.tags) ? c.tags : [],
    kind: c.kind ?? "chapter",
  };
}

export async function listChapters(): Promise<ManualChapter[]> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("manual_chapters")
      .select(
        "id, number, title, slug, summary, parent_id, order_index, version, effective_date, owner, fca_refs, tags, updated_at, kind, start_page, end_page, source_pdf",
      )
      .order("order_index", { ascending: true });
    if (error) {
      console.warn(`[store] manual_chapters query failed: ${error.message}`);
      return [];
    }
    const rows = (data ?? []).map(normaliseChapter);
    // `content` is intentionally omitted from the list view — clients fetch
    // one chapter at a time via getChapter(slug) when they need full text.
    return rows
      .map((r) => ({ ...r, content: "" }))
      .sort((a, b) => {
        const ka = chapterSortKey(a);
        const kb = chapterSortKey(b);
        if (ka[0] !== kb[0]) return ka[0] - kb[0];
        if (ka[1] !== kb[1]) return ka[1] - kb[1];
        return ka[2].localeCompare(kb[2]);
      });
  }
  return [...memChapters]
    .map(normaliseChapter)
    .sort((a, b) => {
      const ka = chapterSortKey(a);
      const kb = chapterSortKey(b);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      if (ka[1] !== kb[1]) return ka[1] - kb[1];
      return ka[2].localeCompare(kb[2]);
    })
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
    const chapter = normaliseChapter(data);
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
    ...normaliseChapter(chapter),
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

// Defaults for the submission columns added in 0004_obligation_submission.sql.
// A Supabase row from a deployment that has not yet applied that migration
// will not carry these keys, so always normalise to a stable shape.
function normaliseObligation(o: any): ComplianceObligation {
  return {
    ...o,
    submission_comment: o.submission_comment ?? null,
    submitted_at: o.submitted_at ?? null,
    submitted_by: o.submitted_by ?? null,
    submitted_by_name: o.submitted_by_name ?? null,
  } as ComplianceObligation;
}

export async function listObligations(): Promise<ComplianceObligation[]> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("compliance_obligations")
      .select("*")
      .order("next_due");
    return ((data as any[]) ?? []).map(normaliseObligation);
  }
  return [...memObligations]
    .sort((a, b) => a.next_due.localeCompare(b.next_due))
    .map(normaliseObligation);
}

export async function updateObligation(id: number, patch: Partial<ComplianceObligation>): Promise<ComplianceObligation | null> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("compliance_obligations")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) {
      console.error(
        `[obligations] update id=${id} failed:`,
        error.code ?? "",
        error.message ?? error,
      );
      return null;
    }
    if (!data) {
      console.error(
        `[obligations] update id=${id} affected 0 rows — check RLS policies on public.compliance_obligations or that the row exists.`,
      );
      return null;
    }
    return normaliseObligation(data);
  }
  const idx = memObligations.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  memObligations[idx] = { ...memObligations[idx], ...patch, updated_at: new Date().toISOString() };
  return normaliseObligation(memObligations[idx]);
}

// Fetches a single obligation by id without going through listObligations().
// Used by submitObligation so a bigint/string id mismatch from PostgREST
// can't silently break the lookup the way `Array.find(o => o.id === id)`
// does on strict equality. Returns null if Supabase reports an error or
// no row.
export async function getObligation(id: number): Promise<ComplianceObligation | null> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("compliance_obligations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error(
        `[obligations] fetch id=${id} failed:`,
        error.code ?? "",
        error.message ?? error,
      );
      return null;
    }
    if (!data) return null;
    return normaliseObligation(data);
  }
  const row = memObligations.find((o) => Number(o.id) === Number(id));
  return row ? normaliseObligation(row) : null;
}

// Records a submission against an obligation. When `submitted` is true the
// last-submission metadata (who/when/comment) is captured and the calendar
// rolls `next_due` forward by one period of the obligation's frequency, so
// the next upcoming filing stays visible. `ad_hoc` obligations don't have
// a natural recurrence so we keep the existing `next_due` and mark them
// as submitted. When `submitted` is false the action acts as an "undo" —
// last-submission metadata is cleared but `next_due` is intentionally not
// rewound (we have no way of knowing the prior cycle's date once advanced).
export async function submitObligation(
  id: number,
  opts: {
    submitted: boolean;
    comment: string | null;
    user: { id: number; full_name: string };
  },
): Promise<ComplianceObligation | null> {
  const now = new Date().toISOString();
  if (!opts.submitted) {
    return updateObligation(id, {
      status: "in_progress",
      submission_comment: opts.comment,
      submitted_at: null,
      submitted_by: null,
      submitted_by_name: null,
    });
  }
  // Need the current row to know the frequency + current next_due.
  const current = await getObligation(id);
  if (!current) {
    console.error(
      `[obligations] submit id=${id} aborted: row not found (or update would be blocked by RLS).`,
    );
    return null;
  }
  const advanced = nextDueAfter(current.next_due, current.frequency);
  const isAdHoc = current.frequency === "ad_hoc";
  return updateObligation(id, {
    // Ad-hoc has no recurrence, so leave it flagged as submitted; recurring
    // obligations roll over to `upcoming` for the next period.
    status: isAdHoc ? "submitted" : "upcoming",
    submission_comment: opts.comment,
    submitted_at: now,
    submitted_by: opts.user.id,
    submitted_by_name: opts.user.full_name,
    next_due: advanced,
  });
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

// ─── Executed Firm policies ──────────────────────────────────────────────────

function normaliseExecutedPolicy(p: any): ExecutedPolicy {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    category: p.category,
    year: p.year,
    version: p.version ?? null,
    effective_date_label: p.effective_date_label ?? null,
    effective_date: p.effective_date ?? null,
    source_filename: p.source_filename ?? null,
    page_count: p.page_count ?? 0,
    summary: p.summary ?? null,
    content: p.content ?? "",
    review_status: p.review_status ?? "current",
    imported_at: p.imported_at ?? new Date(0).toISOString(),
    updated_at: p.updated_at ?? p.imported_at ?? new Date(0).toISOString(),
  };
}

export async function listExecutedPolicies(): Promise<ExecutedPolicy[]> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("executed_policies")
      .select(
        "id, slug, title, category, year, version, effective_date, effective_date_label, source_filename, page_count, summary, review_status, imported_at, updated_at",
      )
      .order("title");
    if (error) {
      console.warn(`[store] executed_policies query failed: ${error.message}`);
      return [];
    }
    return (data ?? []).map(normaliseExecutedPolicy).map((p) => ({ ...p, content: "" }));
  }
  return memExecutedPolicies
    .map(normaliseExecutedPolicy)
    .map((p) => ({ ...p, content: "" }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getExecutedPolicy(slug: string): Promise<ExecutedPolicy | null> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("executed_policies")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    return normaliseExecutedPolicy(data);
  }
  const found = memExecutedPolicies.find((p) => p.slug === slug);
  return found ? normaliseExecutedPolicy(found) : null;
}
