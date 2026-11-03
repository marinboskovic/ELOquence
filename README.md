# ELOquence

Competitive Wordle with an ELO ladder, a post-game move analyzer, an AI coach — and, since 2.0, an
interactive Opener Lab, public profiles, monthly seasons and proper account security.

**Live:** https://el-oquence.vercel.app

## What it does

- **Modes:** Daily (shared puzzle and streak), Competitive (the only mode that changes ELO), Practice
  (unrated), shareable challenge codes, Hard Mode (enforced server-side).
- **Post-game review:** scores every guess for skill and luck against the information-theoretically
  optimal guess, labels it from brilliant to blunder, and explains it with Gemini.
- **Opener Lab:** analyse any word as an opener (bits, rank among 12,953 guesses, pattern spread) and
  explore any position — paint the feedback you got, see what's left and what the engine would play.
- **Learn:** step-by-step lessons and interactive challenges that teach Wordle strategy.
- **Social:** leaderboard, monthly seasons, public profiles, challenges with results and grids.
- **Extras:** achievements, daily archive, Web Push notifications, PWA install, data export, admin panel.

## Stack

| | |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind, Framer Motion (Vercel) |
| Backend | FastAPI, async SQLAlchemy 2.0, Pydantic v2, numpy (Fly.io) |
| Database | PostgreSQL 16 + Alembic (Neon in prod) |
| Auth | Short-lived JWT access tokens + rotating refresh sessions, Google OAuth |
| AI | Google Gemini 2.5 Flash (optional) |
| E-mail | Resend (optional — password reset) |

## Run locally

```bash
cp .env.example .env          # set JWT_SECRET (32+ random chars); the rest is optional
docker compose up --build     # migrations run automatically on backend start
```

Frontend: http://localhost:3000 · API: http://localhost:8000 (docs at `/docs` outside production).

Without Docker:

```bash
# backend
cd backend && python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head && uvicorn app.main:app --reload
# frontend
cd frontend && pnpm install && pnpm dev
```

## Project layout

```
backend/app/analysis   information-theory engine (pattern matrix, entropy, classifier, Opener Lab)
backend/app/routers    auth, games, daily, challenges, analysis, ai, leaderboard, users, profiles, admin, push
backend/app/services   auth/sessions, ELO, game flow, achievements, push, mailer, rate limiting
backend/tests          pytest suite (real PostgreSQL)
frontend/app           Next.js routes (play, game, review, lab, u/[username], dashboard, leaderboard, …)
frontend/components    Wordle-style UI primitives (Tile, Keyboard, GameBoard, Dialog, …)
frontend/lib           API client, session store, settings, types
```

## License

Proprietary. Bachelor's thesis project, FER, University of Zagreb.
