# TODO — Bayana

Execution checklist and progress tracker. **Plan and rationale live in
[SPEC.md](SPEC.md)** (§13 Milestones, §16 Decision log); this file only tracks *task
state* — what's done and what's next. Keep it current; it's the "where we left off"
record across sessions. Decisions do **not** go here — log them in SPEC.md §16.

**Now:** Phases 1a–1c done (live on Railway; all 8,101 words seeded). **Phase 2 — Quiz mode
is functionally complete**: MC quiz with confusability-scored distractors, level-scoped home
hub, light `/stats`, installable PWA, and a sustainable 10-new-words/day pace. **Next:
browse/search** — the last concrete Phase 2 build. The MC↔FSRS coupling and Flashcard↔Quiz
synergy are deferred *by choice* (revisit after browse). Then
Phase 3 (admin audit + on-demand generation).

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

### Flashcard mode — review loop (JP→EN)
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
  - [x] Remaining hardening: **rate-limit** the sign-in request (§11.3 #5) — in-memory
    fixed-window limiter (`src/lib/rate-limit.ts`), enforced in `proxy.ts` on POST to the
    sign-in paths (per-IP 5/10min + global 20/10min); explicit 30-day session TTL (#6)
  - [x] Manual test: magic-link sign-in end-to-end — verified locally **and in prod**
- [x] **Deploy prep** — `railway.json` (Railpack, `start:prod`), `postinstall` generate,
  `start:prod` = migrate + `$PORT`, `prisma`/`dotenv` → runtime deps; **runbook in
  `notes/deploy.md`**. Verified `prisma migrate deploy` runs clean.
- **Deploy** (you, via Railway):
  - [x] Push to GitHub; transfer N3 cache via `pg_dump` pipe
  - [x] Set env vars (fresh `AUTH_SECRET`, `AUTH_URL`, Resend/anthropic, `DATABASE_URL` ref); deploy
  - [x] Generate domain → set `AUTH_URL` → redeploy; smoke-test sign-in — **live, working**
  - [x] Take first manual `pg_dump` backup of **local** (the source of the paid sentence
    cache — see `notes/deploy.md` §6). Prod is intentionally not backed up (Hobby egress);
    prod-only study history is an accepted loss-risk (SPEC §12, §16).

## Phase 1c — Fill content (post-deploy)
- [x] Seed remaining levels N5/N4/N2/N1 (Batch API) — **all 8,101 words now have a
  sentence** (local DB). Batch ids + counts in `notes/batch-generation.md`.
- [x] **Re-backup local** — fresh `pg_dump` taken after all decks seeded; the ~8,100-word
  paid sentence cache is now captured (notes/deploy.md §6).
- [x] **Transfer local → prod** so the deployed app serves all levels (notes/deploy.md §3).
- On-demand `/api/generate` + fetch-on-flip — **moved to Phase 3** (no longer needed for
  coverage now that every word is seeded; returns as a safety net with the admin tooling).

## Phase 2 — Quiz mode ◀ current focus
- [x] **Level scope + home hub** — `UserProfile.activeLevel` added (migration
  `20260604003054_add_user_active_level`); `/home` mode picker + inline level chips
  (`setActiveLevel` server action); `/study` & `/quiz` read the active level;
  login/dev-login/`/` → `/home` (SPEC §8.5). Full stats dashboard deferred to Phase 4.
- [x] `GET /api/quiz?level=&count=` — batch of JP→EN MC questions; **random** distractors
  with meaning-dedupe guard, non-scheduling; selection isolated in `src/lib/quiz.ts`
- [x] **Confusability-scored distractors** — `pickDistractors` ranks by shared kanji
  (Jaccard) + reading similarity (normalized Levenshtein); meaning is a guard against
  near-synonyms; top-K then random for variety, random fallback (SPEC §8.2)
- [x] MC quiz UI (`/quiz` + `src/components/quiz-session.tsx`) — brand-styled, instant
  feedback, score summary with Pī; `prefers-reduced-motion`-aware; mobile-first
- [x] **Dev login** — `GET /api/dev/login` mints a real session for the seeded user
  (gated by `DEV_AUTH`, 404 in prod); dev button on the sign-in page (SPEC §11.7)
- [ ] Flashcard↔Quiz synergy (FSRS-informed distractor/target selection; feeding results
  back) — depends on resolving the MC↔FSRS coupling below (SPEC §8.2, §15)
- [ ] Resolve MC↔FSRS coupling — feed the scheduler or stay a separate practice mode
  (SPEC §8.2, §15)
- [x] **Basic stats** (light, not the Phase-4 dashboard) — `/stats` page + `src/lib/stats.ts`;
  per active level: words started/total + mature, due now, 30-day recall rate; linked from
  `/home`. Day streak deferred (timezone/rollover) to a follow-up.
- [x] **Browse/search** — `/browse` + `GET /api/browse?level=` (browser-cached word list,
  `Cache-Control: private, max-age=3600, stale-while-revalidate=86400`) + `GET /api/words/
  [id]/sentence` (lazy sentence on tap, cached 24h); client-side filtering in memory;
  render cap of 50; accordion sentence reveal. Linked from `/home`.
- [ ] Light polish (optional): daily new-card-limit UI control (limit already enforced
  server-side in `getStudyQueue`)
- [x] Public homepage at `/` (brand + Pī mascot + Sign-in CTA + MIT/GitHub); study app
  moved to `/study`; brand foundation (tokens/fonts in globals, `Parrot` component, Pī
  favicon) per BRAND.md
- [x] **Installable-PWA basics** (pulled forward from Phase 5, SPEC §8.4/§16): manifest
  (`src/app/manifest.ts`) + icons (192/512/maskable via `scripts/gen-pwa-icons.mjs`),
  `display: fullscreen` + portrait, `viewport-fit=cover` + safe-area insets on the
  study/quiz screens. Android = true chrome-free fullscreen; iOS falls back to standalone.
  **Offline shell / service worker still deferred** (Phase 5).

## Phase 3 — Admin audit + on-demand generation (after Quiz mode)
- [ ] Admin review/audit page — admin-gated (`UserProfile.role`); add a review-status field
  to `ExampleSentence`; accept/reject generated sentences (SPEC §13)
- [ ] On-demand `/api/generate` + study-UI fetch-on-flip, with §11.4 guardrails
  (auth + rate-limit + cache-first + bounded `max_tokens`)

## Phase 4 — Multi-user
- [ ] Widen/remove the email allowlist; real `User` rows; authz scoping all reads/writes
  by `userId`; per-user settings (SPEC §13)
- [ ] **First-run onboarding** (moved here from Phase 2, 2026-06-04) — level choice →
  5-question Quiz warm-up (non-scheduling) → guided tour; uses the existing
  `UserProfile.onboardedAt` column to branch first-time vs. returning (SPEC §8.5).
  Deferred because distinguishing first-time vs. returning users only earns its keep once
  there are multiple real users.

## Phase 5+ (later)
See SPEC.md §13 — enhancements (audio/TTS, furigana, streak/heatmap, regeneration/voting,
export to Anki, **PWA offline shell / service worker** — install + fullscreen basics
already done, see Phase 2).

## Open questions
Tracked in SPEC.md §15.
