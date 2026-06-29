# TODO — Bayana

Execution checklist and progress tracker. **Plan and rationale live in
[SPEC.md](SPEC.md)** (§13 Milestones, §16 Decision log); this file only tracks *task
state* — what's done and what's next. Keep it current; it's the "where we left off"
record across sessions. Decisions do **not** go here — log them in SPEC.md §16.

**Now: Phase 3** — MC↔FSRS coupling for Quiz mode (planned, not started).
**Next: Phase 4** — Admin sentence audit + on-demand generation.
**✅ Phase 3.5 complete** — Grammar point study (N3 v1, separate FSRS queue + page).

---

## ▶ Phase 3 — MC↔FSRS coupling

Resolves SPEC §15 open question #1. Makes Quiz and Flashcard modes genuinely
complementary: MC answers seed the FSRS schedule, and MC question selection is informed
by the user's FSRS state. No new schema — reuses `ReviewState`, `ReviewLog`, and the
existing POST `/api/review` endpoint.

### Part A — MC answers write FSRS ratings
- [ ] `src/components/quiz-session.tsx` — in `choose(i)`, fire-and-forget POST to
  `/api/review` with `{ wordId: current.wordId, rating: correct ? 3 : 1 }` (Good on
  correct, Again on wrong). Do NOT await — quiz UI must stay snappy. No UI change.
- [ ] **Decide before coding**: correct → Good (3) or Hard (2)? MC is recognition-only
  (easier than flashcard active recall), so Hard is more conservative and gives a shorter
  interval. Good is simpler and still rewards the answer. Document the choice in SPEC §16.

### Part B — 50/50 MC source split (review pool + new)
- [ ] `src/lib/quiz.ts` `buildQuiz(level, count, userId)` — add `userId`; split target
  selection into two pools: (a) words with `ReviewState` for this user at this level,
  ordered by `due asc` (near-due first, for reinforcement); (b) words with no
  `ReviewState` (new words, randomly sampled). Take `floor(count/2)` from (a) and
  `ceil(count/2)` from (b); if either pool is smaller than its half, fill from the other.
- [ ] `src/app/api/quiz/route.ts` — pass `userId` (already available from
  `getCurrentUserId()`) into `buildQuiz`.

### Part C — SPEC + open-question housekeeping
- [ ] SPEC §8.2 — update to reflect MC→FSRS coupling; retire "non-scheduling first-run
  warm-up" (superseded: the first quiz session now seeds FSRS, which is the warm-up).
- [ ] SPEC §15 — close open question #1 once the implementation decision is recorded.
- [ ] SPEC §16 — add decision-log entry for the coupling + calibration choice.

### Nice-to-have (defer if scope creep)
- `ReviewLog.source` field to distinguish MC vs flashcard review events (helps stats;
  requires a migration). Only worth it once the coupling is live and validated.

---

## Phase 3 — Access & demo

- [x] **Comma-separated allowlist** — `AUTH_ALLOWED_EMAIL` parsed as CSV into a
  `Set<string>`; single address still works. First reviewer engineer can now sign in.
- [x] **First-run onboarding** — level choice → redirect to `/quiz`; `onboardedAt` gates
  the home hub; dev-login leaves `onboardedAt` null so dev users go through onboarding
  too. Simplified from the original "5-question warm-up + guided tour" spec (superseded
  by MC↔FSRS coupling above, which gives the warm-up naturally).
