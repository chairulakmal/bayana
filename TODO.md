# TODO: Bayana

Open work only: what is planned, in flight, or found-but-not-fixed. This file is the cross-session "where we left off" record, so keep it current, and **delete an item in the commit that lands it** rather than archiving it or noting that it used to be here. Shipped work is already recorded three times over: [SPEC.md](SPEC.md) §13 Milestones at design altitude, [DECISIONS.md](DECISIONS.md) for why it was done that way, and git for the detail. Decisions do **not** go here. Below: the sequence, then the active workstream, then the numbered phases, then the two unsequenced sections.

## Sequence

1. **[UI/UX](#uiux-workstream)**, items 1 and 2. Unblocked as of 2026-07-26: the frontend-architecture workstream that rewrote the same lines has landed in full. Items 3 and 4 are deferred on external blockers, not on capacity; do not pull them in as filler.
2. **[Phase 3](#phase-3-mcfsrs-coupling)**: MC↔FSRS coupling for Quiz mode. Unblocked, not started.
3. **[Phase 4](#phase-4-admin-audit--on-demand-generation)**: admin sentence audit plus on-demand generation.
4. **[Kalima absorption + bayan/zaka consumer](#kalima-absorption--bayanzaka-consumer)**: new scope, not yet slotted against a phase. Coupled to Phase 4, since Kalima's rank review folds into that admin page.
5. **Phases 5 and 6**: multi-user, then further enhancements. Tracked only in SPEC.md §13 for now.

Three sections sit outside the sequence and are pulled from as capacity allows: the [legal pages](#legal-pages-privacy-policy--terms-of-use), which have no blocker and become non-optional if the app opens up beyond the invite list; the [design-token migration](#design-tokens-as-tailwind-utilities-deferred), deferred with no blocker but no present need either; and the internal [review backlog](#review-backlog-internal-findings-2026-07-10).

**Numbering is positional and closes up when an item lands.** It describes what is left, not what once was, so a cross-reference must name a section as well as a number ("UI/UX item 2"), and every cross-reference gets re-checked when a section is renumbered.

---

## UI/UX workstream

Everything user-facing that is known-wrong or known-missing, worked top-down and read against BRAND.md and SPEC §8.4. The visual system itself held under review, so nothing here is a token or layout change; what is left clusters on one axis, which is what happens on a keyboard, with a screen reader, or in the instant after a tap.

**Items 1 and 2 are unblocked as of 2026-07-26**, the architecture workstream that rewrote the same lines having landed. **Items 3 and 4 remain deferred**, one blocked on other work and one on a decision that was explicitly postponed.

### 1. Missing headings and page titles

- [ ] No `<h1>` on `/home`, `/grammar`, or any of the four session screens. The hub's "TODAY" / "STUDY MODES" / "LEVEL" labels are `<p>` elements, so heading navigation finds nothing at all on the app's default page. Landing, browse, stats, signin, onboarding and the error routes all have one already. The session screens do have a **focus** target on their completion/summary states (a `tabIndex={-1}` score or "Session done" line), which is not a heading and does not close this: the two mechanisms are independent, and the right fix may well be to promote those same elements.
- [ ] Five routes never set a title: `/home`, `/grammar`, `/onboarding`, `/stats` and `/auth/signin`. `src/app/layout.tsx:7` defines `template: "%s · Bayana"` and every other route uses it, apart from `/`, which deliberately takes the `default`. One `export const metadata` per page.

### 2. Smaller UX items

- [ ] `browse-client.tsx` `goToPage`: turning a page does not scroll back to the top of the list. At 375px with 50 rows, tapping "Next" at the bottom leaves the user at the bottom of the next page.
- [ ] `/stats` has no level control, so changing level means a round trip through `/home`. That is the same friction that justified adding the picker to the grammar hub.
- [ ] `browse-client.tsx`: the `role="status"` result count re-announces on every keystroke. Debounce the announced value, not the filtering.
- [ ] `/grammar/browse` has no `error.tsx`, so since it moved to a server render (SPEC §9.3) a failed query replaces the whole page via the root boundary, where it used to show one red line inside intact page chrome. Probably the right trade for a database failure (the four session routes made that call deliberately), but decide it rather than inherit it. `/browse` is unaffected: its list is still a client fetch with its own error branch.

### 3. Performance: subset the Japanese face, blocked on bayan

**Deferred 2026-07-26: starts only once bayan is finished.** Not a capacity call. The sibling bayan/zaka dataset is the nearer-term commitment, and this is a self-contained build-pipeline project that will still be worth exactly as much later.

- [ ] `src/app/fonts.ts` now self-hosts M PLUS Rounded 1c at 400/700 with `preload: false`, but Google still slices Japanese into ~126 `unicode-range` chunks *per weight*, so ~252 `@font-face` rules are inlined into every page's CSS for glyphs that page will never use. Serving a `fonttools` subset of the ~2,500 characters the deck actually uses via `next/font/local` collapses that to a handful of rules.
  - **Re-measure before starting.** The ~66 KB-gzipped figure in SPEC §14.12 predates dropping weight 800 and moving both Latin faces to variable fonts, so the current cost is unknown.
  - Still a real project rather than a config change: it needs a build step plus a decided answer for what happens when a generated sentence contains a kanji outside the subset.
  - **Note the interaction with the Kalima/bayan work**, which is the thing it waits on: imported questions and the N3 passage set introduce Japanese text this app did not author, so the "kanji outside the subset" question has a wider blast radius after that lands than before. Deciding it first would have meant deciding it twice.

### 4. UX correctness: day boundaries, deferred pending a timezone decision

**Deferred 2026-07-26.** The fix is small; what it needs first is a decision on where a user's timezone comes from (profile field, browser-reported, or a fixed offset), and that was postponed rather than made.

- [ ] Day boundaries use local-*server* midnight (`setHours(0,0,0,0)`) in `getGrammarStats` and in `startOfToday` (`src/lib/home.ts`, which powers the hub's "done today"), so a user in another timezone can watch the count reset mid-session. The hub's helper is centralised, so the code change is one function; the open part is the source of truth for the offset.

---

## Phase 3: MC↔FSRS coupling

Resolves SPEC §15 open question #1. Makes Quiz and Flashcard modes genuinely complementary: MC answers seed the FSRS schedule, and MC question selection is informed by the user's FSRS state. No new schema, since it reuses `ReviewState` and `ReviewLog`.

**Unblocked as of 2026-07-26**, when the session-mode ports landed. Both halves now have the seam they need: Part A writes through the shipped `rateCard` action, and Part B changes `buildQuizRound`, the shared builder the Quiz port introduced precisely so a signature change reaches the page render and the refetch route at once.

### Part A: MC answers write FSRS ratings

- [ ] `src/components/quiz-session.tsx:98`, in the `choose` callback: call the `rateCard` Server Action (shipped, `src/app/study/actions.ts:41`) with `{ wordId: current.wordId, rating: correct ? 3 : 1 }`. Fire inside a transition without blocking the UI, matching the optimistic advance the flashcard loop uses; the quiz must stay snappy. No UI change.
- [ ] **Decide before coding**: correct → Good (3) or Hard (2)? MC is recognition-only (easier than flashcard active recall), so Hard is more conservative and gives a shorter interval. Good is simpler and still rewards the answer. Log the choice in DECISIONS.md.

### Part B: 50/50 MC source split (review pool + new)

- [ ] `src/lib/quiz.ts`: add `userId` to `buildQuizRound` (line 57) and to `buildQuiz` beneath it (line 74); split target selection into two pools: (a) words with `ReviewState` for this user at this level, ordered by `due asc` (near-due first, for reinforcement); (b) words with no `ReviewState` (new words, randomly sampled). Take `floor(count/2)` from (a) and `ceil(count/2)` from (b); if either pool is smaller than its half, fill from the other.
- [ ] Then pass `userId` from **both** callers: `src/app/quiz/page.tsx` (which has it from `requireAuth`) and `src/app/api/quiz/route.ts` (from `getCurrentUserId`, currently called only to authenticate and discarded). The pool logic itself lands once, in the shared builder.

### Part C: SPEC + open-question housekeeping

- [ ] SPEC §8.2: update to reflect MC→FSRS coupling; retire "non-scheduling first-run warm-up" (superseded: the first quiz session now seeds FSRS, which is the warm-up).
- [ ] SPEC §15: close open question #1 once the implementation decision is recorded.
- [ ] DECISIONS.md: add a row for the coupling + calibration choice.

### Nice-to-have (defer if scope creep)

- `ReviewLog.source` field to distinguish MC vs flashcard review events (helps stats; requires a migration). Only worth it once the coupling is live and validated.

---

## Phase 4: Admin audit + on-demand generation

- [ ] Admin sentence-audit page, admin-gated (`UserProfile.role = ADMIN`); add a review-status field to `ExampleSentence`; accept/reject generated sentences (SPEC §13)
- [ ] On-demand generation + study-UI fetch-on-flip, with §11.4 guardrails: auth + per-user rate-limit + cache-first + bounded `max_tokens`
- [ ] **Re-check the shape against the reads/writes convention before building it.** The `/api/generate` working name predates that split, and this endpoint both spends money and writes to the sentence cache, which reads as a write. Whichever way it lands, the guardrails are identical: a Server Action is exactly as web-reachable as a route handler.

---

## Kalima absorption + bayan/zaka consumer

New scope, decided 2026-07-26. Kalima's JLPT mock exam moves into Bayana, and Bayana replaces Kalima as the named reference consumer of the bayan/zaka dataset. Both land in the same new table, so they are one piece of work, not two: Kalima's 496 seeded N3 vocabulary questions and bayan's published releases are the same kind of row from different sources.

Why Bayana rather than Kalima, in one line each: Kalima is N3 vocabulary only across five question types, while this app already models N5 to N1, holds ~8,100 words plus a grammar table whose `pattern` matches bayan's `grammar_points`, and can grade an exported question into a learner's FSRS state. Full reasoning belongs in SPEC §14 and DECISIONS.md (see Part E); the porting checklist for Kalima's side is in that repo's TODO.md.

### Part A: the question store (decide before writing any of it)

- [ ] **Shape the table like bayan's `ExportedQuestion`, not like Kalima's `ExamQuestion`.** Kalima's five types are a subset of bayan's 22-value `question_type` enum (`reading` to `read-kanji`, `orthography` to `pick-spelling`, `contextual` to `word-choice`, `synonym` to `same-meaning`, `usage` to `right-sentence`). Keep bayan's `source` field to distinguish the Kalima seed rows from dataset releases, and leave room for `stimuli` and `provenance` so reading and listening need no second migration.
- [ ] **Decide the overlap with Exam mode.** `src/lib/exam.ts` already builds 問題１/問題２ with algorithmic confusability distractors and no FSRS coupling. Either it stays as the quick benchmark while the imported pool powers a timed mock exam, or one of the two retires. Log the choice in DECISIONS.md; do not leave both undocumented.
- [ ] Write the Prisma migration. Note this repo uses real migrations (`prisma migrate dev`), unlike Kalima's `db push` on boot, so the schema arrives as a reviewed migration.
- [ ] Vocab crosswalk for bayan imports: match on expression plus reading, and keep it on this side. Bayan deliberately cannot carry an Anki identifier (its Hard legal rule #4 rests on the word lists having no third-party deck in the chain), so the join cannot come from there.

### Part B: port from Kalima

- [ ] Answer secrecy: `toClientQuestion` stripping, opaque choice IDs, answers resolved only after submit. This is the property the mock exam is built around; port it first, not last.
- [ ] The four session endpoints (`prepare` / `submit` / `results` / `analysis`). Under the reads/writes convention: `results` is a read (route handler), while `prepare`, `submit` and `analysis` mutate or spend and are Server Actions. Nitro's `defineEventHandler` maps onto either mechanically.
- [ ] Atomic `consumeBudget()` upsert plus the per-IP throttle for the analysis call. This repo currently has only the in-memory limiter in `src/lib/rate-limit.ts`, which does not survive a restart and cannot bound spend across replicas. Note that a Server Action is as web-reachable as a route handler, so the throttle is not optional.
- [ ] Timed 35-question vocabulary session (8-6-11-5-5, 30-minute timer) and the per-type accuracy radar, rewritten in React. The radar is polar math plus SVG, so it ports nearly intact.
- [ ] Wrong-answer review queue, rehomed from Kalima's localStorage onto per-user rows. Consider whether it should feed `ReviewState` rather than living beside it.
- [ ] Remap `wordId` from Kalima's cuids to `Word.id` via the shared Anki guid. Kalima's `words/*.json` is already an export of this corpus, so the guid joins cleanly.
- [ ] Carry `prisma/seed-data/passages-n3.json` across (20 short, 10 medium, 5 long, 10 info, already generated and audited). Paid AI output that will otherwise be regenerated.
- [ ] Fold Kalima's S-F rank review into the Phase 4 admin page under `UserProfile.role = ADMIN` rather than porting its `ADMIN_PASSWORD` HMAC path. These two admin surfaces should be one.

### Part C: access decision

- [ ] Decide whether the mock exam is public. Kalima's homepage is deliberately open for recruiters, which is most of its value; this app gates everything through `proxy.ts` except an explicit list. If it stays public, add exact paths (not a prefix) to that list, consistent with the `/api/demo/login` precedent in SPEC §11.8.

### Part D: bayan/zaka consumer

- [ ] Import path for a pinned `export.json` release tag: fetch, validate against a copy of bayan's Zod schema, insert with `source` set. Pin a dated tag, never "latest".
- [ ] CC BY 4.0 attribution surface for imported questions. This is a license obligation, not a nicety.
- [ ] Grade an imported question into `ReviewState` end to end. This is the behaviour that makes Bayana worth naming as the reference consumer, so it is the acceptance test for Part D.

### Part E: doc housekeeping

The first pass landed 2026-07-26, before any code: SPEC §2 (scope change), §3 (terms), §4.2 (the third source-data class and its CC BY 4.0 obligation), §13 (unnumbered milestone), §14.9/§14.10 (both resolved forks), §15 (two open forks), and the DECISIONS.md row. Remaining:

- [ ] SPEC §13: give the milestone a phase number once it is sequenced.
- [ ] SPEC §6 + §9: the question-store model and the session routes, both deliberately deferred until the Exam-mode fork in §15 is resolved, since that answer changes the shape.
- [ ] DECISIONS.md: a row for the Exam-mode overlap resolution, and one for the public-access decision (Part C), when each is made.
- [ ] **Claims that go false when this ships; flip each in the same commit as the code:** SPEC §11.4 ("no web-reachable route that spends Anthropic tokens") and ARCHITECTURE's "generation is a seeding pipeline, not a request-time feature", both broken by the analysis endpoint; SPEC §12 (`ExampleSentence` as "the only paid, hard-to-regenerate artifact"), broken by the passage set; SPEC §8's four-mode count; README's mode table and Credits section, which owes the CC BY 4.0 attribution.
- [ ] README + ARCHITECTURE truth pass once the mock exam is live, per the standing rule that both must be true of the code in the same commit.

---

## Phase 5: Multi-user (later)

Not tracked here yet. See SPEC.md §13: widen or remove the email allowlist, authorization checks on every read/write, and the remaining first-run onboarding (5-question warm-up + guided tour).

---

## Phase 6: Further enhancements (later)

See SPEC.md §13: audio/TTS, furigana, the full stats dashboard (streak/heatmap, history, charts), sentence regeneration/voting, export to Anki, **PWA offline shell / service worker** (install + fullscreen already done, Phase 2).

---

## Legal pages: privacy policy + terms of use

Not written. Two static routes plus a link surface, but the *content* has to describe what this app actually does, so the work is inventory first and prose second. Unsequenced; it becomes non-optional the moment the app stops being invite-only, since the demo door is already open to anyone (`POST /api/demo/login`, §11.8) and a demo visitor gets a cookie and a database row without ever seeing a policy.

- [ ] **Inventory what is collected, before drafting either page.** From the code as it stands: an email address for allowlisted sign-in (`User`, `Account`, `Session`, plus the hashed magic-link token in `VerificationToken`), a demo identity that is an HMAC-signed cookie with a 7-day life and its own `User` row, and study progress (`ReviewState`, `ReviewLog`, `GrammarProgress`, `GrammarReviewLog`, `UserProfile`). Third parties: **Resend** (delivers the magic link, so it processes the address), **Railway** (hosting and the Postgres instance), **Anthropic** (sentence generation, and worth stating plainly that it is a *seeding* pipeline over deck words, so no user text is sent to it, per SPEC §11.4 and ARCHITECTURE). **No analytics, no tracking pixels, no third-party scripts at all**, the CSP naming no external origin (§11.3), which is a genuinely strong claim and should be made in the policy rather than left implicit.
- [ ] **Decide the retention story for demo rows**, which the privacy page has to state and which is currently a cleanup heuristic rather than a promise (§14.5). "Deleted after N days" and "deleted when we get around to it" are different commitments; pick one and make the code match it.
- [ ] Write `/privacy` and `/terms` as static routes (both prerender: no auth, no per-user data). They must be public in `proxy.ts`, added as **exact paths** rather than a prefix, following the `/api/demo/login` precedent in SPEC §11.8.
- [ ] Link them from the landing footer (`src/app/page.tsx:377`, the credits block beside "MIT License") and from `/auth/signin`, which is where a visitor decides whether to hand over an address. Keep them internal links, so no `target="_blank"`.
- [ ] **Do not describe the MIT licence as the terms of use.** The footer's MIT link covers the *source code*; terms of use govern a person's use of the hosted service. Conflating them is the likely failure mode here given the footer already links one of them.
- [ ] **Coordinate with the attribution surface already owed** in the Kalima/bayan work (Part D: CC BY 4.0 for imported questions) and the deck credit in README. Three separate obligations about who owns what, and they should read as one coherent story rather than three pages that each mention a different licence.

---

## Design tokens as Tailwind utilities (deferred)

**Deferred 2026-07-26, and the reason it was deferred is that its stated justification turned out to be false.** This item claimed dark mode was blocked on it. It is not: the ~327 inline `style={{}}` objects read the tokens (`background: "var(--surface)"`), so redefining `:root` reaches every one of them without touching a call site. Measured, 23 hardcoded colour values exist across all `.tsx`, and nearly all are the parrot mascot (brand-coloured under any theme) and `global-error.tsx` (deliberately token-free, since it must render when the stylesheet has not loaded). SPEC §15 now records the correction, and DECISIONS.md carries the row; do not re-derive the premise from this file's history.

What survives is a real but smaller case, and it needs a trigger before it is worth a ~330-site sweep across five session screens:

- [ ] Each inline object allocates per render, and none can be targeted by `:hover`, `focus-visible`, a media query or a future `dark:` variant. That last one is why `.focus-ring` and `.tap-44` exist as utilities at all: an element with `style={{ border: … }}` beats any Tailwind `focus:border-*` class, so the escape hatch had to be `box-shadow` in CSS.
- [ ] `globals.css` maps three tokens through `@theme inline`. Extending it to the full ramp (`bg-surface`, `text-ink-soft`, `border-line`, `rounded-lg`, `shadow-card`) is cheap and independent of migrating any call site, so it can land first and on its own.
- [ ] **Pull this in when something concrete needs a variant an inline style cannot express** (a `dark:` decision in SPEC §15, a hover state on a surface, a responsive layout change), and migrate the call sites that need it rather than all of them. A blanket sweep buys visual-regression risk that nothing currently pays for.

---

## Review backlog: internal findings (2026-07-10)

Lower-priority findings from the app review, roughly ordered. Pull into a phase as capacity allows. Everything user-facing from this review now lives in the UI/UX workstream above, so what remains here is internal.

### Bugs / correctness

- [ ] `scripts/collect-batch.ts` has no `try`/`catch` at all: add per-item handling so one malformed result doesn't abort a whole batch collection.

### Code quality / tests

- [ ] Dedup session components. `Centered` is byte-identical in all four session files and `RATINGS` is duplicated across `study-session.tsx` / `grammar-session.tsx`; both are untouched and belong here. The normalization half of this item is **already absorbed** by `src/lib/study-cards.ts` and `src/lib/grammar-cards.ts`, so do not re-derive it. Two duplications are **knowingly accepted** and are not to be folded in without a reason: `undoLastGrammarReview` mirrors `undoLastReview` (~20 lines differing only in table and key names, where factoring them together means passing Prisma delegates around), and `exam-session.tsx` keeps its own `HighlightedSentence` (next item).
- [ ] `exam-session.tsx:461`: local `HighlightedSentence` → the shared `src/components/highlighted-sentence.tsx`.
- [ ] Extract quiz/exam scoring helpers (`pickDistractors`, similarity fns, currently module-private) so they can be unit-tested; then test them + the highlighted-sentence token pipeline.
- [ ] Log hygiene: audit `console.error` calls for payloads that shouldn't be logged.

### Local environment

- [ ] `.env:8` pins `NODE_OPTIONS=--max-old-space-size=256`, which OOM-kills `next build`'s TypeScript worker locally; building needs an override (`NODE_OPTIONS=--max-old-space-size=4096 npm run build`). Decide whether the cap is still wanted: it mirrors the Railway runtime budget, but `start:prod` sets its own 512MB anyway.

---

## Open questions

Tracked in SPEC.md §15.
