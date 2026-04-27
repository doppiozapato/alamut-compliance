// Seed / sample data used when Supabase is not configured (development) and
// also as the canonical demo content for first-time deployments.
//
// Production deployments MUST replace the seed accounts via the
// `team_members` table in Supabase (bcrypt-hashed passwords). The dev
// fallback below reads passwords from environment variables — it never
// ships hard-coded production credentials.

import type {
  TeamMember,
  ManualChapter,
  ManualSection,
  ComplianceObligation,
  Attestation,
  AttestationTemplate,
} from "../shared/schema";
import { buildSeedChaptersFromPdf, MANUAL_SOURCE } from "./manualSeed";

// ─── Team members / credentials ──────────────────────────────────────────────
//
// Two senior personnel hold admin rights:
//   • Primary superuser:  tom@alamut-im.com    (always admin)
//   • Second admin:       alice@alamut-im.com  (default; overridable via
//                         SECOND_ADMIN_EMAIL or the comma-separated
//                         ADMIN_EMAILS list)
//
// Dev-only passwords are read from env vars (e.g. ADMIN_DEV_PASSWORD). When
// running without Supabase and without env passwords set, the seed users
// have no usable password and login will fail — by design, so production
// deployments must provision real credentials in Supabase.

export interface SeedUser extends TeamMember {
  password: string | null; // dev-only plaintext (env-driven); null disables login
}

const PRIMARY_ADMIN_EMAIL = "tom@alamut-im.com";
const DEFAULT_SECOND_ADMIN_EMAIL = "alice@alamut-im.com";

