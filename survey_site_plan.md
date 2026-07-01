# Plan: Survey Site (Next.js)

## Status: Planning complete — implementation not started

---

## Overview

A standalone Next.js web app hosted under `/Survey_Site`. Participants are deep-linked into
it from the CalmingBeats iOS app via **WKWebView** (see decision below). Captures survey responses and behavioral timing data.
Writes to the same MongoDB instance as `CalmingMoments_backend`.

**Deployment:** WebView can iterate rapidly on survey questions without app store review—deploy
changes instantly to production.

---

## Key Decisions

### Client Platform: WKWebView (not Browser)

**Decision: Use iOS `WKWebView` for survey display.**

| Factor | Browser | WKWebView | Native Swift |
|--------|---------|-----------|---------------|
| User stays in app | ❌ | ✅ | ✅ |
| Context switch on notification | Bad | Seamless | Seamless |
| Iterate surveys without app store review | N/A | ✅ | ❌ |
| Code reuse (web) | N/A | ✅ | ❌ |
| Development speed | ✅ | ✅ | ❌ |
| Deep-link from push notifications | ✅ | ✅ | ✅ |

**Rationale:**
1. **Zero gatekeeping:** Change survey questions anytime → users see updates immediately. Browser requires
   sharing a public link; WKWebView keeps the experience integrated in CalmingBeats.
2. **Rapid iteration:** Pilot phase requires frequent tweaks (question wording, branching logic, segment-specific variants).
   WebView enables daily deployments without app store friction.
3. **Deep-linking:** Push notifications can direct to specific survey types (`/survey/day-7`, `/survey/post-intervention`)
   while keeping session context intact.
4. **Session continuity:** WKWebView preserves HttpOnly cookies; user never sees authentication details.

**Implementation:** iOS app opens Survey Site URL in `WKWebView` with Bearer JWT in Authorization header.
Survey Site verifies JWT at `/start`, sets session cookie, redirects to survey form.

---

### User Identification
- **Primary (recommended): WebView flow**
  - iOS opens Survey Site in `WKWebView` and sends existing CalmingMoments JWT in
    `Authorization: Bearer <token>` on the entry request
  - Survey Site verifies JWT, extracts `userId`, and immediately exchanges to an HttpOnly
    survey session cookie
- **Fallback (open browser flow): one-time launch code**
  - iOS requests a short-lived single-use launch code from Survey Site API using Bearer JWT
  - Browser opens `/start?code=...`; Survey Site redeems code, sets HttpOnly cookie, redirects
    to clean `/survey` URL
- Survey Site verifies JWT using the same backend signing secret and checks token is active in
  `user.token[]` (mirrors backend session-revocation behavior)
- `userId` is always derived server-side; never accepted from URL/body

**Verification logic (Survey Site `src/lib/verifyToken.ts`):**
```
Authorization: Bearer <token>
  → verify signature with SECRET + check not expired
  → decode payload.userId
  → query users collection: User.findById(userId)
  → confirm token is in user.token[]
  → return userId for use in tracker/survey writes
```

### Database Strategy
- Use **Mongoose** (not Prisma) in the Next.js app
- Point `MONGODB_URI` at the same `mongodb://localhost:27017/<db>` as the NestJS backend
- New collections: `surveyTrackers`, `surveyResponses` — no conflict with existing collections
- No schema migration needed; MongoDB is schemaless at the engine level

### Survey Routing: Separate Routes per Survey Type

**Decision: Each survey type gets its own route (`/survey/day-7`, `/survey/day-14`, etc.).**

Rationale:
- **Different question sets:** Day 7 (Q1-Q7) vs Day 14 (Q1-Q8, NPS) vs nightly recap (1 quick question)
- **Easier iteration:** Change one survey's questions without touching others
- **Analytics clarity:** Recording `surveyType` in responses makes analysis unambiguous
- **Segment branching:** Each route can check `userSegment` from JWT and render Student vs Working Professional variants
- **A/B testing:** Route to `day-7-v1` vs `day-7-v2` via feature flags, measure conversion difference

