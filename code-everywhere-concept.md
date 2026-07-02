# Code Everywhere Concept (Discussion Draft)

## Goal
Require a one-time launch code for every survey entry path, including iOS webview and email browser links.

This is a proposal document only. It does not reflect implementation changes yet.

## Why This Policy
- Removes mixed-trust behavior between channels.
- Blocks simple URL tampering for direct survey access.
- Gives a single audit story: no code, no session.
- Simplifies reasoning for security reviews.

## Current Structure (As-Is)
- Entry endpoint: /start accepts email and optional code.
- Webview-like path can start with email + surveyType (no code).
- Email-link path can start with email + code.
- Session cookie is issued after /start and used by submit APIs.
- Launch code is marked used when survey submission succeeds.

## Target Structure (Code Everywhere)
- /start requires email + code for all channels.
- surveyType is derived from validated launch-code record only.
- No session is created when code is missing, expired, invalid, or already used.
- iOS app and email systems both obtain code from backend-controlled issuance.

## Two Flows Under Code Everywhere

### Flow 1: iOS App WebView (No Manual User Typing)
1. iOS app asks trusted backend for survey launch.
2. Backend requests one-time code from survey service.
3. Backend returns launch URL with email + code to app.
4. App opens webview at /start?email=...&code=...
5. /start validates code, sets session cookie, redirects to survey route.
6. User submits survey; code is consumed (used=true).

### Flow 2: Email Browser Link
1. Backend requests one-time code for user + survey type.
2. Backend sends email containing /start?email=...&code=...
3. User opens link.
4. /start validates code, sets session cookie, redirects to survey route.
5. User submits survey; code is consumed (used=true).

## Security Controls
- Code TTL: 5-10 minutes.
- Single-use code with used flag and usedAt timestamp.
- Bind code to normalized email and survey type.
- Rate limit attempts by email + IP.
- Log issuance, redemption, rejection, and replay attempts.
- Keep session cookie HttpOnly, Secure in production, SameSite=Lax (or stricter if possible).

## API Behavior (Concept)

### Issue Code
POST /api/launch-code
- Input: email, surveyType
- Output: code, expiresInSec
- Validation: user exists, survey not already submitted, rate limits

### Start Session
GET or POST /start
- Required input: email, code
- Success: Set-Cookie survey_session + redirectPath
- Failure: 401 for invalid/missing/expired/used code, 409 for already submitted

### Submit Survey
POST /api/survey
- Requires valid session cookie
- Persists response and tracker
- Marks launch code used=true (idempotent-safe update)

## Data Model Expectations
- surveyLaunchCodes collection fields:
  - code
  - email
  - surveyType
  - expiresAt
  - used
  - usedAt
  - createdAt
- Recommended indexes:
  - unique on code
  - index on email + surveyType + used + expiresAt

## Rollout Plan (No Code Changes in This Draft)
1. Update docs and client contracts to state code is mandatory.
2. Update backend/app integrations so both channels request launch code first.
3. Enforce required code in /start.
4. Update tests for success and negative paths.
5. Monitor completion rate and support tickets for friction impact.

## Tradeoff Summary
Pros:
- Stronger and more uniform access control.
- Lower abuse risk from URL manipulation.
- Clear enterprise-style control boundary.

Cons:
- Extra integration step for iOS and email services.
- Potential user friction if link delivery is delayed.
- More operational dependency on launch-code issuance uptime.

## Open Questions For Discussion
1. Should code TTL be 5 or 10 minutes?
2. Should survey session lifetime be reduced from current long duration?
3. Do we need dedicated analytics dashboards for code failures and replays?
4. Should we eventually add a trusted JWT launch path, or keep code-only for all channels?