function parseAdminEmails(): string[] {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const secondEnv = (process.env.SECOND_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const all = new Set<string>([PRIMARY_ADMIN_EMAIL.toLowerCase(), ...list]);
  if (secondEnv) all.add(secondEnv);
  // If no env override was supplied, fall back to the named second admin.
  if (!secondEnv && list.length === 0) {
    all.add(DEFAULT_SECOND_ADMIN_EMAIL.toLowerCase());
  }
  return Array.from(all);
}

export function isAdminEmail(email: string): boolean {
  return parseAdminEmails().includes(email.toLowerCase());
}

const ADMIN_EMAILS = parseAdminEmails();
const SECOND_ADMIN_EMAIL = ADMIN_EMAILS.find((e) => e !== PRIMARY_ADMIN_EMAIL.toLowerCase()) ?? null;
const SECOND_ADMIN_FULL_NAME =
  SECOND_ADMIN_EMAIL === DEFAULT_SECOND_ADMIN_EMAIL ? "Alice (Admin)" : "Second Admin";

const ADMIN_DEV_PASSWORD = process.env.ADMIN_DEV_PASSWORD || null;
const TEAM_DEV_PASSWORD = process.env.TEAM_DEV_PASSWORD || null;

// Boot-time diagnostic — prints once per process. Helps diagnose deployments
// where login fails because no credential source is configured for the
// (otherwise correctly listed) admin accounts. Never logs the values.
console.log(
  `[seed] admin emails: ${ADMIN_EMAILS.join(", ")} | ` +
    `ADMIN_DEV_PASSWORD set: ${!!ADMIN_DEV_PASSWORD} | ` +
    `TEAM_DEV_PASSWORD set: ${!!TEAM_DEV_PASSWORD}`,
);

export const SEED_USERS: SeedUser[] = [
  {
    id: 1,
    email: PRIMARY_ADMIN_EMAIL,
    full_name: "Tom (Superuser)",
    role: "admin",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    password: ADMIN_DEV_PASSWORD,
  },
  ...(SECOND_ADMIN_EMAIL
    ? [
        {
          id: 2,
          email: SECOND_ADMIN_EMAIL,
          full_name: SECOND_ADMIN_FULL_NAME,
          role: "admin" as const,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          password: ADMIN_DEV_PASSWORD,
        },
      ]
    : []),
  {
    id: 3,
    email: "compliance@alamut-im.com",
    full_name: "Compliance Officer",
    role: "compliance",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    password: TEAM_DEV_PASSWORD,
  },
  {
    id: 4,
    email: "operations@alamut-im.com",
    full_name: "Operations Lead",
    role: "operations",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    password: TEAM_DEV_PASSWORD,
  },
  {
    id: 5,
    email: "finance@alamut-im.com",
    full_name: "Finance Manager",
    role: "finance",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    password: TEAM_DEV_PASSWORD,
  },
  {
    id: 6,
    email: "analyst1@alamut-im.com",
    full_name: "Analyst One",
    role: "team",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    password: TEAM_DEV_PASSWORD,
  },
  {
    id: 7,
    email: "analyst2@alamut-im.com",
    full_name: "Analyst Two",
    role: "team",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    password: TEAM_DEV_PASSWORD,
  },
];

// ─── Manual chapters ─────────────────────────────────────────────────────────
//
// The real Alamut Compliance Manual (September 2025) is parsed from the PDF
// by `script/parseManualPdf.py` and persisted to `script/manualData.json`.
// We load that data at boot so the dashboard ships with the firm's actual
// chapters and sections. If the JSON is missing (e.g. fresh checkout without
// the parsed file), we fall back to the legacy scaffolding below — that path
// is not expected in production.

const parsed = buildSeedChaptersFromPdf();

export const SEED_MANUAL_SOURCE = MANUAL_SOURCE;
export const SEED_SECTIONS: ManualSection[] = parsed.sections;

const FALLBACK_CHAPTERS: ManualChapter[] = [
  {
    id: 1,
    number: "1",
    title: "Introduction & Regulatory Status",
    slug: "introduction",
    summary: "Firm overview, regulatory permissions and applicability of the manual.",
    content:
      "## 1. Introduction\n\nThis Compliance Manual sets out the policies and procedures of Alamut. It applies to all employees, contractors and senior managers.\n\n## 1.1 Regulatory status\n\nAlamut is authorised and regulated by the Financial Conduct Authority (FCA). The firm's permissions are recorded on the FCA Register.\n\n## 1.2 Scope\n\nThis manual covers the firm's investment management activities and supports compliance with the FCA Handbook (PRIN, SYSC, COBS, COLL, FUND).",
    parent_id: null,
    order_index: 1,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "Compliance Officer",
    fca_refs: ["PRIN", "SYSC", "COND"],
    tags: ["overview"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    number: "2",
    title: "Governance & Senior Management Responsibilities",
    slug: "governance",
    summary: "SMCR governance map, allocation of prescribed responsibilities, board and committees.",
    content:
      "## 2. Governance\n\nThe firm operates under the Senior Managers and Certification Regime (SMCR). The Governance Map below identifies senior managers and their prescribed responsibilities.\n\n## 2.1 Board\n\nThe Board meets quarterly and is responsible for strategy, risk appetite and oversight of the control environment.\n\n## 2.2 Committees\n\n- Risk & Compliance Committee\n- Investment Committee\n- Valuations Committee",
    parent_id: null,
    order_index: 2,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "Senior Admin",
    fca_refs: ["SYSC", "COCON", "APER", "FIT"],
    tags: ["smcr", "governance"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 3,
    number: "3",
    title: "Conduct of Business",
    slug: "conduct-of-business",
    summary: "Suitability, best execution, inducements, fair treatment of customers.",
    content:
      "## 3. Conduct of Business\n\nAll regulated activities must be carried out in accordance with the Conduct of Business Sourcebook (COBS).\n\n## 3.1 Best execution\n\nThe firm takes all sufficient steps to obtain the best possible result for clients (COBS 11.2A).\n\n## 3.2 Inducements\n\nThe firm does not accept third-party inducements for portfolio management mandates (COBS 2.3A).",
    parent_id: null,
    order_index: 3,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "Compliance Officer",
    fca_refs: ["COBS", "PRIN"],
    tags: ["conduct"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 4,
    number: "4",
    title: "Market Abuse & Personal Account Dealing",
    slug: "market-abuse",
    summary: "MAR, insider lists, restricted lists, PA dealing pre-clearance.",
    content:
      "## 4. Market Abuse\n\nAll staff must comply with the Market Abuse Regulation (MAR) and the firm's restricted list procedure.\n\n## 4.1 PA dealing\n\nPersonal account trades require pre-clearance from the Compliance Officer. See Annex A for the full PA Dealing Policy.",
    parent_id: null,
    order_index: 4,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "Compliance Officer",
    fca_refs: ["MAR", "COBS"],
    tags: ["market-abuse", "pa-dealing"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 5,
    number: "5",
    title: "Financial Crime, AML & Sanctions",
    slug: "financial-crime",
    summary: "AML risk assessment, KYC, sanctions screening, SARs.",
    content:
      "## 5. Financial Crime\n\nThe firm maintains policies and procedures designed to prevent money laundering, terrorist financing, bribery and breach of sanctions.\n\n## 5.1 KYC\n\nAll new investors are subject to risk-based customer due diligence prior to onboarding.\n\n## 5.2 Sanctions\n\nDaily screening is performed against UK, EU, US OFAC, and UN consolidated sanctions lists.",
    parent_id: null,
    order_index: 5,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "MLRO",
    fca_refs: ["FCG", "FCTR", "SYSC"],
    tags: ["aml", "sanctions"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 6,
    number: "6",
    title: "Conflicts of Interest",
    slug: "conflicts",
    summary: "Identification, recording and management of conflicts.",
    content:
      "## 6. Conflicts of Interest\n\nA conflicts register is maintained by Compliance and reviewed quarterly. Material conflicts are escalated to the Risk & Compliance Committee.",
    parent_id: null,
    order_index: 6,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "Compliance Officer",
    fca_refs: ["SYSC", "COBS"],
    tags: ["conflicts"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 7,
    number: "7",
    title: "Risk Management",
    slug: "risk-management",
    summary: "Risk appetite, ICARA, operational risk, ORSA.",
    content:
      "## 7. Risk Management\n\nThe firm operates a three-lines-of-defence model. The ICARA (Internal Capital Adequacy and Risk Assessment) is reviewed annually.",
    parent_id: null,
    order_index: 7,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "Risk Officer",
    fca_refs: ["MIFIDPRU", "SYSC"],
    tags: ["risk", "icara"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 8,
    number: "8",
    title: "Client Assets (CASS)",
    slug: "client-assets",
    summary: "CASS classification, segregation, reconciliations.",
    content:
      "## 8. Client Assets\n\nThe firm's CASS classification is reviewed annually. CASS resolution pack is maintained and tested.",
    parent_id: null,
    order_index: 8,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "CF10a / CASS Officer",
    fca_refs: ["CASS"],
    tags: ["cass"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 9,
    number: "9",
    title: "Regulatory Reporting",
    slug: "regulatory-reporting",
    summary: "RegData returns, MIFIDPRU reporting, transaction reporting, AIFMD Annex IV.",
    content:
      "## 9. Regulatory Reporting\n\nA full schedule of returns is maintained on the Compliance Calendar. Each return has a primary and secondary owner.",
    parent_id: null,
    order_index: 9,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "Compliance Officer",
    fca_refs: ["SUP", "MIFIDPRU", "FUND"],
    tags: ["reporting"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 10,
    number: "10",
    title: "Training & Competence",
    slug: "training-competence",
    summary: "Annual training plan, attestations, certification.",
    content:
      "## 10. Training & Competence\n\nAll staff complete mandatory annual training on: Code of Conduct, AML, Market Abuse, GDPR, Operational Resilience and Cyber Security.",
    parent_id: null,
    order_index: 10,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "Compliance Officer",
    fca_refs: ["TC", "COCON"],
    tags: ["training"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 11,
    number: "11",
    title: "Operational Resilience & Outsourcing",
    slug: "operational-resilience",
    summary: "Important business services, impact tolerances, outsourcing register.",
    content:
      "## 11. Operational Resilience\n\nImportant business services and impact tolerances are reviewed annually. Outsourcing arrangements are recorded in the Outsourcing Register and tested.",
    parent_id: null,
    order_index: 11,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "COO",
    fca_refs: ["SYSC", "CTPS"],
    tags: ["op-res", "outsourcing"],
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 12,
    number: "12",
    title: "Complaints, Breaches & Whistleblowing",
    slug: "complaints-breaches",
    summary: "DISP procedures, breach log, whistleblowing channels.",
    content:
      "## 12. Complaints & Breaches\n\nAll complaints and breaches are logged. Material breaches are notified to the FCA under SUP 15.3.",
    parent_id: null,
    order_index: 12,
    version: "v1.0",
    effective_date: "2026-01-01",
    owner: "Compliance Officer",
    fca_refs: ["DISP", "SUP"],
    tags: ["complaints", "breaches"],
    updated_at: "2026-01-01T00:00:00Z",
  },
];

// Prefer the parsed Alamut Compliance Manual when available; fall back to the
// scaffolding above only on a fresh checkout where the JSON has not yet been
// generated.
export const SEED_CHAPTERS: ManualChapter[] =
  parsed.chapters.length > 0 ? parsed.chapters : FALLBACK_CHAPTERS;

// ─── Compliance calendar (firm + fund obligations) ───────────────────────────

export const SEED_OBLIGATIONS: ComplianceObligation[] = [
  {
    id: 1,
    title: "MIFIDPRU Quarterly Return (MIF001-MIF003)",
    scope: "firm",
    category: "Regulatory Reporting",
    frequency: "quarterly",
    next_due: "2026-05-15",
    fca_refs: ["MIFIDPRU", "SUP"],
    owner: "Compliance Officer",
    status: "upcoming",
    notes: "Submitted via RegData. Capital, liquidity, concentration risk.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    title: "AIFMD Annex IV Reporting",
    scope: "fund",
    category: "Regulatory Reporting",
    frequency: "quarterly",
    next_due: "2026-05-30",
    fca_refs: ["FUND", "SUP"],
    owner: "Operations Lead",
    status: "upcoming",
    notes: "Per-fund Annex IV submission via FCA Connect.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 3,
    title: "ICARA Annual Review",
    scope: "firm",
    category: "Prudential",
    frequency: "annual",
    next_due: "2026-09-30",
    fca_refs: ["MIFIDPRU"],
    owner: "Risk Officer",
    status: "upcoming",
    notes: "Internal capital and risk assessment, signed off by the Board.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 4,
    title: "FCA Annual Financial Crime Report (REP-CRIM)",
    scope: "firm",
    category: "Financial Crime",
    frequency: "annual",
    next_due: "2026-12-31",
    fca_refs: ["FCG", "SUP"],
    owner: "MLRO",
    status: "upcoming",
    notes: "Submitted within 60 business days of accounting reference date.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 5,
    title: "Annual MLRO Report",
    scope: "firm",
    category: "Financial Crime",
    frequency: "annual",
    next_due: "2026-06-30",
    fca_refs: ["SYSC", "FCG"],
    owner: "MLRO",
    status: "upcoming",
    notes: "Board-approved MLRO report covering AML/CFT effectiveness.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 6,
    title: "Fund NAV Audit Sign-off",
    scope: "fund",
    category: "Audit",
    frequency: "annual",
    next_due: "2026-04-30",
    fca_refs: ["COLL", "FUND"],
    owner: "Operations Lead",
    status: "in_progress",
    notes: "Year-end audited financial statements.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: 7,
    title: "SUP 16 RMAR / RegData Half-yearly",
    scope: "firm",
    category: "Regulatory Reporting",
    frequency: "semi_annual",
    next_due: "2026-07-30",
    fca_refs: ["SUP"],
    owner: "Finance Manager",
    status: "upcoming",
    notes: "FSA001-FSA003 prudential returns where applicable.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 8,
    title: "Consumer Duty Annual Board Report",
    scope: "firm",
    category: "Conduct",
    frequency: "annual",
    next_due: "2026-07-31",
    fca_refs: ["PRIN", "COBS"],
    owner: "Senior Admin",
    status: "upcoming",
    notes: "Board assessment of consumer outcomes (where in scope).",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 9,
    title: "Operational Resilience Self-Assessment",
    scope: "firm",
    category: "Operational Resilience",
    frequency: "annual",
    next_due: "2026-03-31",
    fca_refs: ["SYSC"],
    owner: "COO",
    status: "overdue",
    notes: "Important business services, impact tolerances, mapping.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: 10,
    title: "Fund Manager Long Report (UCITS/AIF)",
    scope: "fund",
    category: "Reporting",
    frequency: "annual",
    next_due: "2026-04-30",
    fca_refs: ["COLL", "FUND"],
    owner: "Operations Lead",
    status: "in_progress",
    notes: "Investor-facing annual report and accounts.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: 11,
    title: "CASS Resolution Pack Review",
    scope: "firm",
    category: "Client Assets",
    frequency: "annual",
    next_due: "2026-11-30",
    fca_refs: ["CASS"],
    owner: "CASS Officer",
    status: "upcoming",
    notes: "Annual review/refresh of CASS RP (where applicable).",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 12,
    title: "SMCR Certification Refresh",
    scope: "firm",
    category: "Governance",
    frequency: "annual",
    next_due: "2026-10-31",
    fca_refs: ["SYSC", "FIT", "COCON"],
    owner: "Compliance Officer",
    status: "upcoming",
    notes: "Annual fit & proper certification of certified staff.",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

// ─── Attestation templates ───────────────────────────────────────────────────

export const SEED_TEMPLATES: AttestationTemplate[] = [
  { id: 1, topic: "Annual Code of Conduct", category: "Code of Conduct", description: "Confirm reading and adherence to COCON / firm Code of Conduct.", frequency: "annual", fca_refs: ["COCON", "APER"] },
  { id: 2, topic: "PA Dealing Policy", category: "Personal Account Dealing", description: "Confirm adherence to PA dealing policy and disclosure of accounts.", frequency: "annual", fca_refs: ["MAR", "COBS"] },
  { id: 3, topic: "Market Abuse Awareness", category: "Market Abuse", description: "Annual training and certification.", frequency: "annual", fca_refs: ["MAR"] },
  { id: 4, topic: "AML / Financial Crime Training", category: "Financial Crime", description: "Annual training and certification.", frequency: "annual", fca_refs: ["FCG"] },
  { id: 5, topic: "Conflicts of Interest Disclosure", category: "Conflicts", description: "Quarterly disclosure of new or changed conflicts.", frequency: "quarterly", fca_refs: ["SYSC"] },
  { id: 6, topic: "Outside Business Interests Refresh", category: "Outside Interests", description: "Annual re-confirmation of OBIs.", frequency: "annual", fca_refs: ["SYSC", "COCON"] },
  { id: 7, topic: "Information Security & Cyber", category: "Op Res", description: "Annual InfoSec / cyber awareness sign-off.", frequency: "annual", fca_refs: ["SYSC"] },
  { id: 8, topic: "Gifts & Entertainment Q-Disclosure", category: "Inducements", description: "Quarterly G&E register refresh.", frequency: "quarterly", fca_refs: ["COBS"] },
];

// Generate per-user attestations from the templates so the dashboard ships
// with realistic data on day one.
function buildSeedAttestations(): Attestation[] {
  const list: Attestation[] = [];
  let id = 1;
  const teamUsers = SEED_USERS.filter((u) => u.is_active);
  for (const user of teamUsers) {
    for (const t of SEED_TEMPLATES) {
      const due =
        t.frequency === "quarterly" ? "2026-06-30" :
        t.frequency === "monthly"   ? "2026-05-31" :
                                      "2026-12-31";
      // Mix of statuses to make the demo dashboard interesting.
      const completedSeed = (id + user.id) % 3 === 0;
      list.push({
        id: id++,
        user_id: user.id,
        topic: `${t.topic} 2026`,
        category: t.category,
        description: t.description,
        due_date: due,
        status: completedSeed ? "completed" : "pending",
        completed_at: completedSeed ? "2026-03-15T10:00:00Z" : null,
        comment: completedSeed ? "Acknowledged and adhered to." : null,
        fca_refs: t.fca_refs,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      });
    }
  }
  return list;
}

export const SEED_ATTESTATIONS: Attestation[] = buildSeedAttestations();
