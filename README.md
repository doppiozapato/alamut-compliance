# Alamut Compliance Dashboard

Internal dashboard for Alamut covering:

- **Firm Compliance Manual** — chapter-and-section viewer for the Alamut
  Compliance Manual (September 2025), parsed from the source PDF into 43
  chapters / appendices and ~300 sections, with fast search and FCA
  cross-references.
- **FCA Handbook reference** — searchable index of all Handbook modules linking back to [handbook.fca.org.uk](https://handbook.fca.org.uk/handbook).
- **Compliance Calendar** — firm and fund regulatory reporting obligations with status tracking.
- **Regulatory Updates** — quarterly digest of FCA / FATF / market guidance with a
  per-quarter dropdown selector, parsed from the firm's quarterly DOCX bulletin.
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
# (optionally) ADMIN_DEV_PASSWORD / TEAM_DEV_PASSWORD for the in-memory
# seed fallback when running without Supabase.

npm install
npm run dev      # http://localhost:8080
```

Without Supabase configured the app boots against in-memory seed data so you
can see the full UI immediately. Configure Supabase to persist changes.

## Access model

| Group                  | Logins                                    | Sees                                                                                       |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Admins**             | `tom@alamut-im.com`, `alice@alamut-im.com`| Full dashboard incl. **Admin** tab (firm-wide attestation oversight, team management).     |
| **Compliance officer** | `compliance@alamut-im.com`                | Full dashboard except `/admin`; can edit manual chapters and obligation status.            |
| **Other team members** | One row per person in `team_members`      | Slimmer **Team Portal**: their own attestations, the manual, FCA reference, calendar, regulatory updates. No admin oversight, no team-wide views. |

The portal label in the header (`Admin Portal` / `Compliance Portal` /
`Team Portal`) reflects which group the signed-in user belongs to. The
backend enforces the same boundary — `/api/admin/*` returns `403` for
non-admins, and `/api/attestations` only ever returns the requester's own
rows when the requester is not admin/compliance.

### Admin accounts

Two senior personnel hold admin rights on the dashboard. Their emails are
the only place this is configured:

| Slot                   | Email                           | Configured via                          |
| ---------------------- | ------------------------------- | --------------------------------------- |
| Primary superuser/admin| `tom@alamut-im.com`             | hard-wired in seed + Supabase           |
| Second admin           | `alice@alamut-im.com`           | seeded by default; overridable via `SECOND_ADMIN_EMAIL` (or `ADMIN_EMAILS`) |

Tom and Alice can sign in with `ADMIN_DEV_PASSWORD` until each row in
`team_members` is updated with a bcrypt `password_hash`; once every admin
row has a hash, drop `ADMIN_DEV_PASSWORD` from Railway.

#### Email shorthand at the login screen

The login handler accepts the shorthand local-part:

- `tom` → expanded to `tom@alamut-im.com`
- `alice@alamut-im` → expanded to `alice@alamut-im.com`
- `tom@alamut-im.com` → used as-is

Anything containing a different domain is passed through unchanged so a
typo cannot silently bind to a wrong row. The same normalisation runs in
`script/setTeamMemberPassword.ts` so the row written there matches what
the user types at sign-in.

To activate or change the second admin:

1. **Supabase deployments:** the `supabase/seed.sql` file inserts
   `alice@alamut-im.com` as the second admin. Bcrypt-hash a password into
   `team_members.password_hash` for that row. To use a different email,
   edit the seed row before running it, or insert the desired row manually
   with `role='admin'`.
2. **In-memory fallback (no Supabase):** the seed creates Alice as the
   second admin automatically. Set `ADMIN_DEV_PASSWORD` to enable her
   login. To use a different email, set `SECOND_ADMIN_EMAIL` (or
   `ADMIN_EMAILS`) in the environment.
3. The login screen does not display credential hints, presets, or demo
   passwords. Provision real bcrypt-hashed passwords in
   `team_members.password_hash` for production.

> ⚠️ **Production:** never commit plaintext passwords. Generate bcrypt
> hashes outside the repo (e.g. `bcrypt.hashSync('newpw', 10)` in Node)
> and load them directly into Supabase.

#### Login resolution order

The `/api/auth/login` handler resolves credentials in this order:

1. **`team_members.password_hash` is populated** — verified server-side. A
   bcrypt-shaped hash (`$2a$` / `$2b$` / `$2y$`) is checked with
   `bcrypt.compare`; any other value is treated as a legacy plaintext column
   and string-compared (kept only so older rows keep working — use bcrypt for
   new accounts).
2. **`password_hash` is NULL** — falls back to the role-based env password:
   `admin` / `compliance` users use `ADMIN_DEV_PASSWORD`; everyone else uses
   `TEAM_DEV_PASSWORD`. This is the path Alamut's seeded Supabase rows
   (`tom@alamut-im.com`, `alice@alamut-im.com`) currently use, since their
   hash columns are NULL.
3. **Neither configured** — login fails with `Invalid credentials` and the
   server logs `has_hash=false has_env_password=false` for the attempt. This
   is the signal to either set the env vars or populate the bcrypt hash.

Recommended for production: bcrypt-hash a password into
`team_members.password_hash` for every active user and remove
`ADMIN_DEV_PASSWORD` / `TEAM_DEV_PASSWORD` from Railway. The handler will
exclusively follow path 1 once hashes are present.

```js
// One-off: hash a password from a Node REPL, paste the result into Supabase.
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('the-password', 10));
```

#### Provisioning a password for a single user

`script/setTeamMemberPassword.ts` wraps the same step so the plaintext
password never appears on the command line, in shell history, or in
process output. The script reads the email and password from environment
variables, generates a bcrypt hash locally, and either updates Supabase
directly (when service-role credentials are present) or prints a
ready-to-paste `UPDATE` statement for the SQL editor.

Direct update against Supabase:

```bash
ALAMUT_USER_EMAIL='alice@alamut-im.com' \
ALAMUT_USER_PASSWORD='<the password>' \
SUPABASE_URL='https://<ref>.supabase.co' \
SUPABASE_SERVICE_ROLE_KEY='<service-role>' \
npx tsx script/setTeamMemberPassword.ts
```

Print-the-SQL mode (no Supabase env vars set):

```bash
ALAMUT_USER_EMAIL='alice@alamut-im' \
ALAMUT_USER_PASSWORD='<the password>' \
npx tsx script/setTeamMemberPassword.ts
# → update public.team_members set password_hash = '$2b$12$...' where lower(email) = 'alice@alamut-im.com';
```

Notes:

- The plaintext password is only read from `ALAMUT_USER_PASSWORD` and is
  never echoed to stdout/stderr or written to disk.
- Email shorthand (`tom`, `alice@alamut-im`) is normalised to the full
  `@alamut-im.com` address — the same rule the login screen uses.
- The script refuses passwords shorter than 8 characters.
- `team_members` rows must already exist (the seed creates them); this
  script only sets `password_hash`.

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
2. In the Supabase SQL Editor, run, in order:
   ```
   supabase/migrations/0001_init.sql
   supabase/migrations/0002_manual_sections.sql
   supabase/migrations/0003_regulatory_updates.sql
   supabase/seed.sql
   ```
   Then push the parsed regulatory updates JSON into the new table:
   ```
   SUPABASE_SERVICE_ROLE_KEY=... npx tsx script/importRegulatoryUpdates.ts
   ```
3. (Recommended) Switch the seeded plaintext passwords to bcrypt hashes and
   move the password column out of public exposure (RLS already blocks
   anonymous writes by default).
4. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`
   for write-heavy operations like the manual importer) in your environment.

### Importing the Firm Compliance Manual

The repo ships with the **Alamut Compliance Manual (September 2025)** already
parsed and committed at `script/manualData.json` (43 chapters/appendices,
~300 sections). The dashboard loads this JSON at boot for both dev and
production builds, so a fresh checkout serves the real manual immediately.

#### Refreshing the parsed JSON from a new PDF

When a new revision of the manual is issued, regenerate the JSON and
optionally push it to Supabase:

```bash
# 1. Regenerate the structured JSON from a PDF.
#    Requires `pdftotext` (poppler-utils) on PATH; no Python dependencies.
python3 script/parseManualPdf.py \
    /path/to/Alamut-Compliance-Manual_<rev>.pdf \
    script/manualData.json

# 2. Rebuild — the build step copies the JSON next to the bundle.
npm run build

# 3. (Production) Push chapters + sections to Supabase.
SUPABASE_SERVICE_ROLE_KEY=... npx tsx script/importManual.ts
# Pass an explicit JSON path if you parsed elsewhere:
SUPABASE_SERVICE_ROLE_KEY=... npx tsx script/importManual.ts ./other.json
```

The parser scans the contents pages for chapter and section page anchors,
slices the body by chapter, strips the recurring "Alamut Investment
Management LLP" / "PRIVATE & CONFIDENTIAL" page chrome, and emits one entry
per numbered section (`1.1`, `16.10`, …) plus an entry per appendix
(`Appendix A`, …). Heuristics tag each chapter with FCA Handbook module
references (PRIN, SYSC, COBS, MAR, …) for the chapter sidebar.

#### Schema additions

`supabase/migrations/0002_manual_sections.sql` adds:

| Object                    | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `manual_chapters.kind`    | `chapter` or `appendix`                            |
| `manual_chapters.start_page` / `end_page` | Page anchors in the source PDF      |
| `manual_chapters.source_pdf` | Filename of the PDF the chapter was imported from |
| `manual_sections` table   | One row per numbered section, FK → `manual_chapters` |

#### Legacy markdown-folder mode

The original markdown-folder importer is still supported for ad-hoc updates:

```bash
SUPABASE_SERVICE_ROLE_KEY=... npx tsx script/importManual.ts ./manual/
```

When `script/importManual.ts` is given a directory it falls through to
that path; otherwise it consumes the parsed JSON.

### Importing quarterly Regulatory Updates

The Regulatory Updates tab is driven by parsed JSON committed under
`script/regulatoryUpdates/` (one file per quarter, e.g. `Q1-2026.json`). The
repo ships with **Q1 2026** already imported. To add a new quarter:

```bash
# 1. Parse the quarterly DOCX bulletin into structured JSON.
#    Default output path is script/regulatoryUpdates/<Q>-<YYYY>.json,
#    derived from the filename (or the earliest date in the document).
python3 script/parseRegulatoryUpdatesDocx.py \
    /path/to/Alamut-Q2-2026-Regulatory-Updates.docx

# 2. (Optional) Inspect the JSON and commit it to the repo so the in-memory
#    fallback and Railway deploy can serve the new quarter immediately.
git add script/regulatoryUpdates/Q2-2026.json
git commit -m "Add Q2 2026 regulatory updates"

# 3. Rebuild — `script/build.ts` copies every JSON in
#    script/regulatoryUpdates/ next to the bundle for production.
npm run build

# 4. (Production) Push the rows to Supabase.
SUPABASE_SERVICE_ROLE_KEY=... npx tsx script/importRegulatoryUpdates.ts
# Pass an explicit file or directory if you want to scope the upsert:
SUPABASE_SERVICE_ROLE_KEY=... npx tsx script/importRegulatoryUpdates.ts \
    script/regulatoryUpdates/Q2-2026.json
```

The DOCX parser walks the Word XML directly (no `python-docx` dependency),
extracts the bold-rendered title from each Update cell, normalises dates
like `9th January 2026` → `2026-01-09`, and recovers all hyperlinks from
the document relationships. The output JSON is deterministic across
re-runs so commits stay clean.

The Supabase importer upserts on `(year, quarter, section, date_published, title)`,
so re-running the script after a manual edit to the JSON is safe.

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
| `SECOND_ADMIN_EMAIL`        | optional | Override the second admin email. Defaults to `alice@alamut-im.com`; `tom@alamut-im.com` is always the primary. |
| `ADMIN_EMAILS`              | optional | Alternative to `SECOND_ADMIN_EMAIL`: comma-separated list of admin emails. |
| `ADMIN_DEV_PASSWORD`        | see notes | Plaintext password for `admin` / `compliance` users. Used in seed mode and as a fallback for Supabase users whose `password_hash` is NULL. Drop it once every admin row has a bcrypt `password_hash`. |
| `TEAM_DEV_PASSWORD`         | see notes | Plaintext password for `operations` / `finance` / `team` users. Same fallback semantics as `ADMIN_DEV_PASSWORD`. |
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

#### `column "polname" does not exist` when running migrations

Symptom — applying `supabase/migrations/0001_init.sql` (or 0002/0003) against
a fresh Supabase project fails with:

```
ERROR:  column "polname" does not exist
HINT:   Perhaps you meant to reference the column "pg_policies.policyname".
```

Cause — older revisions of these migrations guarded `create policy` blocks
with `select 1 from pg_policies where polname = '...'`. Supabase/Postgres
exposes the policy name as `policyname`, not `polname`.

Fix — already applied on `main`. Pull the latest migrations and re-run them
in the Supabase SQL Editor. No action is needed if you are deploying from
the current `main`.

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
│   ├── parseManualPdf.py      # PDF → script/manualData.json (chapters + sections)
│   ├── manualData.json        # parsed Alamut Compliance Manual (committed)
│   ├── importManual.ts        # JSON / markdown → manual_chapters + manual_sections
│   ├── parseRegulatoryUpdatesDocx.py  # DOCX → script/regulatoryUpdates/<Q>-<YYYY>.json
│   ├── regulatoryUpdates/     # one JSON per quarter (Q1-2026.json committed)
│   └── importRegulatoryUpdates.ts     # JSON → regulatory_updates (Supabase)
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
