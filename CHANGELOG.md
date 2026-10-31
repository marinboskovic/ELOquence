# Changelog

## 2.0.0 — ELOquence 2.0

### New
- **Opener Lab** (`/lab`) — analyse any legal word as an opener (bits of information, rank among all
  12,953 guesses, pattern spread, best openers) and a position explorer that shows the remaining
  answers and the engine's best next guess after any painted feedback. Public, no account needed.
- **Public profiles** (`/u/<username>`) — rating, peak, win rate, guess distribution, ELO sparkline,
  favourite opener, recent grids and achievements. Opt-out with the new *Public profile* setting.
- **Seasons** — a monthly race ranked by ELO gained (`/leaderboard` → Season). Lifetime ratings are
  never reset.
- **Account security** — change password, "sign out everywhere", a list of signed-in devices with
  per-device sign-out, forgot/reset password by e-mail.
- **Dashboard** — nemesis words (what keeps beating you), pace (average and fastest solve), favourite
  opener with its personal solve rate, move-quality mix.
- **Data export** — download everything stored about you as JSON (Settings → Privacy).
- **Admin** — ban/unban accounts (all sessions revoked instantly, hidden from leaderboards).
- Theme *System* option, native share sheet with colour-blind emoji and the hard-mode `*`,
  styled 404/error pages, per-page titles, PWA shortcut for the Lab.

### Security
- Access tokens are now short-lived (30 min) JWTs with `jti`/`iat`/`iss` and a per-user
  `token_version`; sessions use rotating refresh tokens with reuse detection. Password change,
  reset, "sign out everywhere" and bans invalidate every existing token immediately.
- Google sign-in: `state` parameter (login CSRF), tokens delivered in the URL fragment (never logged),
  display names sanitised before becoming usernames.
- Word leaks closed: abandoning a daily or a challenge no longer reveals the word; live games no
  longer ship engine output (`optimal_word`, remaining counts…); challenge results and `/mine` reveal
  the word only after *your* attempt is finished; challenges are keyed by id instead of by word;
  the unused `/graph` router (shared cache across users) is gone; the client-supplied local date is
  only trusted when some real timezone is actually on that date.
- Rate limiting everywhere it was missing (register, Google, guest daily, guesses, AI, analysis,
  challenge creation, push, replay, password reset) plus a global per-IP budget and a 256 KB body
  cap. Real client IPs via `Fly-Client-IP` instead of the spoofable `X-Forwarded-For`.
- The backend refuses to start in production with the default `JWT_SECRET`; API docs are disabled
  in production; e-mails are case-insensitive; login runs bcrypt even for unknown e-mails
  (no timing enumeration); common passwords are rejected; push endpoints are allow-listed
  (SSRF); coach-chat input is bounded and delimited against prompt injection.
- Frontend: Content-Security-Policy and security headers, no session wipe on a wrong password,
  `?next=` return paths accept relative URLs only, service-worker notification clicks restricted to
  same-origin URLs, per-account caches cleared on logout.
- Docker image runs as a non-root user from a multi-stage build; `.dockerignore` keeps secrets out.

### Fixed
- Solve time is now recorded server-side, so the ELO time term and the speed achievements work.
- The pattern matrix is built with vectorised numpy in ~20 s instead of minutes (Fly cold starts).
- Gemini calls no longer block the event loop; the AI cache no longer 500s after 30 days.
- Admin "set daily word" always failed; now updates in place (puzzle number stays stable).
- Abandon vs final-guess race, replay matched by creation day instead of puzzle word, leaderboard
  neighbours with equal rating disappearing, stale streaks (streaks now expire when a day is missed),
  placement counting unrated games, duplicate achievement rows, `%` in database URLs breaking Alembic.
- Light theme on the game screen, Enter firing twice after an on-screen key, typing behind the
  abandon dialog, missing "Not in word list" message, timer restarting on resume, dismissing one
  announcement hiding all of them, Learn progress leaking between accounts on a shared device.

### Removed
- Dead components (~2,400 lines), `@xyflow/react`, `elkjs`, `playwright`, the `/graph` API, unused
  engine helpers.

### Developer experience
- `pytest` suite against a real PostgreSQL (auth, games, challenges, lab, profiles, seasons, admin).
- GitHub Actions CI: ruff + pytest, tsc + lint + `next build`.
- `docker compose up` applies migrations automatically; `.env.example` documents every variable.
