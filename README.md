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

The repo ships ready-to-deploy on [railway.com](https://railway.com): pushing
to `main` redeploys the connected service automatically. Configuration files:

| File             | Purpose                                                         |
| ---------------- | --------------------------------------------------------------- |
| `railway.json`   | Builder (Nixpacks), build/start commands, healthcheck path      |
| `nixpacks.toml`  | Pins Node 20, runs `npm install` → `npm run build` → `npm run start` |
| `.npmrc`         | Forces `include=dev` so Vite/esbuild are available at build time |
| `Procfile`       | `web: npm run start` — fallback for buildpack-style hosts       |

The server binds to `process.env.PORT` (Railway-provided) and defaults to
`8080` for local development. The production start command (`npm run start`)
serves both the bundled API (`dist/index.cjs`) and the built client
(`dist/public/`) from a single Express process.

### One-time setup (railway.com UI)

1. Sign in at [railway.com](https://railway.com) → **New Project** →
   **Deploy from GitHub repo**.
2. Authorize the GitHub app on the `doppiozapato` org if prompted, then pick
   **`doppiozapato/alamut-compliance`**.
3. Railway auto-detects `railway.json` and starts the first build. You can
   cancel it if you want to set variables before the first run.
4. Open the service → **Variables** → add the env vars below. The minimum
   required set is `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SESSION_SECRET`,
   `NODE_ENV=production`.
5. Open **Settings → Networking → Generate Domain** to mint a public URL
   (something like `alamut-compliance-production.up.railway.app`).
6. Click **Deploy** (top-right) to redeploy with the new variables. Railway
   will run `npm install --include=dev --no-audit --no-fund && npm run build`,
   start the server, and probe `/api/health` until it returns `200` before
   flipping traffic.
7. Verify the deploy:
   ```bash
   curl https://<your-service>.up.railway.app/api/health
   # → {"status":"ok","service":"alamut-compliance",...}
   ```
   Then open the root URL in a browser — you should see the login screen.

### Required env vars

| Variable                    | Required | Notes                                                                       |
| --------------------------- | :------: | --------------------------------------------------------------------------- |
| `SUPABASE_URL`              | ✅       | `https://<project-ref>.supabase.co`                                         |
| `SUPABASE_ANON_KEY`         | ✅       | Public anon key from Supabase project settings                              |
| `SESSION_SECRET`            | ✅       | Strong random string; sessions are signed with this. `openssl rand -base64 48` |
| `NODE_ENV`                  | ✅       | Set to `production`                                                         |
| `PORT`                      | auto     | Provided by Railway; falls back to `8080` locally                           |
| `ADMIN_PASSPHRASE`          | optional | Legacy admin-override; omit if all logins use `team_members`                |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | Only needed by `script/importManual.ts`; do **not** set on the web service  |

> ⚠️ Never commit real values. `.env` is gitignored; use Railway's
> **Variables** UI or `railway variables set KEY=value` from the CLI.

### CLI flow (optional)

```bash
npm i -g @railway/cli
railway login
railway link                       # select existing project / service
railway variables --set SESSION_SECRET="$(openssl rand -base64 48)"
railway up                         # build + deploy current branch
railway open                       # open service URL in browser
railway logs                       # tail deploy logs
```

### Troubleshooting

#### `EBUSY: resource busy or locked, rmdir '/app/node_modules/.cache'`

Symptom — Railway build fails during the install phase with:

```
npm error code EBUSY
npm error syscall rmdir
npm error path /app/node_modules/.cache
npm error errno -16
npm error EBUSY: resource busy or locked, rmdir '/app/node_modules/.cache'
Build Failed: ... exit code: 240
```

Cause — Nixpacks caches the `node_modules/.cache` path between builds for
faster incremental installs. `npm ci` deletes the entire `node_modules/`
directory before reinstalling, which races against the still-mounted cache
layer and fails with `EBUSY`.

Fix — already applied in this repo. The install phase now uses
`npm install --include=dev --no-audit --no-fund` (in `railway.json`,
`nixpacks.toml`, and `.npmrc`), which mutates `node_modules/` in place
instead of removing it. `package-lock.json` keeps the install deterministic.

If you still see the error after pulling these changes:

1. In the Railway service, open **Settings → Danger → Clear Build Cache**
   (or in the deploy view, the three-dot menu → **Clear build cache**).
2. Trigger a new deploy (push a commit, or **Deploy → Redeploy**).
3. The first build after clearing the cache rebuilds from scratch; subsequent
   builds reuse the cached layers safely.

#### `Cannot find module 'vite'` / `esbuild` / `tsx` during build

Cause — Railway sets `NODE_ENV=production` for the deploy, and some npm
configurations skip `devDependencies` when that's set. The build script
(`script/build.ts`) needs Vite, esbuild, and tsx, all of which live under
`devDependencies`.

Fix — already applied. The `.npmrc` at the repo root sets `production=false`
and `include=dev`, and the install command passes `--include=dev` explicitly.
After the build emits `dist/index.cjs`, the runtime no longer needs these
packages.

### Healthcheck

`GET /api/health` is unauthenticated and returns:

```json
{ "status": "ok", "service": "alamut-compliance", "uptime": 12.34, "timestamp": "..." }
```

Railway uses it as the deploy gate (`railway.json#deploy.healthcheckPath`).
A failing healthcheck rolls the deploy back automatically.

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