**Supported routes:**
```
/survey/day-7               → 5-7 questions at Day 7 mark
/survey/day-14              → 8 questions + NPS at Day 14 mark
/survey/day-21              → personalization check-in at Day 21
/survey/post-intervention   → 3 quick questions after an intervention
/survey/nightly-recap       → 1-2 questions summarizing the day
```

Each route:
- Receives `sessionId`, `calmScore`, `interventionCount`, `userSegment` via query params or JWT payload
- Posts responses to `/api/survey` with `surveyType` field in payload
- Can version independently (e.g., `day-7-v2` for A/B test)

### Survey Trigger
- Survey is initiated exclusively via deep-link from the CalmingBeats iOS frontend
- No in-app auth flow on the survey site itself
- One survey session per link click (identified by `sessionId` uuid)
- iOS scheduler determines *when* to trigger (Day 7, nightly, post-intervention); Survey Site is reactive

---

## MongoDB Schemas

### `survey_trackers` — behavioral timing (append-only)

```ts
{
  userId:          String,             // MongoDB ObjectId string from verified JWT
  sessionId:       String,             // uuid, unique — joins to survey_responses
  surveyOpenTime:  Date,               // recorded on page load
  questionEvents:  [QuestionEvent],    // append-only log, never overwritten or merged
  finalSubmitTime: Date | null,        // null if user abandoned
  createdAt:       Date
}
```

**Derivable from `questionEvents`:**
- Time-to-first-answer per question: first event where `isEdit = false`
- Revisit count per question: count of events where `isEdit = true`
- Total dwell time: diff between consecutive events touching a question
- Abandonment detection: `finalSubmitTime = null`








### `question_events` — embedded subdocument (no own collection)

```ts
{
  questionId:  String,    // e.g. "q1", "q2"
  occurredAt:  Date,      // client-recorded timestamp of the interaction
  isEdit:      Boolean    // false = first time answering, true = any subsequent revisit
}
```

Used only as an embedded array inside `survey_trackers.questionEvents`. Never stored
as a top-level collection. `_id` suppressed (`{ _id: false }`) to keep the array lean.

---

### `survey_responses` — final submitted answers

```ts
{
  userId:      String,   // from verified JWT
  sessionId:   String,   // unique, matches survey_trackers
  responses:   [
    {
      questionId: String,
      answer:     Mixed   // number | string | string[] — tighten once questions finalized
    }
  ],
  submittedAt: Date,
  createdAt:   Date
}
```

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/start` | Auth entrypoint: token/code exchange -> HttpOnly cookie -> redirect `/survey/[type]` |
| `POST` | `/api/launch-code` | Browser fallback only: mint short-lived single-use launch code |
| `POST` | `/api/tracker` | Called on page load — creates tracker doc, returns `sessionId` |
| `POST` | `/api/survey` | Saves responses + all timing events + sets `finalSubmitTime` + records `surveyType` |
| `GET`  | `/api/survey-result` | Returns responses + tracker for the authenticated user |
| `GET`  | `/api/docs` | Swagger UI |

`userId` is derived server-side only. After `/start`, survey APIs authenticate via
HttpOnly cookie session.

### GET/POST /start
- **WKWebView mode:** receives Bearer JWT, verifies, sets cookie, redirects to `/survey/[type]?sessionId=X&calmScore=Y`
- **Browser mode (fallback):** receives one-time `code`, redeems, sets cookie, redirects to `/survey/[type]?sessionId=X&calmScore=Y`

Query params supplied by iOS app before deep-linking; Survey Site reads them to populate context in forms.

### POST /api/launch-code
**Header:** `Authorization: Bearer <token>`
**Use case:** open-browser fallback only
**Response:** `{ "code": "<single-use-code>", "expiresInSec": 60 }`

### POST /api/tracker
**Auth:** HttpOnly cookie (from `/start`)
**Request body:** `{}`
**Response:**
```json
{ "sessionId": "<uuid>" }
```

### POST /api/survey
**Auth:** HttpOnly cookie (from `/start`)
**Request body:**
```json
{
  "sessionId": "<uuid>",
  "surveyType": "day-7",           // "day-7", "day-14", "day-21", "post-intervention", "nightly-recap"
  "variant": "v1",                 // optional, for A/B testing (e.g., "v2")
  "responses": [
    { "questionId": "q1", "answer": 4 },
    { "questionId": "q2", "answer": "Often" }
  ],
  "questionEvents": [
    { "questionId": "q1", "occurredAt": "2026-07-01T10:00:01Z", "isEdit": false },
    { "questionId": "q2", "occurredAt": "2026-07-01T10:00:15Z", "isEdit": false },
    { "questionId": "q1", "occurredAt": "2026-07-01T10:00:28Z", "isEdit": true }
  ],
  "finalSubmitTime": "2026-07-01T10:01:10Z"
}
```

### GET /api/survey-result
**Auth:** HttpOnly cookie (from `/start`)
**Response:** merged tracker + responses for the authenticated user

---

## Client-Side Timing Logic

The frontend tracks events locally and sends everything on final submit (batched, not incremental).
Identity is exchanged once at `/start`; survey APIs then use only HttpOnly cookie session.

```
App launch options:
  A) WebView (preferred)
     → open /start with Authorization: Bearer <token>
  B) Open browser fallback
     → call /api/launch-code with Bearer token
     → open /start?code=<single-use-code>

