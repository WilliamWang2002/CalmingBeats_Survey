# Plan: Survey Site (Next.js)

## Status: Implementation in progress — core auth & routes complete, design system setup in progress

---

## Overview

A standalone Next.js web app hosted under `/Survey_Site`. Participants are deep-linked into
it from the CalmingBeats iOS app via **WKWebView** (see decision below). Captures survey responses and behavioral timing data.
Writes to the same MongoDB instance as `CalmingMoments_backend`.

**Deployment:** WebView can iterate rapidly on survey questions without app store review—deploy
changes instantly to production.

**Design system:** shadcn/ui + Tailwind CSS with theme color #9AD4BD, light background hues, accent #DF8A60. 

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

**Implementation:** iOS app opens Survey Site URL in `WKWebView` or sends email link.
Survey Site looks up user by email at `/start`, sets session cookie, redirects to survey form.

---

### User Identification (Email-Based)

**Two distribution channels, both email-backed:**

- **Option 1: In-app WebView (push notification triggered)**
  - iOS push notification deep-links into Survey Site via WKWebView
  - URL: `GET /start?email=user@example.com&surveyType=day-7`
  - Survey Site looks up `users.findOne({ email })` to get `userId`
  - Validates user hasn't already submitted this `surveyType` (one submission per survey)
  - Sets HttpOnly session cookie with userId
  - Redirects to `/survey/day-7`

- **Option 2: Browser link (email-based surveys)**
  - Backend or iOS requests single-use code from Survey Site: `POST /api/launch-code` with `{ email, surveyType }`
  - Survey Site generates code, stores in `surveyLaunchCodes` collection with email + surveyType
  - Backend/email system sends browser link: `/start?email=user@example.com&code=<code>`
  - User clicks link in email → Survey Site validates email + code + surveyType
  - Checks user hasn't already submitted this survey
  - Marks code as used, sets HttpOnly cookie, redirects to `/survey/[surveyType]`
  - After submission completes, code is permanently invalidated

**Why email-only:**
- Email is safe to pass in URLs (not a secret like a token)
- Consistent mechanism across both flows (WebView and email link)
- Simpler than JWT verification (no signature checks, token revocation lists)
- Still server-side: `userId` is always looked up from email, never accepted from URL/body

**One submission per survey constraint:**
- `surveyResponses` unique index on `(userId, surveyType)` prevents duplicate submissions
- Client-side: check response status before showing survey
- Server-side: reject submission if already exists

**Email lookup logic (Survey Site `src/lib/auth.ts`):**
```
GET /start?email=user@example.com
  → query users collection: User.findOne({ email })
  → if not found: throw 401
  → return userId for session creation

GET /start?email=user@example.com&code=<code>
  → query surveyLaunchCodes: findOne({ code, email, used: false, expiresAt > now })
  → if not found: throw 401
  → mark code as used: update({ used: true, usedAt: now })
  → return userId from code record
```

### Database Strategy
- Use **Mongoose** (not Prisma) in the Next.js app
- Point `MONGODB_URI` at the same `mongodb://localhost:27017/<db>` as the NestJS backend
- New collections: `surveyTrackers`, `surveyResponses` — no conflict with existing collections
- No schema migration needed; MongoDB is schemaless at the engine level

### Survey Routing: Separate Routes per Survey Type

**Decision: Each survey type gets its own route (`/survey/day-7`, `/survey/day-14`, etc.).**

Rationale:
- **Different question sets:** Day 7, Day 14, Day 21, nightly recap — each with dedicated Q1-Q5 questions
- **Easier iteration:** Change one survey's questions without touching others
- **Analytics clarity:** Recording `surveyType` in responses makes analysis unambiguous
- **One submission per survey:** Each route enforces `(userId, surveyType)` uniqueness — user cannot retake
- **A/B testing:** Route to `day-7-v1` vs `day-7-v2` via feature flags, measure conversion difference

**Supported routes:**
```
/survey/day-7               → Questions Q1-Q5 at Day 7 mark
/survey/day-14              → Questions Q1-Q5 at Day 14 mark
/survey/day-21              → Questions Q1-Q5 at Day 21 mark
/survey/nightly-recap       → Quick check-in question
```

Each route:
- Receives `sessionId`, `calmScore`, `interventionCount`, `userSegment` via query params
- Posts responses to `/api/survey` with `surveyType` field in payload
- Validates user hasn't already submitted this survey (one-per-user enforcement)
- Can version independently (e.g., `day-7-v2` for A/B test)

### Survey Trigger & Distribution
- **Option 1 (in-app):** iOS push notification deep-links to WebView at scheduled time (Day 7, Day 14, Day 21, nightly)
- **Option 2 (email):** Backend generates launch code, sends email link (user clicks to browser)
- **One submission per survey:** User cannot retake once submitted (enforced by unique `(userId, surveyType)` constraint)
- Survey Site is reactive: triggers only when user visits link (via push or email click)

---

## MongoDB Schemas

### `survey_trackers` — behavioral timing (append-only)

