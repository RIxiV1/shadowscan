# ShadowScan

AI governance and shadow AI detection.

People at work use ChatGPT, Claude, Gemini, DeepSeek and a dozen browser
extensions without telling IT. Security teams have no idea which tools are in
use or what's being pasted into them. ShadowScan takes the logs a company
already has (browser history exports, proxy logs, CASB reports), works out which
requests went to AI services, scores the risk, and produces a report.

Third-year B.Tech IT mini project.

## Stack

React + TypeScript + Vite + Tailwind on the front, Express + TypeScript +
Mongoose on the back, MongoDB for storage, JWT for auth, Recharts for the
graphs, PDFKit for report export.

npm workspaces monorepo: `apps/web`, `apps/api`, `packages/shared`.

## Running it

Needs Node 20+ and a MongoDB (local `mongod` or a free Atlas cluster).

```bash
npm install
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and set `MONGODB_URI` and `JWT_SECRET`. Generate a secret
with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then:

```bash
npm run seed -- --demo   # providers, settings, admin user, sample activity
npm run dev              # api on :4000, web on :5173
```

Log in at http://localhost:5173 with the `SEED_ADMIN_*` values from your `.env`.
Change that password once you're in.

If the API won't connect, `npm run db:check` will tell you why.

### Scripts

| | |
|---|---|
| `npm run dev` | both apps, hot reload |
| `npm run build` | typecheck + build everything |
| `npm test` | engine tests |
| `npm run seed` | registry + settings + admin (safe to re-run) |
| `npm run db:check` | diagnose a MongoDB connection |

## How it works

```
log file -> parse -> normalise url -> match provider -> scan content -> score
```

**Parsing.** CSV, TSV, JSON, NDJSON, plain text and proxy access logs. Column
names are matched by alias so a file with `Visited URL` works the same as one
with `url`. Timestamps come in five different epoch formats depending on the
source, including Chrome's weird 1601-based microseconds. The format is decided
by looking at the file contents, not the extension.

**Detection.** Two stages. First a registry of ~54 AI providers matched on
domain suffix, so registering `openai.com` covers every subdomain. Anything that
doesn't match falls through to pattern rules that catch AI tools nobody has
catalogued yet, and those get reported as unassessed rather than ignored.

All the provider data lives in `apps/api/src/config/ai-providers.ts`. Nothing in
the detection code mentions a vendor by name, so adding a provider is one object
in that file (or the Registry screen at runtime).

**Scoring.** Every request accumulates points: the provider's base weight,
whether it's blocked, where the vendor processes data, any confidential content
found, and the time of day. The points are itemised, so the UI can show you
exactly why something scored what it did. Per-person and org-level scores are
normalised so they don't just grow with log volume.

**Reports.** PDF export with the tool inventory, riskiest people and recommended
actions. The recommendations come from plain rules, not an LLM. An audit finding
has to come out the same way twice, and sending a company's shadow-AI inventory
to a third-party model to write it up would be a bit rich given what this thing
is for.

## Limitation worth knowing about

Browser history contains URLs, not prompts. You can see that someone opened
chatgpt.com but not what they typed into it.

So confidential-content detection works on URL query strings (AI search tools
put the whole question in `?q=`) and on prompt columns when the log source has
one, which CASB and DLP exports usually do. If you only upload browser history
and see zero content findings, that's the log source, not proof nothing leaked.
The generated report says so too.

## Sample files

Four in `samples/`:

- `casb-export.csv` - has prompt text, so this one shows the full pipeline
- `chrome-history.csv` - plain browser export, detections but no content
- `squid-access.log` - proxy log with no header row
- `chrome-takeout.json` - Google Takeout format, plus two hosts only the
  heuristics catch

## Not built

No live network interception (an agent or proxy is the real answer, way out of
scope for an MVP). No multi-tenancy. No SSO. Changing risk weights doesn't
rescore old events on purpose, otherwise a report you signed last month would
quietly change its numbers.

Uploaded files aren't stored either. They're parsed in memory and thrown away,
and only the AI detections are kept. When a secret turns up in a prompt the app
records that a secret of that type was there and nothing else, so the value
can't be recovered from the database.

## Endpoints

Everything under `/api`. All of it except health, login and bootstrap needs a
bearer token. Responses are always `{ ok: true, data }` or `{ ok: false, error }`,
apart from the PDF export.

```
POST   /auth/login              GET    /events
GET    /auth/me                 GET    /events/:id
POST   /auth/register           GET    /providers
POST   /auth/change-password    POST   /providers
GET    /analytics/dashboard     PUT    /providers/:id
POST   /uploads                 PATCH  /providers/:id/policy
GET    /uploads                 DELETE /providers/:id
DELETE /uploads/:id             GET    /settings/risk
POST   /reports                 PATCH  /settings/risk
GET    /reports/:id             GET    /audit
GET    /reports/:id/pdf         GET    /health
```

`GET /api` returns the same list at runtime.

## Deploying

API on Render, web on Vercel, database on Atlas. `render.yaml` and
`apps/web/vercel.json` have the settings. Run `npm run seed` once from the
Render shell after the first deploy.

MIT licensed.
