# Survey Site

Next.js survey app for CalmingBeats / SomaBeats. It shares the same local MongoDB instance and database name as the backend: `calmingbeats-dev`.

## What it does

- Serves survey pages at routes like `/survey/day-7`, `/survey/day-14`, and `/survey/nightly-recap`
- Accepts identity from the iOS app through `/start`
- Stores tracker and survey response data in MongoDB

## Requirements

- Docker Desktop
- Node.js 20+ and pnpm

## Local Development Model

- Start MongoDB **once**, from `CalmingMoments_backend/`
- Run backend with `pnpm start:dev`
- Run Survey Site with `pnpm dev`
- Both apps connect to `mongodb://localhost:27017/calmingbeats-dev`

## Start Shared MongoDB

From `CalmingMoments_backend/`:

```bash
docker compose up -d
```

That starts the shared local MongoDB on:

```text
localhost:27017
```

## Run the Backend

From `CalmingMoments_backend/`:

```bash
pnpm start:dev
```

## Run the Survey Site

From `Survey_Site/`:

```bash
pnpm install
pnpm dev
```

Then open:

```text
http://localhost:3001
```

## Environment

Survey Site should use:

```text
MONGODB_URI=mongodb://localhost:27017/calmingbeats-dev
JWT_SECRET=defaultSecret
SESSION_SECRET=survey-session-secret-change-me
```

## Notes

- Do **not** start a second MongoDB container from Survey Site. Mongo should be started from the backend repo only.
- For the full auth flow, the backend must be running because `/start` verifies backend JWTs and checks the shared `users` collection.
- Survey routes are intentionally separate so content can change often without touching the iOS app.
- Running Survey Site outside Docker keeps Next.js hot reload fast during survey iteration.
# Survey Site

Next.js survey app for CalmingBeats / SomaBeats. It follows the same local development pattern as the backend: Docker runs MongoDB only, and the Next.js app runs directly on your machine. It uses the same MongoDB database name as the backend: `calmingbeats-dev`.

## What it does

- Serves survey pages at routes like `/survey/day-7`, `/survey/day-14`, and `/survey/nightly-recap`
- Accepts identity from the iOS app through `/start`
- Stores tracker and survey response data in MongoDB

## Requirements

- Docker Desktop
- Node.js 20+ and pnpm, if you want to run outside Docker

## Local Development Model

- Docker handles **MongoDB only**
- Survey Site runs with `pnpm dev`
- MongoDB database name matches backend local dev: `calmingbeats-dev`

## Start MongoDB with Docker

From the `Survey_Site/` folder:

```bash
docker compose up -d
```

This starts MongoDB on:

```text
localhost:27017
```

## Run the Survey Site

From the `Survey_Site/` folder:

```bash
pnpm install
pnpm dev
```

Then open:

```text
http://localhost:3001
```

## What Docker starts

- MongoDB on `localhost:27017`

The app connects to:

```text
mongodb://localhost:27017/calmingbeats-dev
```

Make sure `.env.local` points to the backend database name:

```text
MONGODB_URI=mongodb://localhost:27017/calmingbeats-dev
JWT_SECRET=defaultSecret
SESSION_SECRET=survey-session-secret-change-me
```

## Notes

- For the full auth flow, the backend must also be running because `/start` verifies the backend JWT and checks that token against the backend `users` collection.
- The survey routes are intentionally separate so content can change often without touching the iOS app.
- This setup is better for fast survey iteration because Next.js hot reload stays fast and you are not rebuilding an app container for content changes.
