// Shared TypeScript types mirroring the Supabase schema for the
// Alamut Compliance Dashboard.

export type Role = "admin" | "compliance" | "operations" | "finance" | "team";

export interface TeamMember {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface AuthSession {
  user: { id: number; email: string; full_name: string; role: Role } | null;
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
  next_due: string; // ISO date
  fca_refs: string[];
  owner: string | null;
  status: "upcoming" | "in_progress" | "submitted" | "overdue";
  notes: string | null;
  created_at: string;
  updated_at: string;
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

export interface DashboardStats {
  totalChapters: number;
  upcomingObligations: number;
  overdueObligations: number;
  pendingAttestations: number;
  completedAttestations: number;
  teamMembers: number;
}
