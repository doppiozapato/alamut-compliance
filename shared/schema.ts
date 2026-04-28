// Shared TypeScript types mirroring the Supabase schema for the
// Alamut Compliance Dashboard.

// `Role` keeps `operations` and `finance` as legacy values so existing
// Supabase rows continue to load and authenticate without a backfill, but
// the UI only ever offers the three permission profiles below for new or
// updated members. Legacy roles are normalised to `team`-equivalent
// permissions at session resolution time.
export type Role = "admin" | "compliance" | "operations" | "finance" | "team";

// Permission profiles offered in the Admin UI. New rows must be assigned
// one of these — `operations`/`finance` are not selectable and exist only
// for backwards compatibility with previously-seeded accounts.
export const SELECTABLE_ROLES = ["admin", "compliance", "team"] as const;
export type SelectableRole = (typeof SELECTABLE_ROLES)[number];

export function isSelectableRole(role: string): role is SelectableRole {
  return (SELECTABLE_ROLES as readonly string[]).includes(role);
}

// Maps a stored DB role (which may be a legacy `operations` or `finance`)
// to the role that should drive UI defaults and permission decisions. We
// treat legacy roles as `team` so they pick up the Team Member profile by
// default — admins can still upgrade them to compliance via the editor.
export function normaliseRoleForProfile(role: Role): SelectableRole {
  if (role === "admin" || role === "compliance" || role === "team") return role;
  return "team";
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  compliance: "Compliance",
  team: "Team Member",
  operations: "Team Member",
  finance: "Team Member",
};

// Catalogue of sidebar tabs an admin can grant or revoke. The `admin` tab
// is treated specially: only users with role === "admin" can ever see it,
// regardless of what's in their tab_permissions array.
export const TAB_KEYS = [
  "dashboard",
  "manual",
  "policies",
  "fca",
  "calendar",
  "regulatory-updates",
  "attestations",
  "admin",
] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export const TAB_LABELS: Record<TabKey, string> = {
  dashboard: "Dashboard",
  manual: "Compliance Manual",
  policies: "Policies",
  fca: "FCA Handbook",
  calendar: "Compliance Calendar",
  "regulatory-updates": "Regulatory Updates",
  attestations: "Attestations",
  admin: "Admin / Team Oversight",
};

// Default tab visibility per role. `null` permissions on a TeamMember row
// resolve to this map at session time, so legacy/seed accounts pick up the
// right portal without requiring a backfill migration.
export const DEFAULT_TAB_PERMISSIONS: Record<Role, TabKey[]> = {
  admin: [
    "dashboard",
    "manual",
    "policies",
    "fca",
    "calendar",
    "regulatory-updates",
    "attestations",
    "admin",
  ],
  compliance: [
    "dashboard",
    "manual",
    "policies",
    "fca",
    "calendar",
    "regulatory-updates",
    "attestations",
  ],
  // Legacy roles mirror `team` defaults — they are no longer selectable
  // in the UI but existing rows still resolve to a sensible portal.
  operations: ["dashboard", "manual", "attestations"],
  finance: ["dashboard", "manual", "attestations"],
  team: ["dashboard", "manual", "attestations"],
};

export function resolveTabPermissions(
  role: Role,
  stored: TabKey[] | null | undefined,
): TabKey[] {
  const base = stored && stored.length > 0 ? stored : DEFAULT_TAB_PERMISSIONS[role];
  // Admin role always retains the admin tab — the Team Oversight screen
  // would otherwise become locked out if an admin accidentally unticked it.
  if (role === "admin" && !base.includes("admin")) return [...base, "admin"];
  return base;
}

export interface TeamMember {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  // null when the row hasn't been customised — clients should fall back to
  // DEFAULT_TAB_PERMISSIONS[role] via resolveTabPermissions().
  tab_permissions?: TabKey[] | null;
}

export interface AuthSession {
  user: {
    id: number;
    email: string;
    full_name: string;
    role: Role;
    tab_permissions: TabKey[];
  } | null;
}

export interface ManualChapter {
  id: number;
  number: string; // e.g. "1", "2.1", "Appendix A"
  title: string;
  slug: string;
  summary: string | null;
  content: string; // Markdown
  parent_id: number | null;
  order_index: number;
  version: string | null;
  effective_date: string | null;
  owner: string | null;
  fca_refs: string[]; // e.g. ["SYSC", "COBS 2.1"]
  tags: string[];
  updated_at: string;
  // Provenance from PDF imports — null on manually authored chapters.
  kind?: "chapter" | "appendix";
  start_page?: number | null;
  end_page?: number | null;
  source_pdf?: string | null;
  sections?: ManualSection[];
}

export interface ManualSection {
  id?: number;
  chapter_id?: number;
  chapter_slug?: string;
  number: string; // e.g. "1.1", "16.10"
  title: string;
  slug: string;
  page: number | null;
  content: string;
  order_index: number;
}