- [ ] **Ephemeral demo account** — a "Try demo →" path on the sign-in page that gives
  anyone instant access with no email required. Each click starts a fresh identity.

  **Design:** the demo session lives only in a signed cookie — no Auth.js `Session` row.
  DB rows (`User` + `UserProfile`) are still created for FK integrity, but the cookie is
  the *only* key to them. Lose the cookie → data is unreachable (effectively ephemeral).
  Re-clicking demo generates a new UUID → new DB rows → fresh new-user experience.
  No behavior change for allowlisted users.

  **Implementation pieces (no schema change):**
  - [x] `src/app/api/demo/login/route.ts` — creates `User` (no email) + `UserProfile`
    (no `onboardedAt` → goes to onboarding), writes an httpOnly `bayana-demo-token`
    cookie signed with `HMAC-SHA256(AUTH_SECRET, userId)` (7-day TTL), redirects to
    `/onboarding`. Available in prod. Each click orphans old rows (acceptable at scale).
  - [x] `src/lib/current-user.ts` — `requireAuth()` for pages returns
    `{ userId, email, isDemo }`; `getCurrentUserId()` for API routes falls back to demo
    cookie; `verifyDemoCookie()` uses `timingSafeEqual` for constant-time HMAC check.
  - [x] `src/proxy.ts` — `bayana-demo-token` added to `hasSession`; `/api/demo` added
    to `isPublic` (the route creates the session, so it must be reachable without one).
  - [x] `src/app/auth/signin/page.tsx` — "Try demo →" ghost button below the form with
    "or" divider; 7-day / browser-only note below it.
  - [x] `src/app/home/actions.ts` — `demoSignOutAction` deletes the cookie and redirects
    to sign-in (no DB Session to clear).
  - [x] `src/components/user-menu.tsx` — `isDemo` prop: shows "Demo account" header,
    "?" avatar initial, "End demo" sign-out using `demoSignOutAction`.
  - [x] `src/app/home/page.tsx` — demo warning banner (ink-faint, non-alarming) with
    `mailto:OWNER_CONTACT_EMAIL` link to request real access. Falls back to plain text
    when env var is unset.
  - [x] All app pages (`study`, `quiz`, `stats`, `browse`) — swapped `auth()` + redirect
    for `requireAuth()` so demo sessions are accepted everywhere.

---

---

## ✅ Phase 2 addendum — Exam mode (2026-06-07)

- [x] `src/lib/exam.ts` — `buildExam(level, readingCount, writingCount)`: random word
  selection, 問題１ reading distractors (kanji+reading confusability), 問題２ writing
  distractors (reading-similarity-primary), kana substitution in sentences for 問題２.
- [x] `src/app/api/exam/route.ts` — `GET /api/exam?level=&count=` (default 20, max 40).
  Auth required; non-scheduling (no FSRS reads or writes).
- [x] `src/app/exam/page.tsx` — page shell (mirrors quiz/page.tsx pattern).
- [x] `src/components/exam-session.tsx` — two-section sequential UI with immediate
  feedback, section-break screen (shows 問題１ score), split summary (問題１/問題２ scores).
  `HighlightedSentence` renders the target word underlined in the sentence.
- [x] `src/app/home/page.tsx` — Exam tile added to mode picker (three tiles: Flashcard /
  Quiz / Exam). Modes are independent — no FSRS coupling by design (SPEC §8.6, §16).

---

## Phase 3.5 — Grammar point study

Separate FSRS study queue for JLPT grammar points. Source data: `decks/grammar-n3.md`
(N3 v1; schema designed to accept N5–N1 later). Completely separate from vocab FSRS —
different page, different models, different API routes. Card shape: pattern (JP) front →
meanings + example sentence + translation back.

### Part A — Schema + migration
- [x] Add `GrammarPoint` model to `prisma/schema.prisma`: `id`, `level` (String — "N3"
  etc.), `lesson` (Int), `position` (Int), `pattern` (String), `reading` (String),
  `meanings` (String[]), `exampleJp` (String), `exampleEn` (String). Composite unique on
  `[level, lesson, position]`.
- [x] Add `GrammarProgress` model: `id`, `userId`, `grammarPointId`, FSRS state fields
  (same shape as `ReviewState` — `due`, `stability`, `difficulty`, `elapsed_days`,
  `scheduled_days`, `reps`, `lapses`, `state`, `last_review`). Unique on
  `[userId, grammarPointId]`. FK → `User` and `GrammarPoint`.
- [x] Run `prisma migrate dev --name grammar-points`.

### Part B — Seed script
- [x] `scripts/seed-grammar.ts` — parse `decks/grammar-n3.md` (regex on `###` headings
  for pattern/reading/lesson/position, meanings line, `**例文:**` for exampleJp, next
  line for exampleEn); upsert each row keyed on `(level, lesson, position)`. Idempotent.
- [x] Run script locally; verified 220 N3 points seeded across 10 lessons.

### Part C — Shared FSRS util refactor
- [x] Exported `CardLike` interface from `src/lib/fsrs.ts`; `toCard` now accepts
  `CardLike | null` instead of `ReviewState | null`. Both vocab and grammar share the
  same adapter functions with no copy-paste. No behavior change for existing vocab flow.

### Part D — API routes
- [x] `GET /api/grammar/queue` — returns N grammar points due for the current user at
  their active level, ordered by `due asc`; new points fill remaining slots.
