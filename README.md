# Survey Site

Next.js survey app for CalmingBeats / SomaBeats. It is designed to run locally with Docker and uses the same MongoDB database name as the backend: `calmingbeats-dev`.

## What it does

- Serves survey pages at routes like `/survey/day-7`, `/survey/day-14`, and `/survey/nightly-recap`
- Accepts identity from the iOS app through `/start`
- Stores tracker and survey response data in MongoDB

## Requirements

- Docker Desktop
- Node.js 20+ and pnpm, if you want to run outside Docker

## Run with Docker

From the `Survey_Site/` folder:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:3001
```

This starts:

- MongoDB on `localhost:27017`
- Survey Site on `localhost:3001`

The app connects to:

```text
mongodb://mongo:27017/calmingbeats-dev
```

## Run without Docker

If you already have MongoDB running locally:

```bash
pnpm install
pnpm dev
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
