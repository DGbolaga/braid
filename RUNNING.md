# Running Braid

Three parts: Postgres, the FastAPI backend, the Next.js frontend.

## Quick start

```bash
# 1. Database  (from the repo root)
DB_PORT=5433 docker compose up -d db

# 2. Backend   (from api/)
cd api
uv sync                                   # first time only
cp .env.example .env                      # first time only, then edit if needed
uv run alembic upgrade head               # create the tables
uv run python -m app.seed                 # load the sample cohort
DEMO_MODE=true uv run uvicorn app.main:app --port 8000

# 3. Frontend  (from web/, in a second terminal)
cd web
npm install                               # first time only
npm run dev
```

Then open **http://localhost:3000/signin** and click **Explore as a
coordinator** or **Explore as a participant**.

`DB_PORT=5433` is only needed if your machine already runs Postgres on 5432.
Whatever port you use must match `DATABASE_URL` in `api/.env`.

## The two modes

`web/.env.local` decides whether the frontend talks to the real backend or to
its own built-in mock.

```bash
# Against the real FastAPI backend
NEXT_PUBLIC_API_URL=http://localhost:8000/v1
NEXT_PUBLIC_API_MOCKING=disabled
NEXT_PUBLIC_DEMO_MODE=true

# Frontend on its own, no backend or database needed at all
NEXT_PUBLIC_API_MOCKING=enabled
```

The mock serves every screen in the app. The real backend currently serves the
ones listed below. Restart `npm run dev` after changing this file.

## What works against the real backend

Sign in as **coordinator** (Amara Okonkwo) or **participant** (Blessing Adewale)
from the sign-in screen.

| Screen | Route |
|---|---|
| Programme landing | `/p/she-code-africa/backend-cohort-4` |
| Application form | `/p/she-code-africa/backend-cohort-4/apply?role=mentee` |
| Sign in, verify, sign out | `/signin` |
| Participant home | `/o/she-code-africa/p/backend-cohort-4` |
| Strands list and detail, sending messages | `…/strands` |
| Profile, directory, resources | `…/me`, `…/directory`, `…/resources` |
| Roster | `/admin/o/she-code-africa/programs/{programId}/roster` |
| **Matching runs — start, watch, publish** | `…/programs/{programId}/runs` |
| **Unmatched queue and pairing by hand** | `…/programs/{programId}/unmatched` |
| Applications review and decisions | `…/programs/{programId}/applications` |
| Form builder — draft and publish | `…/programs/{programId}/form` |
| Matching criteria and test run | `…/programs/{programId}/criteria` |
| Milestones | `…/programs/{programId}/milestones` |
| Templates | `…/programs/{programId}/templates` |
| Research writing programme (a second org, different form) | `/o/unilag/p/research-writing-2026` |

`programId` is `00000002-0000-4000-8000-000000000001`.

### The thing worth looking at

On the runs page press **Start a run**. It creates a real matching run, polls it
from queued to drafted, and shows the fairness summary above the pair list:
coverage, mentor load, and the mean match quality for each priority band. That
ordering is the point — the distribution before the names.

Then press **Publish** and the strands appear on the participant side.

## Not yet on the real backend

These screens still show an error against the real API. Switch
`NEXT_PUBLIC_API_MOCKING=enabled` to see them working against the mock.

- Dashboard, strands monitor, broadcast
- Reports, audit log
- Account settings and my programmes

## Signing in for real

Demo sign-in exists because the seeded people have `example.org` addresses
nobody can receive mail at. The real magic-link path works too — there is just
no mail provider configured, so the link is printed to the API's own log:

```
INFO braid.mail  email not delivered (no provider configured)
  to:      amara.okonkwo@example.org
  | http://localhost:3000/verify/XcQ2...
```

Paste that URL into the browser and you are signed in.

## Resetting

```bash
cd api && uv run python -m app.seed
```

Wipes and reloads the sample cohort, including sessions — so you will be signed
out. Safe to run repeatedly.

## Checks

```bash
cd api && uv run ruff check .     # backend lint
cd web && npx tsc --noEmit        # frontend types, strict
cd web && npm run lint
```
