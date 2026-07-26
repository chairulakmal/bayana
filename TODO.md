# TODO: Bayana

Open work only: what is planned, in flight, or found-but-not-fixed. This file is the cross-session "where we left off" record, so keep it current, and **delete an item in the commit that lands it** rather than archiving it. Shipped work is already recorded three times over: [SPEC.md](SPEC.md) §13 Milestones at design altitude, [DECISIONS.md](DECISIONS.md) for why it was done that way, and git for the detail. Decisions do **not** go here.

**Now: the frontend architecture workstream** (first section below). New on 2026-07-26, from a frontend review that looked at data flow rather than at the rendered surface. It is sequenced first because it rewrites the exact lines several already-queued items touch, and doing those first means writing them twice.

**Then: the UI/UX workstream** (second section). Eight items, of which four are now sequenced behind the architecture work and two remain deferred on external blockers. Each is marked in place.

**Then: Phase 3.** MC↔FSRS coupling for Quiz mode (planned, not started). Its Part A is written against `POST /api/review`, which the architecture work deletes, so it has been restated against the replacement and must not start first.

**Next: Phase 4.** Admin sentence audit + on-demand generation. Then Phase 5 (multi-user) and Phase 6 (further enhancements), both tracked only in SPEC.md §13 for now.

**Unsequenced:** Kalima absorption + bayan/zaka consumer (section below). New scope, decided 2026-07-26. Recorded as an unnumbered SPEC §13 milestone; not yet slotted against Phases 3 to 6, and note it is coupled to Phase 4 (Kalima's rank review folds into that admin page).

---

## ▶ Frontend architecture: server-rendered data + Server Action writes

**From a frontend review on 2026-07-26** that read the data flow rather than the rendered surface, so it overlaps the UI/UX workstream in files but not in findings.

The finding: the app is an App Router shell around a client-side SPA. All six interactive surfaces (`study-session`, `quiz-session`, `exam-session`, `grammar-session`, `browse-client`, `grammar-browse-client`) mount, render a loading state, then `useEffect` → `fetch('/api/…')`. Server Components do real work on `/home` and `/stats`, but on the four session screens they resolve an auth cookie and a five-character level string and stop. `/study` therefore costs a server round trip that already knows `userId`, then a JS parse, then a second round trip that re-derives `userId` from scratch, before the first card paints. It also makes `<Link>` prefetch worthless, since prefetching `/study` warms up a spinner.

**Two decisions are already made** (author, 2026-07-26) and constrain everything below. Both are recorded: SPEC §9 states the convention, §14.16 and §14.17 hold the rejected alternatives, and DECISIONS.md carries the dated row.

- **Reads stay route handlers; writes become Server Actions.** Reads keep a documented, cacheable HTTP surface and are still needed for the imperative refetch paths ("Check for more", retry, "Play again"). Writes have no external consumer and gain typed arguments plus a shorter path. Action names and their guards are specified in SPEC §9.2; follow them rather than inventing new ones.
- **No opt-in rendering flags.** `cacheComponents`, View Transitions and the React Compiler are all opt-in and would put a live Railway deployment at the mercy of a Next minor bump. This also rules out `use cache`, which is gated behind `cacheComponents`, so the caching work below uses React's stable `cache()` instead. (Verified against 16.2.7: only `viewTransition` is still under the `experimental.` namespace, so do not go looking for the other two there.)

### 2. Reference implementation on `/study`

Do one mode properly, then port. Steps are ordered because each depends on the last.

- [ ] **Normalize server-side.** `src/app/api/cards/queue/route.ts` returns raw Prisma rows, so every due card ships its full FSRS internals (`stability`, `difficulty`, `reps`, `lapses`, `elapsedDays`, `scheduledDays`, `state`, `lastReview`, `due`) to a client that reads none of them: `study-session.tsx:45` `toCard` discards all of it on arrival. Move that flattening into a shared `src/lib/study-cards.ts` exporting `buildSession(userId, level)`, and have both the route handler and the RSC call it. One shape, one definition, smaller payload.
- [ ] **Split the page into a shell plus a streaming child.** `src/app/study/page.tsx` awaits `buildSession` in a nested async component under `<Suspense>`, not in the page function itself. Suspense only streams what is *below* the boundary, so awaiting in the page body renders nothing until the queue resolves and the boundary does nothing. This is the step that is easy to get subtly wrong.
- [ ] **Seed the client from props.** `study-session.tsx` takes `initial` and drops the mount `useEffect` (`:106`) and the `cards === null` branch (`:177`). Keep `loadQueue` (`:83`) and the `requestIdRef` token (`:77`): both are still needed for the imperative refetch, which stays a route handler.
- [ ] **Add `src/app/study/error.tsx`.** Once the first load happens on the server, a failure throws instead of rendering the in-component retry screen at `:190`. Without a route-level boundary it escapes to the root one and loses the session chrome. This moves from optional to required.
- [ ] **Writes to a Server Action.** `src/app/study/actions.ts` exposes `rateCard` and `undoRating` calling the existing `reviewWord` / `undoLastReview`. **Keep every guard from the route handlers.** A Server Action compiles to a POST endpoint with an id discoverable in the client bundle, so it is exactly as reachable as the route was and its arguments are exactly as untrusted. No `revalidatePath` in either: the queue is client-owned session state, and revalidating would refetch the page mid-session.
- [ ] **Instant advance.** `study-session.tsx:114` `rate`: advance `index` / `reviewed` / `flipped` immediately, run the action inside `useTransition`, roll all three back and surface the error on failure. `busy` is deleted, so the rating buttons stop disabling and rapid-fire rating works.
  - **Not `useOptimistic` here.** It reconciles an optimistic value against server-derived state and reverts when the transition settles. `index` is client-owned state that no server response replaces, so there would be nothing to reconcile against. `useOptimistic` is the right tool in item 5, where the base value is a prop from an RSC.
  - **Note the race.** Dropping `disabled` makes the concurrent double-rate more likely, not less. The SERIALIZABLE transaction at `review.ts:34` is what prevents a lost update; that comment becomes load-bearing and should say so.

### 3. Port the three remaining session modes

- [ ] `quiz-session.tsx`, `exam-session.tsx`, `grammar-session.tsx` against the `/study` reference: server-fetched initial payload, `<Suspense>` shell, route-level `error.tsx`, imperative refetch retained.
- [ ] `grammar-session.tsx:121` write path to a Server Action alongside the vocab one.
- [ ] Delete `POST /api/review`, `POST /api/review/undo` and `POST /api/grammar/review` only once all four modes are ported, not before. The seven read routes (`cards/queue`, `quiz`, `exam`, `browse`, `words/[id]/sentence`, `grammar/queue`, `grammar/browse`) all stay, as does `demo/login`, `dev/login` and the Auth.js catch-all.

### 4. Browse and grammar browse

- [ ] Same server-fetch-then-hydrate treatment for `browse-client.tsx:47` and `grammar-browse-client.tsx:42`. Both keep their read routes: the browser cache on `/api/browse` (`private, max-age=3600, stale-while-revalidate=86400`) is doing real work and should not be discarded.
- [ ] `browse-client.tsx:99` `toggle`: request-token race. Tap row A then row B quickly and A's `finally` clears `loadingId` while B is still in flight, so B's spinner vanishes. The fix is the token already used at `study-session.tsx:77`. Cosmetic, but the pattern is one file away.
- [ ] `browse-client.tsx:42`: `sentenceCache` (ref) and `sentences` (state) are duplicated storage, with the ref as source of truth and the state a hand-copied mirror. One `useState<Map>` with functional updates does both.

### 5. Optimistic level switch and form pending states

- [ ] `level-picker.tsx:50`: the picker dims to `opacity: 0.4` and waits a full round trip to move a check mark. `useOptimistic` fits here precisely because `current` is a prop rendered by the RSC and replaced by `revalidatePath`.
- [ ] `level-picker.tsx:57`: `router.refresh()` fires after `setActiveLevel`, which already calls `revalidatePath` on five paths (`src/app/home/actions.ts:57`). A `revalidatePath` inside a Server Action refreshes the current route on the action response, so this looks like a redundant second round trip. Verify before removing.
- [ ] `src/app/auth/signin/page.tsx:117`: `useActionState` for the pending state, which resolves the second bullet of UI/UX item 2 as a side effect rather than as separate work.

### 6. Design tokens as Tailwind utilities

Independent of items 1 to 5 and pullable in parallel, but do it after the component surgery so the two do not fight over the same lines.

- [ ] Roughly 200 inline `style={{}}` objects across the app consume the `globals.css` tokens directly (`home/page.tsx` alone has 20+). Each allocates a fresh object per render, and none can be targeted by a media query, `:hover`, `focus-visible` or `dark:`.
- [ ] `globals.css` already maps three tokens through `@theme inline`. Extend it to the full ramp so `bg-surface`, `text-ink-soft`, `border-line`, `rounded-lg` and `shadow-card` are real utilities, then migrate call sites.
- [ ] **This is what makes the dark-mode question in SPEC §15 answerable.** Today dark mode would mean editing every one of those ~200 sites; after the migration it is one block redefining `:root`. Add that dependency note to the open question so it is not re-litigated as a design problem when it is a mechanical one.

---

## ▶ UI/UX workstream

Everything user-facing that is known-wrong or known-missing, worked top-down. The items reachable on pages that are otherwise finished (route states, hit targets, the first pass at keyboard and screen-reader gaps, navigation parity) landed on 2026-07-26 and were deleted as they did.

**Items 1 to 6 came from a full UI/UX review of the shipped surface on 2026-07-26**, read against BRAND.md and SPEC §8.4. They cluster on one axis the earlier passes did not cover: what happens on a keyboard, with a screen reader, or in the instant after a tap. The visual system itself held, so nothing below is a token or layout change. Two of the review's items shipped on 2026-07-26 and are deleted, which is what the numbering below has been closed up over: keyboard shortcuts in the study modes (SPEC §8.4, §14.18) and the tap-anywhere card no longer being a `<button>` (SPEC §8.4, §14.19).

**Items 1, 2, 3 and 6 now sequence behind the architecture workstream above**, which rewrites the same lines. Marked in place. Items 4 and 5 are independent and can be pulled at any time.

**Items 7 and 8 are deferred, and neither is waiting on capacity.** One is blocked on other work, the other on a decision that was explicitly postponed. Do not pull either in as filler.

### 1. Focus is destroyed after every answer, in all four modes

Rating or answering leaves focus on `<body>`, so a keyboard user re-Tabs from the top of the document on every card.

**Downgraded from "highest-frequency defect" on 2026-07-26**, when the study-mode keyboard shortcuts shipped: a document-level handler means a keyboard user drives the whole session without needing focus to be anywhere in particular, so the ten-to-twenty re-Tabs per session are no longer on the main path. What remains is the screen-reader case, which the shortcuts do not help: an SR user is told nothing about where they now are, and browse-mode quick-nav keys intercept the digits before the handler ever sees them. Still worth fixing, no longer urgent.

**Sequenced behind architecture items 2 and 3**, which rewrite both mechanisms below. Fixing it first means writing it twice; the rewrite is also the natural place to put the focus move.

- [ ] `src/components/study-session.tsx:355` and `src/components/grammar-session.tsx:310`: rating a card sets `flipped = false`, which unmounts the four rating buttons out from under the focused element, so focus falls to `<body>`.
- [ ] `src/components/quiz-session.tsx:192` and `src/components/exam-session.tsx:317`: the chosen option takes `disabled={answered}`, and browsers blur a control the moment it is disabled.
- [ ] Fix is the same in all four: after each transition, move focus deliberately to the control that is now the next step (the "Show answer" button, or the "Continue" button). A ref plus an effect keyed on the transition, not an `autoFocus`.
- [ ] Note that dropping `busy`/`disabled` in architecture item 2 removes the *second* cause outright, and leaves only the unmount case to handle.

### 2. The magic-link flow leaves the brand at its most fragile moment

- [ ] `src/auth.ts:44` sets only `pages: { signIn }`, so submitting the form lands on Auth.js's built-in `/api/auth/verify-request`: white page, system font, generic copy, no Pī. Add `verifyRequest` (and `error`) to `pages` plus the two small routes. Independent, pullable now.
- [ ] `src/app/auth/signin/page.tsx:117`: "Send magic link" has no pending state, so a slow Resend call reads as a dead button and invites a double-submit. **Superseded by architecture item 5**, which fixes it via `useActionState`. Delete this bullet there, not here.

### 3. Missing headings and page titles

- [ ] No `<h1>` on `/home`, `/grammar`, or any of the four session screens. The hub's "TODAY" / "STUDY MODES" / "LEVEL" labels are `<p>` elements, so heading navigation finds nothing at all on the app's default page. Landing, browse, stats, signin, onboarding and the error routes all have one already.
- [ ] 9 of 11 routes never set a title. `src/app/layout.tsx:7` defines `template: "%s · Bayana"` and only `/browse` and `/grammar/browse` use it; everything else renders the default string in the tab, in history, and in the PWA task switcher. **Partly absorbed**: architecture items 2 and 3 rewrite each session `page.tsx` and should add its `metadata` export in the same edit, leaving only `/home`, `/grammar` and `/onboarding` here.

### 4. Labelling and live-region gaps

- [ ] `src/components/bottom-nav.tsx:44`: no `aria-current="page"` on the active tab (it is the only `aria-current` missing from the codebase), and the `<nav>` has no accessible name. Active state is currently colour plus font weight alone.
- [ ] `src/components/info-bubble.tsx:58`: the trigger is a 16x16 px tap target (`h-4 w-4`, no `.tap-44`), on both the home hub and the landing hero. It is the one control the 44px sweep missed.
- [ ] `src/components/info-bubble.tsx:65`: `aria-expanded` with no `aria-controls`, on a click-toggled rich panel marked `role="tooltip"`. It announces expanding something a screen reader then cannot find. `user-menu.tsx` already carries the correct disclosure pattern to copy.
- [ ] The card flip is silent to screen readers (`study-session.tsx:309`, `grammar-session.tsx:259`), while Quiz and Exam both announce their result through a permanently mounted `role="status"`. Same app, two answers.
- [ ] "Failed to save your review." is a plain `<p>` (`study-session.tsx:342`, `grammar-session.tsx:298`), the only transient message in the app that is not a live region. Note that architecture item 2 makes this message *more* important, not less: with the optimistic advance, a failed write is the only signal that anything went wrong.

### 5. `grammar-browse-client.tsx` never got its sibling's fixes

Two things `browse-client.tsx` fixed and documented in comments were not carried across:

- [ ] `:191` and `:224` put `aria-label` on bare `<span>` elements with no role, which most screen readers discard. That is exactly the bug `browse-client.tsx:275` solved with `role="img"`, so the "n/m studied" count and the mature/learning status dot are still sighted-only here.
- [ ] `:177` applies `opacity: 0.6` to the whole lesson header while a search is active. That is the contrast-passing-pair-plus-alpha composite BRAND.md §3 forbids by name; the `--ink-faint` count text lands near 2.6:1.

### 6. Smaller UX items

- [ ] `src/components/browse-client.tsx:82` `goToPage`: turning a page does not scroll back to the top of the list. At 375px with 50 rows, tapping "Next" at the bottom leaves the user at the bottom of the next page.
- [ ] Grammar has no Undo while vocab does (`grammar-session.tsx:8` calls it a v1 omission). A mis-tapped "Easy" on a grammar card is as unrecoverable as the last-card vocab case that was worth fixing in `study-session.tsx`. **Cheapest during architecture item 3**, which is already writing that component's action layer. When it lands, add the `u` binding to `grammar-session.tsx`'s shortcut map: it is the one key where the two queues currently disagree, and SPEC §8.4 records that parity as deliberate.
- [ ] `src/app/auth/signin/page.tsx:114`: the email field uses `outline-none` plus `focus:border-*` instead of the `.focus-ring` utility both search fields use, and `focus:` rather than `focus-visible:`, so it also fires on pointer taps.
- [ ] `/stats` has no level control, so changing level means a round trip through `/home`. That is the same friction that justified adding the picker to the grammar hub.
- [ ] `src/components/browse-client.tsx:204`: the `role="status"` result count re-announces on every keystroke. Debounce the announced value, not the filtering.

### 7. Performance: subset the Japanese face, blocked on bayan

**Deferred 2026-07-26: starts only once bayan is finished.** Not a capacity call. The sibling bayan/zaka dataset is the nearer-term commitment, and this is a self-contained build-pipeline project that will still be worth exactly as much later.

- [ ] `src/app/fonts.ts` now self-hosts M PLUS Rounded 1c at 400/700 with `preload: false`, but Google still slices Japanese into ~126 `unicode-range` chunks *per weight*, so ~252 `@font-face` rules are inlined into every page's CSS for glyphs that page will never use. Serving a `fonttools` subset of the ~2,500 characters the deck actually uses via `next/font/local` collapses that to a handful of rules.
  - **Re-measure before starting.** The ~66 KB-gzipped figure in SPEC §14.12 predates dropping weight 800 and moving both Latin faces to variable fonts, so the current cost is unknown.
  - Still a real project rather than a config change: it needs a build step plus a decided answer for what happens when a generated sentence contains a kanji outside the subset.
  - **Note the interaction with the Kalima/bayan work**, which is the thing it waits on: imported questions and the N3 passage set introduce Japanese text this app did not author, so the "kanji outside the subset" question has a wider blast radius after that lands than before. Deciding it first would have meant deciding it twice.

### 8. UX correctness: day boundaries, deferred pending a timezone decision

**Deferred 2026-07-26.** The fix is small; what it needs first is a decision on where a user's timezone comes from (profile field, browser-reported, or a fixed offset), and that was postponed rather than made.

- [ ] Day boundaries use local-*server* midnight (`setHours(0,0,0,0)`) in `getGrammarStats` and in `startOfToday` (`src/lib/home.ts`, which powers the hub's "done today"), so a user in another timezone can watch the count reset mid-session. The hub's helper is centralised, so the code change is one function; the open part is the source of truth for the offset.

---

## ▶ Phase 3: MC↔FSRS coupling

Resolves SPEC §15 open question #1. Makes Quiz and Flashcard modes genuinely complementary: MC answers seed the FSRS schedule, and MC question selection is informed by the user's FSRS state. No new schema, since it reuses `ReviewState` and `ReviewLog`.

**Sequenced behind the architecture workstream.** Part A was originally written against `POST /api/review`, which that work deletes in favour of a Server Action, and Part B changes `buildQuiz`'s signature in the same file the port touches. Starting here first means writing Part A twice.

### Part A: MC answers write FSRS ratings

- [ ] `src/components/quiz-session.tsx`: in `choose(i)`, call the `rateCard` Server Action (architecture item 2) with `{ wordId: current.wordId, rating: correct ? 3 : 1 }`. Fire inside a transition without blocking the UI, matching the optimistic advance the flashcard loop uses; the quiz must stay snappy. No UI change.
- [ ] **Decide before coding**: correct → Good (3) or Hard (2)? MC is recognition-only (easier than flashcard active recall), so Hard is more conservative and gives a shorter interval. Good is simpler and still rewards the answer. Log the choice in DECISIONS.md.

### Part B: 50/50 MC source split (review pool + new)

- [ ] `src/lib/quiz.ts` `buildQuiz(level, count, userId)`: add `userId`; split target selection into two pools: (a) words with `ReviewState` for this user at this level, ordered by `due asc` (near-due first, for reinforcement); (b) words with no `ReviewState` (new words, randomly sampled). Take `floor(count/2)` from (a) and `ceil(count/2)` from (b); if either pool is smaller than its half, fill from the other.
- [ ] `src/app/api/quiz/route.ts`: pass `userId` (already available from `getCurrentUserId()`) into `buildQuiz`. Note that after the architecture port this route has a second caller, the `/quiz` RSC, so the change lands in one shared helper rather than in the handler.

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

## Kalima absorption + bayan/zaka consumer (new scope, 2026-07-26)

Kalima's JLPT mock exam moves into Bayana, and Bayana replaces Kalima as the named reference consumer of the bayan/zaka dataset. Both land in the same new table, so they are one piece of work, not two: Kalima's 496 seeded N3 vocabulary questions and bayan's published releases are the same kind of row from different sources.

Why Bayana rather than Kalima, in one line each: Kalima is N3 vocabulary only across five question types, while this app already models N5 to N1, holds ~8,100 words plus a grammar table whose `pattern` matches bayan's `grammar_points`, and can grade an exported question into a learner's FSRS state. Full reasoning belongs in SPEC §14 and DECISIONS.md (see the housekeeping items below); the porting checklist for Kalima's side is in that repo's TODO.md.

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

Done 2026-07-26, before any code: SPEC §2 (scope change), §3 (terms), §4.2 (the third source-data class and its CC BY 4.0 obligation), §13 (unnumbered milestone), §14.9/§14.10 (both resolved forks), §15 (two open forks), and the DECISIONS.md row. Remaining:

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

## Review backlog: remaining findings (2026-07-10)

Lower-priority findings from the app review, roughly ordered. Pull into a phase as capacity allows. Everything user-facing from this review now lives in the UI/UX workstream above, so what remains here is internal.

### Bugs / correctness

- [ ] `scripts/collect-batch.ts`: per-item try/catch so one malformed result doesn't abort a whole batch collection.

### Code quality / tests

- [ ] Dedup session components: byte-identical `Centered` in 4 files, duplicated `RATINGS` arrays, duplicated `shuffle` (`review.ts` / `grammar-review.ts`), ~80-line `getStudyQueue` / `getGrammarQueue` overlap. **Partly absorbed** by architecture item 2, whose shared `study-cards.ts` is the natural home for the normalization half; the `Centered` and `RATINGS` duplication is untouched by it and stays here.
- [ ] Exam-session's local `HighlightedSentence` → shared component.
- [ ] Extract quiz/exam scoring helpers (`pickDistractors`, similarity fns, currently module-private) so they can be unit-tested; then test them + the highlighted-sentence token pipeline.
- [ ] Log hygiene: audit `console.error` calls for payloads that shouldn't be logged.

### Local environment

- [ ] `.env` pins `NODE_OPTIONS=--max-old-space-size=256`, which OOM-kills `next build`'s TypeScript worker locally; building needs an override (`NODE_OPTIONS=--max-old-space-size=4096 npm run build`). Decide whether the cap is still wanted: it mirrors the Railway runtime budget, but `start:prod` sets its own 512MB anyway.

---

## Open questions

Tracked in SPEC.md §15.