/start
  → verify token or redeem code
  → set HttpOnly survey session cookie
  → redirect to /survey

Page mounts (/survey)
  → record surveyOpenTime = Date.now()
  → POST /api/tracker              // cookie auth
      response: { sessionId }

User focuses a question
  → record { questionId, occurredAt: Date.now(), isEdit: hasAlreadyAnswered(questionId) }
  → push to local questionEvents[]

User clicks Submit
  → POST /api/survey               // cookie auth
      body: { sessionId, responses, questionEvents, finalSubmitTime: Date.now() }
```

Batched design chosen over incremental (one call per question) because:
- Partial data from abandoned sessions is not a priority for pilot
- Simpler — no retry/deduplication logic needed on the client

---

## Project Structure

```
Survey_Site/
├── .env.local                      # MONGODB_URI, JWT_SECRET
├── next.config.ts
├── package.json
├── tsconfig.json
├── Dockerfile
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
   │   ├── page.tsx                # Placeholder/landing
   │   ├── start/
   │   │   └── route.ts            # Token/code exchange, set cookie, redirect to /survey/[type]
   │   ├── survey/
   │   │   ├── day-7/
   │   │   │   └── page.tsx        # Questions 1-7, segment-aware branching
   │   │   ├── day-14/
   │   │   │   └── page.tsx        # Questions 1-8 + NPS, segment-aware
   │   │   ├── day-21/
   │   │   │   └── page.tsx        # Personalization check-in
   │   │   ├── post-intervention/
   │   │   │   └── page.tsx        # 3 quick questions: before/after/usefulness
   │   │   └── nightly-recap/
   │   │       └── page.tsx        # 1-2 questions, context from JWT (calm score, intervention count)
│   │   └── api/
│   │       ├── launch-code/
│   │       │   └── route.ts        # POST /api/launch-code (browser fallback)
│   │       ├── tracker/
│   │       │   └── route.ts        # POST /api/tracker
│   │       ├── survey/
│   │       │   └── route.ts        # POST /api/survey
│   │       ├── survey-result/
│   │       │   └── route.ts        # GET  /api/survey-result
│   │       └── docs/
│   │           └── route.ts        # GET  /api/docs → Swagger UI
│   │
│   ├── components/
│   │   ├── SurveyShell.tsx         # layout, loading/error states
│   │   ├── QuestionCard.tsx        # single question renderer (type-switched)
│   │   └── ProgressBar.tsx
│   │
│   ├── lib/
│   │   ├── mongodb.ts              # Mongoose singleton (Next.js hot-reload safe)
│   │   ├── verifyToken.ts          # JWT verify + session-active check (mirrors backend strategy)
│   │   ├── session.ts              # Issue/verify HttpOnly survey session cookie
│   │   └── models/
│   │       ├── SurveyTracker.ts
│   │       ├── SurveyResponse.ts
│   │       ├── User.ts             # Read-only model on shared users collection (for token check)
│   │       └── SurveyLaunchCode.ts # Optional one-time launch code model
│   │
│   └── swagger/
│       └── spec.ts                 # OpenAPI 3.0 spec object
```

---

## Docker

### Strategy
**Docker for local development only** (production does not use Docker).

Each service has a Dockerfile for local testing with MongoDB:

```
CalmingMoments_backend/              ← Separate repo
├── .git
├── Dockerfile                       # For local dev testing only
└── src/

