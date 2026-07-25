# TODO — Bayana

Open work only: what is planned, in flight, or found-but-not-fixed. This file is the
cross-session "where we left off" record, so keep it current, and **delete an item in the
commit that lands it** rather than archiving it. Shipped work is already recorded three
times over: [SPEC.md](SPEC.md) §13 Milestones at design altitude, [DECISIONS.md](DECISIONS.md)
for why it was done that way, and git for the detail. Decisions do **not** go here.

**Now: Phase 3** — MC↔FSRS coupling for Quiz mode (planned, not started).
**Next: Phase 4** — Admin sentence audit + on-demand generation. Then Phase 5 (multi-user)
and Phase 6 (further enhancements), both tracked only in SPEC.md §13 for now.
**Unsequenced:** Kalima absorption + bayan/zaka consumer (section below). New scope, decided
2026-07-26. Recorded as an unnumbered SPEC §13 milestone; not yet slotted against Phases 3
to 6, and note it is coupled to Phase 4 (Kalima's rank review folds into that admin page).

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

## Kalima absorption + bayan/zaka consumer (new scope, 2026-07-26)

Kalima's JLPT mock exam moves into Bayana, and Bayana replaces Kalima as the named reference
consumer of the bayan/zaka dataset. Both land in the same new table, so they are one piece of
work, not two: Kalima's 496 seeded N3 vocabulary questions and bayan's published releases are
the same kind of row from different sources.

Why Bayana rather than Kalima, in one line each: Kalima is N3 vocabulary only across five
question types, while this app already models N5 to N1, holds ~8,100 words plus a grammar
table whose `pattern` matches bayan's `grammar_points`, and can grade an exported question
into a learner's FSRS state. Full reasoning belongs in SPEC §14 and DECISIONS.md (see the
housekeeping items below); the porting checklist for Kalima's side is in that repo's TODO.md.

### Part A — the question store (decide before writing any of it)
- [ ] **Shape the table like bayan's `ExportedQuestion`, not like Kalima's `ExamQuestion`.**
  Kalima's five types are a subset of bayan's 22-value `question_type` enum (`reading` to
  `read-kanji`, `orthography` to `pick-spelling`, `contextual` to `word-choice`, `synonym` to
  `same-meaning`, `usage` to `right-sentence`). Keep bayan's `source` field to distinguish the
  Kalima seed rows from dataset releases, and leave room for `stimuli` and `provenance` so
  reading and listening need no second migration.
- [ ] **Decide the overlap with Exam mode.** `src/lib/exam.ts` already builds 問題１/問題２ with
  algorithmic confusability distractors and no FSRS coupling. Either it stays as the quick
  benchmark while the imported pool powers a timed mock exam, or one of the two retires.
  Log the choice in DECISIONS.md; do not leave both undocumented.
- [ ] Write the Prisma migration. Note this repo uses real migrations (`prisma migrate dev`),
  unlike Kalima's `db push` on boot, so the schema arrives as a reviewed migration.
- [ ] Vocab crosswalk for bayan imports: match on expression plus reading, and keep it on this
  side. Bayan deliberately cannot carry an Anki identifier (its Hard legal rule #4 rests on the
  word lists having no third-party deck in the chain), so the join cannot come from there.

### Part B — port from Kalima
- [ ] Answer secrecy: `toClientQuestion` stripping, opaque choice IDs, answers resolved only
  after submit. This is the property the mock exam is built around; port it first, not last.
- [ ] The four session endpoints (`prepare` / `submit` / `results` / `analysis`) as route
  handlers. Nitro's `defineEventHandler` maps onto `Request`/`NextResponse` mechanically.
- [ ] Atomic `consumeBudget()` upsert plus the per-IP throttle for the analysis call. This repo
  currently has only the in-memory limiter in `src/lib/rate-limit.ts`, which does not survive a
  restart and cannot bound spend across replicas.
- [ ] Timed 35-question vocabulary session (8-6-11-5-5, 30-minute timer) and the per-type
  accuracy radar, rewritten in React. The radar is polar math plus SVG, so it ports nearly intact.
