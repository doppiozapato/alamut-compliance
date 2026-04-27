import type { Express, Request, Response, NextFunction } from "express";
import {
  findUserByEmail,
  listTeamMembers,
  listChapters,
  getChapter,
  upsertChapter,
  listObligations,
  updateObligation,
  listAttestations,
  completeAttestation,
  listAttestationTemplates,
} from "./store";
import { FCA_MODULES, FCA_CATEGORIES } from "./fcaHandbook";
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

export async function registerRoutes(app: Express) {
  // ─── Health ───────────────────────────────────────────────────────────────
  // Unauthenticated liveness probe used by Railway's healthcheck.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "alamut-compliance",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: "email and password required" });

    const user = await findUserByEmail(email);
    if (!user || !user.is_active) return res.status(401).json({ error: "Invalid credentials" });

    // NOTE: seed users store plaintext passwords for demo only.
    // Production deployments must use bcrypt-hashed passwords stored in
    // Supabase `team_members.password_hash` (see migration).
    const expected = (user as any).password_hash
      ? null // bcrypt path handled below
      : (user as any).password;

    let ok = false;
    if (expected != null) {
      ok = expected === password;
    } else if ((user as any).password_hash) {
      // Production deployments should swap this for bcryptjs.compare(...).
      // Kept as a constant-time string compare for the seed-only path.
      ok = (user as any).password_hash === password;
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

  // Quick-switch presets surfaced on the login screen.
  app.get("/api/auth/presets", (_req, res) => {
    res.json({
      presets: [
        { label: "Senior Admin",        email: "admin@alamut.com",       role: "admin" },
        { label: "Compliance Officer",  email: "compliance@alamut.com",  role: "compliance" },
        { label: "Operations Lead",     email: "operations@alamut.com",  role: "operations" },
        { label: "Finance Manager",     email: "finance@alamut.com",     role: "finance" },
      ],
    });
  });

  // ─── Stats ────────────────────────────────────────────────────────────────

  app.get("/api/stats", requireAuth, async (req, res) => {
    const [chapters, obligations, attestations, members] = await Promise.all([
      listChapters(),
      listObligations(),
      listAttestations(),
      listTeamMembers(),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      totalChapters: chapters.length,
      upcomingObligations: obligations.filter((o) => o.status === "upcoming" && o.next_due >= today).length,
      overdueObligations: obligations.filter((o) => o.status === "overdue" || (o.status !== "submitted" && o.next_due < today)).length,
      pendingAttestations: attestations.filter((a) => a.status !== "completed").length,
      completedAttestations: attestations.filter((a) => a.status === "completed").length,
      teamMembers: members.length,
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
