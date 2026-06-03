# TODO — Bayana

Execution checklist and progress tracker. **Plan and rationale live in
[SPEC.md](SPEC.md)** (§13 Milestones, §16 Decision log); this file only tracks *task
state* — what's done and what's next. Keep it current; it's the "where we left off"
record across sessions. Decisions do **not** go here — log them in SPEC.md §16.

**Now:** Phase 1b → **deploy via Railway following `notes/deploy.md`** (your click-through).
Then Phase 1c (other levels + on-demand generation).

---

## ▶ Phase 1a — Playable slice (run locally, study ASAP)

Goal: a locally-running app you can actually study N3 with. No auth, no deploy yet.

### Foundation
- [x] Initialize git repo
- [x] Scaffold Next.js 16 app (TS, App Router, Tailwind v4) — builds clean
- [x] Add Prisma + `@prisma/client`; `docker-compose.yml` for local Postgres (port 5887);
  `.env` + `.env.example`; verify DB connection
- [x] Write `prisma/schema.prisma` from SPEC §6 — `User`, `UserProfile`, `Word`,
  `ExampleSentence`, `ReviewState`, **`ReviewLog`** + enums; first migration applied;
  `src/lib/db.ts` client singleton (Prisma 7 + `@prisma/adapter-pg`) — connection verified

### Data import (N3 only for now)
- [x] `scripts/import-csv.ts` — parse `decks/*.csv` → `Word` rows (quoted commas,
  `〜`/`(...)` placeholders, tag→level rules, `guid` unique key). N3 imported (2,140).
- [x] Seed the default `User` + `UserProfile` (`scripts/seed-user.ts`, idempotent);
  `DEFAULT_USER_ID` written to `.env`

### AI sentence generation (N3)
- [x] `src/lib/generate.ts` — cached prompt + JSON validation; sanity-checked 5 N3 words
  (~$0.003). On-demand `POST /api/generate` deferred to Phase 1b.
- [x] `scripts/seed-sentences.ts` — `--test` quality gate + Batch API submit
  (batch `msgbatch_01VKSSFCPCC8t5KECm3H83Gt`, 2135 N3 requests)
- [x] `scripts/collect-batch.ts` — collected 2,135 (0 malformed/failed); **N3 fully
  covered: 2,140 / 2,140 words have a sentence**

### Anki mode — review loop (JP→EN)
- [x] `ts-fsrs` adapter (`src/lib/fsrs.ts`) — Card ⇄ ReviewState, scheduler, log mapping
- [x] Review services (`src/lib/review.ts`) — `reviewWord` (+ `ReviewLog`),
  `undoLastReview` (ts-fsrs `rollback`), `getStudyQueue` — verified end-to-end
- [x] API route handlers: `GET /api/cards/queue`, `POST /api/review`,
  `POST /api/review/undo` — verified over HTTP (incl. 400 validation)
- [x] Mobile-first card UI (`src/components/study-session.tsx` + home page) —
  flip / rate / undo, iPhone SE baseline; builds + SSR-renders

### Done when
- [x] Run locally and study N3 end-to-end off the app — cards now show example sentences

---

## Phase 1b — Shippable (public): auth + deploy (N3 only)
- [x] **Auth** — magic-link (Auth.js v5 + Resend, single-email allowlist), database sessions
  - [x] Verified Auth.js v5 ↔ Next 16 (proxy.ts is Node runtime → DB sessions OK)
  - [x] Schema + migration (`User` fields + Account/Session/VerificationToken)
  - [x] `src/auth.ts` — Resend provider, **allowlist enforced before send**, 15-min tokens,
    DB sessions; route handler; sign-in page
  - [x] `proxy.ts` cookie guard; `getCurrentUserId` → session; API routes 401; page redirect
  - [x] Seeded user linked to allowlist email (sign-in attaches to existing user)
  - [ ] Remaining hardening: **rate-limit** the sign-in request (§11.3 #5) — not yet done
  - [ ] Manual test: magic-link sign-in end-to-end (needs Resend delivery — see note below)
- [x] **Deploy prep** — `railway.json` (Railpack, `start:prod`), `postinstall` generate,
  `start:prod` = migrate + `$PORT`, `prisma`/`dotenv` → runtime deps; **runbook in
  `notes/deploy.md`**. Verified `prisma migrate deploy` runs clean.
- **Deploy** (you, via Railway):
  - [x] Push to GitHub; transfer N3 cache via `pg_dump` pipe
  - [ ] Set env vars (fresh `AUTH_SECRET`, `AUTH_URL`, Resend/anthropic, `DATABASE_URL` ref); deploy
  - [ ] Generate domain → set `AUTH_URL` → redeploy; smoke-test sign-in; enable daily backups

## Phase 1c — Fill content (post-deploy)
- [ ] Seed remaining levels N5/N4/N2/N1 (Batch API)
- [ ] On-demand `/api/generate` + UI fetch-on-flip for not-yet-seeded words

## Phase 2+ (later)
See SPEC.md §13 — Duolingo mode, suspend/leech, stats, multi-user, enhancements.

## Open questions
Tracked in SPEC.md §15.
