# Survey Site

Next.js survey app for CalmingBeats / SomaBeats.

## Current Behavior

- Serves survey routes:
  - `/survey/day-7`
  - `/survey/day-14`
  - `/survey/day-21`
  - `/survey/nightly-recap`
- Uses email-based identity at `/start` (no backend JWT verification in Survey Site)
- Supports two entry paths:
  - Option 1: iOS WebView link (`/start?email=...&surveyType=...`)
  - Option 2: Email browser link with one-time code (`/start?email=...&code=...`)
- Enforces one submission per `(userId, surveyType)`

## Local Development

### 1) Start shared MongoDB from backend repo

From `CalmingMoments_backend/`:

```bash
docker compose up -d
```

### 2) Run Survey Site

From `Survey_Site/`:

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3001
```

## Environment

`.env.local`:

```text
MONGODB_URI=mongodb://localhost:27017/calmingbeats-dev
SESSION_SECRET=survey-session-secret-change-me
```

## Notes

- Keep a single local MongoDB source of truth (backend compose).
- Survey content is defined in `content_doc/` and mapped in `src/lib/surveys.ts`.
- The app currently uses custom CSS theme colors:
  - Theme: `#9AD4BD`
  - Accent: `#DF8A60`