- [ ] Wrong-answer review queue, rehomed from Kalima's localStorage onto per-user rows. Consider
  whether it should feed `ReviewState` rather than living beside it.
- [ ] Remap `wordId` from Kalima's cuids to `Word.id` via the shared Anki guid. Kalima's
  `words/*.json` is already an export of this corpus, so the guid joins cleanly.
- [ ] Carry `prisma/seed-data/passages-n3.json` across (20 short, 10 medium, 5 long, 10 info,
  already generated and audited). Paid AI output that will otherwise be regenerated.
- [ ] Fold Kalima's S-F rank review into the Phase 4 admin page under `UserProfile.role = ADMIN`
  rather than porting its `ADMIN_PASSWORD` HMAC path. These two admin surfaces should be one.

### Part C — access decision
- [ ] Decide whether the mock exam is public. Kalima's homepage is deliberately open for
  recruiters, which is most of its value; this app gates everything through `proxy.ts` except an
  explicit list. If it stays public, add exact paths (not a prefix) to that list, consistent with
  the `/api/demo/login` precedent in SPEC §11.8.

### Part D — bayan/zaka consumer
- [ ] Import path for a pinned `export.json` release tag: fetch, validate against a copy of
  bayan's Zod schema, insert with `source` set. Pin a dated tag, never "latest".
- [ ] CC BY 4.0 attribution surface for imported questions. This is a license obligation, not a
  nicety.
- [ ] Grade an imported question into `ReviewState` end to end. This is the behaviour that makes
  Bayana worth naming as the reference consumer, so it is the acceptance test for Part D.

### Part E — doc housekeeping

Done 2026-07-26, before any code: SPEC §2 (scope change), §3 (terms), §4.2 (the third
source-data class and its CC BY 4.0 obligation), §13 (unnumbered milestone), §14.9/§14.10
(both resolved forks), §15 (two open forks), and the DECISIONS.md row. Remaining:

- [ ] SPEC §13: give the milestone a phase number once it is sequenced.
- [ ] SPEC §6 + §9: the question-store model and the session routes, both deliberately
  deferred until the Exam-mode fork in §15 is resolved, since that answer changes the shape.
- [ ] DECISIONS.md: a row for the Exam-mode overlap resolution, and one for the public-access
  decision (Part C), when each is made.
- [ ] **Claims that go false when this ships; flip each in the same commit as the code:**
  SPEC §11.4 ("no web-reachable route that spends Anthropic tokens") and ARCHITECTURE's
  "generation is a seeding pipeline, not a request-time feature", both broken by the analysis
  endpoint; SPEC §12 (`ExampleSentence` as "the only paid, hard-to-regenerate artifact"),
  broken by the passage set; SPEC §8's four-mode count; README's mode table and Credits
  section, which owes the CC BY 4.0 attribution.
- [ ] README + ARCHITECTURE truth pass once the mock exam is live, per the standing rule that
  both must be true of the code in the same commit.

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
- [ ] Touch targets below 44px: user-menu avatar (36px), browse pagination + clear-search,
  home-link pill. Use `.tap-44` (BRAND.md §7). (Level-picker rows fixed 2026-07-25;
  session-header pills and both level-picker chip rows fixed 2026-07-26.)
- [ ] Root `error.tsx` / `loading.tsx` / `not-found.tsx` (currently unstyled defaults).
- [ ] Grammar hub: inline level switcher (currently vocab-hub-only).
- [ ] Dark mode: decide (support or explicit non-goal) and log it in DECISIONS.md. Interim
  state as of 2026-07-26: light-only, now *declared* via `color-scheme: light` so UA chrome
  can't render dark against the cream surfaces. That fixes the leak, not the question.

### Accessibility
- [ ] User-menu keyboard/focus management (Escape to close, focus trap/return).
- [ ] Info-bubble: proper disclosure pattern (button + `aria-expanded`).
- [ ] Browse accordions: `aria-expanded` on lesson toggles.
- [ ] Search inputs: `aria-label`s; result counts in an `aria-live` region. (Focus rings
  fixed 2026-07-26 via `.focus-ring`.)

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