Survey_Site/                         ← Separate repo
├── .git
├── Dockerfile                       # For local dev testing only
└── src/

SomaBeats/                           ← Meta repo
├── .git
├── docker-compose.yml               # Orchestrates backend + survey-site + mongo locally
└── README.md
```

### SomaBeats `docker-compose.yml` (Local Dev)

```yaml
version: '3.8'
services:
  mongo:
    image: mongo:7
    container_name: dev-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  backend:
    build: ../CalmingMoments_backend  # Build from local source
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: mongodb://mongo:27017/<dbname>
      SECRET: <shared_jwt_secret>
    depends_on:
      - mongo

  survey-site:
    build: ../Survey_Site             # Build from local source
    ports:
      - "3001:3001"
    environment:
      MONGODB_URI: mongodb://mongo:27017/<dbname>
      JWT_SECRET: <shared_jwt_secret>
    depends_on:
      - mongo

volumes:
  mongo_data:
```

### `Survey_Site/Dockerfile`

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

FROM base AS builder
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3001
CMD ["node", "server.js"]
```

> Requires `output: 'standalone'` in `next.config.ts` to enable standalone build output.

### Local Dev Workflow

```bash
# From SomaBeats/ root, with both service repos cloned locally
docker compose up

# Services build from source and start together
# Access:
#   MongoDB: localhost:27017
#   Backend: http://localhost:3000
#   Survey Site: http://localhost:3001
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `mongoose` | MongoDB ODM |
| `uuid` | Generate `sessionId` |
| `zod` | Request body validation |
| `jose` | JWT verification (same secret as CalmingMoments backend) |
| `cookie` | Parse/set cookie headers for session exchange |
| `swagger-ui-react` | Swagger UI at `/api/docs` |
| `next` `react` `react-dom` | Framework |

**Environment variables (`.env.local`):**
```
MONGODB_URI=mongodb://localhost:27017/<dbname>
JWT_SECRET=<same value as CalmingMoments_backend SECRET>
```

---

## Implementation Notes

### Rapid Iteration for Pilot Phase

**Survey content will change frequently.** This architecture supports daily updates:

1. **Question wording:** Edit `day-7/page.tsx`, redeploy → all users see new wording next load
2. **A/B variants:** Route users to `/survey/day-7?variant=v2` → different JSX, same schema
3. **Branching logic:** Check `userSegment` from JWT → render Student vs Working Professional questions
4. **No app review:** Zero gatekeeping; changes live within minutes
5. **Analytics:** `surveyType` + `variant` fields in responses allow measuring "which version converts better?"

**Workflow example:**
```
1. Question wording not resonating → edit src/app/survey/day-7/page.tsx
2. Deploy to production
3. Next user sees updated question text
4. Record variant in submission → analyze conversion difference
```

---

## Open Items

- [ ] **Survey question set must be finalized per survey type** — defines route structure and response schema
      - Day 7 questions (Q1-Q7)
      - Day 14 questions (Q1-Q8 + NPS)
      - Day 21 questions
      - Post-intervention questions
      - Nightly recap question(s)
- [ ] Decide if survey can be re-taken (currently: one doc per sessionId, multiple sessions
      per userId are allowed — no enforcement of one-per-user)
- [ ] Confirm MongoDB database name (must match `CalmingMoments_backend` DATABASE_URL)
- [ ] Confirm shared signing secret mapping (`CalmingMoments_backend: SECRET` -> `Survey_Site: JWT_SECRET`)
- [ ] Implement `/start` exchange route and HttpOnly cookie session helper
- [ ] Decide whether browser fallback (`/api/launch-code`) ships in v1 or later
- [ ] Add `output: 'standalone'` to `next.config.ts` before building Docker image
- [ ] Create `Survey_Site/Dockerfile` (multi-stage Next.js build as shown above)
- [ ] Create root `SomaBeats/docker-compose.yml` (orchestrates services locally)
- [ ] Update `SomaBeats/README.md` with developer onboarding steps
- [ ] Design variant routing for A/B testing (feature flags or query param)
