# Survey Site

Next.js survey app for CalmingBeats / SomaBeats.

## Current Behavior

- Uses email-based identity at `/start`.
- Supports two entry paths:
  - Option 1: iOS WebView link (`/start?email=...&surveyType=...`)
  - Option 2: Email browser link with one-time code (`/start?email=...&code=...`)
- Enforces one submission per `(userId, surveyType)`.
- Already-submitted users are redirected to `/already-submitted` before survey usage.
- Direct survey routes (`/survey/day-7`, `/survey/day-14`, `/survey/day-21`, `/survey/nightly-recap`) are server-guarded against re-takes.
- Tracker records include `surveyType`.
- Root route `/` is intentionally not used as a landing page.

## Supported Survey Types

- `day-7`
- `day-14`
- `day-21`
- `nightly-recap`

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
http://localhost:3000
```

## Environment

`.env.local`:

```text
MONGODB_URI=mongodb://localhost:27017/calmingbeats-dev
SESSION_SECRET=survey-session-secret-change-me
```

## Manual Testing Procedure

Primary test email used in this project:

```text
e2e-launch-code-user@example.com
```

### 1) Seed/Verify User

Ensure this document exists in `users` collection:

```js
{ "email": "e2e-launch-code-user@example.com", "token": [], "createdAt": new Date() }
```

### 2) SurveyType Matrix Test

Open each link and complete/submit the survey:

1. `http://localhost:3000/start?email=e2e-launch-code-user@example.com&surveyType=day-7`
2. `http://localhost:3000/start?email=e2e-launch-code-user@example.com&surveyType=day-14`
3. `http://localhost:3000/start?email=e2e-launch-code-user@example.com&surveyType=day-21`
4. `http://localhost:3000/start?email=e2e-launch-code-user@example.com&surveyType=nightly-recap`

Expected:

- Redirect to matching `/survey/<surveyType>`
- `Initializing...` clears
- Submit enables after required answers
- Submit succeeds

### 3) One-Time Code Flow

PowerShell:

```powershell
$body = @{ email = "e2e-launch-code-user@example.com"; surveyType = "nightly-recap" } | ConvertTo-Json
$resp = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/launch-code -ContentType application/json -Body $body
```

macOS (zsh/bash):

```bash
curl -s -X POST "http://localhost:3000/api/launch-code" \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e-launch-code-user@example.com","surveyType":"nightly-recap"}'
```

Optional (macOS with jq):

```bash
CODE=$(curl -s -X POST "http://localhost:3000/api/launch-code" \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e-launch-code-user@example.com","surveyType":"nightly-recap"}' | jq -r '.code')
echo "$CODE"
```

Then open:

```text
http://localhost:3000/start?email=e2e-launch-code-user@example.com&code=<PASTE_CODE>
```

Expected:

- Redirect into survey
- Submit succeeds
- Launch code is marked used

### 4) Duplicate Submission Behavior

After successful submission of a given surveyType, retry that same survey link.

Expected:

- Redirect to `/already-submitted`

### 5) Negative Checks

1. Invalid code -> reject
2. Expired code (TTL 600 sec) -> reject
3. Unknown email -> user lookup failure

## Automated Testing

From `Survey_Site/`:

```bash
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
```

Current status expectation:

- Unit: passing
- Integration: passing
- E2E: known submit-enabled issue under investigation

## Notes

- Keep a single local MongoDB source of truth (backend compose).
- Survey content is defined in `content_doc/` and mapped in `src/lib/surveys.ts`.
- The app currently uses custom CSS theme colors:
  - Theme: `#9AD4BD`
  - Accent: `#DF8A60`