- [x] `POST /api/grammar/review` — accepts `{ grammarPointId, rating }`; applies FSRS
  scheduling via shared util; writes updated `GrammarProgress`. Auth required.

### Part E — Grammar page + UI
- [x] `src/app/grammar/page.tsx` — server component; requires auth; inline stats panel
  (total, started, mature, due now); "Study Grammar" CTA links to `/grammar/study`.
  Vocab stats stay on `/stats` — no grammar data there.
- [x] `src/app/grammar/study/page.tsx` — session page shell (mirrors /study).
- [x] `src/components/grammar-session.tsx` — client component; flip-and-rate loop for
  grammar cards. Front: pattern (large JP). Back: reading (if differs) + meanings + example.
- [x] Grammar tab added to `BottomNav` (pencil icon, between Home and Stats).

### Part F — SPEC + TODO housekeeping
- [x] SPEC §13 — add Phase 3.5 milestone entry.
- [x] SPEC §16 — log decisions: separate grammar FSRS queue, dedicated `/grammar` page,
  N3-first with level-agnostic schema, card direction (pattern→meaning+example).

---

## Phase 4 — Admin audit + on-demand generation

- [ ] Admin sentence-audit page — admin-gated (`UserProfile.role = ADMIN`); add a
  review-status field to `ExampleSentence`; accept/reject generated sentences (SPEC §13)
- [ ] On-demand `/api/generate` + study-UI fetch-on-flip, with §11.4 guardrails:
  auth + per-user rate-limit + cache-first + bounded `max_tokens`

---

## Phase 5+ (later)

See SPEC.md §13 — audio/TTS, furigana, streak/heatmap, sentence regeneration/voting,
export to Anki, **PWA offline shell / service worker** (install + fullscreen already
done, Phase 2).

---

## Open questions

Tracked in SPEC.md §15.

---

## ✅ Archive — completed phases (chronological)

### Phase 1a — Playable slice (local, study ASAP)

#### Foundation
- [x] Initialize git repo
- [x] Scaffold Next.js 16 app (TS, App Router, Tailwind v4) — builds clean
- [x] Add Prisma + `@prisma/client`; `docker-compose.yml` for local Postgres (port 5887);
  `.env` + `.env.example`; verify DB connection
- [x] Write `prisma/schema.prisma` from SPEC §6 — `User`, `UserProfile`, `Word`,
  `ExampleSentence`, `ReviewState`, **`ReviewLog`** + enums; first migration applied;
  `src/lib/db.ts` client singleton (Prisma 7 + `@prisma/adapter-pg`) — connection verified

#### Data import (N3 only)
- [x] `scripts/import-csv.ts` — parse `decks/*.csv` → `Word` rows (quoted commas,
  `〜`/`(...)` placeholders, tag→level rules, `guid` unique key). N3 imported (2,140).
- [x] Seed the default `User` + `UserProfile` (`scripts/seed-user.ts`, idempotent);
  `DEFAULT_USER_ID` written to `.env`

#### AI sentence generation (N3)
- [x] `src/lib/generate.ts` — cached prompt + JSON validation; sanity-checked 5 N3 words
  (~$0.003). On-demand `POST /api/generate` deferred to Phase 1b.
- [x] `scripts/seed-sentences.ts` — `--test` quality gate + Batch API submit
  (batch `msgbatch_01VKSSFCPCC8t5KECm3H83Gt`, 2135 N3 requests)
- [x] `scripts/collect-batch.ts` — collected 2,135 (0 malformed/failed); **N3 fully
  covered: 2,140 / 2,140 words have a sentence**

#### Flashcard mode — review loop (JP→EN)
- [x] `ts-fsrs` adapter (`src/lib/fsrs.ts`) — Card ⇄ ReviewState, scheduler, log mapping
- [x] Review services (`src/lib/review.ts`) — `reviewWord` (+ `ReviewLog`),
  `undoLastReview` (ts-fsrs `rollback`), `getStudyQueue` — verified end-to-end
- [x] API route handlers: `GET /api/cards/queue`, `POST /api/review`,
  `POST /api/review/undo` — verified over HTTP (incl. 400 validation)
- [x] Mobile-first card UI (`src/components/study-session.tsx` + home page) —
  flip / rate / undo, iPhone SE baseline; builds + SSR-renders
- [x] Run locally and study N3 end-to-end off the app