```ts
{
  userId:          String,             // MongoDB ObjectId string from email lookup
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
  userId:      String,   // looked up server-side from email, never accepted from URL
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
| `GET/POST` | `/start` | Auth entrypoint: email lookup or code redemption -> HttpOnly cookie -> redirect `/survey/[type]` |
| `POST` | `/api/launch-code` | Browser fallback: mint single-use code (expires 60 sec, invalidated after submission) |
| `POST` | `/api/tracker` | Called on page load — creates tracker doc, returns `sessionId` |
| `POST` | `/api/survey` | Saves responses + all timing events + sets `finalSubmitTime` + records `surveyType` |
| `GET`  | `/api/survey-result` | Returns responses + tracker for the authenticated user |
| `GET`  | `/api/docs` | Swagger UI |

`userId` is derived server-side only. After `/start`, survey APIs authenticate via
HttpOnly cookie session.

### GET/POST /start
- **Option 1 (WebView):** receives `?email=user@example.com`, looks up user, sets cookie, redirects to `/survey/[type]?sessionId=X&calmScore=Y`
- **Option 2 (Browser email link):** receives `?email=user@example.com&code=<code>`, validates both, marks code used, sets cookie, redirects to survey

Query params supplied by iOS app before deep-linking; Survey Site reads them to populate context in forms.

### POST /api/launch-code
**Caller:** Backend or iOS (not user-facing)
**Request body:** `{ "email": "user@example.com", "surveyType": "day-7" }`
**Response:** `{ "code": "<single-use-code>", "email": "user@example.com", "surveyType": "day-7", "expiresInSec": 600 }`
**Use case:** Generate single-use codes for email-based survey distribution

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
Option 1: In-app WebView (push notification)
  Push notification → deep-link /start?email=user@example.com&surveyType=day-7
  → Survey Site looks up email → validates not already submitted
  → sets cookie, redirects to /survey/day-7

Option 2: Browser email link (backend-initiated)
  Backend/email system → POST /api/launch-code { email, surveyType }
  → Survey Site generates single-use code
  → Backend sends email: /start?email=user@example.com&code=<code>
  → User clicks link
  → Survey Site validates email + code + surveyType, marks used
  → sets cookie, redirects to /survey/[surveyType]

/start
  → look up user by email
  → if code provided: redeem and validate (mark used)
  → check surveyType: user hasn't already submitted
  → set HttpOnly survey session cookie
  → redirect to /survey/[surveyType]

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
├── .env.local                      # MONGODB_URI
├── next.config.mjs
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
│   │   ├── auth.ts                 # Email lookup + launch code verification
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

For Survey Site local development, Docker should handle **MongoDB only**, matching the backend workflow.
The Next.js app should run directly with `pnpm dev` for faster iteration.

Why this is the better fit here:
- Survey content is expected to change often
- Next.js hot reload is faster outside Docker
- Matches backend local development pattern already used by the team
- Reduces container/debugging complexity during the pilot

Each service can still have a Dockerfile for optional containerized smoke testing, but the default local workflow should be Mongo-only Docker.

Example local structure:

```
CalmingMoments_backend/              ← Separate repo
├── .git
├── Dockerfile                       # Optional smoke-test / production-like build
└── src/

Survey_Site/                         ← Separate repo
├── .git
├── Dockerfile                       # Optional smoke-test / production-like build
└── src/

SomaBeats/                           ← Meta repo
├── .git
├── docker-compose.yml               # Orchestrates backend + survey-site + mongo locally
└── README.md
```

### MongoDB `docker-compose.yml` (Local Dev)

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

volumes:
  mongo_data:
```

This shared MongoDB container should be started from `CalmingMoments_backend/`, not from `Survey_Site/`.
There should be a single local MongoDB compose entrypoint to avoid port conflicts on `localhost:27017`.

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

> Requires `output: 'standalone'` in `next.config.mjs` to enable standalone build output.

### Local Dev Workflow

```bash
# In CalmingMoments_backend/ - start shared MongoDB once
docker compose up -d

# In CalmingMoments_backend/
pnpm start:dev

# In Survey_Site/
pnpm install
pnpm dev
```

Survey Site should use `MONGODB_URI=mongodb://localhost:27017/calmingbeats-dev` for this workflow.
Do not start MongoDB separately from `Survey_Site/`.

---

## Dependencies

| Package | Purpose |
|---|---|
| `mongoose` | MongoDB ODM |
| `uuid` | Generate `sessionId` |
| `zod` | Request body validation |
| `cookie` | Parse/set cookie headers for session exchange |
| `swagger-ui-react` | Swagger UI at `/api/docs` |
| `next` `react` `react-dom` | Framework |
| `shadcn/ui` | Accessible component library |
| `tailwindcss` | Utility-first CSS |

**Environment variables (`.env.local`):**
```
MONGODB_URI=mongodb://localhost:27017/calmingbeats-dev
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

---

## Design System

### Color Palette
- **Theme (Primary):** #9AD4BD
- **Background:** Very light hue of theme (e.g., #F5FAF9)
- **Accent (Pop):** #DF8A60
- **Supporting:** Light monotone grays

### Component Library
- **Framework:** shadcn/ui + Tailwind CSS
- **Key components:** `button`, `card`, `radio-group`, `progress`, `tooltip`
- **Customization:** Tailwind config with theme color palette

### Survey Content
- **Day 7, 14, 21 questions:** Defined in `content_doc/` (Q1-Q5 per survey)
- **Implementation:** Parse content into `src/lib/surveys.ts` structured format
- **Nightly recap:** Quick single-question check-in (defined separately)

---

## Open Items

- [ ] **Setup shadcn/ui + Tailwind** — Initialize design system with color palette
- [ ] **Parse survey content** into structured format in `src/lib/surveys.ts`
- [ ] **Implement email-based auth** in `/start` and `/api/launch-code` routes
- [ ] **Single-use code enforcement** — Mark code as used after submission completes
- [ ] **Create survey form components** (question card, progress bar, submit button)
- [ ] **Add tooltips and question numbering** per design spec
- [x] **Prevent re-takes:** One submission per `(userId, surveyType)` via unique index + server-side validation
- [ ] **Design variant routing** for A/B testing (feature flags or query param)
- [ ] **Create root `SomaBeats/docker-compose.yml`** (orchestrates services locally)
- [ ] **Update `SomaBeats/README.md`** with developer onboarding steps
