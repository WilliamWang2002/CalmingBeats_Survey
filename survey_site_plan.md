# Plan: Survey Site (Next.js)

## Status: Planning complete — implementation not started

---

## Overview

A standalone Next.js web app hosted under `/Survey_Site`. Participants are deep-linked into
it from the CalmingBeats iOS app. Captures survey responses and behavioral timing data.
Writes to the same MongoDB instance as `CalmingMoments_backend`.

---

## Key Decisions

### User Identification
- iOS app passes its existing CalmingMoments Bearer token via `Authorization: Bearer <token>` header
- Survey Site verifies the JWT using the **same `SECRET`** as `CalmingMoments_backend` (shared env var)
- `userId` is extracted from `payload.userId` — never trusted from the client or URL
- Survey Site also validates the token is still active by checking `user.token[]` in the `users`
  collection (replicates backend session-revocation behavior)
- No backend changes required — no new endpoint, no new token, no raw userId in URL

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

### Survey Trigger
- Survey is initiated exclusively via hyperlink from the CalmingBeats iOS frontend
- No in-app auth flow on the survey site itself
- One survey session per link click (identified by `sessionId` uuid)

---

## MongoDB Schemas

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
| `POST` | `/api/tracker` | Called on page load — creates tracker doc, returns `sessionId` |
| `POST` | `/api/survey` | Saves responses + all timing events + sets `finalSubmitTime` |
| `GET`  | `/api/survey-result` | Returns responses + tracker for the authenticated user |
| `GET`  | `/api/docs` | Swagger UI |

All endpoints require `Authorization: Bearer <token>` header. `userId` is derived
server-side from the verified JWT — never passed by the client.

### POST /api/tracker
**Header:** `Authorization: Bearer <token>`
**Request body:** `{}` *(empty — userId comes from token)*
**Response:**
```json
{ "sessionId": "<uuid>" }
```

### POST /api/survey
**Header:** `Authorization: Bearer <token>`
**Request body:**
```json
{
  "sessionId": "<uuid>",
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
**Header:** `Authorization: Bearer <token>`
**Response:** merged tracker + responses for the authenticated user

---

## Client-Side Timing Logic

The frontend tracks events locally and sends everything on final submit (batched, not incremental).
The Bearer token is sent in the `Authorization` header on every API call — never in the URL or body.

```
Page mounts (app opens WKWebView with token injected as default header)
  → record surveyOpenTime = Date.now()
  → POST /api/tracker              // Authorization: Bearer <token>
      server: verify token → extract userId → create tracker doc
      response: { sessionId }

User focuses a question
  → record { questionId, occurredAt: Date.now(), isEdit: hasAlreadyAnswered(questionId) }
  → push to local questionEvents[]

User clicks Submit
  → POST /api/survey               // Authorization: Bearer <token>
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
│   │   ├── page.tsx                # Survey UI entry point
│   │   └── api/
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
│   │   └── models/
│   │       ├── SurveyTracker.ts
│   │       ├── SurveyResponse.ts
│   │       └── User.ts             # Read-only model on shared users collection (for token check)
│   │
│   └── swagger/
│       └── spec.ts                 # OpenAPI 3.0 spec object
```

---

## Docker

### Strategy
Root-level `docker-compose.yml` owns MongoDB and orchestrates both services. The backend's
existing `CalmingMoments_backend/docker-compose.yml` is **not modified** — it stays as a
solo dev shortcut (mongo only). Both files define a `mongo` service but live in separate
Compose projects (different directories = different project names) so they don't conflict
as long as you don't run both simultaneously on port 27017.

```
SomaBeats/
├── docker-compose.yml              ← NEW: mongo + backend + survey-site
├── CalmingMoments_backend/
│   ├── docker-compose.yml          ← unchanged (solo mongo for backend dev)
│   └── Dockerfile                  ← NEW
└── Survey_Site/
    └── Dockerfile                  ← NEW
```

### Root `docker-compose.yml`

```yaml
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
    build: ./CalmingMoments_backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: mongodb://mongo:27017/<dbname>
      SECRET: <shared_jwt_secret>
    depends_on:
      - mongo

  survey-site:
    build: ./Survey_Site
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

**Critical:** inside Docker, services reach MongoDB via hostname `mongo` (the service name),
not `localhost`. `.env.local` keeps `localhost` for local dev; Docker env vars override it.

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

### Workflow

```bash
# Full stack (from SomaBeats/ root)
docker compose up

# Survey site + mongo only — skip backend
docker compose up mongo survey-site

# Backend solo dev — unchanged existing workflow
cd CalmingMoments_backend && docker compose up
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `mongoose` | MongoDB ODM |
| `uuid` | Generate `sessionId` |
| `zod` | Request body validation |
| `jose` | JWT verification (same secret as CalmingMoments backend) |
| `swagger-ui-react` | Swagger UI at `/api/docs` |
| `next` `react` `react-dom` | Framework |

**Environment variables (`.env.local`):**
```
MONGODB_URI=mongodb://localhost:27017/<dbname>
JWT_SECRET=<same value as CalmingMoments_backend SECRET>
```

---

## Open Items

- [ ] **Survey question set not yet finalized** — required before building QuestionCard and
      tightening the `answer: Mixed` type in SurveyResponse
- [ ] Decide if survey can be re-taken (currently: one doc per sessionId, multiple sessions
      per userId are allowed — no enforcement of one-per-user)
- [ ] Confirm MongoDB database name (must match `CalmingMoments_backend` DATABASE_URL)
- [ ] Confirm `SECRET` env var name matches between both projects before deploying
- [ ] Decide how iOS WKWebView injects the Authorization header (custom URL scheme vs.
      injected JS on load)
- [ ] Add `output: 'standalone'` to `next.config.ts` before building Docker image
- [ ] Create root-level `docker-compose.yml` and `Survey_Site/Dockerfile`
- [ ] Create `CalmingMoments_backend/Dockerfile` if full-stack Docker is needed