---

### Phase 1b — Shippable: auth + deploy (N3 only)
- [x] **Auth** — magic-link (Auth.js v5 + Resend, single-email allowlist), database sessions
  - [x] Verified Auth.js v5 ↔ Next 16 (proxy.ts is Node runtime → DB sessions OK)
  - [x] Schema + migration (`User` fields + Account/Session/VerificationToken)
  - [x] `src/auth.ts` — Resend provider, **allowlist enforced before send**, 15-min tokens,
    DB sessions; route handler; sign-in page
  - [x] `proxy.ts` cookie guard; `getCurrentUserId` → session; API routes 401; page redirect
  - [x] Seeded user linked to allowlist email (sign-in attaches to existing user)
  - [x] Rate-limit the sign-in request — in-memory fixed-window limiter
    (`src/lib/rate-limit.ts`), per-IP 5/10min + global 6/10min, in `proxy.ts`; explicit
    30-day session TTL (SPEC §11.3)
  - [x] Manual test: magic-link sign-in end-to-end — verified locally and in prod
- [x] **Deploy prep** — `railway.json` (Railpack, `start:prod`), `postinstall` generate,
  `start:prod` = migrate + `$PORT`, `prisma`/`dotenv` → runtime deps; runbook in
  `notes/deploy.md`. Verified `prisma migrate deploy` runs clean.
- [x] Push to GitHub; transfer N3 cache via `pg_dump` pipe; env vars + `AUTH_URL` set;
  deploy + smoke-test sign-in — **live, working**
- [x] First manual `pg_dump` backup of local (paid sentence cache; Hobby prod not backed up)

---

### Phase 1c — Fill content (post-deploy)
- [x] Seed remaining levels N5/N4/N2/N1 (Batch API) — **all 8,101 words now have a
  sentence** (local DB). Batch ids + counts in `notes/batch-generation.md`.
- [x] Re-backup local after all decks seeded.
- [x] Transfer local → prod so deployed app serves all levels.
- On-demand `/api/generate` + fetch-on-flip — moved to Phase 4 (not needed for coverage).

---

### Phase 2 — Quiz mode ✅
- [x] **Level scope + home hub** — `UserProfile.activeLevel` (migration); `/home` mode
  picker + inline level chips (`setActiveLevel` server action); `/study` & `/quiz` read
  active level; login/dev-login/`/` → `/home`. Full stats dashboard deferred to Phase 4.
- [x] `GET /api/quiz?level=&count=` — batch of JP→EN MC questions; random distractors
  with meaning-dedupe guard, non-scheduling; selection isolated in `src/lib/quiz.ts`
- [x] **Confusability-scored distractors** — `pickDistractors` ranks by shared kanji
  (Jaccard) + reading similarity (normalized Levenshtein); meaning guard; top-K + random
  fallback (SPEC §8.2)
- [x] MC quiz UI (`/quiz` + `src/components/quiz-session.tsx`) — brand-styled, instant
  feedback, score summary with Pī; `prefers-reduced-motion`-aware; mobile-first
- [x] **Dev login** — `GET /api/dev/login` mints a real session (gated by `DEV_AUTH`,
  404 in prod); dev button on sign-in page (SPEC §11.7)
- [x] **Basic stats** — `/stats` + `src/lib/stats.ts`; words started/total + mature, due
  now, 30-day recall rate per active level; linked from `/home`
- [x] **Browse/search** — `/browse` + `GET /api/browse?level=` (browser-cached,
  `Cache-Control: private, max-age=3600, stale-while-revalidate=86400`) + lazy sentence
  on tap; client-side filtering; paginated 50/page; started-words-first ordering
- [x] **Public homepage** at `/`; brand foundation (tokens/fonts, `Parrot`, Pī favicon)
- [x] **Installable-PWA basics** — manifest + icons, `display: fullscreen`, safe-area
  insets on session screens. Android chrome-free fullscreen; iOS standalone fallback.
- [x] **Security review** (2026-06-05) — `getStudyQueue` O(backlog) query fixed
  (count + take); `Object.hasOwn` enum validation at all 6 call sites; `proxy.ts` →
  `src/proxy.ts`. Documented in SPEC §16.
- Flashcard↔Quiz synergy / MC↔FSRS coupling — **moved to Phase 3 above**
- User-adjustable settings UI — **intentional non-goal** (SPEC §16)
