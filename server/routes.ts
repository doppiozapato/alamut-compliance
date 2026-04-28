import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import {
  findUserByEmail,
  listTeamMembers,
  listChapters,
  getChapter,
  upsertChapter,
  listSectionsForChapter,
  listObligations,
  updateObligation,
  submitObligation,
  listAttestations,
  completeAttestation,
  listAttestationTemplates,
  listRegulatoryUpdates,
  listRegulatoryQuarters,
  listExecutedPolicies,
  getExecutedPolicy,
} from "./store";
import { supabaseEnabled } from "./supabase";
import { FCA_MODULES, FCA_CATEGORIES } from "./fcaHandbook";
import { SEED_MANUAL_SOURCE } from "./seedData";
import type { Role } from "../shared/schema";

declare module "express-session" {
  interface SessionData {
    user?: { id: number; email: string; full_name: string; role: Role };
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// Normalises a login identifier to a full email address. The firm uses
// `@alamut-im.com` for every account, and users sometimes type the
// shorthand local-part (`tom@alamut-im`, or even bare `tom`). We add the
// `.com` TLD when the host is `alamut-im` with no TLD, and append the full
// domain when the input has no `@` at all. Anything else (a different
// domain, a malformed string) is returned untouched so the lookup will
// fail rather than silently auth-bind to the wrong row.
const ALAMUT_DOMAIN = "alamut-im.com";
function normaliseLoginEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return trimmed;
  if (!trimmed.includes("@")) return `${trimmed}@${ALAMUT_DOMAIN}`;
  const [local, host] = trimmed.split("@");
  if (host === "alamut-im") return `${local}@${ALAMUT_DOMAIN}`;
  return trimmed;
}

export async function registerRoutes(app: Express) {
  // ─── Health ───────────────────────────────────────────────────────────────
  // Unauthenticated liveness probe used by Railway's healthcheck. Exposes
  // the build commit/time so we can confirm in the browser whether a
  // redeploy actually shipped a new bundle.
  const BUILD_COMMIT =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT ||
    process.env.SOURCE_VERSION ||
    "unknown";
  const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "alamut-compliance",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      build: { commit: BUILD_COMMIT, time: BUILD_TIME },
    });
  });

  app.get("/api/version", (_req, res) => {
    res.status(200).json({ commit: BUILD_COMMIT, time: BUILD_TIME });
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  app.post("/api/auth/login", async (req, res) => {
    const { email: rawEmail, password } = req.body as { email?: string; password?: string };
    if (!rawEmail || !password) return res.status(400).json({ error: "email and password required" });

    const email = normaliseLoginEmail(rawEmail);

    const user = await findUserByEmail(email);
    if (!user || !user.is_active) {
      console.warn(
        `[auth] login rejected for ${email} (raw="${rawEmail}"): no active user found (supabaseEnabled=${supabaseEnabled})`,
      );
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Login resolution order:
    //   1. If `team_members.password_hash` is set, verify against it. A
    //      bcrypt-shaped hash ($2a$/$2b$/$2y$) is checked with bcrypt.compare;
    //      anything else is treated as a legacy/dev plaintext entry and
    //      compared directly (kept only so existing non-bcrypt rows still
    //      work — production should use bcrypt).
    //   2. Otherwise fall back to the role-based env password
    //      (ADMIN_DEV_PASSWORD for admin/compliance; TEAM_DEV_PASSWORD for
    //      everyone else). This is what lets the seeded Supabase rows with
    //      NULL password_hash log in without needing plaintext in the DB.
    //   3. If neither source is configured, fail with a non-secret diagnostic
    //      log so Railway operators can see why.
    const hash = (user as any).password_hash as string | null | undefined;
    const envPassword = (user as any).password as string | null | undefined;
    const hasHash = !!hash;
    const hasEnvPassword = !!envPassword;

    let ok = false;
    let path: "hash_bcrypt" | "hash_plain" | "env" | "none" = "none";
    if (hash) {
      if (/^\$2[aby]\$/.test(hash)) {
        path = "hash_bcrypt";
        try {
          ok = await bcrypt.compare(password, hash);
        } catch (e) {
          console.warn(`[auth] bcrypt.compare threw for ${email}: ${(e as Error).message}`);
          ok = false;
        }
      } else {
        path = "hash_plain";
        ok = hash === password;
      }
    } else if (envPassword) {
      path = "env";
      ok = envPassword === password;
    }

    console.log(
      `[auth] login attempt: email=${email} role=${user.role} ` +
        `supabaseEnabled=${supabaseEnabled} has_hash=${hasHash} has_env_password=${hasEnvPassword} ` +
        `path=${path} ok=${ok}`,
    );

    if (path === "none") {
      console.warn(
        `[auth] login rejected for ${email}: no credential configured ` +
          `(supabaseEnabled=${supabaseEnabled}, has_hash=${hasHash}, has_env_password=${hasEnvPassword}). ` +
          `Set team_members.password_hash in Supabase, or ADMIN_DEV_PASSWORD/TEAM_DEV_PASSWORD in env.`,
      );
    } else if (!ok) {
      console.warn(`[auth] login rejected for ${email}: bad password via ${path} path`);
    }

    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    req.session.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    };
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: "Session save failed" });
      res.json({ user: req.session.user });
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", (req, res) => {
    res.json({ user: req.session.user ?? null });
  });

  // ─── Stats ────────────────────────────────────────────────────────────────

  app.get("/api/stats", requireAuth, async (req, res) => {
    const requester = req.session.user!;
    const isOversight = requester.role === "admin" || requester.role === "compliance";

    // Admin/compliance see firm-wide attestation totals; everyone else sees
    // only their own counts so the team portal does not leak headcount.
    const [chapters, obligations, attestations, members] = await Promise.all([
      listChapters(),
      listObligations(),
      isOversight ? listAttestations() : listAttestations({ user_id: requester.id }),
      isOversight ? listTeamMembers() : Promise.resolve([]),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      totalChapters: chapters.length,
      upcomingObligations: obligations.filter((o) => o.status === "upcoming" && o.next_due >= today).length,
      overdueObligations: obligations.filter((o) => o.status === "overdue" || (o.status !== "submitted" && o.next_due < today)).length,
      pendingAttestations: attestations.filter((a) => a.status !== "completed").length,
      completedAttestations: attestations.filter((a) => a.status === "completed").length,
      teamMembers: isOversight ? members.length : null,
    });
  });

  // ─── Manual chapters ──────────────────────────────────────────────────────

  app.get("/api/manual/chapters", requireAuth, async (_req, res) => {
    res.json(await listChapters());
  });

  app.get("/api/manual/chapters/:slug", requireAuth, async (req, res) => {
    const c = await getChapter(String(req.params.slug));
    if (!c) return res.status(404).json({ error: "Chapter not found" });
    res.json(c);
  });

  app.get("/api/manual/chapters/:slug/sections", requireAuth, async (req, res) => {
    const sections = await listSectionsForChapter(String(req.params.slug));
    if (!sections) return res.status(404).json({ error: "Chapter not found" });
    res.json(sections);
  });

  app.get("/api/manual/source", requireAuth, (_req, res) => {
    res.json(SEED_MANUAL_SOURCE);
  });

  app.post("/api/manual/chapters", requireRole("admin", "compliance"), async (req, res) => {
    try {
      const c = await upsertChapter(req.body);
      res.status(201).json(c);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Failed to upsert chapter" });
    }
  });

  // ─── FCA Handbook reference ───────────────────────────────────────────────

  app.get("/api/fca/modules", requireAuth, (req, res) => {
    const { category, q } = req.query as Record<string, string>;
    let mods = FCA_MODULES;
    if (category) mods = mods.filter((m) => m.category === category);
    if (q) {
      const s = q.toLowerCase();
      mods = mods.filter(
        (m) =>
          m.code.toLowerCase().includes(s) ||
          m.title.toLowerCase().includes(s) ||
          (m.description ?? "").toLowerCase().includes(s),
      );
    }
    res.json({ categories: FCA_CATEGORIES, modules: mods });
  });

  // ─── Compliance calendar / obligations ────────────────────────────────────

  app.get("/api/obligations", requireAuth, async (req, res) => {
    const { scope } = req.query as Record<string, string>;
    let rows = await listObligations();
    if (scope === "firm" || scope === "fund") rows = rows.filter((o) => o.scope === scope || o.scope === "both");
    res.json(rows);
  });

  app.patch("/api/obligations/:id", requireRole("admin", "compliance"), async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const updated = await updateObligation(id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  // Mark a calendar obligation as submitted (or revert that decision) and
  // capture an optional comment alongside who/when. Restricted to the same
  // admin/compliance roles that can edit obligations.
  app.post(
    "/api/obligations/:id/submit",
    requireRole("admin", "compliance"),
    async (req, res) => {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
      const requester = req.session.user!;
      const body = (req.body || {}) as { submitted?: boolean; comment?: string | null };
      const submitted = body.submitted !== false; // default true
      const rawComment = body.comment;
      const comment =
        typeof rawComment === "string"
          ? rawComment.trim().slice(0, 4000) || null
          : rawComment === null
            ? null
            : null;
      const updated = await submitObligation(id, {
        submitted,
        comment,
        user: { id: requester.id, full_name: requester.full_name },
      });
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    },
  );

  // ─── Attestations ─────────────────────────────────────────────────────────

  // Team members see only their own attestations; admins (and compliance) can
  // view all by passing `?user_id=...` or omitting it for the full list.
  app.get("/api/attestations", requireAuth, async (req, res) => {
    const requester = req.session.user!;
    const filterUserId = req.query.user_id ? parseInt(String(req.query.user_id), 10) : undefined;

    if (requester.role === "admin" || requester.role === "compliance") {
      const rows = await listAttestations({ user_id: filterUserId });
      return res.json(rows);
    }
    // Non-admins only see their own.
    const rows = await listAttestations({ user_id: requester.id });
    res.json(rows);
  });

  app.post("/api/attestations/:id/complete", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const requester = req.session.user!;
    const { comment } = (req.body || {}) as { comment?: string };
    const updated = await completeAttestation(id, requester.id, comment ?? null);
    if (!updated) return res.status(404).json({ error: "Attestation not found or not yours" });
    res.json(updated);
  });

  app.get("/api/attestations/templates", requireRole("admin", "compliance"), async (_req, res) => {
    res.json(await listAttestationTemplates());
  });

  // ─── Regulatory updates ───────────────────────────────────────────────────

  app.get("/api/regulatory-updates/quarters", requireAuth, async (_req, res) => {
    res.json(await listRegulatoryQuarters());
  });

  app.get("/api/regulatory-updates", requireAuth, async (req, res) => {
    const { quarter, year, section } = req.query as Record<string, string>;
    const opts: { quarter?: string; year?: number; section?: "regulatory" | "enforcement" } = {};
    if (quarter) opts.quarter = quarter;
    if (year && /^\d+$/.test(year)) opts.year = parseInt(year, 10);
    if (section === "regulatory" || section === "enforcement") opts.section = section;
    res.json(await listRegulatoryUpdates(opts));
  });

  // ─── Executed Firm policies ───────────────────────────────────────────────

  app.get("/api/executed-policies", requireAuth, async (_req, res) => {
    res.json(await listExecutedPolicies());
  });

  app.get("/api/executed-policies/:slug", requireAuth, async (req, res) => {
    const policy = await getExecutedPolicy(String(req.params.slug));
    if (!policy) return res.status(404).json({ error: "Policy not found" });
    res.json(policy);
  });

  // ─── Admin: team overview ─────────────────────────────────────────────────

  app.get("/api/admin/team", requireRole("admin"), async (_req, res) => {
    const [members, attestations] = await Promise.all([listTeamMembers(), listAttestations()]);
    const summary = members.map((m) => {
      const mine = attestations.filter((a) => a.user_id === m.id);
      const completed = mine.filter((a) => a.status === "completed").length;
      const pending = mine.filter((a) => a.status === "pending").length;
      const overdue = mine.filter((a) => a.status === "overdue").length;
      return { ...m, total: mine.length, completed, pending, overdue };
    });
    res.json(summary);
  });

  app.get("/api/admin/team/:id/attestations", requireRole("admin"), async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    res.json(await listAttestations({ user_id: id }));
  });
}
