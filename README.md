# Alamut Compliance Dashboard

Internal dashboard for Alamut covering:

- **Firm Compliance Manual** — chapter-based viewer with fast search and FCA cross-references.
- **FCA Handbook reference** — searchable index of all Handbook modules linking back to [handbook.fca.org.uk](https://handbook.fca.org.uk/handbook).
- **Compliance Calendar** — firm and fund regulatory reporting obligations with status tracking.
- **Attestations** — per-team-member sign-offs (Code of Conduct, PA Dealing, AML, etc).
- **Admin oversight** — senior admins see attestation status across the entire team.

The repo follows the same conventions as `doppiozapato/alamut-expert-network`:
Node + Express + Vite/React on Railway, Supabase as the data backend.

## Stack

| Layer    | Tech                                                                |
| -------- | ------------------------------------------------------------------- |
| Server   | Node 20, Express 5, `express-session`, Supabase JS client           |
| Client   | React 18, Vite 7, Tailwind 3, `wouter` (hash routing), React Query  |
| Database | Supabase (Postgres) — schema in `supabase/migrations/`              |
| Hosting  | Railway (NIXPACKS, GitHub-connected auto-deploy)                    |

## Local development

```bash
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_ANON_KEY, SESSION_SECRET, ADMIN_PASSPHRASE

npm install
npm run dev      # http://localhost:8080
```

Without Supabase configured the app boots against in-memory seed data so you
can see the full UI immediately. Configure Supabase to persist changes.

### Demo credentials

Quick-switch presets are available on the login screen:

| Preset                | Email                       | Password         | Role         |
| --------------------- | --------------------------- | ---------------- | ------------ |
| Senior Admin          | `admin@alamut.com`          | `admin2026`      | `admin`      |
| Compliance Officer    | `compliance@alamut.com`     | `compliance2026` | `compliance` |
| Operations Lead       | `operations@alamut.com`     | `operations2026` | `operations` |
| Finance Manager       | `finance@alamut.com`        | `finance2026`    | `finance`    |
| Analyst One / Two     | `analyst1/2@alamut.com`     | `analyst2026`    | `team`       |

> ⚠️ **Production:** these are demo-only plaintext passwords. Replace them
> by populating `team_members.password_hash` (bcrypt) directly in Supabase
> and removing the `password` column from any seed data you load.

### Role permissions

| Capability                      | admin | compliance | operations | finance | team |
| ------------------------------- |:-----:|:----------:|:----------:|:-------:|:----:|
| Read manual / FCA / calendar    | ✅    | ✅         | ✅         | ✅      | ✅   |
| Complete own attestations       | ✅    | ✅         | ✅         | ✅      | ✅   |
| Edit manual chapters            | ✅    | ✅         | —          | —       | —    |
| Update obligation status        | ✅    | ✅         | —          | —       | —    |
| View ALL team attestations      | ✅    | ✅         | —          | —       | —    |
| `/admin` team oversight tab     | ✅    | —          | —          | —       | —    |

## Supabase

### One-time provisioning

1. Create (or reuse) a Supabase project. Two existing projects are documented
   in repo notes:
   - `alamut-expert-network` (`uxlslahhnuecwfbgdijo`) — already populated for
     the expert network app. **Do not** mix tables — use a different schema or
     a new project for compliance.
   - `Self Source` (`ozdxxwpbbbhvhlvusoeo`) — empty; suitable for use here.
2. In the Supabase SQL Editor, run:
   ```
   supabase/migrations/0001_init.sql
   supabase/seed.sql
   ```
3. (Recommended) Switch the seeded plaintext passwords to bcrypt hashes and
   move the password column out of public exposure (RLS already blocks
   anonymous writes by default).
4. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`
   for write-heavy operations like the manual importer) in your environment.

### Importing the Firm Compliance Manual

The dashboard ships with a placeholder chapter structure. To replace it with
your real manual:

1. Convert the manual to one markdown file per chapter, named `NN-slug.md`
   (e.g. `02-governance.md`). Optional front matter is supported:
   ```
   ---
   summary: SMCR governance map
   owner: Compliance Officer
   version: v1.2
   effective_date: 2026-01-01
   fca_refs: SYSC, COCON, APER
   tags: smcr, governance
   ---
   # 2. Governance
   ...
   ```
2. Run:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=... npx tsx script/importManual.ts ./manual/
   ```
3. The dashboard will pick up the new chapters on the next page load.

## Railway deployment

The repo is set up for the same Railway pattern as
`alamut-expert-network` — push to GitHub and the connected service redeploys.

### One-time setup (dashboard)

1. Sign in to Railway → **New Project** → **Deploy from GitHub repo** → select
   `doppiozapato/alamut-compliance`.
2. Set environment variables in **Variables**:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SESSION_SECRET` (any strong random string)
   - `ADMIN_PASSPHRASE` (legacy override path — not required if you only use
     team_members credentials)
   - `PORT` is set automatically by Railway; the server defaults to `8080`.
3. Railway picks up `railway.json` (NIXPACKS, `npm install && npm run build`,
   `node dist/index.cjs`).
4. The production URL will look like
   `https://alamut-compliance-production.up.railway.app/`.

### CLI flow (optional)

```bash
npm i -g @railway/cli
railway login
railway link          # link to project
railway up            # deploys current branch
railway open          # opens the deployed URL
```

## Project layout

```
alamut-compliance/
├── client/                    # Vite/React SPA
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── AlamutLogo.tsx
│       │   └── Layout.tsx     # dark sidebar + compact header
│       ├── lib/
│       │   ├── auth.ts
│       │   ├── queryClient.ts
│       │   └── utils.ts
│       └── pages/
│           ├── Login.tsx
│           ├── Dashboard.tsx
│           ├── Manual.tsx
│           ├── ChapterView.tsx
│           ├── FCAReference.tsx
│           ├── Calendar.tsx
│           ├── Attestations.tsx
│           └── Admin.tsx
├── server/
│   ├── index.ts               # Express + sessions
│   ├── routes.ts              # /api/* endpoints
│   ├── store.ts               # Supabase / in-memory data layer
│   ├── seedData.ts            # demo content + credentials
│   ├── fcaHandbook.ts         # canonical FCA module list
│   ├── supabase.ts
│   ├── static.ts
│   └── vite.ts
├── shared/schema.ts           # types shared client+server
├── supabase/
│   ├── migrations/0001_init.sql
│   └── seed.sql
├── script/
│   ├── build.ts               # esbuild + vite build
│   └── importManual.ts        # markdown → manual_chapters
├── railway.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

## Auth model

- Login-first: SPA shows the login screen until `/api/auth/me` returns a
  user. After login the dashboard layout (dark sidebar, compact header,
  card-driven dashboard, dense workspace sections) is identical in
  structure to `alamut-expert-network`.
- Sessions are HTTP-only cookies signed with `SESSION_SECRET`, stored in
  memory (`memorystore`) — replace with a persistent store (Redis, Supabase)
  if you need multi-instance or restart-resilient sessions.
- Roles are derived from `team_members.role` and enforced by
  `requireAuth` / `requireRole` middleware in `server/routes.ts`.

## Build and tests

```bash
npm run check    # TypeScript type-check (server + client + shared)
npm run build    # bundles to dist/index.cjs and dist/public/
```

There is no automated test suite yet — the data model is small and the
critical paths are auth + Supabase pass-through. Add Vitest + Supertest
when meaningful business logic lands server-side.
