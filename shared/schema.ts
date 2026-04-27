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

export interface DashboardStats {
  totalChapters: number;
  upcomingObligations: number;
  overdueObligations: number;
  pendingAttestations: number;
  completedAttestations: number;
  teamMembers: number;
}
