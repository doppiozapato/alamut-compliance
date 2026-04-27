// Data access layer. Wraps Supabase when configured; otherwise serves the
// in-memory seed data. The seed branch lets the dashboard run end-to-end on
// Railway/locally before Supabase is provisioned.

import { supabase, supabaseEnabled } from "./supabase";
import {
  SEED_USERS,
  SEED_CHAPTERS,
  SEED_OBLIGATIONS,
  SEED_ATTESTATIONS,
  SEED_TEMPLATES,
  SeedUser,
} from "./seedData";
import type {
  TeamMember,
  ManualChapter,
  ComplianceObligation,
  Attestation,
  AttestationTemplate,
} from "../shared/schema";

// In-memory mirrors used when Supabase is unavailable.
const memUsers: SeedUser[] = [...SEED_USERS];
const memChapters: ManualChapter[] = [...SEED_CHAPTERS];
const memObligations: ComplianceObligation[] = [...SEED_OBLIGATIONS];
const memAttestations: Attestation[] = [...SEED_ATTESTATIONS];
const memTemplates: AttestationTemplate[] = [...SEED_TEMPLATES];

function nextId<T extends { id: number }>(rows: T[]): number {
  return rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<SeedUser | null> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("team_members")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    return (data as SeedUser) ?? null;
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
  return [...memChapters].sort((a, b) => a.order_index - b.order_index);
}

export async function getChapter(slug: string): Promise<ManualChapter | null> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("manual_chapters")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return (data as ManualChapter) ?? null;
  }
  return memChapters.find((c) => c.slug === slug) ?? null;
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
