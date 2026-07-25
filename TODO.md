# TODO — Bayana

Open work only: what is planned, in flight, or found-but-not-fixed. This file is the
cross-session "where we left off" record, so keep it current, and **delete an item in the
commit that lands it** rather than archiving it. Shipped work is already recorded three
times over: [SPEC.md](SPEC.md) §13 Milestones at design altitude, [DECISIONS.md](DECISIONS.md)
for why it was done that way, and git for the detail. Decisions do **not** go here.

**Now: Phase 3** — MC↔FSRS coupling for Quiz mode (planned, not started).
**Next: Phase 4** — Admin sentence audit + on-demand generation. Then Phase 5 (multi-user)
and Phase 6 (further enhancements), both tracked only in SPEC.md §13 for now.

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
  interval. Good is simpler and still rewards the answer. Log the choice in DECISIONS.md.

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
- [ ] DECISIONS.md — add a row for the coupling + calibration choice.

### Nice-to-have (defer if scope creep)
- `ReviewLog.source` field to distinguish MC vs flashcard review events (helps stats;
  requires a migration). Only worth it once the coupling is live and validated.

---

## Phase 4 — Admin audit + on-demand generation

- [ ] Admin sentence-audit page — admin-gated (`UserProfile.role = ADMIN`); add a
  review-status field to `ExampleSentence`; accept/reject generated sentences (SPEC §13)
- [ ] On-demand `/api/generate` + study-UI fetch-on-flip, with §11.4 guardrails:
  auth + per-user rate-limit + cache-first + bounded `max_tokens`

---

## Phase 5 — Multi-user (later)

Not tracked here yet. See SPEC.md §13: widen or remove the email allowlist, authorization
checks on every read/write, and the remaining first-run onboarding (5-question warm-up +
guided tour).

---

## Phase 6 — Further enhancements (later)

See SPEC.md §13 — audio/TTS, furigana, the full stats dashboard (streak/heatmap, history,
charts), sentence regeneration/voting, export to Anki, **PWA offline shell / service
worker** (install + fullscreen already done, Phase 2).

---

## Review backlog — remaining findings (2026-07-10)

Lower-priority findings from the app review, roughly ordered. Pull into a phase as
capacity allows.

### Bugs / correctness
- [ ] Day boundaries use local-server midnight (`setHours(0,0,0,0)`) in `getGrammarStats`
  and in `startOfToday` (`src/lib/home.ts`, which powers the hub's "done today") — wire in a
  per-user timezone / day-start. The hub's helper is centralised so the fix is one function.
- [ ] `scripts/collect-batch.ts` — per-item try/catch so one malformed result doesn't
  abort a whole batch collection.

### UX / UI
- [ ] Touch targets below 44px: session-header buttons, user-menu avatar (36px), browse
  pagination + clear-search, home-link pill. (Level-picker rows fixed 2026-07-25.)
- [ ] Root `error.tsx` / `loading.tsx` / `not-found.tsx` (currently unstyled defaults).
- [ ] Grammar hub: inline level switcher (currently vocab-hub-only).
- [ ] Dark mode: decide (support or explicit non-goal) and log it in DECISIONS.md.

### Accessibility
- [ ] User-menu keyboard/focus management (Escape to close, focus trap/return).
- [ ] Info-bubble: proper disclosure pattern (button + `aria-expanded`).
- [ ] Browse accordions: `aria-expanded` on lesson toggles.
- [ ] Search inputs: `aria-label`s; result counts in an `aria-live` region.

### Code quality / tests
- [ ] Dedup session components: byte-identical `Centered` in 4 files, duplicated
  `RATINGS` arrays, duplicated `shuffle` (`review.ts` / `grammar-review.ts`),
  ~80-line `getStudyQueue` / `getGrammarQueue` overlap.
- [ ] Exam-session's local `HighlightedSentence` → shared component.
- [ ] Extract quiz/exam scoring helpers (`pickDistractors`, similarity fns — currently
  module-private) so they can be unit-tested; then test them + the highlighted-sentence
  token pipeline.
- [ ] Log hygiene: audit `console.error` calls for payloads that shouldn't be logged.
- [ ] Migrate to `next/font` (self-hosted) — also lets CSP drop the Google Fonts hosts.

### Local environment
- [ ] `.env` pins `NODE_OPTIONS=--max-old-space-size=256`, which OOM-kills `next build`'s
  TypeScript worker locally; building needs an override
  (`NODE_OPTIONS=--max-old-space-size=4096 npm run build`). Decide whether the cap is still
  wanted: it mirrors the Railway runtime budget, but `start:prod` sets its own 512MB anyway.

---

## Open questions

Tracked in SPEC.md §15.