export interface ManualSourcePdf {
  source_file: string;
  title: string;
  version: string;
  page_count: number;
  generated_at: string; // ISO timestamp of last import
}

export interface FcaModule {
  code: string; // e.g. "SYSC"
  title: string;
  category: string; // e.g. "High Level Standards"
  url: string; // canonical handbook URL
  description?: string | null;
}

export interface ComplianceObligation {
  id: number;
  title: string;
  scope: "firm" | "fund" | "both";
  category: string; // e.g. "Regulatory Reporting", "AML", "MiFID"
  frequency: "annual" | "semi_annual" | "quarterly" | "monthly" | "ad_hoc";
  next_due: string; // ISO date — date of the next upcoming filing
  fca_refs: string[];
  owner: string | null;
  status: "upcoming" | "in_progress" | "submitted" | "overdue";
  notes: string | null;
  // Last-submission metadata. After a submission is recorded these capture
  // the most recent filing (date/comment/actor) while `next_due` is rolled
  // forward to the next period — so the calendar always shows the next due
  // date, not the just-completed one.
  submission_comment: string | null;
  submitted_at: string | null;
  submitted_by: number | null;
  submitted_by_name: string | null;
  created_at: string;
  updated_at: string;
}

// Roll a YYYY-MM-DD date forward by one cycle of the obligation's
// frequency. `ad_hoc` obligations have no recurrence so the original
// due date is returned unchanged. Exported so client and server agree
// on the same arithmetic.
export function nextDueAfter(
  dueDate: string,
  frequency: ComplianceObligation["frequency"],
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!m) return dueDate;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1; // 0-based
  const day = parseInt(m[3], 10);
  const monthsToAdd: Record<ComplianceObligation["frequency"], number> = {
    monthly: 1,
    quarterly: 3,
    semi_annual: 6,
    annual: 12,
    ad_hoc: 0,
  };
  const add = monthsToAdd[frequency] ?? 0;
  if (add === 0) return dueDate;
  // Use UTC arithmetic so timezones don't shift the day.
  const target = new Date(Date.UTC(year, month + add, 1));
  // Clamp `day` to the last day of the target month (e.g. Jan 31 + 1m = Feb 28/29).
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const dom = Math.min(day, lastDay);
  const yyyy = target.getUTCFullYear().toString().padStart(4, "0");
  const mm = (target.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = dom.toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export interface Attestation {
  id: number;
  user_id: number;
  topic: string; // e.g. "Code of Conduct - Q2 2026"
  category: string; // e.g. "Annual COC", "Trade Notification", "PA Dealing"
  description: string | null;
  due_date: string;
  status: "pending" | "completed" | "overdue";
  completed_at: string | null;
  comment: string | null;
  fca_refs: string[];
  created_at: string;
  updated_at: string;
  user?: TeamMember;
}

export interface AttestationTemplate {
  id: number;
  topic: string;
  category: string;
  description: string | null;
  frequency: "annual" | "quarterly" | "monthly" | "ad_hoc";
  fca_refs: string[];
}

export interface RegulatoryUpdateLink {
  label: string;
  url: string;
}

export interface RegulatoryUpdate {
  id: number;
  quarter: string; // e.g. "Q1"
  year: number; // e.g. 2026
  quarter_label: string; // e.g. "Q1 2026"
  section: "regulatory" | "enforcement";
  date_published: string; // ISO date (YYYY-MM-DD)
  date_published_label: string | null; // e.g. "9 January 2026"
  category: string | null;
  title: string;
  body: string;
  effective_date: string | null; // ISO date when parsable
  effective_date_label: string | null; // free-text fallback
  useful_links: RegulatoryUpdateLink[];
  source_document: string | null;
  imported_at: string; // ISO timestamp
}

export interface RegulatoryUpdateQuarter {
  quarter: string;
  year: number;
  label: string;
  count: number;
  source_document: string | null;
}

// ─── Executed Firm policies ─────────────────────────────────────────────────
// Distinct from `ManualChapter` — these are standalone signed/executed firm
// policy documents (e.g. AML Policy 2025, Order Execution Policy 2025) sourced
// from PDFs uploaded to the policy library. The Compliance Manual is the
// source of policy *guidance*; these documents are the operative versions.

export interface ExecutedPolicy {
  id: number;
  slug: string;
  title: string;
  category: string;
  year: number;
  version: string | null;
  effective_date_label: string | null;
  effective_date: string | null;
  source_filename: string | null;
  page_count: number;
  summary: string | null;
  // Full extracted text. Omitted from list responses to keep payloads small;
  // populated on the detail endpoint.
  content?: string;
  review_status?: "current" | "under_review" | "archived" | null;
  imported_at: string;
  updated_at: string;
}

export interface DashboardStats {
  totalChapters: number;
  upcomingObligations: number;
  overdueObligations: number;
  pendingAttestations: number;
  completedAttestations: number;
  // null for non-admin viewers — the team portal does not surface headcount.
  teamMembers: number | null;
}
