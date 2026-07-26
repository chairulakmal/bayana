# Bayana: Design Document

**Spaced-repetition JLPT vocabulary trainer with AI-generated example sentences.**

| | |
|---|---|
| **Status** | Living document; Phases 1a through 3.5 implemented and deployed (§13). **A migration to Nuxt, including a redesign of the data model, is decided and not started** (§5.2, §6, §14.26); this document describes the deployed Next.js system and marks what the migration changes. |
| **Author** | Chairul Akmal |
| **Last updated** | 2026-07-27 (**the three pre-gate workstreams are done**, and each was kept live through the freeze on the same ground: it survives the Nuxt port. Every route now has one `<h1>` and one title, the rule being one heading per *rendered state* rather than per file, so the four session components promote the completion line that already carried focus and give the active card screen a visually-hidden heading rather than the title bar that would compete with recall (§8.4); `/browse` returns to the top of the list when paging and debounces the *announced* result count rather than the filtering; `/stats` gains the shared `LevelPicker`, which also retired a chip-row variant that had no call site; and `/grammar/browse` gains an **in-page** error boundary, because a route-level `error.tsx` cannot rebuild header chrome that needs the database (§9.3, §14.28). **`/privacy` and `/terms` are published** (new §11.10), plain-language by the author's call, stating two claims that are properties of the code rather than marketing (no analytics or third-party scripts of any kind, and no user activity ever reaching an AI model) and flagged in TODO.md against the work that would falsify each. Their retention promise made the demo cleanup a **commitment** rather than a heuristic: the rule moves to `src/lib/demo-cleanup.ts` and gains a daily Railway cron service, with a 14-day stated window over a 7-day enforced cutoff so a missed run degrades nothing (§11.8, §12). And **`src/lib` is pinned with 158 characterization tests** against one file before (new §12.1): DB-touching functions take a `Deps` seam as a defaulted last parameter and tests inject an in-memory fake that throws on any query shape it does not implement, chosen over a throwaway Postgres because what has to survive the port is composition rather than SQL, and over `vi.mock` because the suite is meant to run against the Nuxt copy. Two findings recorded rather than fixed (§15): `getLevelStats` counts Hard as a failed recall while its comment said otherwise (comment corrected to the code), and `rollback` leaves an undone card due immediately rather than restoring its original due date. The extraction TODO.md asked for landed with it: the scoring helpers duplicated between `quiz.ts` and `exam.ts` are now `src/lib/word-similarity.ts`. §8.4, §9.3, §11.8, §12, §13, §15 updated; new §11.10, §12.1 and §14.28. Earlier the same day: **the project states a ranked north star** in §2, the author's, and it is the tie-breaker for every open fork: (1) be the best study app for its loyal users, currently one person; (2) be the reference consumer of bayan, whose location is now recorded; (3) be a learning vehicle for the author, scoped to mobile layout, PWA and design implementation; (4) be a current Nuxt application, migrating to Nuxt 4 at the Gate 2 rewrite and adopting Nuxt 5 once stable, the author being an active contributor to Nuxt so that running on current Nuxt is upstream dogfooding rather than a maintenance chore. This **corrects the recorded justification for §14.26's migration**, which had credited §1's learning goal alone: objective 3 is framework-independent and a Next.js app would serve it equally well, so objective 4 is the one that names Nuxt and holds it as an end. §2 and §14.26 updated. Same day: **all source data consolidates onto bayan**: vocabulary, grammar, example sentences and questions come from one CC BY 4.0 supplier, which retires the Anki deck, the unredistributable grammar file behind §4.1's licensing defect, and §7's generation pipeline entirely. Verified against bayan's repository rather than assumed, and it supplies **only grammar today**: its vocabulary lists are being regenerated, its `VocabEntrySchema` has no example-sentence field at all, and `dataset/export.json` is `{"count": 0}`; it also targets N5–N3, so the app's range narrows until bayan extends its own. The author's condition is that bayan produce N5–N3 words *and* sentences before Bayana consumes any of it. **Bayan reaches production first and the migration waits for it**, decided later the same day and **reversing** an earlier decision to seed the new database from the current corpus and swap later: that reasoning had rested on Bayana needing to keep working, which the completed exam makes false, so the option kept only its costs (a database seeded from a corpus already scheduled for deletion, and three components surviving a cutover designed to remove them). Both answers are recorded in §14.27, since the reversal turned on a premise rather than a preference. Consequently `decks/*.csv`, `scripts/import-csv.ts` and §7 are retired *at* the cutover as originally expected, and the imported-question milestone is largely absorbed into the migration, being its reference consumer now describing how the app is seeded rather than a feature added later. New §4.3 and §14.27; §4, §4.1, §7 and §13 updated. Same day: **the production database is reset at cutover rather than migrated**, the author's call, which removes what §14.26 had recorded a day earlier as the migration's largest cost: the app has one user whose JLPT sitting is complete, so the accumulated FSRS history is discarded rather than carried, and `ExampleSentence` is reseeded from the local copy §12 already designates authoritative rather than transferred out of prod. The §6 redesign is consequently **unconstrained by data as well as by schema**, no carry-over script exists to write or rehearse, and the cutover reduces to a reseed plus a domain repoint; an archival `pg_dump` before the reset is retained as a recommendation, not a prerequisite, solely to preserve `ReviewLog` as FSRS re-optimization input for the empty `UserProfile.fsrsParams`. §6, §12, §13 and §14.26 updated. 2026-07-26: **the framework migrates to Nuxt**, decided and not started, as a greenfield app in this same repository that takes over the production URL at cutover: the deciding constraint is that React to Vue admits no incremental path, so an "in-place" migration would perform the same ~7,700-line rewrite while leaving `main` unbuildable, and the deciding *reason* is the learning goal in §1 rather than any defect in the deployed stack, whose §5.1 single-service conclusion is inherited unchanged since none of its five arguments is a Next.js argument. **The data model is deliberately in scope** (§6): `Word.guid` cannot remain a word's identity once bayan-produced words have no Anki lineage, which also puts a deadline on §12's guid-keyed transfer and backup format; the FSRS field block is duplicated four times and would reach six with stored exam questions; and `level` already has two representations. The redesign is bounded by data rather than schema, in that `ExampleSentence` and the accumulated FSRS history must survive while everything else may be reseeded, which makes the cutover a data migration over precisely the prod-only data §12 declines to back up routinely. New §5.2 and §14.26, §6 and §12 gain the consequences, §13 gains the milestone and defers Phases 3 and 4 behind it, and §15 gains the auth-replacement question while the Exam-mode fork is **pulled forward** into the migration because the question store cannot be shaped without it. Also recorded in §6: `UserProfile.timezone` and `dayStartHour` have existed unused since the schema was written, so the day-boundary defect's stated blocker was already resolved. Earlier the same day: the server-render default from the session ports gains a **stated exception**, and the criterion is payload size rather than page kind, which is the new §9.3: `/grammar/browse` moves onto the server behind the shared `buildGrammarBrowse` (~220 rows, so the round trip dominates), while `/browse` **keeps its client fetch** (~2,700 rows and ~90 KB gzipped for N1, whole-deck because search filters in memory, and a cookie-reading route's response is not cacheable), but gives up the per-user `started` flag that had been riding inside it, which is what raises `/api/browse` from a 1 h to a 24 h `max-age`: the short lifetime had never described deck data, only the ordering sharing its response. `/browse` now server-renders that ordering instead (`src/lib/browse.ts`). Also: `LevelPicker` gains `useOptimistic` and loses both its `router.refresh()` (verified redundant against the 16.2.7 `revalidatePath` reference: an action's response already carries the re-rendered payload for the route being viewed) and its `disabled={pending}` plus `opacity: 0.4` dimming; the sign-in form becomes a client component with a real pending state, reporting `AccessDenied` as returned state rather than an `?error=` redirect. §8.3, §9.1, §9.2 and §10 updated, the seven rejected shapes are in the new §14.25, and §15's dark-mode question is **corrected**: the app's ~330 inline `style={{}}` objects were never the blocker, since they read the tokens, so a token migration is an independent change rather than a prerequisite. Earlier the same day: the three remaining session modes are ported onto the §8.1 reference, which completes the §9 reads/writes split: `/quiz`, `/exam` and `/grammar/study` each build their first payload during the page render, awaited in a nested component under `<Suspense>` and handed to the client as a prop, so `POST /api/review`, `POST /api/review/undo` and `POST /api/grammar/review` are **deleted** and the surviving read routes serve only imperative refetches. Three shared builders give each mode one definition of a round: `buildQuizRound`, `buildExamRound` (which takes over the 問題１/問題２ split, because `ExamSession` recovers the section boundary from question *order*, so two callers splitting differently would misplace the break screen rather than error) and the new `src/lib/grammar-cards.ts`, whose `buildGrammarSession` flattens what the queue route had been returning as raw `GrammarProgress` rows. **Grammar gains undo**, the one genuinely new feature here and the only part needing a migration: `GrammarProgress` holds only the latest state, so the new `GrammarReviewLog` table (§6) supplies what ts-fsrs `rollback()` needs, with no change to `fsrs.ts`, which was already entity-agnostic; this also makes the two flip-and-rate key maps identical, `u` having been the one key they disagreed on. **Focus is now moved deliberately after every study-mode transition** (`src/hooks/use-focus-on-transition.ts`), under a rule that focuses a button only where the next step is unambiguous and a `tabIndex={-1}` anchor wherever it is a choice, since `Space` natively activates a focused button; answered options move from `disabled` to `aria-disabled` for the same reason. All four modes now share `src/components/session-error.tsx` behind four thin `error.tsx` files, keeping per-route copy because only some modes can truthfully promise they schedule nothing. §6, §8.2, §8.4, §8.6, §9.1, §9.2 and §13 Phase 3.5 updated; the five rejected shapes are in the new §14.24; and §6's "never updated or deleted" claim about `ReviewLog` is corrected, both logs having always had an undo that deletes. Same day: Flashcard mode is the reference implementation of the §9 reads/writes split: `/study` builds its first queue during the page render and streams it under `<Suspense>` (the `await` sits in a nested component, because a boundary only streams what is below it), `src/lib/study-cards.ts` holds the one `buildSession` both the page and `GET /api/cards/queue` call, `rateCard` and `undoRating` land as Server Actions with every route guard reproduced, rating now advances the card before the write resolves, and the route gains its own `error.tsx`; §8.1 is rewritten, §8.4 records that error coverage is now two-tier, §9.1/§9.2 statuses updated, the future-tense claim in §14.17 is now realised, and the four rejected shapes are in the new §14.23. Same day: the magic-link flow no longer leaves the brand: `pages` in `src/auth.ts` now names `verifyRequest` and `error` as well as `signIn`, so the two Auth.js built-ins (an unstyled white page, one of them on the happy path) are replaced by `/auth/verify-request` and `/auth/error`; all three screens share the new `src/components/auth-card.tsx`, `AccessDenied` is forwarded to the sign-in page rather than explained twice, and §11.2 gains both the page list and the by-*when* split between the two error paths, with the three rejected options in the new §14.22. Same day: `grammar-browse-client.tsx` brought up to its vocab sibling: the progress dot gains the `role="img"` that makes its label count, the lesson-header studied count moves into the button's own name (where an `aria-label` on a control discards every child, so labelling the span could never have worked), the header name drops the "Expand"/"Collapse" verb in favour of `aria-expanded`, and the `opacity: 0.6` search state is removed as the fourth instance of the composite BRAND.md §3 forbids; §8.4 gains both halves of the `aria-label` rule and the new §14.21 holds the three rejected options. Same day: labelling and live-region gaps closed: the active `BottomNav` tab gains `aria-current="page"` and the tab bar an accessible name, `InfoBubble` becomes a real disclosure with a 44px target instead of a 16px `role="tooltip"`, the flashcard and grammar reveals are announced through the same always-mounted `role="status"` Quiz and Exam use, and every transient failure message moves into a `role="alert"`; §8.4's keyboard/SR bullet gains the live-region and disclosure rules and the new §14.20 holds the five rejected options. Same day: the flashcard and grammar cards stop being `<button>`s and become plain `<div>`s with a pointer-only tap-to-flip overlay, restoring text selection and giving screen readers something other than one giant button name: §8.4 gains a "content surface is never itself a control" rule and the new §14.19 holds the four rejected shapes. Same day: keyboard shortcuts shipped in all four study modes: §8.4 gains the key map and the `.kbd-hint` discoverability treatment, with the two rejected forks (declining shortcuts outright, and Anki's `Space`-rates-Good binding) in the new §14.18. Earlier the same day: API surface split by direction: §9 restructured into §9.1 route handlers (reads) and §9.2 Server Actions (writes), the three rating routes marked for retirement and the planned on-demand generation route reclassified as a write; §14.16 records why both uniform alternatives lost, and §14.17 records the decision to decline `cacheComponents`, View Transitions and the React Compiler on deployment risk. Planned, not built. Earlier the same day: UI/UX workstream parked: the Japanese-face subset is deferred behind the bayan work and the timezone day-boundary fix behind a timezone-source decision, both tracked in TODO.md; dark mode moved from that list into §15 as the open design question it always was. Same day: grammar hub gains an inline `LevelPicker` with derived empty-deck markers, `setActiveLevel` now revalidates every level-scoped route, and §14.14 records the partial mitigation this gives the disabled-tile stranding. Same day: keyboard and screen-reader gaps closed on the browse pages and the account menu: §8.4 gains a keyboard/SR floors bullet and `UserMenu` becomes a disclosure rather than a mis-declared ARIA menu, per the new §14.15. Same day: Grammar mode tile now disabled on levels with no seeded deck, reversing §8.5's "no tile is ever disabled" rule; the reversal and its accepted cost are in the new §14.14. Same day: hit-target audit closed: the last five sub-44px controls raised to the floor and §8.4's touch-ergonomics bullet gains the `.tap-44` / `.tap-44-box` split. Same day: route states added app-wide: §8.4 gains a route-states bullet covering the four boundary files and the two-tier loading design, with the rejected shapes in the new §14.13. Same day: brand fonts self-hosted with `next/font` and the Japanese face cut to two weights: §8.4 gains a font-delivery bullet, §11.3 records a CSP with no third-party origin left in it, and §14.12 is rewritten from a deferral into the decision and its rejected alternatives. Same day: font weights trimmed to what the app renders and Japanese text returned to the Japanese face at nine sites. Same day: accessibility floors added to §8.4 with the alternatives in §14.11, following a BRAND.md review: contrast and keyboard-focus defects fixed in the session chrome, the level pickers, and the browse inputs; `--ink-faint` darkened to clear AA; BRAND.md resynced against `globals.css`. Same day: planned scope added in §2, §4.2, §13, §14.9/§14.10 and §15: the Kalima mock-exam absorption and the bayan/zaka consumer role, neither built yet. Same day: §16 decision log extracted to [DECISIONS.md](DECISIONS.md), leaving a pointer. 2026-07-25, documentation-consistency pass: §8 intro, §8.6, §9, §11.2/§11.3/§11.6 and §13 corrected against the implementation; §13 phases renumbered to admit the MC↔FSRS coupling phase. Earlier the same day: §8.5 rewritten for the `/home` landing and the revamped public `/`; §14.7/§14.8 added; deck-size figure corrected in §3) |
| **Target platform** | Mobile-first responsive web (Next.js 16, deployed on Railway) |

---

## TL;DR

Bayana turns an existing ~8,100-word JLPT vocabulary deck (N5–N1, Anki export) into a modern web flashcard app. Cards are scheduled with **FSRS** (the algorithm used by current Anki), and each word is paired with **example sentences generated once by Claude Haiku and cached permanently** in Postgres. It offers four study modes (§8): a serious spaced-repetition **"Flashcard mode,"** a fast, gamified multiple-choice **"Quiz mode,"** a JLPT-style **"Exam mode"** benchmark, and a separate FSRS queue for **grammar points**. The app ships as a **single full-stack Next.js service** on Railway. It launches single-user with **passwordless email magic-link authentication** (Auth.js + Resend, restricted to an email allowlist that holds one address today) and a data model that is multi-user-ready from day one.

---

## 1. Background & motivation

JLPT learners memorize large vocabulary lists, but isolated word↔meaning pairs are weak memory anchors. Contextual example sentences materially improve retention, yet writing ~8,100 of them by hand is impractical and licensing pre-made sentence banks is costly.

We start with a clean, structured deck in Anki export format. By generating one set of high-quality, level-appropriate example sentences per word with a cheap LLM and caching them, we get the pedagogical benefit at a near-zero, one-time cost, and a study experience tailored to our own data and scheduling.

## 2. Goals & non-goals

**North star (stated by the author, 2026-07-27).** Four objectives, ranked, against which every goal below and every open fork is settled:

1. **Be the best study app for the people who actually use it.** Today that is one person, the author, and the ranking is deliberate rather than a placeholder: a feature that measurably improves this user's daily review loop outranks one that would look better to a hypothetical audience. "Loyal users" is the operative phrase, not "users": the app optimises for retention and daily return over acquisition, which is why §2's non-goals decline social features and why §8.5's minimal-friction start is a differentiator rather than a nicety.
2. **Be the reference consumer of bayan** (<https://github.com/bayan-exam>), in the substantive sense §4.3 describes: built entirely on the dataset and grading its releases into a real scheduler, not importing questions into a corner of the app.
3. **Be a learning vehicle for the author, specifically in mobile layout, PWA, and design implementation.** This gives §1's learning goal a rank and a scope. It is a real objective the project may spend effort on rather than only a description of how the work is done, but it sits below user value and the bayan role, which means it justifies taking the harder path *within* a piece of work far more readily than it justifies choosing the work itself. The three named areas are where the project is deliberately a teaching instrument; elsewhere the boring option is the right one.
4. **Be a current Nuxt application.** The app migrates to Nuxt 4 at the Gate 2 rewrite (TODO.md) and adopts Nuxt 5 once that release is stable, rather than settling on whichever version happened to be current when it was written. The author is an active contributor to the Nuxt project, so running on current Nuxt is upstream dogfooding as well as a property of this app, which is what makes staying current an objective rather than a maintenance chore.

**Objectives 3 and 4 are what carry §14.26's migration to Nuxt, and this document previously credited the learning goal alone.** That was the weaker claim: a rewrite of a working application is hard to defend under objective 1, and objective 3's scope (mobile layout, PWA, design implementation) is framework-independent, so it would be served by a Next.js app equally well. Objective 4 is the one that names Nuxt specifically and holds it as an end rather than a means. Where objectives conflict the ranking decides, and the reasoning is logged here and in DECISIONS.md rather than settled in passing.

**Goals**
- **Match Anki's core review loop** (FSRS scheduling, undo, suspend, meaningful stats) while eliminating its setup overhead, and without user-authored decks (see non-goals).
- Import the existing deck and present it as study-ready flashcards.
- Schedule reviews with a modern SRS (FSRS) for strong long-term retention.
- Attach AI-generated, level-appropriate example sentences to every word, generated once and served from cache thereafter.
- Ship as the smallest reasonable deployable footprint on Railway.
- Be secure by default despite a single-user launch, and extend cleanly to multi-user.
- Deliver a **mobile-first** experience optimized for small phone screens (iPhone SE baseline) that remains fully usable on desktop.
- **Minimal-friction start.** Returning users are a single tap from studying: signing in lands them on the home hub, whose primary CTA is routed to the highest-priority work for their remembered **active level**, with the four modes one tap away. No decks, note types, or configuration. First-time users complete a one-time level choice first (§8.5). Frictionless entry is a core differentiator from Anki.

**Planned scope change (decided 2026-07-26, not yet built).** Two goals are being added, and together they widen the product from a single-deck vocabulary trainer into a JLPT practice app with a second upstream:

- **Host a JLPT mock exam**, absorbed from the sibling Kalima project: a timed, multi-type sitting drawn from a stored question pool rather than generated per request from the word table. This is a different object from the existing Exam mode (§8.6), and whether the two coexist or one retires is open (§15).
- **Be the reference consumer of the bayan/zaka question dataset**, importing pinned, CC BY 4.0 licensed releases and grading them into FSRS state (§4.2).

The second is the larger commitment: until now every byte of content was either committed to this repo or generated by this project, and the level of a word was decided by a file we control (§4). A published external dataset is a dependency with its own release cadence, schema, and licence obligations. Accepted because grading an imported question into a real scheduler is a capability no other consumer of that dataset has, and because the import is a pinned artifact rather than a live service call. Milestone and open forks: §13, §15.

**Non-goals (initial release)**
- Native mobile apps (mobile-first responsive web only; see §8.4).
- User-authored decks or editing of source vocabulary.
- Social/sharing features, leaderboards.
- Real-time collaboration or multi-device live sync beyond standard server state.

## 3. Terminology

- **Word**: a vocabulary entry from the source deck (`expression`, `reading`, `meaning`).
- **Example sentence**: an AI-generated sentence using a word, with reading + translation.
- **Review state**: per-user, per-word FSRS scheduling data.
- **Cache hit/miss**: whether a word already has stored example sentences.
- **Seeding**: the one-time bulk generation of example sentences via the Batch API.
- **Question store** *(planned, §4.2)*: the stored pool of pre-authored exam questions, as distinct from the questions Quiz and Exam mode build on the fly from `Word` rows.
- **Exported question** *(planned)*: one row of that pool in the shape bayan publishes, carrying its own `question_type`, `source`, and provenance.
- **Reference consumer** *(planned)*: the named downstream application that a dataset publisher points to as the worked example of using its releases. Bayana takes this role for bayan/zaka (§2, §4.2).

---

## 4. Source data

**All three classes of source data below are scheduled to be replaced by bayan (decided 2026-07-27; §4.3).** Vocabulary, grammar points, and example sentences are all to come from that dataset once it produces them, which retires the Anki deck, the locally supplied grammar file, and this project's own sentence-generation pipeline (§7). The sections below describe the sources in use today and remain authoritative until the replacement lands; §4.3 states what changes, what it is blocked on, and why the migration does not wait for it.

The deck originates from [**open-anki-jlpt-decks**](https://github.com/jamsinclair/open-anki-jlpt-decks), **MIT-licensed** and freely usable with attribution. Our copy is committed at `decks/*.csv`: Anki export format, one file per JLPT level.

| File | Rows (≈) | Level |
|------|----------|-------|
| `n5.csv` | 717 | N5 (easiest) |
| `n4.csv` | 667 | N4 |
| `n3.csv` | 2,140 | N3 |
| `n2.csv` | 1,906 | N2 |
| `n1.csv` | 2,698 | N1 (hardest) |
| **Total** | **8,128 rows → 8,101 words** | after `guid` de-duplication on import |

**Columns:** `expression` (kanji/word), `reading` (kana), `meaning` (English), `tags` (space-separated, e.g. `JLPT JLPT_N5 Genki`), `guid` (stable Anki identifier).
- `guid` is the natural **unique key** and guarantees idempotent re-imports.
- `tags` encode legacy/overlapping levels (an N5 word may also be tagged `JLPT_3`). The **source file** is authoritative for level; surplus tags are stored as metadata.

The original Anki card templates (EN→JP and JP→EN directions plus `styles.css`) served as a visual reference for the card UI during Phase 1a. They are **not committed**: the card UI has since diverged from them and [BRAND.md](BRAND.md) is the visual reference now.

**Import considerations**
- Some `meaning` fields are quoted CSV containing commas (`"to meet, to see"`); use a spec-compliant CSV parser.
- Some entries use placeholder markers (`〜` / `～`) and parenthetical notes (e.g. `(かさを～) さす`); preserve raw text but flag these for the generation prompt.
- The `MediaMissing` tag is irrelevant to this product and may be discarded.

### 4.1 Grammar source data

Grammar points (§13 Phase 3.5) come from a source not licensed for redistribution, unlike the MIT-licensed vocabulary above. **This is the defect §4.3 exists to fix**, and bayan's CC BY 4.0 grammar index is ready to fix it today; §14.27 records why it is nonetheless taken together with the vocabulary rather than early and alone. `decks/grammar-*.md` is therefore **gitignored, not committed**: the repo ships the schema and seed script, but not the content itself. Anyone reproducing this project needs to supply their own grammar deck in the same markdown shape (`## Lesson N – Title` / `### pattern reading` heading tag / meanings / `**例文:**` sentence / translation; see the header comment in `scripts/seed-grammar.ts`).

| File | Points | Lessons | Level |
|------|--------|---------|-------|
| `grammar-n3.md` | 220 | 22 | N3 |

### 4.2 Imported question data (planned, decided 2026-07-26)

The mock exam and the dataset-consumer role (§2, §13) introduce a **third class of source data**: pre-authored exam questions, stored rather than generated from `Word` rows at request time. Two sources feed one table, because they are the same kind of row:

| Source | Content | Licence |
|--------|---------|---------|
| Kalima seed | 496 N3 vocabulary questions across five types, plus an audited passage set (20 short / 10 medium / 5 long / 10 info) | Author's own, moved between the author's projects |
| bayan/zaka releases | Published `ExportedQuestion` rows, pinned to a dated release tag | **CC BY 4.0** |

### 4.3 Consolidation onto bayan (decided 2026-07-27, blocked upstream)

**Bayan becomes the single source of every content class**: vocabulary, grammar, example sentences, and questions. This subsumes §4, §4.1 and §4.2 into one supplier and one licence, and it retires §7's generation pipeline, which exists only because no redistributable sentence source was available when this project started.

Three arguments carry the decision. It **resolves the §4.1 licensing defect** outright: the grammar deck is gitignored because it cannot be redistributed, which makes this repository non-reproducible by anyone else, whereas bayan's grammar index is CC BY 4.0 and committed. It **collapses three provenance stories into one**, which the privacy and credits surfaces (§11.6, TODO.md) otherwise have to explain separately. And it makes Bayana the reference consumer of bayan in a substantive rather than decorative sense, since the app would then be built entirely on the dataset rather than merely importing questions into a corner of it.

**What bayan supplies today, verified against the repository on 2026-07-27:**

| Class | Bayan status | Usable now |
|-------|--------------|------------|
| Grammar points | `GrammarEntrySchema`: `pattern`, `level`, `meaning`, `category`, `example`, `example_highlight` | **Yes.** Maps onto `GrammarPoint` directly, and `example_highlight` supplies the pattern spans this app currently derives by hand. |
| Vocabulary lists | Generator exists (`tools/generate-words.ts`); lists are being regenerated | No |
| Vocabulary example sentences | **No schema field.** `VocabEntrySchema` carries `id`, `word`, `reading`, `meaning`, `level`, `freq_score`, `context`, `pos` | No; requires a schema addition on bayan's side |
| Questions | `dataset/export.json` is `{"count": 0, "questions": []}` at tag `beta-2026-06-26` | No |

**Coverage:** bayan targets **N5–N3**, with N2 and N1 deferred to a later phase there. Bayana currently covers N5–N1 with ~8,101 words, so the consolidation narrows the app's range until bayan extends its own. This is accepted rather than mitigated; the author's condition is that bayan produce N5–N3 words *and* their example sentences before Bayana consumes any of it.

**This is a blocking upstream dependency, and the migration waits for it** (decided 2026-07-27; the opposite was decided earlier the same day and reversed, §14.27). Bayan reaches production first: N5–N3 vocabulary with example sentences, the grammar index, and a non-empty dataset release. The Nuxt migration then begins, and its first seed is bayan data, so the new application is never populated from a corpus already scheduled for deletion.

Two consequences follow. **`decks/*.csv`, `scripts/import-csv.ts` and the whole of §7 are retired at the cutover**, as originally expected, rather than surviving it. And **Bayana's schedule is now a function of bayan's**, which is accepted on the grounds that the author's exam is complete, so no study depends on this app continuing to work (the same premise that made the production database disposable, §6). The `source` discriminator in §6 survives the change of ordering regardless: the question store still mixes bayan releases with Kalima-seeded rows (§4.2), and provenance remains worth recording per row even when one supplier dominates.

Three properties of this data drive the design:

- **Licence obligation, not a courtesy.** CC BY 4.0 requires attribution, so imported questions need a visible attribution surface in the UI before the first release is imported. This is the first content in the project carrying an obligation that survives into the running app; the vocabulary's MIT terms are satisfied by the README credit (§11.6), and the grammar deck is simply never redistributed (§4.1).
- **No shared identifier with our corpus.** Bayan cannot carry an Anki `guid`, because its own licensing position rests on no third-party deck appearing anywhere in its chain. The vocabulary crosswalk is therefore **expression plus reading**, computed and owned on this side, and it is lossy by nature: homographs and orthographic variants will need a documented tie-break. Contrast §4's import path, where `guid` makes the join exact and re-imports idempotent.
- **Paid, audited content.** The passage set is generated AI output that was reviewed once. Like `ExampleSentence` (§7.5, §12), it is transferred rather than regenerated, and it joins the backup target when it lands.

**Shape.** The table follows bayan's `ExportedQuestion` rather than Kalima's `ExamQuestion` (§14.9), keeping the `source` field that distinguishes seed rows from dataset releases and leaving room for `stimuli` and `provenance` so that reading and listening questions need no second migration. The concrete Prisma model is deliberately **not** written into §6 until the fork in §15 about Exam-mode overlap is resolved, since that answer changes what the table has to serve.

---

## 5. System architecture

The system is a **single full-stack Next.js 16 (App Router) application**. The browser UI, the JSON API (Route Handlers / Server Actions), the FSRS scheduling logic, and the Anthropic integration all live in one deployable, backed by a managed Postgres instance.

**A migration to Nuxt was decided on 2026-07-26 and is not started** (§5.2, milestone in §13, alternatives in §14.26). Everything in this section and in §5.1 describes the system as deployed today and remains authoritative until the cutover; what changes at that point is the framework and the data model (§6), not the topology.

```
┌─────────────────────────── Railway ────────────────────────────┐
│                                                                  │
│  Next.js (App Router) — single service                          │
│   ├─ /app                React UI (Flashcard, Quiz, Exam, Grammar) │
│   ├─ /app/api/review     POST rating → FSRS → next due date      │
│   ├─ /app/api/cards      study queue, browse, search             │
│   ├─ /app/api/quiz       multiple-choice question + distractors  │
│   ├─ /app/api/exam       JLPT-style kanji reading/writing round  │
│   ├─ /app/api/grammar/*  grammar queue + FSRS review             │
│   ├─ /app/api/demo/*     ephemeral demo session (prod-available) │
│   ├─ /app/api/auth/*     Auth.js (Email provider via Resend)     │
│   └─ /app/api/dev/*      dev-only session bypass (404 in prod)   │
│        │                                                         │
│        ├── Prisma ───────────────►  Postgres (Railway plugin)    │
│        ├── @anthropic-ai/sdk ────►  Claude Haiku (Messages/Batch)│
│        └── Resend SDK ───────────►  Email (magic links)          │
│                                                                  │
│  scripts/ (run via `railway run` or locally)                    │
│   ├─ import-csv.ts       seed Word rows from decks/*.csv          │
│   ├─ seed-sentences.ts   build & submit Batch jobs (N3 first)    │
│   ├─ collect-batch.ts    poll + write results into ExampleSentence│
│   ├─ seed-grammar.ts     seed GrammarPoint rows from decks/grammar-*.md │
│   └─ batch-status.ts / cost.ts / export-words.ts / split-words.ts (utilities)│
└──────────────────────────────────────────────────────────────────┘
```

### 5.1 Why a single full-stack service is sufficient (vs. a separate API)

A split backend (e.g. a Rails or standalone Node API behind a separate frontend) is a common default, but it is **unjustified for this product's actual requirements**. The decision to use one Next.js service is deliberate:

- **No cross-client API contract to honor.** The only consumer of our backend is our own web frontend. A standalone API earns its keep when multiple independent clients (mobile apps, third parties, other services) must share it. We have exactly one client, so a public, versioned API surface is overhead with no payoff. Next.js Route Handlers and Server Actions give us typed, server-only endpoints colocated with the UI that consumes them.

- **No heavy background-processing tier is needed.** The one long-running workload (bulk sentence generation) is delegated to **Anthropic's Batch API**, which executes asynchronously on Anthropic's side. Our system only submits jobs and polls for results, work that a lightweight scheduled route or a one-off script handles cleanly. This is the usual reason teams reach for a separate API + worker tier (Sidekiq, Celery, etc.); here that reason does not apply.

- **Every feature is a database query or a single LLM call.** FSRS scheduling is pure in-process computation (`ts-fsrs`). Multiple-choice distractors are a same-level `SELECT` over existing words: no AI, no extra service. On-demand sentence fallback is one synchronous Haiku request. None of this benefits from a network hop to a separate backend; a split would only add latency and a second failure domain.

- **One language, one toolchain, one deploy.** TypeScript end-to-end means shared types between server and client, a single dependency graph, one CI/CD pipeline, and one Railway service to operate, observe, and scale. A separate API would roughly double the operational surface (extra service, extra build, extra inter-service auth) for no capability we require.

- **Scaling is horizontal and stateless.** App state lives in Postgres; the Next.js service is stateless and scales out by adding replicas behind Railway's load balancer. We do not have a workload profile (e.g. CPU-bound media processing) that warrants isolating the backend onto its own scaling unit.

**When we would revisit this:** if we later add independent clients that must share the backend, introduce continuous/streaming generation pipelines that need a dedicated worker fleet, or require a CPU/memory profile incompatible with the web tier. None are on the roadmap. The data model (§6) and generation design (§7) are framework-agnostic, so extracting a service later is an option, not a prerequisite. See §14 for the full alternatives analysis.

**None of the five arguments above is a Next.js argument.** Each turns on the product's requirements (one client, no worker tier, per-request work that is a query or a single LLM call, one language, stateless scaling), so the single-full-stack-service conclusion is inherited unchanged by the Nuxt implementation in §5.2, which is a Nitro server and a Vue client in one deployable. The migration replaces the framework, not the architecture.

### 5.2 Planned migration to Nuxt (decided 2026-07-26, not started)

Bayana moves off Next.js 16 onto Nuxt. The implementation is a **greenfield Nuxt application built in the same repository**, which takes over the production URL when it is ready, rather than an in-place translation of the existing tree. Rejected alternatives, including remaining on Next.js, are in §14.26; the sequenced work is in TODO.md and the milestone in §13.

**The deciding constraint is that React to Vue admits no incremental path.** Next.js and Nuxt cannot run in one process, and the existing build stops working the moment Nuxt's configuration lands, so a nominally in-place migration performs the same rewrite while leaving the main branch unbuildable for its duration. A greenfield application keeps production serving throughout, reduces rollback to a domain repoint, and lets Nuxt's conventions determine the structure instead of the existing files translating themselves page for page. The same repository is retained because the git history, this document, DECISIONS.md, `decks/`, and `scripts/` are all worth keeping and none of them are framework-specific.

**Scope, measured against the codebase as of 2026-07-26:**

- **Rewritten:** approximately 7,700 lines of `.tsx`, concentrated in five session and browse components totalling 2,281 lines, with 152 React hook call sites to re-express as Vue reactivity.
- **Re-decided rather than ported:** the Next-shaped layer. App Router files, Server Actions (Nuxt has no equivalent; writes become Nitro event handlers), the `proxy.ts` route guard (Nitro server middleware), `next/font`, and Auth.js's Next adapter, whose replacement is an open question (§15). Every hardening requirement in §11 is framework-independent and must be re-established rather than assumed; §11 is the port's acceptance checklist.
- **Carried across near-verbatim:** `scripts/` and `src/lib` (~3,300 lines), of which only `src/lib/current-user.ts` imports anything from Next. This figure is conditional on the data model, which is deliberately in scope (§6).
- **Not affected:** the deck CSVs, the generation design (§7), BRAND.md and the design tokens.

**Kalima is already a Nuxt/Nitro application**, which is why the migration is sequenced before the mock-exam absorption (§13): performed in this order, most of that port becomes a move rather than a rewrite.

---

## 6. Data model

The schema is **single-user at launch but multi-user-ready**: one seeded `User` row owns all review state today. Introducing real authentication later means populating additional users and scoping queries by `userId`: no change to the core shape.

**This model is scheduled for redesign in the Nuxt migration (decided 2026-07-26; §5.2, §14.26).** The section below remains authoritative for the deployed system and is the input to that redesign, not its output. The migration is explicitly not obliged to inherit the schema, on the reasoning that this is the least expensive moment such a change will ever be available: nothing is live on the new application, the old one continues serving, and the imported-question store (§4.2) requires new tables regardless, so deferring the change converts a design decision into a migration against production. Three structural findings are the inputs:

- **`Word.guid` cannot remain the identity of a word.** It is `@unique` and required, holding the stable Anki identifier that makes CSV imports idempotent. Bayan-produced words have no such identifier and cannot acquire one: bayan's licensing position rests on its word lists having no third-party deck in their lineage (§4.2). Word identity therefore needs a natural key both sources can satisfy (expression plus reading) together with a `source` discriminator, retaining a nullable `guid` for deck idempotency alone. This has a consequence beyond the schema, recorded in §12: the sentence-cache transfer and the long-term backup format are both keyed by `Word.guid` today, so both need a successor before the first bayan-sourced word is inserted.
- **The FSRS field block is duplicated four times.** `ReviewState`, `ReviewLog`, `GrammarProgress` and `GrammarReviewLog` each carry the same ten fields, because vocabulary and grammar were built as parallel hierarchies. Adding stored exam questions as a third studiable kind would produce a third pair and a sixth copy. The target is a single studiable-item abstraction with one state table and one log table keyed by item kind and item id. `src/lib/fsrs.ts` is already entity-agnostic behind its `CardLike` interface and needs no change to serve it, and the duplication between `undoLastGrammarReview` and `undoLastReview` (accepted knowingly, §14.24) is retired by the same change rather than fixed separately.
- **`level` has two representations.** `Word.level` is the `Level` enum; `GrammarPoint.level` is a plain `String`, chosen deliberately so grammar decks for new levels need no migration. Imported questions would introduce a third opinion. One representation should win, with the reasoning recorded.

**The redesign is unconstrained, revised 2026-07-27.** It was originally bounded by two datasets that had to survive the cutover intact. One of those bounds has been lifted by the author: the production database may be reset. The app has exactly one user, whose JLPT sitting is now behind them, so the accumulated FSRS history in `ReviewState`, `ReviewLog`, `GrammarProgress` and `GrammarReviewLog` has served its purpose and is discarded rather than migrated. `Word` and `GrammarPoint` reseed from committed or locally supplied sources; demo users, sessions and verification tokens were always disposable; the auth tables' shape is dictated by whichever authentication library the migration selects (§15).

That leaves **`ExampleSentence`** as the only data with a claim on the new schema, and even that claim is weak, because §12 already designates the *local* Postgres as its authoritative copy: the Batch results land there first and are transferred to prod, and it is the thing that gets backed up. So the sentence cache is not carried across from production at all. It is reseeded into the new database from the local source, exactly as it was originally seeded, and the only requirement the new model inherits is that its word identity can be joined against that export (§12).

**The cutover is therefore a reseed and a domain repoint, not a data migration.** The single remaining recommendation is an optional one, recorded because it is cheap and its cost is asymmetric: take one archival `pg_dump` of prod before the reset. `ReviewLog` exists partly to feed FSRS re-optimization into the empty `UserProfile.fsrsParams` weights, and that is the one use for the discarded history that has not yet been served. Nothing waits on it.

**One column pair is already correct and unused.** `UserProfile.timezone` (IANA identifier, default `"UTC"`) and `UserProfile.dayStartHour` (default 4, an Anki-style rollover) have existed since the schema was written and are read by no code; `src/lib/home.ts` computes day boundaries from server-local midnight while asserting in a comment that no such preference exists. The design decision was made here and never wired up. Both columns carry into the new model.

**Identity vs. profile.** `User` is the **authentication identity**: once Auth.js is added (§11), its Prisma adapter owns this model (alongside `Account` / `Session` / `VerificationToken`) and expects a specific shape. App-specific data (display name, study preferences, role) therefore lives in a separate **one-to-one `UserProfile`**, keeping library-managed auth concerns decoupled from our own. `UserProfile` is also where the study **direction preference** (§8.1) and the **admin role** (gating the admin audit page, §13) live.

```prisma
model User {
  id            String            @id @default(cuid())
  email         String?           @unique        // null only for the seeded pre-auth user
  emailVerified DateTime?                        // set by Auth.js when a magic link is confirmed
  image         String?
  createdAt     DateTime          @default(now())
  profile       UserProfile?                     // 1:1 — app-specific data (see below)
  reviews       ReviewState[]
  grammarProgress GrammarProgress[]
  accounts      Account[]                        // Auth.js — unused with email-only provider
  sessions      Session[]                        // Auth.js database sessions (§11.3)
}

// App-specific per-user data, one-to-one with User. Kept separate from the
// auth-managed User so library concerns and product concerns don't mix.
model UserProfile {
  id          String   @id @default(cuid())
  userId      String   @unique           // one row per user → enforces 1:1
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  displayName String?
  role        Role     @default(MEMBER)  // ADMIN gates the admin sentence-audit page (§13)
  // study preferences
  activeLevel    Level?                   // JLPT level both modes operate on; set at onboarding (§8.5), changeable
  onboardedAt    DateTime?                // set when first-run (level → warm-up → guide) completes; gates onboarding
  studyReverse   Boolean @default(false) // also review EN→JP (recall); default is JP→EN only (§8.1)
  newCardsPerDay Int     @default(10)     // NEW-card pace per queue build, not a hard daily cap (§16)
  timezone       String  @default("UTC")  // IANA tz; defines the "day" for limits/streaks/stats
  dayStartHour   Int     @default(4)       // local hour a new day begins (Anki-style 4am rollover)
  // FSRS tuning — defaults now; personalized from ReviewLog later (§8.1)
  fsrsParams       Float[]                 // FSRS weights w[]; empty ⇒ ts-fsrs library defaults
  desiredRetention Float   @default(0.9)   // FSRS target recall probability
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum Role { MEMBER ADMIN }

// Auth.js adapter models — owned by @auth/prisma-adapter; do not modify field names.
// `Account` is populated only by OAuth providers (none yet but adapter requires it).
// `Session` stores server-side database sessions (§11.3). `VerificationToken` holds
// the hashed magic-link token (single-use, short TTL — §11.3 hardening requirements).
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime
  @@id([identifier, token])
}

model Word {
  id         String   @id @default(cuid())
  guid       String   @unique           // from CSV — idempotent imports
  expression String                     // kanji/word
  reading    String                     // kana
  meaning    String                     // English
  level      Level                      // N5..N1 (authoritative = source file)
  tags       String[]                   // remaining raw tags
  sentences  ExampleSentence[]
  reviews    ReviewState[]
  @@index([level])
}

enum Level { N5 N4 N3 N2 N1 }

model ExampleSentence {
  id          String   @id @default(cuid())
  wordId      String
  word        Word     @relation(fields: [wordId], references: [id], onDelete: Cascade)
  japanese    String                    // sentence using the word
  reading     String                    // furigana/kana reading of sentence
  english     String                    // translation
  model       String                    // e.g. "claude-haiku-4-5"
  source      GenSource                 // BATCH | ONDEMAND
  createdAt   DateTime @default(now())
  @@index([wordId])
}

enum GenSource { BATCH ONDEMAND }

// FSRS per-(user,word) scheduling state — fields mirror the ts-fsrs `Card` struct
// (camelCase here; a thin app adapter maps to/from ts-fsrs's snake_case).
model ReviewState {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  wordId        String
  word          Word      @relation(fields: [wordId], references: [id], onDelete: Cascade)
  // FSRS fields (ts-fsrs Card)
  stability     Float?
  difficulty    Float?
  due           DateTime  @default(now())
  lastReview    DateTime?
  elapsedDays   Int       @default(0)   // days since previous review at last rating
  scheduledDays Int       @default(0)   // interval assigned at last rating
  learningSteps Int       @default(0)   // index into (re)learning steps
  reps          Int       @default(0)
  lapses        Int       @default(0)
  state         FsrsState @default(NEW)
  @@unique([userId, wordId])
  @@index([userId, due])
}

// Review history: one row per rating event. Powers statistics, one-step undo
// (restore the card's prior scheduling state), and future FSRS re-optimization.
// Rows are never *updated*, and undo deletes the row it reverses; kept decoupled
// from User/Word (indexed scalar ids, no FK relation) so it stays history that
// outlives row lifecycle.
model ReviewLog {
  id            String    @id @default(cuid())
  userId        String
  wordId        String
  // Fields mirror the ts-fsrs ReviewLog so we can rollback() for one-step undo.
  rating        Int                       // 1=Again, 2=Hard, 3=Good, 4=Easy
  state         FsrsState                 // card state at review time
  due           DateTime                  // due date this review assigned
  stability     Float?
  difficulty    Float?
  elapsedDays   Int       @default(0)
  scheduledDays Int       @default(0)
  learningSteps Int       @default(0)      // (re)learning step index at review time
  reviewedAt    DateTime  @default(now())
  @@index([userId, reviewedAt])
  @@index([userId, wordId])
}

enum FsrsState { NEW LEARNING REVIEW RELEARNING }

// Grammar points — separate from vocabulary, with their own FSRS queue.
//
// `GrammarPoint` holds static content parsed from decks/grammar-*.md.
// `level` is a plain String (not the Level enum) so the same table accepts
// N5–N1 grammar decks as they are added later, without a schema migration.

model GrammarPoint {
  id          String @id @default(cuid())
  level       String // "N3", "N2", etc. — plain string so new levels need no migration
  lesson      Int    // lesson number within the level
  lessonTitle String // e.g. "During, While, and Sequence" — denormalized from the
                      // source file's lesson heading (like `level`, repeated per row
                      // so the browse view can group without a second lookup)
  position  Int      // 1-indexed position within the lesson
  pattern   String   // display form, e.g. "ばいい"
  reading   String   // kana reading (may equal pattern; stored separately to allow differ)
  meanings  String[] // English meanings, e.g. ["Can", "Should", "It'd be good if"]
  exampleJp String   // example sentence in Japanese
  exampleEn String   // English translation of the example
  progress  GrammarProgress[]
  @@unique([level, lesson, position]) // natural idempotency key for upserts
  @@index([level])
}

// FSRS scheduling state for one (user, grammar point) pair.
// Field names and types mirror ReviewState exactly so the CardLike interface
// (src/lib/fsrs.ts) lets the same FSRS adapter functions serve both queues.
model GrammarProgress {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  grammarPointId String
  grammarPoint   GrammarPoint @relation(fields: [grammarPointId], references: [id], onDelete: Cascade)
  // FSRS fields — same shape as ReviewState
  stability     Float?
  difficulty    Float?
  due           DateTime  @default(now())
  lastReview    DateTime?
  elapsedDays   Int       @default(0)
  scheduledDays Int       @default(0)
  learningSteps Int       @default(0)
  reps          Int       @default(0)
  lapses        Int       @default(0)
  state         FsrsState @default(NEW)
  @@unique([userId, grammarPointId])
  @@index([userId, due])
}

// Review history for grammar ratings, mirroring ReviewLog on the grammar tables.
// Added 2026-07-26 to make grammar undo possible: GrammarProgress holds only the
// latest state, so reversing a rating needs the review being reversed, which
// ts-fsrs rollback(card, log) consumes (§8.4, §14.24).
model GrammarReviewLog {
  id             String    @id @default(cuid())
  userId         String
  grammarPointId String
  // Same fields as ReviewLog, so fromLog/toLog serve both queues unchanged.
  rating         Int                       // 1=Again, 2=Hard, 3=Good, 4=Easy
  state          FsrsState                 // card state at review time
  due            DateTime                  // due date this review assigned
  stability      Float?
  difficulty     Float?
  elapsedDays    Int       @default(0)
  scheduledDays  Int       @default(0)
  learningSteps  Int       @default(0)      // (re)learning step index at review time
  reviewedAt     DateTime  @default(now())
  @@index([userId, reviewedAt])
  @@index([userId, grammarPointId])         // drives the undo lookup
}
```

`ExampleSentence` is the **cache**: once a word has rows here, no API call is made. Permitting multiple rows per word allows several examples per card and UI rotation.

**The two review logs are described as history rather than as an append-only ledger, which is a correction rather than a change of design.** Both `ReviewLog` and `GrammarReviewLog` have a one-step undo that *deletes* the row it reverses, so neither is literally append-only, and `ReviewLog`'s comment claimed otherwise from the beginning while `undoLastReview` deleted from it. Any future consumer must therefore read either table as "ratings that were not undone", not as every rating event that ever occurred. Nothing depends on the distinction today: statistics are derived from `ReviewState`/`GrammarProgress`, and an undone rating is one the user explicitly retracted, so excluding it is the behaviour a stats or FSRS-reoptimization consumer would want anyway. The alternative, a `revertedAt` tombstone column that preserves the row, is recorded in §14.24 and remains available if a consumer ever needs the full event stream.

---

## 7. AI sentence generation

**This entire section is scheduled for retirement (decided 2026-07-27; §4.3).** It exists because no redistributable source of JLPT example sentences was available when the project started; bayan is to become one, at which point Bayana stops generating sentences and starts consuming them. Until that lands the pipeline remains in use and is the seed source for the post-migration database (§14.27), so nothing here is dead code. Two consequences worth stating in advance: the §11.4 guarantee that no web-reachable route spends Anthropic tokens becomes trivially true rather than carefully maintained, and the §12 characterisation of `ExampleSentence` as the only paid, hard-to-regenerate artifact stops holding, since the sentences become redistributable data owned upstream.

**Strategy: pre-generate with the Batch API (N3 first), then the remaining levels.** On-demand generation exists only as a fallback for the rare cache miss.

### 7.1 Why the Batch API
- **≈ 50% cheaper** than synchronous calls, ideal for a one-time ~8.8k-word fill.
- Asynchronous: thousands of requests submitted, polled, and collected within ~24h.
- Seeding has no latency requirement, so the asynchronous trade-off is pure savings.

### 7.2 Prompt design (per word)
- **System prompt** (shared, identical across requests) is marked for **prompt caching** so repeated batch requests reuse it. It defines the task, the JSON output schema, per-level difficulty tuning, and rules for placeholder words (`〜`, `(...)`).
- **User message** carries the word's `expression`, `reading`, `meaning`, and `level`.
- **Output (structured JSON):**
  ```json
  {
    "japanese": "私は毎朝公園で友達に会う。",
    "reading":  "わたしはまいあさこうえんでともだちにあう。",
    "english":  "I meet my friend at the park every morning."
  }
  ```
- Sentence complexity is tuned to level: N5/N4 short and basic, N1 natural and idiomatic, with vocabulary/grammar restricted to at-or-below the target level where feasible.
- **One sentence per word** at launch: simplest and lowest cost. The schema already permits multiple `ExampleSentence` rows per word (§6), so generating more later needs no core change. A future **admin review/audit** workflow (§13 Phase 4) will let an admin accept or reject each generated sentence before it surfaces to learners.

### 7.3 Seeding order
1. **N3 batch first** (priority): ~2,140 words.
2. Then N5, N4, N2, N1.
3. `scripts/seed-sentences.ts` chunks words, builds Batch request files, and submits.
4. `scripts/collect-batch.ts` polls status and, on completion, parses results and upserts `ExampleSentence` rows (`source = BATCH`), keyed by word `guid`/`id`. Each model output is **schema-validated** (well-formed JSON with non-empty `japanese`/`reading`/`english`); malformed or empty results are skipped and logged for retry, never stored.
5. The pipeline is re-runnable: words that already have cached sentences are skipped.

### 7.4 On-demand fallback
`POST /api/generate`: when a card is opened and has zero `ExampleSentence` rows (e.g. a level not yet seeded), the server makes a single synchronous Haiku call, **validates the JSON output** (same schema check as seeding), stores the result (`source = ONDEMAND`), and returns it. First view incurs ~1s latency; subsequent views are cache hits. This endpoint is authenticated (§11) to prevent unauthorized cost.

### 7.5 Cost estimate (order of magnitude; verify against current Haiku pricing)
Assumptions: ~300 input tokens/word (including amortized cached system prompt) and ~450 output tokens/word (≈3 sentences). At ~8,800 words this is ~2.6M input + ~4.0M output tokens. At Haiku-class rates with the Batch 50% discount, total one-time cost lands in the **low-single-digit to ~$10** range; prompt caching reduces input cost further. Treat this as a budget ceiling, not a quote; confirm against current published Haiku pricing.

**Measured actual (2026-06-03).** The full one-time seed of all five levels (≈8,100 words, one sentence each) via the Batch API cost **≈ $2.55 cumulative** (Anthropic console): N3 first (~$0.62), then N5/N4/N2/N1 (~$1.7), plus a few cents of prompt-quality gating and straggler retries. Output tokens dominate (they can't be cached); the Batch discount and cached system prompt kept it well under the ceiling above. This confirms the core premise: the contextual-sentence benefit is achieved at a near-zero, one-time cost.

---

## 8. Study experience

Bayana offers four complementary study modes: **Flashcard mode** (serious spaced-repetition recall, §8.1), **Quiz mode** (fast, gamified JP→EN multiple choice, §8.2), **Exam mode** (JLPT-style reading/writing questions, §8.6), and **grammar study** (a separate FSRS queue over grammar points, §13 Phase 3.5). Flashcard mode is the retention engine; Quiz mode is the lightweight warm-up; Exam mode is the benchmark; grammar runs alongside all three on its own schedule. Browse/search (§8.3) is a reference tool rather than a mode.

**Level scope.** Every mode operates within a **single JLPT level at a time, the user's *active level***, chosen once at onboarding (§8.5) and changeable later (stored on `UserProfile.activeLevel`, §6). Queues, new-card selection, and multiple-choice distractors all stay within one level's vocabulary, so the modes are *separated by level*: you study one level at a time, not the whole deck at once. The one deliberate exception is the home hub's words-due count, which is level-agnostic for the reason given in §8.5.

**Entry points.** A **public marketing page** lives at `/` for logged-out visitors and the authenticated app opens on the home hub. Onboarding, the hub, and the routing between them are specified in **§8.5**; the look-and-feel follows **[BRAND.md](BRAND.md)**.

### 8.1 Flashcard mode: SRS review (FSRS)
The classic spaced-repetition flashcard loop, modeled on Anki.

- The daily queue selects `ReviewState` rows where `due <= now` for the current user **at their active level** (§8.5), ordered by due date, plus a configurable number of `NEW` cards/day **selected in randomized order** so similar-sounding words (adjacent in the source deck) aren't clustered together.
- The card UI mirrors the Anki templates: the front shows the expression (or the meaning, in reverse direction); flipping reveals reading, meaning, and a **cached example sentence**.
- The user rates **Again / Hard / Good / Easy**; the `rateCard` Server Action (§9.2) invokes `ts-fsrs` to compute the new `stability`, `difficulty`, `due`, and `state`, which are persisted inside a SERIALIZABLE transaction (§14.6).
- **The first queue is built during the page render, not fetched by the client (2026-07-26).** `src/app/study/page.tsx` resolves the guard and the active level in the page body, then awaits `buildSession` (`src/lib/study-cards.ts`) in a nested async component under `<Suspense>`, and hands the result to `StudySession` as a prop. The nesting is load-bearing rather than stylistic: `<Suspense>` streams only what sits *below* the boundary, so awaiting the queue in the page function would block the whole page and the fallback would never render. `buildSession` is the single definition of the session payload and is shared with `GET /api/cards/queue`, so the two entry points cannot disagree; it also drops the FSRS internals (`stability`, `difficulty`, `reps`, `lapses`, `elapsedDays`, `scheduledDays`, `state`, `lastReview`, `due`) that were previously shipped to a client that reads none of them. Because a failed build now throws during a server render instead of resolving into a `useEffect`, the route carries its own `error.tsx` (§8.4).
- **Rating advances the card immediately** and writes in the background inside a `useTransition`, rolling `index`, `reviewed` and `flipped` back together if the action rejects. `useOptimistic` is deliberately not used: it reconciles an optimistic value against server-derived state, and `index` is client-owned state that no server response replaces. The rating buttons no longer disable, which makes rapid-fire rating a supported interaction and makes the SERIALIZABLE transaction in `review.ts` the *only* guard against a lost update rather than the second one (§14.23). Undo keeps an in-flight guard and is not optimistic, because two quick undos target the same card where two quick ratings target different ones.
- **Continuous sessions:** when a batch is exhausted the screen **refetches** the queue from `GET /api/cards/queue`, so cards that have just become due (a card rated *Again*, or a learning-step card) cycle back without a manual reload. That read stays a route handler precisely because these paths are imperative refetches from an already-mounted component (§14.16). The "all caught up" state appears only when a fresh fetch returns nothing (with a *Check for more* action to refetch).
- Each rating is also appended to the immutable **`ReviewLog`** (§6), which powers statistics, future FSRS re-optimization, and **one-step undo**: restoring the card's prior scheduling state right after a misrating. Undo ships in the MVP.
- **Direction:** new users default to **JP→EN** (recognition); **EN→JP** (recall) is opt-in via user preferences. Example sentences are generated for the Japanese word only (§7) and are therefore direction-independent: the same cached sentence appears on the reveal side in either direction.

### 8.2 Quiz mode: multiple choice
A gamified, tap-to-answer quiz in the spirit of Duolingo: pick the right answer from four options, get instant feedback, keep momentum. Optimized for quick mobile sessions. Questions are drawn from the user's **active level** (§8.5), and the first-run warm-up is five such questions, run as a **non-scheduling** practice (it doesn't affect FSRS state).

- `GET /api/quiz` returns a target word plus one correct option and three distractors.
- Variants: show `expression` → choose `meaning`, or `meaning` → choose `expression`/`reading`.
- Instant correct/incorrect feedback with the cached example sentence shown on reveal.
- **The first round is built during the page render, not fetched by the client (2026-07-26).** `src/app/quiz/page.tsx` resolves the guard, `searchParams` and the active level in the page body, then awaits `buildQuizRound` in a nested async component under `<Suspense>` and hands the result to `QuizSession` as a prop, following the `/study` reference in §8.1 (including why the nesting is load-bearing). `GET /api/quiz` is retained and now serves only the imperative refetch behind "Play again" and the load-failure retry (§14.16). `buildQuizRound` (`src/lib/quiz.ts`) is the single definition of a round, shared by both callers, and owns the size default and its clamp so no caller can request an unbounded round; the component no longer sends a `count` at all, leaving exactly one definition of the round size. `QuizSession` also now imports `QuizQuestion` from the builder instead of re-declaring a hand-written local mirror of it. Because a failed build throws during a server render, the route carries its own `error.tsx` (§8.4).
- Whether Quiz mode results feed the FSRS scheduler (correct ≈ Good, wrong ≈ Again) or remain a separate, non-scheduling practice mode is **Phase 3** (§13; open question #1 in §15). The shared builder is where that lands: Phase 3 Part B's 50/50 split needs `userId`, and adding it to `buildQuizRound` reaches both callers at once.

#### UI & feel: Duolingo-grade, deliberately restrained
The mode should *feel* as polished and satisfying as Duolingo (that bar is the point) but with two deliberate departures that are part of the product thesis (§1):

- **Minimal animation.** Snappy, lightweight transitions (instant answer feedback, a brief correct/incorrect state), **not** heavy character animations, celebratory cutscenes, or motion that delays the next question. Momentum comes from speed and low friction, not spectacle. Respect `prefers-reduced-motion`.
- **Zero ads, ever.** No advertising, no interstitials, no upsell modals. This is a core anti-Duolingo differentiator, not a future monetization slot.
- Otherwise it inherits the mobile-first ergonomics of §8.4 (full-width thumb-reachable options, ≥44×44 px targets, iPhone SE baseline) and shows the cached example sentence on reveal for context.
Distractors are chosen to be *plausibly confusable* with the target rather than random, so that answering correctly requires actually knowing the word. Confusability is scored along three independent axes, all derivable from existing `Word` fields:

- **Orthographic**: shares one or more kanji with the target's `expression` (e.g. 見る / 見える).
- **Phonetic**: identical or near-identical `reading`; homophones such as 会う / 合う are the classic JLPT trap.
- **Semantic**: overlapping `meaning`.

**Implementation (MVP).** A single same-level query fetches the candidate pool (`WHERE level = $level AND id <> $targetId`; only ~700–2,700 rows), and candidates are **scored in application code** as a weighted sum of the three signals; the top-scoring candidates become the distractors, with a fallback to random same-level words when too few confusable candidates exist. Keeping the scoring in TypeScript (rather than SQL) keeps the weighting and guardrails readable and unit-testable, while SQL stays a plain pool fetch.

**Fairness guardrail.** A distractor must never be a legitimate answer. Candidates whose `meaning` is a near-duplicate or superset of the target's (true synonyms) are excluded, so the semantic axis selects *similar-but-distinct*, never equivalent. The orthographic and phonetic axes do not carry this risk.

**Difficulty mix.** Each question blends confusable and random distractors (e.g. two confusable + one random) so it is challenging but solvable; the exact ratio is tunable and is an open question (§15).

**Scale path (Phase 2+).** If per-request scoring ever needs to move into the database, the Postgres-native upgrades are: a kanji `text[]` column with a GIN overlap index (orthographic), `pg_trgm` trigram similarity (phonetic/lexical), and **pgvector** over a one-time pass of `meaning` embeddings (true semantic similarity). None are required at launch scale.

### 8.3 Browse / search
A whole-deck lookup tool scoped to the active level. The user can search by kanji, reading, or English meaning; tapping any word reveals its cached example sentence.

**Implementation.** `GET /api/browse?level=` returns the level's full word list (id, expression, reading, meaning; **no sentences**) with `Cache-Control: private, max-age=86400, stale-while-revalidate=604800`. The browser caches this response; repeat visits within the day cost zero server round-trips. The client (`BrowseClient`) filters in memory per keystroke: no server request per search. Results are **paginated at 50 per page** with previous/next controls and an editable page-number input (clamped to `totalPages` so shrinking results mid-session never leaves the user on a phantom page); this replaces an earlier render cap that had no way to reach later pages. Sentences are lazy-loaded per word via `GET /api/words/[id]/sentence` (cached 24 h) when a row is tapped, keeping the initial payload small. Rows expand/collapse in an accordion (one open at a time).

**The response carries no per-user data** (2026-07-26). It previously included a `started` flag per word and sorted started words first, which coupled ~2,700 immutable deck rows to a value that changes on every rating and so capped the lifetime above at one hour. The per-user half is now read during the `/browse` render (`getStartedWordIds`, `src/lib/browse.ts`) and passed to the client as a prop, where a stable partition lifts started words to the front of the already-sorted list; the ordering is unchanged and the fetched payload is identical for every user. The display sort stays on the server, because `localeCompare(…, "ja")` gives kana/kanji collation that a Postgres `ORDER BY` does not, and running it per cache miss rather than per mount keeps ~2,700 comparisons off the hydration path. Why this page keeps a client fetch at all when the four session screens do not: §9.3.

`/grammar/browse` is the same tool for grammar points and is built the other way, server-rendered in full: at ~220 rows the payload is small enough that the round trip costs more than the bytes. `src/lib/grammar-browse.ts` holds the one `buildGrammarBrowse` that the page render and `GET /api/grammar/browse` both call.

### 8.4 Responsive / mobile-first design
The product is **designed for the phone first** and progressively enhanced for larger screens; the bulk of study happens on mobile.

- **Baseline viewport:** iPhone SE (**375 × 667 CSS px**, the smallest mainstream target). All primary flows (study, flip, rate, quiz) must be fully usable and uncluttered at this size without horizontal scrolling or zoom. Larger phones, tablets, and desktop are treated as additive breakpoints, not the design center.
- **Layout:** a single-column, vertically-centered card layout (mirroring the source Anki templates) that scales up gracefully; on desktop the card is width-capped and centered rather than stretched edge-to-edge.
- **Touch ergonomics:** rating actions (Again/Hard/Good/Easy) and MC options are full-width, thumb-reachable controls with ≥ 44×44 px hit targets, placed in the lower portion of the viewport. Card flip is tap-anywhere; swipe gestures are an optional enhancement, never the only path. A control is allowed to be *painted* smaller than 44px where visual quiet matters (session-header pills, JLPT chips); its **hit target** is not, and `.tap-44` expands the target without changing the painted box (BRAND.md §7). `.tap-44` is **vertical-only** by design, so that two chips side by side can never steal each other's taps; `.tap-44-box` is the both-axis variant, reserved for a control that is narrow *and* has no horizontal neighbour (currently only the header avatar). Neither utility fixes a bare text run, which has no box to expand: those get real padding instead. The audit was declared closed on 2026-07-26 and had exactly one exception found the same day by the review that followed it: `InfoBubble`'s 16 × 16 "ⓘ" trigger, on both the hub and the landing hero. It now carries `.tap-44-box`, and is the second control to satisfy that utility's no-horizontal-neighbour constraint, which holds here because what sits either side of the trigger is prose, and prose has no hit area to lose.
- **Accessibility floors (2026-07-26):** all text clears WCAG AA (4.5 : 1), which makes `--ink-faint` the quietest value in the app rather than a decorative one; every control carries a visible keyboard focus indicator, and `outline` is reserved for that indicator so a selected state never removes it. Ratios, the token ramp, and the two ways this gets broken in practice (compositing with `opacity`, drawing selection with `outline`) are in BRAND.md §3 and §7; the alternatives weighed are in §14.11.
- **Keyboard and screen-reader floors (2026-07-26):** every disclosure has at least one keyboard exit that restores focus to its trigger; `UserMenu` is a disclosure, not an ARIA menu (§14.15). Every input carries an accessible name from `aria-label` rather than a placeholder, which is not exposed by all screen readers and vanishes once the field has content. Every expand/collapse control carries `aria-expanded`, since the ▲/▼ glyphs that convey state visually are `aria-hidden` by design, and it is **never emitted alone**: it is paired with `aria-controls` naming the panel it reveals. A tap-toggled panel is a **disclosure, not a `role="tooltip"`**, which in ARIA is a hover- or focus-triggered description reached through `aria-describedby` (§14.20). **State carried by colour is carried by a role or attribute as well**: the active `BottomNav` tab announced identically to the other two for as long as grape plus weight 700 was its only marker, and now takes `aria-current="page"`, emitted only when current; the tab bar itself carries an accessible name so a landmark list shows something other than a bare "navigation". **Live regions are part of the normal render**, never mounted at the moment they have something to say: a live node created when it first has content is frequently not announced at all (the precedent and its comment are in `quiz-session.tsx`). Four surfaces rest on that rule. Three are `role="status"`: the two browse result counts, the Quiz and Exam answer result, and the flashcard and grammar **reveal**, which is otherwise a silent DOM change, since the headword stays put and the answer is merely appended beneath it (reading and meaning are announced; the example sentence deliberately is not). One is `role="alert"`: every transient failure message, assertive rather than polite because it reports a rating or an undo that was *not* saved and must not queue behind the reveal (§14.20). An `aria-label` is only honoured where a role can carry it, so a labelled decorative `<span>` needs `role="img"`; and on a **control** it *replaces* the contents rather than adding to them, so information rendered inside a named button has to live in that name and cannot be attached to a child (§14.21). The two rules pull in opposite directions, and one file was breaking both at the same point: `grammar-browse-client.tsx` put an `aria-label` on a bare `<span>` that no screen reader would honour, *inside* a button whose own `aria-label` would have discarded it however it was marked up. A disclosure's name is therefore **the thing, not the verb**: "Lesson 3: Conditionals, 4 of 12 studied", with `aria-expanded` carrying open or closed, because a name that spells out "Collapse" duplicates the attribute and goes stale the moment the control is disabled. **A content surface is never itself a control**: the flashcard and grammar cards are plain `<div>`s carrying a transparent tap-to-flip overlay that unmounts on reveal, not `<button>`s wrapping their own content (§14.19). Wrapping them cost three separate things, of which only the first is cosmetic in appearance: Blink and WebKit apply `user-select: none` to button content, so the word and its example sentence could not be selected and pasted into a dictionary, which on a vocabulary app is a functional loss; a screen reader flattened the entire revealed card into one button name; and after the flip the wrapper was a focusable control with no action. The overlay is `aria-hidden` with `tabIndex={-1}`, making it pointer-only, because the footer's "Show answer" button already exposes the identical action to the keyboard and the accessibility tree.
- **Every route has one `<h1>` and one title (2026-07-27).** Two independent obligations, closed together because they were missing on the same set of screens. The **heading** rule is *one `<h1>` per rendered state*, not per file: `/home` and `/grammar` promoted their existing headline `<p>` (and their `TODAY` / `STUDY MODES` / `LEVEL` section labels, now `<h2>`), so the app's default page went from offering heading navigation nothing at all to offering it a real outline. The four session components each render several mutually exclusive states, so each state carries its own: the load-failure, empty and completion screens promote the display-type line they already had, which on the completion screen is **the same element that already carries `tabIndex={-1}`** — focus and heading coincide rather than compete, so a screen reader lands on the heading and reads it. The active card screen deliberately has no visible headline (the card is the content, and a title bar above it is chrome competing with recall), so it takes a **visually-hidden `<h1>` naming the mode and level** ("Flashcards · N3"), which also answers "which deck am I in?" for a user who cannot see the level chip. The **title** rule is that every route sets one through the `template: "%s · Bayana"` in `src/app/layout.tsx`; five routes never did (`/home`, `/grammar`, `/onboarding`, `/stats`, `/auth/signin`), and `/` remains the one deliberate exception, taking the `default`. Titles name the task rather than the route, so `/onboarding` is "Get started".
- **Two smaller conventions settled in the same pass (2026-07-27).** **Turning a page returns the viewport to the top of the list**, not to the top of the document: at the 375px baseline the "Next" control sits below 50 rows, so paging left the user on rows 45–50 of a page they had not read; scrolling the list's top edge into view (rather than `window.scrollTo(0, 0)`) avoids costing a swipe back past the heading and search field, and is instant rather than smooth, so no `prefers-reduced-motion` branch is needed. And **a live region announces a settled value, not an intermediate one**: `/browse`'s result count filters per keystroke, so typing a seven-letter query queued seven announcements over the user's own typing. The fix debounces the **announced** value on a 700 ms pause while the visible count keeps updating immediately — the visible line is no longer the live region itself; a sibling `sr-only` node is. The filtering is untouched, deliberately: delaying it would be fixing the wrong thing (§14.28).
- **Level is changeable from every level-scoped page (2026-07-27).** `/stats` had no control, so changing level meant a round trip through `/home` — the same friction that put the picker on the grammar hub. It mounts the **same `LevelPicker` component** both hubs use rather than a third variant, because the level is global state (§14.9) and one control means one place for the behaviour to be right; `setActiveLevel` already revalidates `/stats`, so switching re-renders the numbers in the same round trip. This also retired `browse-level-picker.tsx`, a compact chip-row variant that had no call site at all: `/browse` deliberately has no switcher, which made the component permanently dead.
- **Keyboard shortcuts in the four study modes (2026-07-26).** Every mode is fully drivable from the keyboard without Tab. The map is deliberately identical wherever the modes agree, so it transfers between queues in one sitting:

  | Key | Flashcard / Grammar | Quiz / Exam |
  |---|---|---|
  | `Space`, `Enter` | reveal the answer; **inert once revealed** | continue to the next question, once answered; dismiss the 問題１→問題２ section break |
  | `1`–`4` | rate Again / Hard / Good / Easy, once revealed | pick that option, before answering |
  | `U` | undo the last rating (Flashcard **and Grammar**, 2026-07-26) | not bound |

  **The map is now identical across the two flip-and-rate queues.** `U` was the one key they disagreed on, and grammar acquired it on 2026-07-26 along with the undo it drives (§14.24), because a shortcut's whole value is that it transfers and the parity above was already stated as deliberate.

  **`Space` never rates.** Anki binds it to *Good* on a revealed card, and that binding was rejected here (§14.18): rating is `1`–`4` only, so a reflexive `Space` cannot schedule a card the user had not finished reading. The mechanism is `src/hooks/use-keyboard-shortcuts.ts`, which owns the four guards a shortcut layer is a bug without (modifier chords pass through to the browser, `event.repeat` is dropped, text entry is never intercepted, and `Space`/`Enter` defer to the native activation of a focused control so nothing double-fires); each session component declares its own map, because a hook expressing both reveal-then-rate and pick-then-continue would only be the same conditional moved somewhere less legible. It listens on `document` rather than on the card, since the control a shortcut targets is routinely unmounted at the moment the key is pressed. Bindings are live only while the interactive screen is showing: loading, error, empty and summary screens are ordinary button layouts reached by Tab. Discoverability is a `.kbd-hint` keycap printed on the control each key drives, shown only under `(hover: hover) and (pointer: fine)`, a proxy for "a physical keyboard is attached" that leaves the 375px baseline unchanged where a width breakpoint would have put keycaps on a touch tablet. The keycap inherits `currentColor` at full opacity rather than a faded value, because it sits on four different button fills and BRAND.md §3 forbids that composite; it is `aria-hidden` everywhere, being a duplicate of a binding rather than information.
- **Focus is moved deliberately after every study-mode transition (2026-07-26).** Each mode advances by swapping controls out from under the focused element: rating a card sets `flipped = false` and unmounts the four rating buttons, and answering a question replaces the options with a Continue button. The browser's response to losing the focused element is to move focus to `<body>`, so a keyboard user re-Tabbed from the top of the document on every card and a screen-reader user was told nothing about where they now were. The mechanism is `src/hooks/use-focus-on-transition.ts`, which fires on a change to a small derived key and **skips the initial render**, because firing on mount would yank focus off the top of a freshly-loaded page, which is not a transition at all. Each component chooses its own target, for the same reason each declares its own key map. **The rule governing those targets:** focus a *button* only where the next step is a single unambiguous one ("Show answer", "Continue", "Start 問題２"); where the next step is a **choice** among several controls, focus a non-activatable anchor with `tabIndex={-1}` instead, never the first choice. `Space` and `Enter` natively activate a focused button, so focusing "Again" or option 1 would let a reflexive second `Space` bury a card unread or answer a question unseen, which is precisely the hazard §14.18 declined Anki's binding to avoid. Two consequences follow. The Quiz and Exam prompt is such an anchor, chosen over an empty sentinel so that landing there reads out the question being asked; and **the flashcard and grammar reveal moves focus nowhere at all**, by name rather than by omission, because its next step is a four-way choice *and* it fires the polite `role="status"` answer announcement above, which a focus change in the same commit can cut off mid-sentence. Nothing is lost by staying put there, since the rating keys work from anywhere. The rejected targets are in §14.24. Answered options are marked `aria-disabled`, not `disabled`, because a real `disabled` blurs the control the instant it is applied (the second cause of the same defect) and also drops the answered options out of the tab order mid-round, so a screen-reader user can no longer review what the choices were; the click guard already lived in the component. One gap is knowingly left: the post-refetch-failure retry screens do not move focus, being off the per-card path.
- **Typography:** Japanese text (expression/reading) is sized for legibility on small screens and must render correctly with appropriate CJK font fallbacks; respects dynamic type / user font-scaling.
- **Installable PWA (basics shipped 2026-06-04):** a Web App Manifest (`src/app/manifest.ts`, served at `/manifest.webmanifest`) plus PNG icons (192 / 512 / maskable, generated from `src/app/icon.svg` by `scripts/gen-pwa-icons.mjs`) make Bayana installable to the home screen. `display: "fullscreen"` runs the study/quiz session chrome-free and edge-to-edge on Android; iOS Safari ignores `fullscreen` and degrades to `standalone` (chrome-free but the status bar remains), an accepted limitation, as the author is on Android (§16). `viewport-fit=cover` plus `env(safe-area-inset-*)` (`.pt-safe`/`.pb-safe`, applied to the session `<main>`) keep controls clear of the notch and home indicator, and `dvh` sizing fills the screen without browser-chrome clipping. The **offline shell (service worker)** remains deferred (§13).
- **Implementation:** Tailwind CSS with a mobile-first breakpoint strategy (base styles target the SE; `sm:`/`md:`/`lg:` add desktop affordances).
- **Visual language**: the palette, typography (Fredoka / Nunito / M PLUS Rounded 1c), the mascot Pī, and components are specified in **[BRAND.md](BRAND.md)** (design tokens in its §8); the iPhone SE baseline above is the shared design target for both docs.
- **Route states (2026-07-26):** every route is covered by a boundary, so no navigation and no failure falls through to a Next.js default rendered against the cream surfaces. Four files at `src/app`: `error.tsx` (segment errors, a Client Component because React error boundaries are client-side, offering `reset()` for the transient cases), `global-error.tsx` (root-layout failures, which sit above `error.tsx` and so cannot be caught by it), `not-found.tsx` (prerendered static, since a 404 must not cost a database round-trip), and `loading.tsx`. The loading design is two-tier: the root file is a generic fallback whose job is only that no route is ever uncovered, and `/home`, `/browse` and `/stats` each ship a layout-shaped skeleton beside their page, which Next.js prefers because the nearest boundary wins (§14.13). **Error coverage became two-tier for the same reason on 2026-07-26**, when `/study` gained `src/app/study/error.tsx`: once a route fetches its own data during the render, a failure throws instead of resolving into a `useEffect`, and the root boundary is written for the whole app, so it offers "Back to start" and cannot speak about the session the user was in. **All four modes now have one** (`/study`, `/quiz`, `/exam`, `/grammar/study`), each a thin file over the shared `src/components/session-error.tsx`, which carries the reasoning once. A boundary is per-segment and cannot be shared by importing it elsewhere, so the four files are structurally required; what they hold is copy. **The headline and reassurance stay per-route rather than defaulting**, which is the one place a prop was worth spending: each mode can then promise something different and *true*. A flashcard queue build only reads, so progress is provably safe; Exam may promise it schedules nothing, FSRS coupling being a permanent non-goal there (§8.6); and Quiz deliberately says only that the round had not started, because a sentence about what Quiz writes goes stale in Phase 3. `/grammar/study`'s boundary sits at that segment rather than at `app/grammar/`, which would also swallow failures on the grammar hub and its browse page, two screens with no session to resume. **`/study` waits through `<Suspense>` rather than a `loading.tsx`**, which is the third distinct mechanism here and is deliberate: a `loading.tsx` covers the whole segment including its guard, whereas the boundary sits *inside* the page around the one child that awaits the database, so the shell paints while only the queue streams. Its fallback is the shared `SessionLoading` component, which is the wait that used to live inside `study-session.tsx` as a `cards === null` branch. Skeleton blocks use one shared `.skel` class filled with `--cream-100`, the token that is already the unfilled track behind every progress bar. Two rules govern them: **anything needing no data is rendered for real** (section labels, headings, `BottomNav`, which stays usable while the page loads), and **placeholder fidelity is dimensional, not textual**, so a skeleton never restates page copy that would then drift. `WordListSkeleton` is shared between `/browse`'s server wait and `BrowseClient`'s much longer client fetch of the level's word list, so the two waits render as one continuous load. Both error surfaces display `error.digest` when present: Next.js redacts the real message before sending it to the browser, and that hash is the join key to the server log.
- **Font delivery.** The three faces are declared in `src/app/fonts.ts`, downloaded from Google at build time by `next/font/google`, and served from our own origin out of `/_next/static/media`; nothing is fetched from Google at runtime. Each declaration exposes a CSS custom property that `globals.css` maps onto the brand tokens (`--f-display`, `--f-body`, `--f-jp`), so call sites name roles rather than families. The Japanese face sets `preload: false`, which is load-bearing rather than incidental (§14.12).

### 8.5 Onboarding & session flows
Two user stories drive entry into the app. Both reach the same level-scoped engines (§8.1, §8.2, §8.6, plus the grammar queue of Phase 3.5); they differ only in the first-run extras.

- **First-time user (first run).** Sign in via the email magic link (§11.2) *or* start a demo session (`POST /api/demo/login`, §11.8) → routed to `/onboarding` (gated on `UserProfile.onboardedAt` being unset) → **choose a JLPT level** (N5–N1) → the app then drops straight into the home hub. The `/onboarding` level-choice screen is **implemented** (Phase 3.5). The follow-on **Quiz mode warm-up** (5 non-scheduling questions) and **guided tour** remain deferred to the multi-user phase (§13). Completing the level choice persists `UserProfile.activeLevel` and stamps `onboardedAt` (§6), which is what distinguishes a first-time from a returning user thereafter.
- **Returning user.** Sign in → **the post-login landing** → start. That's it.

**Post-login landing: `/home`.** Sign-in (`redirectTo`), the dev login, `/onboarding` completion, `/onboarding`'s already-onboarded bounce, the public `/` redirect, and the PWA manifest's `start_url` all resolve to the home hub. This reverses the temporary `/grammar` reprioritization of 2026-07-02 (§16): that change existed because the hub carried no status of its own, so opening on it cost a tap and told the user nothing. The hub now reports what is due across both queues, which removes the reason to bypass it.

**The hub (`/home`).** A **light dashboard**, in four bands, ordered by how often each is used:

1. **Today panel**: words due, grammar points due, and reviews completed today, plus a progress bar for the active level (started / total). This is the "where am I" glance the hub previously lacked entirely.
2. **Primary CTA**: a single button routed by `pickNextAction` (`src/lib/home.ts`) to the highest-priority work: due vocab, then due grammar, then new vocab, then Quiz as a never-a-dead-end fallback. This is what preserves the one-tap, no-config promise (§2) now that the hub shows more than three buttons.
3. **Mode grid**: four tiles (Flashcard `/study`, Quiz `/quiz`, Exam `/exam`, Grammar `/grammar`) in a 2×2 layout, each with a subtitle derived from live counts. Grammar is included here because the hub is the app's default page; a mode absent from it is effectively hidden. **The Grammar tile is disabled on levels with no seeded deck** (only N3 is seeded, §4.1); the other three are always live. This reverses the "no tile is ever disabled" rule of 2026-07-25 (author's decision, 2026-07-26; §14.14), and the cost it was written to prevent is real and accepted rather than solved: the tile is the only UI path to `/grammar`, and `pickNextAction` cannot stand in for it because every count in `getGrammarStats` is level-scoped, so a non-N3 user's `grammarDue` is always 0. **A user who studies N3 grammar and then switches level loses access to it, and their reviews come due unseen until they switch back.** The disabled treatment is built from tokens, never `opacity` (BRAND.md §3): the tile recedes by losing elevation (paper fill, no shadow) with its text stepped down the ink ramp to values that still clear AA, and it renders as a plain `div` rather than a disabled control, since there is no action to describe. `/grammar` itself still distinguishes "no deck for this level" from "all caught up" rather than reporting a deck that does not exist as finished.
4. **Inline level selector**: the five JLPT chips, persisting `UserProfile.activeLevel` via a server action and re-scoping every engine. The level is changed *here*, not on a separate settings page. It sits **below** the mode grid: a level is chosen once and revisited rarely, whereas a mode is chosen every session.

**Scoping asymmetry, stated deliberately.** The Today panel's *words due* count is **not** level-scoped, because `getStudyQueue` (§8.1) returns due cards regardless of level so nothing already in progress is stranded. A level-scoped number here would promise a smaller session than the one the tile actually opens. The progress bar *is* level-scoped and is labelled with the level to make that explicit.

**Still not the full dashboard.** Streak, history, and charts remain deferred to the later stats/dashboard work (§13, Phase 6); `/stats` keeps the heavier per-level aggregates (including the 30-day recall rate, which the hub deliberately does not compute; see the header comment in `src/lib/home.ts` for why the hub has its own narrower query set rather than reusing `getLevelStats`).

**`BottomNav` lists places, not modes:** Home, Stats, Browse. Grammar was a fourth tab only while it was itself the post-login landing; with all four modes on the hub, keeping one mode in the tab bar mixed two categories and made the other three look arbitrarily omitted (§16, 2026-07-25; rejected alternative in §14.8).

### 8.6 Exam mode: JLPT-style reading & writing

A benchmark mode that presents 20 questions in two sections mirroring the vocabulary sub-problems of the JLPT Reading section. **No timer is implemented**; earlier revisions of this section described the mode as "timed," which it never was. Whether to add one is an open item: with per-question feedback (below), the mode is a study tool rather than a mock sitting, and a countdown would change that character.

- **問題１・漢字の読み方 (kanji reading):** An example sentence is shown with the target word underlined in its kanji form. The student picks its kana reading from four options. Correct answer = `Word.reading`; distractors are readings of orthographically and phonetically confusable same-level words (kanji Jaccard + reading similarity, matching Quiz mode's distractor strategy applied to the `reading` field).

- **問題２・漢字の書き方 (kanji writing):** The example sentence is shown with the target word's kanji replaced by its kana reading (the first occurrence in the sentence is substituted). The student picks the correct kanji form from four options. Correct answer = `Word.expression`; distractors are expressions of words whose readings sound similar to the target (reading similarity as the primary axis; shared kanji as a bonus).

**Question count.** Default 20 (10 + 10); the endpoint accepts `?count=` up to 40.

**The first round is built during the page render, not fetched by the client (2026-07-26).** `src/app/exam/page.tsx` follows the `/study` reference of §8.1: guard, `searchParams` and level in the page body, `buildExamRound` awaited in a nested async component under `<Suspense>`. `GET /api/exam` is retained for the "Try again" refetch only, and the route carries its own `error.tsx` (§8.4). `ExamSession` imports the question types from `src/lib/exam.ts` rather than re-declaring them.

**`buildExamRound` owns the section split, and that is why it exists.** It takes one total and derives `ceil(count/2)` 問題１ plus `floor(count/2)` 問題２ (reading takes the spare question on an odd count, being the section with no sentence-substitution constraint). The split had lived in the route handler, which was safe while the handler was the only caller and is not now: `ExamSession` is never told where the sections divide and instead **recovers the boundary from question order**, by finding the first `type: "writing"` index. A page and a route that split a round differently would therefore not error; they would quietly produce a round whose section-break screen falls in the wrong place or never fires. One definition makes that unrepresentable.

**Section structure.** Questions 1–10 are 問題１; questions 11–20 are 問題２. A lightweight **section-break screen** appears between them (showing the 問題１ score before the student proceeds), mirroring the experience of turning a page in a real JLPT paper.

**Immediate feedback.** Unlike a real exam's submit-all-at-end model, Exam mode reveals the correct answer after each question. This is optimal for a study tool: the student connects the correction to the question immediately rather than after a full 20-question delay.

**Independence from FSRS.** Exam mode neither reads from nor writes to `ReviewState`. Questions are drawn at random from the active level's word pool, not from the FSRS due queue. The mode is a pure benchmark; its results do not schedule or unschedule anything. Flashcard, Quiz, and Exam are independent today, and FSRS coupling is a **permanent** non-goal for Exam specifically (§16 decision log); Quiz gains it in Phase 3 (§13). Grammar schedules against its own separate queue either way.

**Sentence substitution edge case.** For 問題２, the kana replacement uses `String.replace` on the first occurrence of `Word.expression` in the sentence. If the sentence uses a conjugated or inflected form of the word rather than the bare `expression`, the replacement finds no match and the sentence is displayed unmodified (the underline target is then the kana reading standing alone, functionally still a valid question). This occurs rarely and is accepted as-is.

---

## 9. API surface (route handlers and Server Actions)

**The convention: reads are route handlers, writes are Server Actions** (decided 2026-07-26; rejected alternatives in §14.16). A read keeps a URL that the browser can cache, that a client component can re-request imperatively, and that can be inspected with `curl`; two read routes depend on that directly, since `/api/browse` and `/api/words/[id]/sentence` carry `Cache-Control` headers that eliminate repeat round-trips (§10). A write has none of those properties to lose: it has no consumer outside this app, is never cacheable, and gains typed arguments across the boundary plus composition with React transitions when expressed as an action.

Two things the split does **not** change. First, the security posture: a Server Action compiles to a POST endpoint whose id is discoverable in the client bundle, so it is exactly as web-reachable as a route handler and its arguments are exactly as untrusted. Every guard that applied to a route (auth via `getCurrentUserId()`, enum validation with `Object.hasOwn`, rate limiting) applies unchanged to the action that replaces it; the typed signature is a developer convenience and never a boundary. Second, the classification rule is "does this mutate or spend", not "which HTTP verb did it use to have": `POST /api/demo/login` stays a route handler because it is a public, origin-checked, rate-limited entry point rather than an in-app mutation, and `/api/auth/*` stays because Auth.js owns it.

The **Status** column reflects what is actually built today vs. designed-but-not-yet-built, so the auth/protection guarantees below can't be assumed for routes that don't yet exist. Batch operations are currently **scripts only** (run locally), not HTTP endpoints: there is intentionally no web-reachable, cost-incurring Anthropic route at present (see §11.4).

### 9.1 Route handlers (reads, plus the public and dev entry points)

| Method | Route | Purpose | Auth | Status |
|--------|-------|---------|------|--------|
| GET | `/api/cards/queue` | Today's FSRS study queue, flattened by `buildSession` | required | **Implemented**; no longer serves a session's *first* payload (the `/study` render does, §8.1), only the imperative refetches |
| `*` | `/api/auth/*` | Auth.js (sign-in request, callback, session) | public (rate-limited) | **Implemented** |
| GET | `/api/quiz?level=&count=` | Batch of JP→EN multiple-choice questions (non-scheduling), via `buildQuizRound` | required | **Implemented**: confusability-scored distractors (shared kanji + reading similarity, §8.2); serves only the "Play again" refetch since the `/quiz` render builds the first round |
| GET | `/api/exam?level=&count=` | JLPT-style exam round: 問題１ (kanji reading) + 問題２ (kanji writing), non-scheduling, via `buildExamRound` | required | **Implemented**: 10+10 questions, two-section with break screen (§8.6); refetch only, and the section split now lives in the builder |
| GET | `/api/grammar/queue` | Grammar FSRS study queue, flattened by `buildGrammarSession` | required | **Implemented**; refetch only (the `/grammar/study` render builds the first payload), and the response is now the flattened card payload rather than raw `GrammarProgress` rows (§8.1) |
| GET | `/api/grammar/browse?level=` | Every grammar point for one level, grouped by lesson, with per-point progress status | required | **Implemented**: whole dataset in one payload (§13 Phase 3.5 addendum), now via the shared `buildGrammarBrowse`; **no in-app caller** since the `/grammar/browse` render took over (§9.3), retained as the read surface the convention asks reads to keep |
| POST | `/api/demo/login` | Start an ephemeral demo session: create `User` + `UserProfile`, sign with HMAC, redirect to `/onboarding` | public (rate-limited, origin-checked) | **Implemented**: production-available; POST-only, session identity is a time-bound HMAC-signed cookie (§11.8) |
| GET | `/api/dev/login` | **Dev-only**: mint a session for the seeded user (skip the magic link) | none (dev-only) | **Implemented**: 404 in prod; gated by `DEV_AUTH` (§11.7) |
| GET | `/api/browse?level=` | Word list for one level (id, expression, reading, meaning; no sentences, **no per-user field**); browser-cached | required | **Implemented**: `Cache-Control: private, max-age=86400, stale-while-revalidate=604800`, raised from one hour on 2026-07-26 when the `started` flag moved to the page render (§8.3). Auth is now the *only* reason the handler reads the session; the body does not vary by user |
| GET | `/api/words/[id]/sentence` | Lazy-load one word's cached example sentence | required | **Implemented**: `Cache-Control: private, max-age=86400, stale-while-revalidate=604800` |
| POST | `/api/batch/submit` | Submit a generation batch | admin | Not planned (scripts only) |
| GET | `/api/batch/:id` | Poll batch status / collect | admin | Not planned (scripts only) |

The on-demand single-sentence fallback (§7.4, §11.4) was tracked here as a planned `POST /api/generate`. Under the convention above it both mutates the sentence cache and spends money, so it is a write and belongs in §9.2; the route name is retained only as the historical working title.

### 9.2 Server Actions (writes)

Server Actions are colocated with the route that owns them (`src/app/<route>/actions.ts`) and every module carries the `"use server"` directive, which makes each export a POST endpoint. The **Guards** column is therefore not optional detail: it is the entire protection on a publicly reachable mutation.

| Action | Module | Purpose | Guards | Status |
|--------|--------|---------|--------|--------|
| `signOutAction` | `app/home/actions.ts` | Destroy the DB session, redirect to `/` | Auth.js `signOut` | **Implemented** |
| `demoSignOutAction` | `app/home/actions.ts` | Delete the demo cookie, redirect to `/` | none needed (deletes a cookie) | **Implemented** |
| `setActiveLevel` | `app/home/actions.ts` | Persist `UserProfile.activeLevel` | `getCurrentUserId()` + `Object.hasOwn(Level, …)`; revalidates all five level-scoped routes | **Implemented** |
| `completeOnboarding` | `app/onboarding/actions.ts` | Set the starting level and `onboardedAt` | `getCurrentUserId()` + `Object.hasOwn(Level, …)` | **Implemented** |
| `rateCard` | `app/study/actions.ts` | Apply an FSRS rating to a word (`reviewWord`) | `getCurrentUserId()` + rating ∈ {1,2,3,4} + non-empty `wordId` | **Implemented** (2026-07-26); `POST /api/review` retired the same day |
| `undoRating` | `app/study/actions.ts` | Revert the most recent review (`undoLastReview`) | `getCurrentUserId()` + non-empty `wordId` | **Implemented** (2026-07-26); throws where the route returned 404, since an action has no status code |
| `rateGrammarPoint` | `app/grammar/actions.ts` | Apply an FSRS rating to a grammar point (`reviewGrammarPoint`) | as `rateCard`, on `grammarPointId` | **Implemented** (2026-07-26); replaced `POST /api/grammar/review`, now retired |
| `undoGrammarRating` | `app/grammar/actions.ts` | Revert the most recent grammar review (`undoLastGrammarReview`) | as `undoRating`, on `grammarPointId` | **Implemented** (2026-07-26); **new rather than ported**: grammar had no undo, and `GrammarReviewLog` (§6) is what made one possible |
| on-demand generation | Phase 4 | Single-sentence fallback on a cache miss | auth + per-user rate limit + cache-first + bounded `max_tokens` (§11.4) | Planned (Phase 4, optional) |

**No `revalidatePath` on the four rating and undo actions.** A study session's card list is fixed at load time and is client-owned state from that point on (§8.1), so revalidating would refetch the page underneath a session in progress. `setActiveLevel` is the opposite case and does revalidate, because the level scopes what every other route renders.

**No `router.refresh()` after a Server Action that revalidates** (2026-07-26). `LevelPicker` called both, which was a second request for a render the app had already been handed: a Server Function's response carries the re-rendered payload for the route being viewed, in the same round trip as the write ("Updates the UI immediately (if viewing the affected path)", Next.js `revalidatePath` reference, verified against 16.2.7). A `router.refresh()` is only needed where the write did *not* revalidate the current path, which under §9.2's table is nowhere today.

### 9.3 Which reads the server renders, and which stay client fetches

§9.1 settles what a read *is*; this settles who performs it. The default, established by `/study` (§8.1) and applied to all four session modes, is that **a route renders its own first payload** and hands it to the client as a prop, because the alternative costs a round trip that re-derives a `userId` the render already had, plus a spinner that `<Link>` prefetch can only ever warm up. The read route survives for the imperative refetches (§14.16).

The default has one exception, and the criterion is **payload size, not page kind** (decided 2026-07-26; author, with the rejected shapes in §14.25). A dynamic route's response is not cacheable, so anything serialized into it is re-downloaded on every visit; a route handler's response can carry a `Cache-Control` header. Server-rendering therefore trades a *repeated* transfer for a *removed* round trip, and which side wins depends on how many bytes are being repeated:

| Surface | Rows per level | Choice |
|---------|----------------|--------|
| The four session screens | ~10–35 cards | Server-rendered. Trivial payload, and the round trip is the entire cost. |
| `/grammar/browse` | ~220 points, sentences inline | Server-rendered. Small enough that the round trip still dominates. |
| `/browse` | ~2,700 words, ~90 KB gzipped (N1) | **Client fetch, kept.** Whole-deck by necessity (search filters in memory), so the RSC payload would carry ~90 KB on every visit against a route handler that caches it for a day. |

**A server-rendered read needs a boundary that fails where the read was, not where the route is (decided 2026-07-27; author).** Moving a read into the render moves its failure from a `useEffect`'s catch to a thrown error, and the nearest boundary then decides how much of the page it takes down. For the four session modes that is the whole screen, correctly: there is no session left to show. For `/grammar/browse` it was an inherited accident — before the move, a failed query showed one red line inside intact page chrome, and afterwards the root boundary replaced the header, heading, level chip, account menu and nav as well. A route-level `error.tsx` cannot restore those, because an error boundary must be a Client Component and every one of them needs the database. The resolution is `src/components/inline-error-boundary.tsx`, a boundary placed **inside the page**, wrapping the `<Suspense>` around the one child that awaits the database. Errors thrown by a Server Component below a suspense boundary surface on the client at the nearest error boundary, so placement alone decides containment; nothing about the server/client split has to be reasoned about at the call site. Retry is `router.refresh()` paired with the reset inside one transition, because clearing the boundary alone re-renders the same failed RSC payload. The rejected shapes, including a segment `layout.tsx` that would have made a plain `error.tsx` work, are in §14.28.

Two rules follow, and both are load-bearing. **A surface that stays a client fetch must still server-render its per-user half**: that is what freed `/api/browse` to hold a day-long cache instead of an hour (§8.3), and it is the general shape: split the response along the cacheable/per-user seam rather than choosing between the two. And **a read route that loses its in-app caller is not thereby dead code**: `/api/grammar/browse` has none, and is kept because reads are the surface that stays inspectable and cacheable (§14.16), delegating to the same shared builder the page calls so the two cannot drift.

---

## 10. Caching strategy

1. **Sentence cache (primary)**: `ExampleSentence` rows in Postgres. This is the core of the product: each word's sentences are generated once and reused for every view by every user. Cache key = word; a miss triggers on-demand generation (§7.4).
2. **Anthropic prompt caching**: the shared system prompt is cached across batch and on-demand requests to reduce input-token cost.
3. **HTTP browser caching**: the browse word list (`GET /api/browse`) and the lazy-loaded sentences (`GET /api/words/[id]/sentence`) are both served with a 24 h max-age and a 7-day stale window. Both datasets change ~never (seeded once), so the browser avoids repeat fetches within the cache window entirely. The word list held only a 1 h max-age until 2026-07-26, and that shorter lifetime was never a judgement about deck data: it was the freshness the *per-user ordering* in the same response needed. Splitting that ordering out (§8.3) is what let the header describe the data it actually serves; the general form of that rule is §9.3. Both values stay `private`: nothing sits in front of the app on Railway that would use a shared cache, so `public` would buy nothing and would cost the auth gate. The study queue and review writes are `force-dynamic` and never cached.

---

## 11. Security & authentication

### 11.1 Threat model
Although the initial release serves a single user, the app is reachable on the public internet. The assets we protect are: (a) the owner's study progress and account, and (b) the `ANTHROPIC_API_KEY`, whose abuse incurs real cost. The adversary is an unauthenticated internet actor (credential guessing, endpoint scanning, cost-abuse of the generation endpoint, email-relay abuse). High-sophistication or insider threats are out of scope for the initial release.

### 11.2 Authentication: passwordless email magic link
Authentication uses **Auth.js with the Email provider**, sending magic links via **Resend** (already provisioned). Access is restricted to an **email allowlist**: `AUTH_ALLOWED_EMAIL` is parsed as a comma-separated list into a `Set` (a single address is the degenerate case, and is what production runs today). We chose passwordless magic links over a seeded password deliberately:

- **No long-lived shared secret lives in the application.** A seeded password is a static credential that must be stored, rotated, and kept out of source control, env dumps, and logs, a recurring leak vector for self-hosted apps. The magic-link flow stores no reusable password; authentication reduces to *proving control of the allowlisted inbox*.
- **It delegates to a stronger security boundary.** The owner's email account is almost certainly protected by a strong password and 2FA that we maintain anyway. Leaning on it is stronger than any password store we would build, and removes a redundant secret rather than adding one.
- **The allowlist contains blast radius.** Even if the sign-in endpoint is discovered, a link can only ever be delivered to an allowlisted address, so an attacker cannot have one sent to themselves. The list is kept to the few addresses that genuinely need access (today: one), which is what keeps this property meaningful.

**Every page in the flow is ours (2026-07-26).** `pages` in `src/auth.ts` names all three: `signIn` → `/auth/signin`, `verifyRequest` → `/auth/verify-request`, `error` → `/auth/error`. Anything left unnamed falls back to Auth.js's built-in equivalent under `/api/auth/*`, which is an unstyled white page in a system font with no mascot, and the two that were unnamed fired at the flow's most fragile moments: immediately after committing to sign in, and after clicking a link that no longer works. `verifyRequest` is on the **happy path**, which made its absence the more expensive of the two. The three screens share `src/components/auth-card.tsx` (§14.22) and need no `proxy.ts` change, since everything under `/auth` is already public, as it must be for screens whose purpose is to be seen without a session.

**Two error paths, deliberately, and the split is by *when* not by *what*.** `/auth/signin` keeps its own `?error=` handling for failures raised while the form is being submitted, because that path is our Server Action catching an `AuthError` rather than an Auth.js redirect; it therefore owns the allowlist message and the optional owner-contact mailto. `/auth/error` handles what fails afterwards: an expired or already-used token (`Verification`, the common case) and misconfiguration (`Configuration`). `AccessDenied` arriving at `/auth/error` is forwarded to `/auth/signin?error=AccessDenied` rather than explained twice (§14.22).

### 11.3 Hardening requirements (the magic link is only secure if these hold)
A magic link is a bearer token in transit; the implementation **must** enforce:

1. **High-entropy tokens** (≥ 256 bits) stored **hashed at rest**, never the raw token.
2. **Single-use** tokens, invalidated immediately on redemption.
3. **Short TTL**: 10–15 minutes.
4. **Server-side allowlist enforcement** (case-insensitive membership in the `AUTH_ALLOWED_EMAIL` set, normalized on both sides) *before* any email is sent, and **failing closed** if the allowlist is unset. Without this the endpoint is an open email-spam relay. The check is repeated in the `signIn` callback at verification time, as defense in depth.
5. **Rate limiting** on the sign-in request endpoint (per-IP and global) to prevent inbox bombing and token-guessing.
6. **Secure sessions**: `httpOnly`, `Secure`, `SameSite=Lax` cookies with a sane expiry and rotation; sessions stored server-side (Auth.js database sessions via Prisma).
7. **HTTPS everywhere**: provided by Railway TLS; redirect HTTP→HTTPS.
8. **Security response headers** on every route (`next.config.ts`): HSTS (makes the HTTPS redirect durable in the browser), a Content-Security-Policy that blocks all external script/frame/object loads (`'unsafe-inline'` is retained for script/style because Next.js hydration requires it; per-request nonces were judged not worth the dynamic-rendering cost for an app with no third-party scripts), `frame-ancestors 'none'`/`X-Frame-Options: DENY` (clickjacking), `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin` (keeps magic-link URLs out of third-party Referer logs). Since the `next/font` migration (§14.12) the policy names **no third-party origin at all**: `style-src` and `font-src` dropped `fonts.googleapis.com` and `fonts.gstatic.com`, so every directive is now `'self'` plus, where unavoidable, `'unsafe-inline'`. A reintroduced `@import` of Google Fonts would therefore fail closed rather than quietly re-adding a third-party dependency.

   **Two development-only relaxations**, gated on `process.env.NODE_ENV === "development"` so the production policy is unaffected: `'unsafe-eval'` in `script-src`, and `ws:`/`wss:` in `connect-src`. React's development build calls `eval()` for debugging features (it reconstructs cross-environment callstacks for the error overlay) and Turbopack's HMR runtime evaluates hot-updated modules, so without the first the dev server throws `eval() is not supported in this environment` and the overlay degrades; the second covers the HMR websocket, which CSP 3 says `'self'` already permits on the same origin but which browsers have handled inconsistently. `'unsafe-eval'` is deliberately **not** granted in production: it would make any injected string executable and undo much of what this policy exists to prevent. React never uses `eval()` in production builds, so nothing needs it there.

### 11.4 Secrets & API-key protection
- All secrets (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `AUTH_SECRET`, `DATABASE_URL`) are injected as Railway environment variables and never committed.
- The Anthropic key is **server-only**; it is never exposed to the client and no model call is reachable from the browser without an authenticated server route. As built, the only code that calls Anthropic lives in `src/lib/generate.ts` and is imported **only by the local `scripts/`**: there is currently **no web-reachable route that spends Anthropic tokens** (the on-demand endpoint below is not yet built; §9).
- **If/when `/api/generate` is added** (the optional on-demand fallback, §7.4), it becomes the single Anthropic cost-abuse vector and **must** ship with all of: (a) authentication (`getCurrentUserId` → 401); (b) **rate limiting** (reuse `src/lib/rate-limit.ts`, per-user and global) so an authenticated client can't loop it; (c) **cache-first**: call the model only when the word has zero cached sentences, so repeated requests for the same word are free; (d) a bounded `max_tokens`. Without (b)–(d), auth alone does not bound cost.
- Batch operations are **scripts only** (run locally), not HTTP endpoints, so they expose no cost-incurring route. Should they ever be exposed as `/api/batch/*`, they require an admin marker beyond a normal session.

### 11.5 Path to multi-user
Multi-user is reached by: removing the allowlist (or widening it from a fixed list to an invite/allow rule), relying on the already-present `userId` scoping for all queries, and adding explicit authorization checks so every read/write is constrained to the session's user. No schema migration of the core shape is required (§6).

### 11.6 Public repository & PII
This repository is intended to be **open-sourced**, so no personal data is committed.

- **The allowlist is configuration, not source.** `AUTH_ALLOWED_EMAIL` holds the comma-separated addresses permitted to sign in; its *value* lives only in Railway environment variables and is **never committed**. `.env.example` carries a placeholder (`you@example.com`), never a real address.
- **A dedicated alias is preferred for the allowlist** rather than a primary personal inbox: it scopes the app's reach and is trivially rotatable if abused.
- **Git commit metadata is accepted as public.** Commits are authored under an email the author already publishes, so no history rewrite or noreply alias is required. (Decision: author's call; the trade-off is permanent public exposure of that address, accepted because it is already public.)

### 11.7 Development auth bypass (must be impossible in production)
Local development skips the magic-link round-trip via a **dev-only** route, `GET /api/dev/login` (§9), which mints a real database session for the seeded user and sets its cookie. Producing a genuine session keeps full parity with the production flow: `auth()`, the `proxy.ts` guard, and `getCurrentUserId` all work unchanged. It is **doubly gated** so it cannot exist in the deployed app: the handler returns 404 when `NODE_ENV === "production"`, **and** only runs when `DEV_AUTH=1` is explicitly set (never set in prod). `proxy.ts` likewise treats `/api/dev/*` as public only outside production. We deliberately did **not** use an Auth.js Credentials provider for this: it requires the JWT session strategy, whereas Bayana uses database sessions (§11.3 #6).

### 11.8 Demo session (ephemeral, production-available)
`POST /api/demo/login` (§9) is a **production-available** path that lets visitors try the app without an email address. It is fundamentally different from the dev bypass above:

- **What it does:** creates a fresh `User` row (no email) and a `UserProfile` (no `onboardedAt`) in the database, then signs `userId:expiresAtMs` with **HMAC-SHA256** keyed by `AUTH_SECRET`, and writes the result as a 7-day `httpOnly` cookie. The user is then redirected (303) to `/onboarding`.
- **Session identity with server-enforced expiry.** No Auth.js `Session` row is created. `getCurrentUserId()` in `src/lib/current-user.ts` detects the demo cookie, verifies the HMAC (constant-time comparison), then checks the signed `expiresAtMs` against the clock; the expiry is inside the signed payload, so a client cannot extend its session by re-sending an old cookie or editing the timestamp. Cookies in the pre-expiry format (HMAC over `userId` alone) fail verification and are treated as signed-out; this was accepted over dual-format support because demo sessions are disposable by design.
- **Endpoint hardening.** Because this is the one unauthenticated write endpoint (each hit inserts a `User` + `UserProfile` row), it carries three defenses:
  1. **POST-only**: a state-changing GET can be triggered cross-site by an `<img>` tag or link prefetch without user intent; GET now returns 405.
  2. **Same-origin check**: browsers attach an `Origin` header to cross-site POSTs; any `Origin` not matching the app's public origin (derived from `AUTH_URL`) is rejected with 403. Non-browser clients that omit the header pass this check; bounding those is the rate limiter's job.
  3. **Rate limiting in `proxy.ts`**: per-IP (5/hour) and global (30/hour) fixed-window limiters bound total row creation even from rotating IPs, mirroring the sign-in limiters (§11.3 #5).
- **Ephemerality by design.** Each demo start creates a new `User`; the previous session's rows are orphaned (no cookie → unreachable). Losing the cookie means losing all data. This is intentional: demo data is cheap to create and users are expected to sign up via magic link if they want persistence.
- **Retention is a published promise, backed by a schedule (decided 2026-07-27; author).** The deletion rule is unchanged and still deliberately narrow — `email IS NULL`, no Auth.js `Session` rows, `createdAt` older than the cookie TTL, and `id ≠ DEFAULT_USER_ID` (the local seed user) — because a wrong match cascade-deletes real study progress (§14.5 covers why a heuristic filter beat an `isDemo` column). What changed is *when it runs*. It lived inside the demo-login handler, which meant that on a quiet week nothing ran at all; that is a cleanup heuristic, not a commitment, and §11.10 requires the privacy page to state one. The rule now lives in `src/lib/demo-cleanup.ts` and has two callers: `scripts/cleanup-demo-users.ts`, run daily as a Railway cron **service** (§12), which is what makes the promise keepable; and the login route, still, as a redundant backstop costing one indexed `DELETE` on a path that already writes, so a paused cron degrades the promise rather than voiding it. **The stated window is 14 days against an enforced cutoff of 7**, and the gap is deliberate: rows become deletable at the cookie TTL, so a daily sweep takes them on day 7 or 8, and promising 14 absorbs a missed run without turning an operational hiccup into a broken commitment. A cron service rather than an authenticated `/api/cron/*` route, because a route would put a destructive operation on the public internet and make its safety rest on a shared secret being compared correctly (§14.28).
- **`/api/demo/login` is public in `proxy.ts`** (exact path, no session check) so the route is reachable before authentication; this is the correct, intentional behaviour. The exact-path match (rather than a `/api/demo/*` prefix) ensures future demo routes do not silently ship unauthenticated. It is distinct from `/api/dev/*`, which is public **only outside production**.
- **Threat model.** The HMAC prevents a user from forging a cookie to impersonate another `userId`; the signed expiry bounds how long a leaked cookie is useful; POST + Origin checking prevents cross-site session minting; rate limits plus opportunistic cleanup bound DB row accumulation from abandoned or abusive demo starts.

### 11.9 `proxy.ts`: Next.js 16 route-guard mechanics

The route guard, session gate, and rate limiters described above all live in `proxy.ts`, and Next.js 16 changed the mechanics of that file in ways that fail silently if missed:

- Next.js 16 renamed middleware to **proxy**. A `middleware.ts` file is **ignored without error**: creating one produces no guard at all, so every route silently ships unprotected.
- The file exports a function named `proxy` (type `NextProxy`; `NextRequest`/`NextResponse` from `next/server` work as before), and a `config.matcher` array still scopes which paths it runs on.
- The proxy runs in the **Node.js runtime** by default (not Edge), which is what allows the in-memory rate limiters (§11.3 #5, §11.8) to live there.
- `proxy.ts` must sit at the **project root**, not under `src/`; the framework does not pick it up elsewhere (confirmed 2026-06-05, §16).

### 11.10 Published policies (`/privacy`, `/terms`, 2026-07-27)

Two static routes stating what the service does with a person's data, and what they agree to by using it. They became non-optional before the allowlist widens, because the demo door is already open to anyone (§11.8) and a demo visitor receives a cookie and a database row without ever having seen a policy.

- **The inventory is the work; the prose is second.** What is collected, verified against the schema rather than assumed: an email address for allowlisted sign-in (`User`, `Account`, `Session`, plus the hashed magic-link token in `VerificationToken`), a demo identity that is an HMAC-signed cookie with its own `User` row, and study progress (`ReviewState`, `ReviewLog`, `GrammarProgress`, `GrammarReviewLog`, `UserProfile`). Third parties, one job each: **Resend** delivers the magic link and therefore processes the address, **Railway** hosts the app and its Postgres, and **Anthropic** wrote the example sentences.
- **Two claims are load-bearing and both are properties of the code, not marketing.** First, **no analytics, no tracking pixels, no third-party scripts of any kind** — a genuinely strong claim, and true only while the CSP names no external origin (§11.3); it also means the only cookies are the two that make sign-in work, so there is nothing for a consent banner to ask about. Second, **nothing a user does is ever sent to an AI model**: generation is a seeding pipeline over deck words that ran once, ahead of time (§7, §11.4). Both go false under work already planned — on-demand generation (§13 Phase 4) breaks the second — so each is flagged in TODO.md against the item that would break it, to be flipped in the same commit.
- **Register: plain language, short, honest (author's call, 2026-07-27).** Conventional legal boilerplate was rejected (§14.28); the pages read in Bayana's own voice, at roughly one screen each.
- **The MIT licence is not the terms of use.** The footer's MIT link governs the *source code*; `/terms` governs use of the *hosted service*. Conflating them is the obvious failure mode given the footer already links one of them, so `/terms` states the distinction explicitly rather than leaving it to be inferred, and the landing footer puts the policy links on their own line rather than running all three together.
- **Both routes are public in `proxy.ts` as exact paths**, following the `/api/demo/login` precedent (§11.8), so a future `/privacy/*` cannot ship public by inheritance. They must be readable *before* signing in: a policy a visitor can only see after handing over an address is not a policy. They are linked from the landing footer and from `/auth/signin`, which is the moment that decision is actually made.
- **Both prerender** (no auth, no per-user data), which has one consequence worth stating: `OWNER_CONTACT_EMAIL` is read at build time on these pages, unlike on the hub, so it ships as whatever it was when `next build` ran.
- **The prose is written to survive the port.** The inventory describes the service, not Next.js, so route file paths and the `proxy.ts` allowlist mechanism stay out of the copy and the Nuxt app re-hosts these two pages rather than rewriting them.

---

## 12. Deployment (Railway)

- **Services:** 1 × Next.js web + 1 × Postgres plugin, plus **1 × cron service** added 2026-07-27. No Redis or worker tier is required (see §5.1, §7.1).
- **The cron service** runs `npx tsx scripts/cleanup-demo-users.ts` on `0 4 * * *` against the same `DATABASE_URL`, and exists to make §11.8's 14-day retention promise keepable rather than aspirational. Railway runs a cron service as a one-off container per tick and treats the tick as finished when the process exits, which is why the script exits explicitly and returns a non-zero code on failure, so a broken tick reads as a failed run rather than a silent no-op. It is idempotent and safe at any frequency: it deletes only rows that are already provably unreachable. **It is not created by `railway.json`**, which configures the web service only, so adding it is a one-time manual step in the Railway dashboard; if it is absent, the login-path backstop still bounds the table and the published promise is the thing that degrades.
- **Build:** **Railpack** (Railway's current default builder; configured in `railway.json` as `build.builder: "RAILPACK"`) autodetects the Next.js app, or a Dockerfile for finer control. Nixpacks is **deprecated** and is not used.
- **Environment variables:** `DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `AUTH_SECRET`, `AUTH_ALLOWED_EMAIL`, `AUTH_EMAIL_FROM`, `AUTH_URL` (public origin, for Auth.js callbacks). `DEFAULT_USER_ID` is **not** a production variable; it is only used by the local `scripts/seed-user.ts` helper.
- **Migrations & seed:** run `prisma migrate deploy` on release; load words with `scripts/import-csv.ts`. For the example-sentence cache, **transfer the already-generated sentences from local rather than regenerating**; regeneration would re-incur API cost. Because `Word.id` cuids differ per database, transfer keyed by the stable `Word.guid` (a GUID-keyed export/import), or `pg_dump`/restore the `Word` + `ExampleSentence` tables together so ids stay aligned. `seed-sentences.ts` / `collect-batch.ts` remain for generating *new* levels directly on prod.
- **Backups:** the Railway **Hobby** plan has no managed backups. The backup target is the **local** Postgres (the `bayana-postgres` container), which is the authoritative source of the generated sentence cache (Batch results land there first, then are transferred to prod), so backing it up protects `ExampleSentence`, the only paid, hard-to-regenerate artifact. (`Word` is free to re-import from `decks/`.) Back it up with `pg_dump` (exact commands in `notes/deploy.md`, which is gitignored along with the rest of `notes/`); for long-term keeping, a `Word.guid`-keyed JSON export is preferred over a `.dump`, which is tied to the Postgres major version and schema. Dump files contain personal data and are gitignored (`/backups`).
  - **Prod is deliberately not backed up routinely**, to avoid Hobby-plan egress cost. The accepted consequence: prod-only data, chiefly `ReviewState`/`ReviewLog` (study history, which accumulates only in prod once studying happens there), is **not recoverable** if the prod database is lost. This is an accepted risk for a single-user learning project, not a recommendation for multi-user (§11.5), where study history would warrant a managed or scheduled backup.
- **Domain:** Railway-generated domain for the initial release; custom domain later.

**Two consequences of the Nuxt migration land here** (§5.2), both dated 2026-07-26 and both unaddressed:

- **The `Word.guid`-keyed transfer and export format has a deadline.** Both the prod sentence-cache transfer and the preferred long-term backup ("a `Word.guid`-keyed JSON export") assume every word has an Anki identifier. Bayan-sourced words will not (§6), so the key has to change before the first one is inserted, and the existing backups remain readable only for the deck-sourced subset.
- **The cutover resets the production database rather than migrating it** (author's decision, 2026-07-27; §6). This closes what had briefly been the migration's largest risk. The accepted risk recorded above, that prod-only `ReviewState`/`ReviewLog` are unrecoverable, is not merely tolerated at cutover but *exercised*: the study history is discarded deliberately, the app having one user whose exam is behind them. The new database is seeded the way the first one was, from `decks/` and from the local sentence cache, so no carry-over script exists to write, rehearse, or get wrong. The one retained recommendation is an archival `pg_dump` before the reset, purely to preserve `ReviewLog` as potential FSRS re-optimization input; it blocks nothing.

---

## 12.1 Testing strategy (2026-07-27)

Bayana had **one** test file until 2026-07-27 (`src/lib/fsrs.test.ts`, covering the adapter round-trip), which was defensible while the app was the only thing at risk and stops being defensible the moment the code is going to move. `src/lib` is ~2,600 lines and only `current-user.ts` imports anything from Next, so it is the layer that copies into the Nuxt app close to verbatim — and code that moves without being rewritten also moves without being re-read. A scheduling interval that shifts by a day, or a distractor pool that quietly narrows, produces no error and no visible symptom.

- **These are characterization tests.** The goal is to pin what the code does *today*, so the ported code can be diffed against it, not to assert correctness in the abstract. Where a test disagreed with the source, that was recorded as a finding rather than fixed mid-freeze; two were found on the first pass and both are in §15.
- **Assertions sit at the function boundary, never on row shapes.** This matters because the data model is deliberately in scope for the migration (§6): "`buildQuizRound` returns four options, one correct, distractors drawn from the same level" survives a schema redesign and becomes its specification, while an assertion on a `ReviewState` row shape dies with the table and proves nothing about the port.
- **Randomness is tested as invariants over many runs, not with a seeded generator.** Both question builders shuffle. Seeding would pin an implementation detail the port is free to change and would make the tests pass for the wrong reason; asserting "a kanji-sharing word is picked more often than an unrelated one" over 200 rounds tests the property the shuffle exists to serve.
- **DB-touching functions are tested against an in-memory fake, not a throwaway Postgres** (author's decision; alternatives in §14.28). The mechanism is a seam: every such function takes a `Deps` object (`src/lib/deps.ts`) as its **last parameter, with a default**, so every existing call site is untouched, tests inject `makeFakeDb()`, and the port gets one named place to hand the same logic a different query layer. The fake (`src/lib/__fixtures__/fake-db.ts`) implements only the query features the app actually uses and **throws on anything else**, which is the property that makes it trustworthy: a fake that quietly ignored an argument would turn a passing suite into evidence of nothing.
- **What the fake cannot test, stated rather than implied:** it runs `serializableTxn` inline, so the lost-update race that isolation level exists to prevent is out of reach; and it tests composition, not SQL. Both are accepted, the second more comfortably than the first, because composition — ordering, caps, level scoping — is what runs *above* the query layer and therefore what has to survive the port unchanged.
- **The suite is the port's acceptance gate.** These files import nothing framework-specific, so on the other side they should need a new query layer beneath them and no change above it. The first assertion that cannot be satisfied is the port's first real finding.

Coverage as of 2026-07-27: 158 tests over 8 files, covering the FSRS adapter and its intervals, the shared scoring toolkit, both question builders, both review/undo cycles, both queue builders, the browse/stats/home aggregates, and the demo-cookie authentication path. Not covered: React components, route handlers, Server Actions, and the highlighted-sentence token pipeline (TODO.md).

---

## 13. Milestones & rollout

Completed phases are listed in the order they shipped, then the planned ones in intended order. That is why **Phase 3.5 appears before Phase 3**: grammar study was an unplanned interleave that shipped in June 2026, while Phase 3 (MC↔FSRS coupling) is still ahead. The half-step number is kept rather than renumbered so the decision log (§16) and TODO.md keep referring to the same thing.

**Phase 1a: Playable slice (run locally, study ASAP). ✅ done**
- Postgres schema (incl. `ReviewLog`); seeded default `User` + `UserProfile`.
- CSV import for **N3**; batch-seed N3 example sentences.
- **Flashcard mode** review (JP→EN) via `ts-fsrs`, with **one-step undo**.
- Mobile-first card UI (flip / rate). Runs locally, end-to-end.

**Phase 1b: Shippable (public), auth + deploy. ✅ done**
- Magic-link auth (Auth.js + Resend, email allowlist) with §11.3 hardening and a root-level `proxy.ts` route guard (§11.9).
- Deployed to Railway; N3 sentence cache transferred (by `Word.guid`, §12) rather than regenerated.

**Phase 1c: Fill out content. ✅ done (generation)**
- All levels (N5–N1, ≈8,100 words) batch-seeded; every word now has a cached sentence (§7.5). The on-demand `/api/generate` fallback is **no longer needed for coverage** and has moved to Phase 4 (it returns there as a safety net for future additions).

**Phase 2: Quiz mode. ✅ functionally complete**
- Gamified multiple-choice quiz (§8.2): `GET /api/quiz` with confusability-scored distractors (shared kanji + reading similarity, §8.2), instant feedback, cached example sentence on reveal. Duolingo-grade UI, minimal animation, zero ads.
- Level scope + home hub (`/home`): `UserProfile.activeLevel`, returning-user mode picker (Flashcard / Quiz), inline level selector.
- Light polish shipped: **browse/search** (`/browse`, browser-cached word list, 50/page pagination, started-words-first, inline level switcher, lazy sentence per tap, §8.3), **basic stats** (`/stats`: started/total, due, recall rate), **default `newCardsPerDay` lowered 20 → 10** with a tap-to-open `InfoBubble` explanation on the landing and home hub, **installable PWA** (pulled forward from the enhancements phase, §8.4).
- MC↔FSRS coupling and Flashcard↔Quiz synergy **deferred by choice** (§15, §16); now Phase 3 below.
- First-run onboarding deferred → multi-user phase (§16), then partly pulled forward in Phase 3.5 below.

**Phase 2 addendum: Exam mode. ✅ done (2026-06-07)**
- JLPT-style benchmark mode (§8.6): `GET /api/exam` with 10 × 問題１ (kanji reading in sentence context) + 10 × 問題２ (kanji writing from kana in sentence context). Sequential with immediate feedback; section-break screen between 問題１ and 問題２; split score summary.
- Exam mode is **independent of FSRS** by design: neither reads from nor writes to `ReviewState`. All three modes (Flashcard, Quiz, Exam) are standalone (§16 decision log).
- Home hub updated to a three-tile mode picker (Flashcard / Quiz / Exam).

**Phase 3.5: Grammar point study (N3 v1). ✅ done (2026-06-29)**
- Separate FSRS study queue for JLPT grammar points, fully independent of the vocabulary queue. Source data: `decks/grammar-n3.md`: 220 grammar points across 22 lessons (§4.1). Schema designed to accept N5–N1 grammar decks later without migration.
- **Schema:** `GrammarPoint` (`level` stored as plain `String`, not the `Level` enum) and `GrammarProgress` (FSRS fields mirroring `ReviewState`; composite unique on `[userId, grammarPointId]`). `CardLike` interface extracted from `src/lib/fsrs.ts` so the FSRS adapter functions are shared between vocab and grammar with no duplication.
- **Seed:** `scripts/seed-grammar.ts` parses `decks/grammar-*.md` and upserts grammar points idempotently keyed on `(level, lesson, position)`.
- **API:** `GET /api/grammar/queue` (due + new, same two-pool strategy as vocab); `POST /api/grammar/review` (FSRS rating → upsert `GrammarProgress`). Both auth-required. **Superseded 2026-07-26:** the queue route now serves refetches only and returns a flattened payload, and the review route was retired in favour of the `rateGrammarPoint` / `undoGrammarRating` actions (§9.1, §9.2).
- **Card shape:** front = grammar pattern (large JP); back = reading (if it differs from pattern) + comma-joined meanings + example sentence (pattern bolded in grape) + English translation. No undo in v1; **undo added 2026-07-26** with the `GrammarReviewLog` table that made it possible (§6, §14.24).
- **`/grammar` hub page:** inline FSRS stats (total/started/mature/due); single "Grammar Points" CTA; an inline `LevelPicker` (added 2026-07-26) so the level can be changed without a round trip through `/home`, which matters more since that round trip became a one-way door (§14.14). Rows for levels with no seeded deck are *marked* ("no deck yet"), never disabled, because the picker sets the global `activeLevel` that vocabulary study also reads; the marked set is derived from the table via `getSeededGrammarLevels`, not hardcoded to N3, since the restriction is a property of what has been imported rather than of the design. Vocab stats remain on `/stats`. Grammar also got a `BottomNav` tab here, removed on 2026-07-25 when the mode grid on `/home` made it redundant (§8.5, §14.8).
- **`/onboarding` page:** level-choice screen shown to any user whose `UserProfile.onboardedAt` is unset (both magic-link sign-ups and demo visitors). Pulled forward from the multi-user phase to support the demo flow. The follow-on Quiz warm-up and guided tour stay there (Phase 5 below).
- **Demo session (`/api/demo/login`):** ephemeral try-without-signup path; creates a new `User` + `UserProfile`, signs the userId with HMAC-SHA256, sets a 7-day cookie, and redirects to `/onboarding`. Production-available; since hardened to POST-only with a signed expiry, rate limiting, and origin checking (§11.8, 2026-07-10).

**Phase 3.5 addendum: Grammar browse + lesson titles. ✅ done (2026-07-01)**
- **`lessonTitle` column added to `GrammarPoint`** (migration `20260701130743_grammar_lesson_title`), denormalized from the source file's `## Lesson N – Title` heading the same way `level` is denormalized, repeated per row so a browse view can group and label lessons without a second lookup.
- **`GET /api/grammar/browse?level=`**: auth-gated, returns every grammar point for a level grouped into lessons in one payload (unlike `/api/browse`'s per-word lazy-load: grammar's ~220-row dataset is small enough to ship whole). `Cache-Control` mirrored `/api/browse`'s 1 h / 24 h values as of this phase; the two diverged on 2026-07-26 when the vocab route shed its per-user field and `/grammar/browse` moved to a server render (§9.3).
- **`/grammar/browse` page + `GrammarBrowseClient`:** collapsible per-lesson accordion (collapsed by default; 22 open lessons would be an unreasonable scroll), search box filters by pattern/reading/meaning and force-expands matching lessons. Reachable via a "Browse all grammar points" button on `/grammar`.
- **Seed script now prunes stale rows:** after upserting the freshly parsed file, it deletes any `GrammarPoint` row for that level whose `(lesson, position)` no longer appears in the file. Content gets renumbered across edits (a lesson's item count changes, a point moves to a different lesson), which otherwise leaves orphan rows behind under the old key; upsert alone can't catch these since the parser no longer produces them at all. Pruning cascades to `GrammarProgress` (`onDelete: Cascade`), so any in-progress FSRS state on an orphaned point is lost, acceptable for a single-user app, chosen over leaving orphans so the DB stays an exact mirror of the source file.

**Pre-migration hardening: headings, policy pages, and pinning `src/lib`. ✅ done (2026-07-27)**

The three workstreams that were live while everything else waited behind the two gates, grouped because they share one property: **each survives the port.** Deliberately unnumbered, following the precedent below.

- **Every route has one `<h1>` and one title** (§8.4). Six screens had no heading, including `/home`, the app's default page; five never set a title. Each is a requirement statement that carries into any framework unchanged.
- **Three smaller UX items** (§8.4, §9.3): paging `/browse` returns to the top of the list, its result count announces a settled value rather than one per keystroke, `/stats` gains the shared level picker, and `/grammar/browse` gains an in-page error boundary so a failed query no longer takes the whole page down.
- **`/privacy` and `/terms` published** (§11.10), with the demo-data retention promise they state now backed by a scheduled sweep (§11.8) and a Railway cron service (§12). Mostly prose about what the service does, so it re-hosts rather than gets rewritten.
- **`src/lib` pinned with 158 characterization tests** (§12.1), up from one file covering the FSRS adapter. This is the migration prerequisite rather than a cleanup task: `src/lib` is the code that copies across close to verbatim, so it is the code whose behaviour has to be pinned *before* it moves, and the suite is the port's acceptance gate. Two findings surfaced and are recorded in §15 rather than fixed mid-freeze.

**Framework migration to Nuxt (decided 2026-07-26). ▶ next**

- Greenfield Nuxt application in the same repository, taking over the production URL at cutover; scope and reasoning in §5.2, rejected alternatives in §14.26, sequenced checklist in TODO.md.
- **Includes a redesign of the data model** (§6), unconstrained by the existing schema and, since 2026-07-27, by the existing data: the production database is reset at cutover rather than migrated, so the new one is seeded from `decks/` and the local sentence cache exactly as the first one was (§12).
- **Blocked on bayan reaching production, deliberately** (§4.3, §14.27). The migration does not begin until bayan publishes N5–N3 vocabulary with example sentences, its grammar index, and a non-empty dataset release, so the new application is seeded from bayan on its first run and never from a corpus already scheduled for deletion. `decks/*.csv`, `scripts/import-csv.ts` and the §7 pipeline are retired at this milestone's cutover. Accepted cost: this project's schedule is a function of bayan's, tolerable because the author's exam is complete and no study depends on this app in the interim.
- **The imported-question milestone below is largely absorbed into this one.** With bayan supplying the entire corpus, being its reference consumer is how the application is seeded rather than a feature added afterwards; what remains separately sequenced is the Kalima mock-exam half.
- **This milestone and the imported-question milestone below are now sequenced, in that order**, and every numbered phase from Phase 3 onward is deferred behind both. The ordering argument is that work performed on the Next.js implementation before the migration is either discarded or performed twice, while Kalima's own stack is already Nuxt/Nitro, so migrating first converts most of that port from a rewrite into a move.
- **Two decisions are pulled forward into this milestone** because the data model cannot be designed without them: the Exam-mode overlap question (§15), which determines the shape of the question store, and the authentication-library replacement (§15), which determines the shape of the auth tables.
- Deliberately unnumbered, following the precedent set below: a number asserts a position in the original sequence, and this milestone interrupts that sequence rather than extending it.

**Phase 3: MC↔FSRS coupling. ⏸ deferred behind the migration**
- Make Quiz and Flashcard genuinely complementary rather than parallel: a multiple-choice answer writes an FSRS rating (correct ≈ Good, wrong ≈ Again) through the existing `POST /api/review`, and Quiz target selection is informed by FSRS state (a split between near-due review words and never-seen ones). Resolves open question #1 (§15).
- No schema change: reuses `ReviewState`, `ReviewLog`, and the existing write path, which is now the `rateCard` Server Action rather than a review endpoint (§9.2), and `buildQuizRound` rather than the route handler for the source split (§8.2). The calibration choice (correct → Good or Hard, given that multiple choice is recognition rather than active recall) is to be recorded in [DECISIONS.md](DECISIONS.md) when it is made.
- This also supersedes the "non-scheduling first-run warm-up" framing in §8.2: once the first quiz session seeds FSRS, the warm-up *is* the coupling.

**Phase 4: Admin audit + on-demand generation. ⏸ deferred behind the migration**
- **Admin review/audit page** (admin-gated via `UserProfile.role`): inspect each AI-generated example sentence and accept or reject it before it surfaces to learners (adds a review-status field to `ExampleSentence`; optionally generate several candidates per word and keep the best).
- **On-demand `/api/generate`** + study-UI fetch-on-flip for any not-yet-seeded words, with the §11.4 guardrails (auth + rate-limit + cache-first + bounded `max_tokens`).

**Phase 5: Multi-user**
- Widen/remove the email allowlist; real `User` rows; authorization checks scoping all reads/writes by `userId`.
- Per-user settings are **intentionally minimal** (see §16); multi-user does not imply a settings page. The active level (already inline on `/home`) is the only planned user-facing control; all other parameters (`newCardsPerDay`, FSRS retention target, study direction) remain author-set defaults.
- **First-run onboarding completion (§8.5)**: the `/onboarding` level-choice screen already exists (Phase 3.5); what remains here is the follow-on: a **5-question Quiz warm-up** (non-scheduling) and a **guided tour** of the app. Uses the existing `UserProfile.onboardedAt` column to branch first-time vs. returning. Deferred because the warm-up and tour only earn their keep once there are multiple real users to onboard (the sole author is already past it).

**Phase 6: Further enhancements**
- Audio (TTS) for sentences, furigana rendering, the full stats dashboard (streak/heatmap, history, charts; §8.5), sentence regeneration/voting, export back to Anki. (Installable-PWA *basics* (manifest, icons, fullscreen + safe-area) were pulled forward to 2026-06-04, §8.4/§16; the **offline shell / service worker** is what remains here.)

**Kalima absorption + bayan/zaka consumer (decided 2026-07-26; sequenced after the migration, and split, on the same date)**

Kalima's JLPT mock exam moves into this app, and this app replaces Kalima as the named reference consumer of the bayan/zaka dataset. Both land in one new question store (§4.2).

- **Sequenced immediately after the migration milestone above, and split in two.** The **consumer half** (import a pinned dataset release, validate it, and grade an imported question into `ReviewState` end to end) follows the migration directly, so it is built once in the final framework. The **Kalima mock-exam half** (the timed sitting, the per-type radar, the passage set, the wrong-answer queue) is deferred further, as feature scope rather than integration scope. What keeps them one milestone is the shared question store; what separates them is that only the consumer half establishes the reference-consumer claim.
- **No phase number yet, on purpose.** A number asserts a position in the original numbered sequence, which both this milestone and the migration interrupt rather than extend.
- **It is coupled to Phase 4, which affects sequencing.** Kalima's S-F rank review folds into the Phase 4 admin page under `UserProfile.role` rather than porting Kalima's separate `ADMIN_PASSWORD` path. Shipping Phase 4 first therefore means building that admin surface twice.
- **Scope, in five parts** (checklist in TODO.md): the question store and its migration; the port from Kalima (answer secrecy first, then the four session endpoints, the budget and throttle, the timed session and per-type radar, the wrong-answer queue, the `wordId` remap via Anki `guid`, and the passage set); the public-access decision (§15); the bayan import path with pinned release tags and a CC BY 4.0 attribution surface; and the doc housekeeping this section is part of.
- **Prerequisite, not a cleanup task.** The in-memory rate limiter (§11.3 #5) is documented as acceptable on the grounds that this is a single instance with no spend behind any route. A budgeted analysis endpoint removes that third condition, so a durable limiter and budget store are a precondition of shipping it, not a follow-up (§11.4).
- **Acceptance test for the consumer role:** an imported question graded end to end into `ReviewState`. Anything short of that makes the "reference consumer" claim decorative.

---

## 14. Alternatives considered

### 14.1 Separate backend API (Rails or standalone Node) + Next.js frontend
**Rejected for the initial release.** A dedicated API tier is the right call when multiple independent clients share a backend, when a heavy background-worker fleet is required, or when the backend has a scaling/resource profile incompatible with the web tier. None apply here: there is a single client (our own UI), the only long job is offloaded to Anthropic's Batch API, and every operation is a DB query or a single LLM call. A split would roughly double operational surface (a second service, build, deploy, and inter-service auth) and add a network hop and failure domain for no capability we need. Because the data model and generation design are framework-agnostic, extracting a service later remains possible if requirements change (§5.1).

### 14.2 Seeded static password instead of magic link
**Rejected.** A seeded password introduces a long-lived shared secret the app must store, rotate, and keep out of source control and logs (a common leak vector), and would in practice be backstopped by email-based reset anyway, making the inbox the real security boundary. Passwordless magic links delegate directly to that stronger boundary and remove the redundant secret (§11.2). A properly hashed, rate-limited password is acceptable in principle, but strictly inferior here given Resend is already available.

### 14.3 On-demand-only sentence generation (no seeding)
**Rejected as the primary path.** Generating purely on first view eliminates upfront cost but adds latency to first views and forgoes the ≈50% Batch discount for the bulk fill. We retain it only as a fallback for cache misses (§7.4).

### 14.4 Service-worker / offline support shipped with the PWA basics
**Deferred (not rejected).** When making Bayana installable (manifest + icons + fullscreen, 2026-06-04), the option was to also add a Workbox-style service worker (e.g. `@serwist/next`, the maintained `next-pwa` successor) to precache the app shell so it opens offline. It was deferred because the install/fullscreen goal (a chrome-free, edge-to-edge study session) needs **no** service worker, while a SW adds a real maintenance surface (cache-versioning and invalidation, stale-asset bugs, extra Turbopack/Next 16 integration risk) for little benefit on an always-online, single-user app. The manifest alone is enough for an Android install; iOS "Add to Home Screen" likewise needs no SW. Offline support can be added later (§13 Phase 6) once there is a concrete offline use case. Also considered and rejected for the same release: the browser **Fullscreen API** (`requestFullscreen`) to force a single route truly fullscreen; it is unsupported on iPhone Safari, so it is not a portable answer, whereas the manifest `display` mode covers Android cleanly.

### 14.5 `isDemo` column on `User` instead of a heuristic cleanup filter

**Rejected (for now).** The opportunistic demo-user cleanup (§11.8) must identify rows that are certainly abandoned demo sessions, because a wrong match cascade-deletes real study progress. An explicit `isDemo: Boolean` column would make that identification trivial and self-documenting, but requires a migration and backfill for a property that is already fully derivable: demo users are exactly the users with `email IS NULL`, no Auth.js `Session` rows, and (for deletability) a `createdAt` older than the cookie TTL, excluding the local seed user's pinned id. The heuristic filter was chosen because it needs no schema change and each condition independently excludes a class of real user. Revisit if the demo flow grows features (e.g. demo-to-real account upgrade) that make "is a demo user" load-bearing beyond cleanup.

### 14.6 `SELECT … FOR UPDATE` row locking instead of serializable transactions

**Rejected.** The review write path (§8.1) is a read-modify-write: read the FSRS row, compute the next card state in JavaScript (`ts-fsrs`), write it back. Under Postgres's default `READ COMMITTED` isolation, two concurrent reviews of the same card both read the same prior state and the second write silently discards the first (a lost update). Explicit row locking (`SELECT … FOR UPDATE`) fixes this by serializing at the row, but in Prisma it requires `$queryRaw`, abandoning the typed query API precisely on the app's most correctness-sensitive path. Instead, the transaction runs at `SERIALIZABLE` isolation with a bounded retry on Prisma error `P2034` (serialization conflict), wrapped in a shared `serializableTxn()` helper in `src/lib/db.ts`. Contention on a single user's single card is near-zero, so retries are vanishingly rare and the stronger isolation costs nothing in practice; the helper's contract (the callback may run more than once; queries inside must be sequentially awaited, since an interactive transaction holds one connection) is documented at the definition.

### 14.7 Demo sessions skipping onboarding entirely

**Rejected.** When the home hub became the app's default page (§8.5, 2026-07-25), an option was to send `POST /api/demo/login` straight to `/home` with a preset level (N3, the only fully-seeded grammar level), on the grounds that a reviewer evaluating the app wants the shortest possible path to seeing it work. It was rejected because the active level scopes every engine, every count, and the hub's progress bar: a demo user who never chose N3 would be shown a Today panel and a progress bar describing a level picked for them, which is a worse first impression than one extra tap. The level choice is also the app's clearest statement of what it is (a JLPT tool, N5 to N1), so it doubles as orientation. Author decided; deciding factor was that onboarding is a single tap and is itself informative.

### 14.8 Grammar as a permanent `BottomNav` tab

**Rejected.** Grammar had a tab of its own from Phase 3.5, and was promoted to the leftmost tab on 2026-07-02 when `/grammar` became the post-login landing. With the hub restored as the default page and carrying all four modes (§8.5), the tab was removed instead of kept alongside the new Grammar tile. Keeping it was the conservative option and would have saved a tap when navigating from `/stats` or `/browse`, but the tab bar then listed three *places* plus one *study mode*, which both mixed categories and implied Flashcard, Quiz, and Exam had been deliberately excluded. The accepted cost: `/grammar` is a page with no corresponding tab, so no tab highlights while the user is on it. That is a standard sub-page condition and was judged the smaller wart. Author decided.

### 14.9 Kalima's `ExamQuestion` shape for the imported question store

**Rejected** in favour of bayan's `ExportedQuestion` shape (§4.2), decided 2026-07-26 before any of the table was written. Kalima's model is the one with 496 rows already in it, so reusing it would have made the port a copy rather than a translation. It lost because its five question types are a strict subset of bayan's 22-value `question_type` enum (`reading` maps to `read-kanji`, `orthography` to `pick-spelling`, `contextual` to `word-choice`, `synonym` to `same-meaning`, `usage` to `right-sentence`), so adopting it would have meant migrating the table again on the first dataset import, and a second time for reading and listening once `stimuli` and `provenance` were needed. Following the publisher's shape instead makes both sources the same row from the start, with `source` as the only discriminator. The cost accepted: the 496 seed rows are rewritten on the way in rather than copied, and this project now tracks an external schema it does not control, so a bayan schema change is a migration here.

### 14.10 Hosting the mock exam in Kalima rather than absorbing it

**Rejected.** Kalima already has the mock exam, a public homepage that recruiters land on, and its own admin path, so leaving it there was the zero-work option. It lost on capability: Kalima is N3 vocabulary only across five question types, while this app already models N5 to N1, holds ~8,100 words plus a grammar table whose `pattern` matches bayan's `grammar_points`, and has an FSRS scheduler that can turn a graded question into a review schedule. Only the last of those makes the reference-consumer role mean anything, since grading into a real scheduler is what a dataset publisher wants demonstrated. The cost accepted: Bayana stops being a single-purpose vocabulary trainer (§2), Kalima loses its main feature, and this repo takes on a public surface it did not have if the mock exam stays open to visitors (§15). Author decided.

### 14.11 Alternatives weighed in the 2026-07-26 accessibility pass

Four forks surfaced while fixing the contrast and focus defects found in the BRAND.md review (§8.4). Each is recorded because the rejected option is the one a later reader is likely to reach for again.

**A new tertiary token instead of darkening `--ink-faint`. Rejected.** `--ink-faint` (`#9a8597`, 3.25 : 1) was documented as a disabled/hints value but used as tertiary body text at ~60 call sites. Adding a compliant `--ink-tertiary` and leaving `--ink-faint` alone would have preserved the token's documented meaning, but it requires auditing all 60 sites to decide which meant "disabled" and which meant "quiet", and it leaves a failing token in the palette for the next author to reach for. Darkening the token in place to `#7d6a7a` (4.8 : 1) fixes every site at once and costs only a small loss of contrast *range* between `--ink-soft` and `--ink-faint`. The palette gains a rule instead of a token: the ramp is three steps and its last step is the AA floor.

**Padding the small controls to 44px instead of `.tap-44`. Rejected.** The honest reading of the ≥ 44px rule is to make the control 44px. It was rejected for the two places it applies: a 44px-tall session header adds ~25px of chrome to a screen whose entire purpose is the card below it, and a 44px-tall JLPT chip stops reading as a chip and starts reading as a button, which changes the meaning of a level row. The `.tap-44` overlay is the standard "expand the target past the visual bounds" technique and resolves the two. Its expansion is **vertical only**, which was itself a fork: a full 44 × 44 overlay on a horizontal chip row would make adjacent level buttons overlap, and a mis-tap that selects the *wrong level* is worse than a target that is narrow but unambiguous. Horizontal reach is met by giving chip rows real padding instead.

**Tuning the inactive-chip opacity to a passing value instead of removing it. Rejected.** Inactive JLPT chips were dimmed (`0.55` on the home picker, `0.45` on browse), which composited the white-text chips to ~3.2 : 1 and ~2.5 : 1. A safe alpha exists (~0.8 measures 5.1 : 1), but it is a magic number that holds only for the current five chip colours and would silently break if a chip's fill changed. Removing the dim entirely and carrying selection with a ring plus a slight scale (the pattern the onboarding picker already used) eliminates the failure mode rather than parameterising it, and the rows already read as inactive from their cream fill and `--ink-soft` label.

**Leaving the level-chip ring colour as `currentColor`. Rejected.** `currentColor` resolves to white on `.chip-n5` and `.chip-n2`, so a ring drawn in it disappears against `--paper`. The onboarding picker had already discovered this and carried a local `RING_COLOR` override; the browse picker needed the same map. Rather than copy it, both now import `src/components/level-chip.ts`. A duplicated contrast rule is a contrast bug with a delay on it: the second copy is the one nobody updates.

### 14.12 Font delivery, and the alternatives rejected on the way to `next/font`

**Decided: self-host via `next/font/google` (landed 2026-07-26).** The chosen design is stated in §8.4; this section records what it was chosen over. Measurements below come from production builds of the commit before and the commit after the migration.

| | Before (`@import`) | After (`next/font`) |
|---|---|---|
| Page CSS, gzipped | 6.0 KB | 72.8 KB |
| Third-party stylesheet, gzipped | 91.5 KB | none |
| Total render-blocking CSS | 97.5 KB | 72.8 KB |
| Serial steps to first font byte | 4 | 2 |
| Third-party origins contacted | 2 | 0 |
| `@font-face` rules served | 405 | 260 |
| `.next/static` | 807 KB | 4.4 MB |

**Keeping the `@import` in `globals.css` (the status quo) was rejected.** It is the slowest available entry point: the browser cannot discover the fonts until `globals.css` has itself downloaded and parsed, so the sequence was HTML, then our CSS, then the `fonts.googleapis.com` stylesheet, then the `fonts.gstatic.com` files, with a DNS and TLS setup for each of the two third-party origins. Google also serves that stylesheet `cache-control: private, max-age=86400`, so a returning visitor re-fetched 91.5 KB gzipped before a single font byte could be requested, and `private` prevents any shared cache from absorbing it. The frequently cited counter-argument, that visitors arrive with Google Fonts already cached from other sites, has not held since HTTP cache partitioning shipped in 2020.

**Bundling this migration into the 2026-07-26 weight trim was rejected** (historical; the constraint no longer applies). The trim was a one-line change with a measured saving and no behavioural risk, while the migration touches the CSP, the build, and every font declaration. Landing them together would have meant neither could be reverted alone.

**Preloading the Japanese subset was rejected.** `next/font` emits a `<link rel="preload">` for every file belonging to a declared subset, and Google chunks CJK into roughly 126 `unicode-range` slices per weight. Preloading them would have the browser eagerly fetch the entire Japanese range on every page in order to paint a handful of glyphs, which is materially worse than the on-demand fetching the migration replaced. The JP face therefore sets `preload: false`, verified against the build: `next-font-manifest.json` lists exactly two preloadable files (the Latin faces of Fredoka and Nunito) and no Japanese file.

A related unknown recorded here because it cost investigation time and reads the other way round from the documentation: `next/font` never sends a `subset` parameter to Google. It requests the full stylesheet and self-hosts **every** face in the response, so `subsets` selects only what is preloaded. This is why the JP face can omit `subsets` entirely, which matters because next/font's bundled metadata for M PLUS Rounded 1c does not list `japanese` as a subset at all: naming it is a build error, and omitting it costs nothing once preloading is off.

**Listing static weights for Fredoka and Nunito was rejected** in favour of their variable fonts. Both families ship a variable version (weight axes 300 to 700 and 200 to 1000 respectively), so omitting `weight` yields one file per subset covering the whole range instead of the four and three static instances previously requested. This also retires the maintenance burden the trim created for the Latin faces: any weight in range now works without a corresponding entry in a request URL. Fredoka's `wdth` axis is excluded, since next/font omits non-weight axes unless they are named and the design never varies width.

**A third Japanese weight was rejected** (author's call, taken in this pass; the question was left open by the previous one). M PLUS Rounded 1c 800 was loaded and used at five display sites. Dropping it removes about 126 `@font-face` rules, roughly a third of the Japanese CSS, and those five sites moved to 700. Retaining it would have been the more expensive half of the JP face for a difference visible only on large headwords. The five sites had to move rather than merely lose the weight: a `font-weight: 800` with only 400 and 700 loaded is synthesised by the browser as a faux-bold off 700, which is worse than 700 itself.

**One expected benefit is not currently realised, and the design does not depend on it.** `adjustFontFallback` is documented to emit a metric-matched `local("Arial")` fallback face carrying `size-adjust` and `ascent-override`, which would reduce layout shift when a face swaps in. Verified against a real Next 16.2.7 build, the Turbopack implementation of `next/font` emits no such face (and, unlike the webpack code path, does not hash family names). The option is left at its default so the benefit accrues automatically if Turbopack gains it, but the case for the migration rests on the request-chain and caching results above, not on layout shift.

**Accepted costs.** `.next/static` grows from 807 KB to 4.4 MB, because all 261 self-hosted `.woff2` files ship in the image whether or not a given deploy serves them; this is negligible against a Node image and is not transferred to the browser, which still fetches only the chunks a page needs. The build also acquires a network dependency on Google, since the faces are downloaded during `next build`; Next caches them under `.next/cache`, so the exposure is cold builds. Both were judged acceptable against removing a runtime third-party dependency from every page load.

### 14.13 Route-state coverage: the shapes rejected on the way to a two-tier loading design

**Decided: a generic root fallback plus layout-shaped skeletons on the three hub pages (landed 2026-07-26).** The chosen design is stated in §8.4; this section records what it was chosen over. The forcing constraint is that a root `loading.tsx` creates a Suspense boundary around *every* route lacking one of its own, so the choice is not "which pages get a loading state" but "which pages get the *good* one".

**A root fallback alone was rejected.** It is the cheapest option and it does close the literal gap, but a centred spinner is not a loading state so much as a placeholder for one: it shares no geometry with the page it precedes, so the transition is a swap rather than a resolution, and on a hub whose content is a fixed grid of known dimensions that discards information the app already has. It also inherits the marketing homepage, which awaits only a session lookup and would flash.

**Per-page skeletons with no root boundary was rejected**, despite avoiding that flash on `/`. It leaves the session routes (`/study`, `/quiz`, `/exam`) painting nothing while the server builds a queue, which is the app's most data-dependent work, and it makes coverage a property of who remembered to add a file: every future route would ship uncovered by default. Having both means the weak fallback is a floor rather than the design.

**Skeletons that restate the page's own copy were rejected**, which is why placeholder fidelity stops at dimensions. The mode tiles' titles and subtitles are the tempting case: reproducing them would make the hub skeleton near-indistinguishable from the loaded page. It would also create a second copy of that copy in a file nobody opens, and the first subtitle edit would silently desynchronise it. Text the server does not need to compute is instead rendered *for real* rather than mocked, which gets the same benefit without the duplicate.

**Leaving `BrowseClient`'s existing loading text alone was rejected** once the sequencing was traced. Browse has two consecutive waits, and the short one (auth plus active level, on the server) precedes the long one (the level's entire word list, over the network). Giving only the first a skeleton would have made the page visibly *regress* mid-load, from a laid-out placeholder to a line of centred text. Both now render the same `WordListSkeleton`, so the placeholder paints once and simply persists.

**An animated shimmer sweep was rejected** in favour of an opacity pulse. A translating gradient repaints a large area every frame, which is the wrong work to schedule on a low-end phone precisely while the response the skeleton exists to mask is still in flight.

### 14.14 Disabling the Grammar tile, and what that costs

**Decided: disable the tile on any level with no seeded deck (landed 2026-07-26, author's call).** This reverses the rule recorded in §8.5 on 2026-07-25, which held that no mode tile may ever be disabled. Recording the reversal rather than quietly editing the rule, because the reasoning behind the original still holds and is now an accepted cost rather than a refuted argument.

**The original rule's premise is unchanged and was verified again before the reversal.** The hub tile is the only UI path to `/grammar`: `BottomNav` lists Home, Stats and Browse (§8.5), and every other link to `/grammar` is *inside* the grammar section, reachable only once you are already there. `pickNextAction` is not a substitute, because `getGrammarStats` scopes `total`, `started`, `dueNow` and `studiedTodayCount` to the active level, so a non-N3 user's `grammarDue` is 0 by construction and the routed CTA never points at grammar. The consequence follows directly: a user who studies N3 grammar and then switches level has no route back to it except switching level again, and their reviews accumulate with no visible signal.

**Partially mitigated, later the same day, by the grammar hub's own level picker** (§13 Phase 3.5). Switching level *while on* `/grammar` now keeps the user there, so the round trip that used to cost a navigation is gone and the level can be switched back immediately. This does not close the hole: the one-way door is leaving `/grammar` first and changing level from `/home`, after which the tile is dead and there is no route back. The picker narrows the window; only the `GrammarProgress` condition below removes it.

**Chosen against the alternative of leaving it live.** A tile that is fully styled as actionable on four of five levels, where it leads to a hub that can only say "nothing here", spends the hub's credibility on every level except one. The author judged a wrong-looking-but-honest tile worse than an unreachable section, on the grounds that this is a single-user app whose owner knows the level switch exists, and that the N3-only deck is itself temporary (§4.1).

**Two narrower options were offered and declined**, and are recorded because they remain available if the stranding ever bites. (a) *Disable only when the user has zero `GrammarProgress` rows at any level*, which produces an identical dead tile for anyone who has never touched grammar while keeping the door open for anyone with history to lose; it costs one extra unscoped count on the hub. (b) *Keep the tile live but style it recessive*, signalling unavailability without removing the route. The author chose the flat condition for its simplicity.

**The disabled styling does not use `opacity`.** BRAND.md §3 forbids compositing a passing contrast pair with alpha, which is exactly how a conventional "greyed out" control drops below AA. The tile instead loses elevation (paper fill instead of white, no shadow) and steps its text down the ink ramp to `--ink-soft` / `--ink-faint`, both of which clear 4.5 : 1. The emoji is greyscaled rather than faded, which is safe because it is decorative and carries no contrast obligation. It renders as a plain `div`, not a disabled `button` or a dead `Link`: there is no action to make unavailable, so announcing a control that never existed would be worse than announcing none.

### 14.15 `UserMenu`: disclosure rather than an ARIA menu

**Decided: convert the account dropdown to a disclosure (landed 2026-07-26, author's call).** It had declared `role="menu"`, `role="menuitem"` and `aria-haspopup="menu"` while implementing no key handling at all, so a keyboard user could open it and have no way out: Escape did nothing, focus was neither moved nor restored, and the only dismissal was a pointer tap on the backdrop.

**Two ways to make that honest, and the trap is closed either way.** The role could have been kept and honoured, or dropped to match the widget. The panel holds one action (Sign out / End demo) plus a line of account text.

**Implementing the full menu pattern was rejected.** The APG menu contract is Up/Down between items, a roving `tabindex`, Home/End, Tab-closes, and focus moved into the menu on open: roughly sixty lines of machinery to navigate a single item. It also would not have fixed the second defect on its own, because the account header would still need to move out of the panel: a bare `<p>` is not a `menuitem`, `group` or `separator`, and a screen reader is entitled to discard invalid children of `role="menu"`, so the user's own email address was at risk of never being announced.

**The disclosure was chosen because it describes what is actually there.** The trigger owns `aria-expanded` and `aria-controls`; the panel is ordinary content, which makes the header readable again, and Tab reaches the one button unaided because the panel follows the trigger in DOM order. Declaring a menu role advertises a keyboard contract to assistive technology, and advertising one the component cannot honour is itself the accessibility defect, not merely an unfinished feature.

**Three exits, deliberately.** Escape (bound at document level, so it works whether focus is still on the avatar or already inside the panel, and it restores focus to the avatar), focus leaving the widget (a `focusout` check on the wrapper, which is what tabbing past the last control means, and without which the panel stays open behind a keyboard user while its backdrop keeps swallowing pointer clicks), and the original backdrop tap. `aria-controls` is emitted only while the panel exists, since pointing at an absent id is a dangling reference.

### 14.16 A uniform API surface, either all route handlers or all Server Actions

**Rejected in favour of the split in §9** (reads are route handlers, writes are Server Actions), decided 2026-07-26 while planning the move of session data-fetching onto the server. Both uniform options were genuinely available, and uniformity has real value: a mixed surface means a reader has to learn a rule before they can predict where a given operation lives.

**All Server Actions. Rejected on the read path.** It is the tidier-sounding option and would delete seven route handlers. It loses three things the reads actually use. (a) *HTTP caching*: an action is always a POST and is never cached, so `/api/browse`'s `private, max-age=3600, stale-while-revalidate=86400` and `/api/words/[id]/sentence`'s 24-hour window (§10) would have to be re-implemented as application state, replacing a browser primitive that already works with code that can be wrong. (b) *Imperative refetch*: "Check for more", the load-failure retry, and "Play again" all re-request a queue from an already-mounted client component. An action can serve that, but a cacheable GET is the better fit and is what those paths were built against. (c) *Inspectability*: a route can be exercised with `curl` while developing; an action's endpoint id is generated at build time and is not a stable address.

**All route handlers (the status quo). Rejected on the write path.** Keeping every mutation as a handler preserves uniformity at the cost of a hand-maintained JSON contract on both sides of each write, with no type checking across the boundary, plus the per-route ceremony of parsing and re-validating a body that the caller had in typed form a moment earlier. It also does not compose with a React transition as directly, which matters because the optimistic rating loop is the change these routes were being touched for.

**The cost accepted is the rule itself.** §9 states it in one line, and both tables name it, so the mixed surface is documented rather than discovered. The classification is deliberately "does this mutate or spend" rather than "was it a POST", which is why `/api/demo/login` stays a route handler: it is a public, origin-checked, rate-limited entry point, not an in-app mutation. Author decided; the deciding factor was that the two read routes carrying `Cache-Control` headers are the ones a uniform-actions design would measurably make worse.

### 14.17 Adopting Next.js 16's opt-in rendering features (`cacheComponents`, View Transitions, React Compiler)

**Declined for now, 2026-07-26, and recorded rather than left unexamined**, because all three are the features a reader of this codebase would reasonably expect a Next.js 16 app to be using, and "we never got to it" and "we chose not to" are different facts.

**What each would have bought.** `cacheComponents` (a top-level config key in 16.2.7, which subsumes Partial Prerendering and is the gate for the `use cache` directive) would prerender the static shell of every page and stream only the user-specific holes; today every route is fully dynamic because `requireAuth()` reads cookies at the top of the tree. It would also make the word-list query cacheable across requests, which is the single largest avoidable database read in the app: `db.word.findMany({ where: { level } })` is identical for every user and changes only when the deck is re-seeded. `experimental.viewTransition` would animate the card flip and the hub-to-session navigation, the two moments where a mobile-first PWA most wants to feel native. `reactCompiler` (also top-level) would retire the hand-written `useCallback` memoization in the session components.

**Declined on deployment risk, not on merit.** Bayana is live on a single Railway instance and is the author's daily study tool, so an opt-in rendering feature turns a routine `next` minor bump into a potential outage of the thing being used to study. Only `viewTransition` still sits under the `experimental.` namespace in 16.2.7; the other two have graduated to top-level keys but remain opt-in with evolving semantics, and the namespace is not the risk being avoided.

**One consequence follows immediately and is worth naming**, since it looks like an unrelated omission later: `use cache` is unavailable without `cacheComponents`, so the caching work uses React's `cache()` instead. That is a strictly smaller tool (request-scoped memoization, no cross-request cache) but it is stable API, and it addresses the defect actually measured: `getActiveLevel`, `hasOnboarded` and `getNewCardsPerDay` each issued their own `findUnique` for the same `UserProfile` row, so a `/home` render fetched one row three times and each grammar route fetched it twice. All eight read sites now funnel through a single `cache()`d `getProfile` in `src/lib/profile.ts`. **The saving was small when this was written and that was the point of doing it first**, and as of 2026-07-26 it has arrived: `/study` now builds its first queue during the page render (§8.1), so `getActiveLevel` and `getStudyQueue` land in the same request and the memoization pays on the app's most-used screen rather than only on the hub. The same follows for each remaining mode as it is ported; `grammar-review.ts`'s builder still runs in its own request until then. Two properties were verified against React 19.2.4 rather than assumed, and both are what make it safe to call from route handlers and scripts as well as from a render: outside a request scope `cache()` does not throw, it passes through and calls the function, so the behaviour degrades to exactly what the code did before; and because the scope is the request, a profile edit is always visible on the next navigation. The corresponding hazard is that a Server Action and the re-render it triggers can be one request, so a writer that read the row before updating it would seed the cache with the pre-write value; no writer does, and the constraint is recorded at both `getProfile` and `setActiveLevel`. Cross-request caching of the deck stays on the table for whenever the flags are revisited. Author decided; the deciding factor was that the app is in daily use by its author and the three features are additive polish rather than blockers.

### 14.18 Declining study-mode keyboard shortcuts, and Anki's `Space`-rates-Good binding

Two forks on the way to the shortcut map in §8.4, both resolved by the author on 2026-07-26.

**Rejected: declining shortcuts outright.** This was a live option rather than a formality. BRAND.md's platform note makes larger screens "additive breakpoints, never the design center," and a keyboard shortcut is a pure desktop affordance that buys the iPhone SE baseline nothing; on that reading the item was a feature request, not a defect, and closing it would have been defensible. It lost on three counts. The rule exists to stop desktop pulling layout around, and a `keydown` handler costs zero pixels at 375px, so honouring it here would have applied the rule past its purpose. §8.1 states that the card UI "mirrors the Anki templates," and `Space`-to-reveal with `1`–`4`-to-rate *is* the Anki key map, which makes the absence closer to a parity gap than to missing scope. Finally, a document-level handler means a keyboard user never depends on where focus currently sits, which substantially defuses the highest-frequency accessibility defect on the board (focus falling to `<body>` after every answer, ten to twenty times a session) while the fix for it waits behind the frontend-architecture work. That defect still needs its deliberate focus move for screen-reader users; it is no longer the most expensive thing a keyboard user experiences.

**Rejected: `Space` rates *Good* on a revealed card.** Anki's own binding, and the strongest argument for it is that muscle memory transfers whole rather than partially: an Anki user's most-pressed key would do the same thing here. It was declined because the two applications do not carry the same risk. `Space` is also the reveal key, so on a revealed card it changes meaning silently mid-turn, and the failure mode is a `Good` rating written to FSRS for a card the user had not finished reading, a scheduling error that stays invisible until the card fails to come back. Anki users tolerate this because Anki has a deep undo they reach for reflexively; Bayana has a single-step undo on the vocab queue and none at all on grammar (§8.1), so the same slip is cheaper to make and dearer to fix. The cost of declining is precise and accepted: an Anki user's `Space` reflex produces nothing on a revealed card instead of a rating. Rating stays on `1`–`4`, which Anki also binds, so the transferable half of the muscle memory is kept and only the ambiguous half is dropped.

### 14.19 Shapes rejected for the tap-anywhere flashcard

The card must stay tap-anywhere (§8.4, BRAND.md §7), so every option below preserves that; they differ in what carries the tap. Resolved 2026-07-26.

**Rejected: `user-select: text` on the wrapping `<button>`.** The obvious one-line fix, and the reason this item was worth examining rather than patching. It does restore selection in Blink, but it addresses only the first of the three defects: the screen reader still flattens the revealed card into a single button name, and the wrapper is still a focusable control that does nothing once flipped. A one-line fix that resolves a third of a problem while making the remaining two-thirds look handled is worse than no fix, because nothing will bring anyone back to it.

**Rejected: keeping the `<button>` and giving it an `aria-label`.** This makes the screen-reader problem worse rather than better. An `aria-label` on a button replaces its content as the accessible name, so the revealed reading, meaning and example sentence would stop being announced at all instead of being announced badly.

**Rejected: an `onClick` on the plain `<div>` with no button element anywhere.** The cheapest structure, and it does fix all three defects, since there is no control to mis-announce or leave behind. It lost because it puts a real interaction on an element with no role, which is invisible to assistive technology and to tooling, and because it makes the reveal reachable by pointer only as a matter of structure rather than by choice. The overlay costs one element and keeps the interaction in an element that actually is one.

**Rejected: an overlay labelled "Show answer" and left in the tab order.** The overlay is a duplicate of a control the footer already renders. Labelling it would put two identically-named buttons in the accessibility tree for one action; leaving it unlabelled but focusable would put a nameless stop on the Tab path, which is the 4.1.2 failure the change set out to remove. Pointer-only via `aria-hidden` plus `tabIndex={-1}` is the standard resolution: the affordance stays for the finger, and the keyboard and screen reader use the real control.

### 14.20 Alternatives weighed in the 2026-07-26 labelling and live-region pass

Five forks surfaced while closing the labelling and live-region item (§8.4). Each rejected option is the one a later reader is likely to reach for again, and two of them are the *tidier-looking* choice.

**Keeping `role="tooltip"` on the `InfoBubble` panel and making it honest. Rejected.** The role was not merely redundant; it described a different widget. An ARIA tooltip is a hover- or focus-triggered description, referenced from its trigger with `aria-describedby`, and it is not a thing the user opens and closes. Honouring it would have meant driving the panel from `mouseenter`/`focus` and dropping `aria-expanded`, which on a mobile-first app is a regression: the panel exists to be *tapped* open on a phone, where hover does not exist, and its content is a short paragraph with bold runs rather than a one-line hint. Dropping the role instead leaves a plain disclosure, which is what the component already was behaviourally, and reuses the contract `UserMenu` settled on (§14.15). The same reasoning applies in the same direction as it did there: advertising a role whose contract the widget does not implement is itself the defect.

**`aria-live` on the revealed-answer container instead of a separate `sr-only` region. Rejected, and this is the fork most likely to be re-opened**, because it is the design that avoids duplicating visible text into a hidden node, and text duplicated for assistive technology is normally a smell. It fails on mechanics rather than on taste: the answer container is *mounted by the flip*, so the live region and its content come into existence in the same commit, which is exactly the case that frequently goes unannounced. The rule already stated in §8.4 and enforced by the Quiz precedent is that a live region must be in the DOM before it has anything to say, and only a node outside the conditional can be. The accepted cost is that a screen-reader user hears the reading and meaning once from the live region and again if they navigate the card.

**Announcing the whole revealed card, example sentence included. Rejected.** The card body holds the headword, reading, meaning, the Japanese example sentence, its kana reading, and the English translation. Reading and meaning *are* the answer to the recall attempt; the rest is supporting context that stays on screen and can be read on demand. Announcing all six would push a Japanese sentence and a kana transcription through a synthesiser configured for English on every single card, which is why the `lang="ja"` work of 2026-07-10 exists at all, and it would make the announcement longer than the pause between rating one card and revealing the next.

**`role="status"` for the failure message, and mounting it only when there is a message. Rejected on both halves.** Polite was rejected because the message is not status, it is the report that a rating or an undo did not persist, and a polite region waits its turn behind the reveal announcement that has just fired for the same card. Conditional mounting was rejected for the reason above; `role="alert"` inserted with its content does get announced by most current pairings, but relying on that would put two different rules in one file. The wrapper therefore always exists and carries no padding of its own, so an empty one contributes no height to the flex column. This matters more after the optimistic-advance work in TODO.md, where the card advances before the write is confirmed and this message becomes the only signal that anything went wrong.

**Padding the `InfoBubble` trigger to 44px, or reaching for the vertical-only `.tap-44`. Rejected.** A 44px painted circle beside a 13px line of text would dominate the line it annotates, which is the same argument that produced `.tap-44` for the session-header pills (§14.11); and `.tap-44` alone would have left the target 16px *wide*, the same failure it produced on the 36px avatar (§14.19's neighbouring entry in DECISIONS.md). `.tap-44-box` is correct here for a reason worth stating rather than assuming, because its own comment forbids using it in a row: the constraint is about two *hit areas* overlapping, and both call sites place static prose either side of the trigger. A minor related choice: `aria-current="page"` rather than `aria-current="true"`, since the value names what kind of current thing the tab is, and `"page"` is exactly what a navigation tab links to.

### 14.21 Alternatives weighed in the grammar-browse parity pass

Three forks surfaced while carrying `browse-client.tsx`'s fixes across to `grammar-browse-client.tsx` (§8.4). The first is the one the work item itself prescribed, and it was wrong.

**`role="img"` on the studied-count `<span>`, mirroring the vocab progress dot. Rejected, because it cannot work.** The item was written as "the same bug `browse-client.tsx` solved with `role="img"`", and for the grammar progress dot that is exactly right: the dot sits in a plain `<div>` row, so a role that can carry a name makes the label part of the row's text. The lesson-header count is a different case that looks identical. It sits inside a button that carries its own `aria-label`, and an author-supplied name on a control replaces its entire subtree, so "L3", the lesson title and "4/12" were all being discarded before any question of the span's role arose. Marking the child up more carefully would have produced no change in what is announced. The count therefore moved *into* the button's name, and the span keeps only its visible form. The general lesson is recorded in §8.4 rather than here, because the two `aria-label` rules (a name needs a role to attach to; a name on a control replaces the contents) are easy to know separately and easy to miss when they meet.

**Keeping "Expand" / "Collapse" in the lesson-header name. Rejected.** It reads well in isolation and it is what the code did. It is also a second copy of `aria-expanded`, and the copy was already wrong: while a search is active the accordion is force-expanded and the header is `disabled`, so the label announced "Collapse Lesson 3" on a control that could not collapse anything. The disclosure convention, which this app had already adopted for `UserMenu` (§14.15) and the vocab word rows, is that the name says what the thing is and the attribute says what state it is in. That also makes the name stable across a state change, which is one fewer string to keep in sync.

**Replacing the header's `opacity: 0.6` with a token-based recession instead of removing it. Rejected.** This is the fourth instance of the composite BRAND.md §3 forbids (after the session header, the mode tile in §14.14, and the grammar CTA card), and the established remedy is to recede by losing elevation and stepping text down the ink ramp. Here nothing needed to replace the dim at all: the ▼ chevron already unmounts while a search is active, and its absence is the honest signal that there is nothing to toggle. Spending contrast to dim a *search result* is also the least defensible place to spend it, since the reason the row is on screen is that the user asked for it. Removing the alpha returns the `--ink-faint` count from roughly 2.6 : 1 to its measured 4.8 : 1.

### 14.22 Alternatives weighed while bringing the magic-link pages in-house

Three forks surfaced while adding `/auth/verify-request` and `/auth/error` (§11.2). All three are cases where the option that looks more rigorous is the worse one.

**A third hand-copy of the card shell instead of extracting `AuthCard`. Rejected.** The two new screens need the same centred card, the same home-linking wordmark, and the same subtitle line that `/auth/signin` already had, which is roughly twenty lines each. The repo already knows what that costs: `Centered` is byte-identical in four session components and sits in the review backlog for exactly this reason. Extracting first was chosen over extracting later because the later version never happens once three copies exist and have each drifted a little. The component is parameterised only on what the three screens genuinely differ on (mascot mood, its accessible name, the subtitle, the body, and a `below` slot that exists solely because the dev-login shortcut sits outside the card), which keeps it a shell rather than a framework. One consequence stated so it is not read as an accident: the wordmark stays the `<h1>` on all three screens and each screen's own headline is an `<h2>`, since the site is what the page is *of* and the headline is what state it is *in*.

**Explaining `AccessDenied` on `/auth/error` as well as on `/auth/signin`. Rejected.** Auth.js can deliver that code to either screen, so handling it in both is the obvious defensive move, and it produces two screens explaining the same allowlist in slightly different words: the exact shape of drift §14.11 recorded for the duplicated ring-colour map. Only the sign-in page can offer the owner-contact `mailto` beside the message (it is gated on `OWNER_CONTACT_EMAIL`), so it is the screen that should own it, and `/auth/error` forwards instead of competing. The rule generalises: one message, one screen.

**Importing the 15-minute TTL from `src/auth.ts` so the verify-request copy cannot drift. Rejected, and this is the closest call.** The page tells the user the link "expires in 15 minutes and works once", which is a hardcoded copy of `TOKEN_TTL_SECONDS`, and a third copy at that, since the email body states it too. Deriving it would mean importing `@/auth` into the page, which pulls the whole NextAuth config, the Prisma adapter and the provider into a screen that renders fixed prose, and it would cost the page its prerendering: `/auth/verify-request` is confirmed `○ (Static)` in the build output precisely because it depends on nothing. Introducing a tiny shared constants module was the third option and was declined as more machinery than a number in prose deserves. The TTL is fixed by §11.3 item 3 at 10 to 15 minutes and has never changed; the mitigation is that both copies name `TOKEN_TTL_SECONDS` in a comment, so a change is greppable from the place that would change.

### 14.23 Alternatives weighed in the `/study` reference implementation

Four forks surfaced while moving Flashcard mode's reads onto the server and its writes onto Server Actions (§8.1). The reads/writes split itself was settled earlier and is in §14.16; these are the choices inside it.

**Awaiting `buildSession` in the page function rather than in a nested component. Rejected, and it is the one that fails silently.** It is the shape most people write first, because a page that awaits its own data reads naturally and appears to work: the page renders, the card appears. What it does not do is stream. `<Suspense>` only streams what sits *below* the boundary, so an `await` in the page function blocks the entire response and the fallback never renders, leaving a blank screen for exactly as long as the queue takes to build. The nested `StudyQueue` component exists solely to put that one `await` below the boundary. `requireAuth()` and `getActiveLevel()` stay in the page body on purpose: the first is the guard and nothing may render before it, the second is one indexed read of a row `getProfile` memoizes per request (§14.17) that both the fallback and the child need.

**Making undo optimistic too, and dropping its in-flight guard for symmetry with rating. Rejected.** Consistency is a real argument here, and it lost to what the two actions actually do. Two quick ratings address two *different* cards, which is what rapid-fire rating means and is now a supported interaction; two quick undos address the *same* card, and the second finds no log row left to roll back, so it throws and reports a failure for an operation that succeeded once. Undo is also a corrective action taken once rather than twenty times a session, so the round trip is affordable, and rolling back a rollback is materially harder to reason about than rolling back an advance. The guard is a `useRef` rather than state so taking it costs no render, and the button's `disabled` stays bound to the history alone so it cannot flicker mid-tap.

**Retiring `GET /api/cards/queue` along with the two rating routes. Rejected.** With the first payload now built during the render it is tempting to read the queue route as dead code. It is not: "Check for more", "Another session?" and the refetch retry all re-request a queue from a component that is already mounted, which is the imperative case §14.16 kept route handlers for. Both entry points now call the same `buildSession`, so the duplication that would justify deleting one of them does not exist.

**Syncing `initial` into state with an effect instead of seeding `useState`. Rejected.** `useState(initial.cards)` ignores every later value of the prop, which is normally a bug worth a `useEffect` to fix. Here the fix would be the bug: a fresh `initial` mid-session could only come from `/study` being revalidated underneath a session in progress, and the correct response to that is not to swap the user's cards out from under them but to not revalidate, which is what §9.2 already specifies for both rating actions. Seeding once and staying client-owned is what "the card list is fixed at load time" (§8.1) means in code.

### 14.24 Alternatives weighed while porting the three remaining session modes

Five forks surfaced while applying the `/study` reference (§14.23) to Quiz, Exam and Grammar, and while adding the grammar undo and the focus handling that came with them. The shapes already rejected in §14.23 were not re-litigated per mode.

**Storing the prior FSRS state for grammar undo as `prev*` snapshot columns on `GrammarProgress`, or accepting it from the client. Both rejected; a `GrammarReviewLog` table was added instead.** Grammar undo was the expensive part of this change and the only one needing a migration, because `GrammarProgress` holds only the *latest* state and so offered nothing to roll back to. Roughly eight `prev*` columns would have avoided a table, and were rejected as duplicated state that can disagree with itself, single-purpose (useless to the statistics and FSRS re-optimization a log also serves), and structurally unable to grow past one step. Letting the client send the prior state was rejected outright on §11 grounds: an action's arguments arrive from the network and are exactly as untrusted as a JSON body, so this would let a caller write an arbitrary `stability` onto a scheduling row, which is a far worse trade than a table. The log mirrors `ReviewLog` field for field, which means `fromLog`/`toLog` and ts-fsrs `rollback()` serve both queues with **no change to `src/lib/fsrs.ts`**, the adapter having already been entity-agnostic by way of `CardLike` (§13 Phase 3.5). A `revertedAt` tombstone instead of deleting the reversed row was the third option, declined for now as machinery with no consumer, and is noted in §6 as still available. Author decided: the deciding factor was that `u` was the one key the two flip-and-rate queues disagreed on, against a parity §8.4 already called deliberate.

**Focusing the first rating button, or the first option, after a transition. Rejected, and this is the fork that would have introduced a bug while fixing one.** It is the obvious reading of "move focus to the next step", and it is wrong for both flip-and-rate and pick-then-continue: browsers natively activate a focused button on `Space`, so a user who pressed `Space` to reveal and then pressed it again reflexively would have rated the card *Again* without reading it. That is the same hazard §14.18 declined Anki's `Space`-rates-Good binding to avoid, and reintroducing it through the back door while fixing a focus bug would have been a poor trade. Hence the rule in §8.4: a button only for a single unambiguous next step, a `tabIndex={-1}` anchor wherever the next step is a choice. **A corollary was also rejected: anchoring focus near the ratings on reveal.** It is harmless on the `Space` axis, but the reveal fires a polite `role="status"` announcement of the answer, and moving focus in the same commit can cut a screen reader off mid-sentence, so the reveal moves focus nowhere, which costs nothing because the rating keys work from anywhere.

**Three more copies of `study/error.tsx`, one per newly-ported route. Rejected.** A boundary is per-segment, so four files are structurally required and the only question was what is in them; copying ~70 lines of identical mascot, headline, buttons and digest markup three times would have grown the "dedup session components" backlog item while writing it. `SessionError` holds the reasoning once and takes copy as props. The cost accepted is that this refactored a file that had shipped hours earlier. **What was *not* collapsed is the copy**: each route states its own reassurance, because a generic one would be either vague enough to be worthless or specific enough to go stale: Exam may promise it schedules nothing, Quiz may not (Phase 3), and only Flashcard and Grammar can point at a queue build that provably only reads.

**Leaving the section split in `GET /api/exam` and repeating it in the page. Rejected.** It was the smaller diff and looked safe, the split being three lines of `ceil`/`floor`. It is not safe, because `ExamSession` is never told where the sections divide and recovers the boundary from question *order*: two callers splitting differently would not error, they would hand the component a round whose section-break screen falls in the wrong place or never fires. `buildExamRound` takes one total and owns the division, which makes the failure unrepresentable rather than unlikely. The same argument applied more weakly to Quiz, where only the round size is shared, and `buildQuizRound` was added anyway for symmetry and because Phase 3 Part B needs exactly that seam to add `userId` to both callers at once.

**Keeping `GET /api/grammar/queue`'s raw response shape and normalizing in both callers. Rejected.** Preserving the wire format avoids a breaking change to a documented route, which would matter if anything outside this app consumed it; nothing does. The route was shipping every due card's entire `GrammarProgress` FSRS row plus four unused `GrammarPoint` columns to a client that reads six fields, and the flattening `buildGrammarSession` performs is precisely what `buildSession` already does for vocab, so keeping grammar different would have been an inconsistency with no benefit. `GrammarSessionPayload` deliberately carries one field `StudySessionPayload` does not, `dueCount`: grammar tracked the due/new split already, so its "N more due" hint is exact where vocab's is an admitted estimate. The two payload types are **not** unified, since collapsing them would mean either discarding that precision or adding a field vocab cannot populate.

### 14.25 Alternatives weighed while porting the two browse pages and the remaining form states

Seven forks surfaced while extending the §9.3 treatment to `/browse` and `/grammar/browse` and while giving the level picker and the sign-in form real pending states. The reads/writes split (§14.16) and the shapes already rejected in §14.23 were not re-litigated.

**Server-rendering `/browse`'s word list in full, as the other five surfaces do. Rejected, and it was the shape the work item prescribed.** Uniformity is a genuine argument and it lost to arithmetic. The list is the whole level because search filters in memory, so N1 is ~2,700 rows and ~90 KB gzipped; `/browse` reads cookies and is therefore dynamic, so its response cannot be cached, and every visit would re-transfer those bytes to remove one round trip. The route handler it replaces can hold them in the browser for a day. What made the fork visible was that the work item protecting the existing cache and the work item prescribing the server render were the same item, which is how the two halves came to be resolved separately: the *ordering* moved to the render, the *bytes* stayed behind a cacheable URL. Author decided; the deciding factor was that a study aid is opened repeatedly in a session, so the repeated cost is the one that compounds.

**Making the word list public and `force-static` so a shared cache could serve it. Rejected.** This was the first-drafted form of the split and it is strictly worse here. `public` only pays where something in front of the app would use it, and nothing does on Railway (§12), so the benefit was zero while the cost was turning an authenticated endpoint into an unauthenticated one that runs a query for any caller, which is a §11.8 access decision taken as a side effect of a caching change. The deck is MIT-licensed and already public in the repository, so secrecy was never the issue; unmetered database work for anonymous callers was. The header stays `private` and the handler still resolves the session, now for the auth check alone.

**A hybrid: server-rendering the first page of 50 rows while the full list streams in behind it. Rejected, and it is the one that looks best on paper.** It appears to buy real content on first paint *and* a cached full list. It does not, for two reasons that only appear once written down. The started-first ordering is not expressible in SQL (it needs the user's `ReviewState` set and `localeCompare(…, "ja")`), so producing a correct first page means fetching and sorting the whole level on the server anyway, which is the work the split exists to avoid. Worse, the client sorts the cached list independently, so any divergence between the two orderings would silently duplicate or drop rows at the seam between the server's 50 and the client's list. Also declined: search would have to be disabled, or lie, until the full list arrived.

**Sorting the word list with `ORDER BY expression` so the payload arrives ready to render. Rejected.** It moves ~2,700 comparisons off the server, and it changes the order users see: Postgres sorts under the database's own collation, effectively by code point for Japanese, where `localeCompare(…, "ja")` gives correct kana/kanji collation. Trading correct collation for a sort that runs once per cache miss was not a trade worth making. The client-side work that remains is a stable partition, O(n) with no comparisons at all.

**Deleting `GET /api/grammar/browse` now that nothing calls it. Rejected, for the reason §14.23 declined to delete the queue route, and then one more.** The queue route survived because it still had an imperative caller; this one has none, and survives on the other half of §14.16's argument: a read is the thing that keeps a URL inspectable with `curl` and cacheable by a browser, and the page's data shape is a contract worth having one assertion that it is expressible over HTTP. The cost of keeping it is now near zero, since it delegates to the same `buildGrammarBrowse` the page calls, so the drift that would justify deleting one of them cannot occur. Recorded explicitly because "nothing imports it" will look like an obvious cleanup to the next reader; if it goes, it should go as a decision.

**`useOptimistic` for the level picker, having declined it for the flashcard rating loop (§14.23). Not a contradiction, and worth stating because it looks like one.** The hook reconciles an optimistic value against server-owned state and drops it when the transition settles, so it needs a base value the server actually replaces. `current` is exactly that (a prop the RSC renders from `UserProfile.activeLevel`, replaced by the `revalidatePath` inside the action), whereas the flashcard's `index` is client-owned state no server response ever touches, leaving nothing to reconcile against. **The row's `disabled={pending}` was dropped in the same change**: browsers blur a control the instant it is disabled, so disabling the row the user just tapped dropped focus to `<body>` on every level switch, which is the hazard §14.24 already resolved for answered quiz options. Nothing replaces it, because React dispatches Server Functions sequentially, so a second tap mid-flight queues behind the first and the last one wins. The `opacity: 0.4` dimming of inactive rows went with it, as both a BRAND.md §3 composite and a claim about latency that the optimistic check mark makes false.

**Keeping the sign-in form's `?error=` redirect, and passing the owner contact to it as a prop. Both rejected.** With the form now a client component holding `useActionState`, an `AccessDenied` can be reported as returned state instead of a redirect back to the same page, which removes a round trip whose only purpose was to tell the user they mistyped their address. The `?error=` *read* stays, because Auth.js's own flows still redirect there, and it is fed in as `useActionState`'s initial value rather than a second `initialError` prop, so a submit's result structurally replaces it and a stale code from the URL can never sit beside a fresh one. The owner-contact address travels in the action's result rather than as a prop for a narrower reason: a prop would serialize it into the payload of *every* sign-in page load, where a harvester would find it, whereas returning it with the one error that offers it preserves the previous exposure. The submit button does keep `disabled` while pending, unlike the level picker's rows, because a second submit sends a second email; it is not dimmed with opacity, since white-on-grape is the composite BRAND.md §3 forbids, and the label change to "Sending…" says more than a greyed button would.

### 14.26 Alternatives weighed in the decision to migrate to Nuxt

Four forks, decided together on 2026-07-26 (§5.2). The first is the decision itself; the remaining three shape its execution.

**Justification corrected 2026-07-27, without reopening the decision.** The reasoning below rests on the learning goal, which §2 now ranks third and scopes to mobile layout, PWA and design implementation. That scope is framework-independent and a Next.js app would serve it equally well, so the learning goal on its own supports "keep building" rather than "build in Nuxt." The argument that actually names Nuxt is §2's fourth objective: being a current Nuxt application is an end the project holds, and the author's contributions upstream make running on current Nuxt dogfooding rather than churn. That objective also supplies a commitment the original decision did not: the target is Nuxt 4 at the rewrite and Nuxt 5 once stable, not whichever version is current on the day the port begins.

**Remaining on Next.js 16. Rejected, and it is the option the codebase argues for.** Nothing in the deployed system is failing. The stack decision in §5.1 remains sound, the app is live and in daily use, and the reads/writes port completed the same month left the architecture in the best state it has been in. Against that, the decision is explicitly not a technical-merit judgement between two frameworks: it is a call about what this project is *for*. §1 and CLAUDE.md both state that Bayana exists to develop the author's skills rather than only to ship, and the marginal learning available from further Next.js work on an app whose hard problems are already solved is low, while the sibling project the mock exam is being absorbed from is already Nuxt/Nitro. **Author decided; the deciding factor was the learning goal, with the Kalima stack alignment as the supporting practical argument.** The cost is stated plainly rather than minimised: approximately 7,700 lines of working, reviewed, accessible UI are discarded and rewritten, and the rewrite produces no user-visible feature.

**An in-place migration, converting the existing tree file by file. Rejected on a technical impossibility rather than a preference.** The usual argument for in-place, that it can proceed incrementally under a strangler pattern, does not survive contact with React and Vue: the two frameworks cannot share a process, and the Next.js build stops working as soon as Nuxt's configuration and generated tsconfig land at the root. An in-place migration therefore performs an identical rewrite while leaving the main branch unbuildable and production undeployable for its full duration, and reduces rollback from a domain repoint to reverting a merge of several thousand lines. It carries one further cost that is easy to miss: with the old file always adjacent, translation is cheaper than design at every individual decision, which biases the result toward a page-for-page reproduction of a Next.js application in Vue, the opposite of the stated intent.

**A new repository. Rejected.** It buys a clean history and forfeits an accumulated one. This repository's git history, this document, DECISIONS.md, BRAND.md, the deck sources and `scripts/` are all framework-independent and are, for a portfolio project, among its more valuable artifacts. Since "greenfield" here describes the code rather than the repository, none of the arguments for a fresh start require one: the new application is built alongside `src/`, which is deleted in the cutover commit and remains recoverable from history behind a tag. The one real cost accepted is cosmetic, in that the repository's reported language composition changes at cutover.

**Inheriting the existing Prisma schema. Rejected**, on timing rather than on the schema's merits: the imported-question store requires new tables regardless, the three structural findings in §6 each get worse rather than better once a third studiable kind exists, and the alternative is not "never change it" but "change it later, against production, with the FSRS history already larger."

**This was recorded on 2026-07-26 as the closest call of the four, and it stopped being close the next day.** The cost that made it close was that a redesign converts the cutover into a data migration over data that cannot be regenerated, which is why the redesign was initially bounded by a rule requiring both `ExampleSentence` and the accumulated FSRS history to survive intact, carried by a checked-in script rehearsed against a copy. On 2026-07-27 the author lifted that constraint: the production database may be reset, the app having one user whose JLPT sitting is complete, so the study history is discarded rather than migrated and the sentence cache is reseeded from the local authoritative copy §12 already designates. **The cost the objection priced therefore no longer exists**, and it is worth recording that the decision survived on its own reasoning before the constraint was lifted rather than because of it: the analysis above was written while the migration still looked expensive.

### 14.27 Alternatives weighed in consolidating all source data onto bayan

The decision itself is in §4.3. What was weighed here is **when** Bayana adopts it, given that bayan is in early development, its dataset release is empty, its vocabulary lists are being regenerated, and vocabulary example sentences do not yet exist in its schema at all. **This fork was decided twice on 2026-07-27 and the second answer reversed the first**; both are recorded, because the reversal turned on a premise rather than on a preference.

**Bayan reaches production first, and the migration begins after it. Chosen (second decision, and final).** Bayana is rebuilt on real bayan data from its first seed: one corpus, one licence, one provenance story, and no interim state to unwind. `decks/*.csv`, `scripts/import-csv.ts` and the whole of §7 are retired *at* the cutover rather than surviving it, which is what the migration was always expected to do to them. The accepted cost is a genuine dependency: Bayana's schedule is now a function of bayan's, and bayan is early enough that its dataset release is empty.

**Seeding the new database from the current corpus and swapping to bayan later. Chosen first, then rejected.** The argument for it was that gating one project on another makes a ship date hostage to a roadmap, and specifically that a completed-but-unshipped Nuxt app would put every subsequent fix back into the discarded-or-done-twice position that justified migrating first. **That argument rested on Bayana needing to keep working, and it does not.** The author's JLPT sitting is complete (the same fact that made the production database disposable, §6), so there is no study to interrupt and no cost to the app standing still while bayan ships. With that premise removed the option keeps only its costs: a database seeded from a corpus already scheduled for deletion, three components surviving a cutover designed to remove them, and a `source` discriminator carrying a distinction that would exist for one release and then never again. **Author decided; the deciding factor was that Bayana has no users waiting on it, which the earlier reasoning had failed to apply.**

**Adopting bayan partially, taking grammar (which is ready) and leaving vocabulary on the Anki deck. Rejected under both orderings**, and now moot. Bayan's grammar index is usable today and would resolve §4.1's licensing defect immediately, which is the single most valuable thing the consolidation buys. It was declined because it delivers a deliberately mixed corpus at exactly the moment the schema is being redesigned to have one provenance story. Under the chosen ordering the question disappears: grammar and vocabulary arrive together because the migration waits for both.

### 14.28 Alternatives weighed in the 2026-07-27 headings, policy-pages and library-pinning pass

**Where a session screen's `<h1>` goes.** A visible title bar above the card was rejected: the card is the content, and chrome above it competes with recall on the one screen where the whole design goal is that nothing does. Leaving the active screen with *no* heading was rejected too, since that is the state a user spends the session in and heading navigation would find nothing there. The visually-hidden `<h1>` gets the outline without the pixels. On the completion screen, adding a heading *beside* the existing `tabIndex={-1}` focus target was rejected in favour of promoting that same element: they are independent mechanisms, but pointing both at one element is what makes a screen reader read the heading on arrival instead of landing next to it.

**How `/grammar/browse` fails.** Three shapes, and the chosen one is not the obvious one. **A route-level `error.tsx`** is the idiomatic answer and cannot work here: it replaces the page's whole render, and the header, level chip, account menu and nav are rendered by the page from database reads, which a Client Component boundary cannot redo. **A segment `layout.tsx` holding that chrome**, which would make a plain `error.tsx` correct, was rejected on cost: the layout and the page would each need `requireAuth()` and `getActiveLevel()`, adding two round trips per render to a page that currently makes one, in exchange for structural tidiness on a route the migration rewrites anyway. **Accepting the root boundary** — the call the four session routes made deliberately — was rejected because their case does not transfer: a failed session queue leaves no session to show, whereas a failed reference list leaves a perfectly good page around a missing list. The in-page boundary keeps one fetch and restores the pre-server-render behaviour exactly.

**A third level-picker variant for `/stats`.** Rejected. A compact chip row already existed (`browse-level-picker.tsx`) and looked like the right fit for a header, but the level is global state and a second control for it is a second place for optimistic updates, revalidation and disabled-state handling to be got wrong. Mounting the shared `LevelPicker` also surfaced that the chip row had no call site at all and deleted it.

**Demo-data retention.** Three options, differing in what is promised rather than in what the code deletes. **Describing the existing mechanism honestly** ("deleted the next time anyone starts a demo") was rejected: it is accurate and it is not a commitment, and a privacy page that declines to state a deadline invites the reader to assume the worst. **A sweep on an authenticated request path**, throttled to once an hour inside `requireAuth()`, would need no new infrastructure and was rejected for putting a destructive `DELETE` on a read path where a bug is felt by every signed-in request. **A scheduled sweep with a 14-day promise. Chosen (author).** It is the only option where the promise holds when nobody visits, and the 7-day enforced cutoff under a 14-day stated window is what keeps a missed cron run from breaking a published commitment. An authenticated `/api/cron/*` route was rejected as the trigger in favour of a cron service: a route puts a destructive operation on the public internet and makes its safety depend on a secret comparison being written correctly, whereas a scheduled process is not web-reachable at all.

**Register for the policy pages.** Conventional legal boilerplate (numbered clauses, `LIMITATION OF LIABILITY` in capitals, a named governing jurisdiction) was rejected by the author in favour of plain language. The reasoning is that the strongest thing these pages have to say — no analytics, no trackers, no user data reaching an AI model — is a factual claim about the code, and burying it in boilerplate is how a reader learns to skip the page. The accepted cost is that the terms name no governing jurisdiction, which is a real gap for a hosted service and is the thing to revisit if Bayana ever stops being a single-author side project.

**How DB-touching functions get tested.** **A real throwaway Postgres** is the honest rival and was rejected by the author: it would additionally test the SQL, which is where some of the risk genuinely is, but it makes `npm test` depend on Docker, needs provisioning in CI, and pins queries against a schema the migration is explicitly free to redesign (§6). What must survive the port is the composition above the query layer, and that is what the fake exercises. **Testing only the pure functions** and leaving the queue, browse, stats and home modules uncovered was rejected because ordering is precisely the behaviour TODO.md identifies as surviving a port syntactically while changing semantically — the uncovered set would have been the risky set.

**How the fake gets injected.** **`vi.mock("@/lib/db")`** is the smaller diff and touches no production code, and was rejected because it is a Vitest mechanism: the suite is meant to run against the Nuxt copy as the port's acceptance gate, and a module-mocking hook is exactly the kind of thing that does not travel. **A repository interface per module** (`wordsAtLevel(level)`, `sentencesFor(ids)`) would be the cleanest seam and was rejected as too large a refactor to perform *while* writing the tests that are supposed to prove nothing changed. The chosen `Deps` parameter is a compromise with one property that decided it: production code stays typed against Prisma's own generic delegates, so a malformed `where` clause is still a compile error, and the untyped-ness lands entirely on the fake — which compensates by throwing on any query feature it does not implement rather than silently answering wrong.

---

## 15. Open questions

- **Is `rating >= 3` the right recall threshold, and is undo's discarded due date acceptable?** Two findings surfaced by the first characterization pass (2026-07-27), both pinned by tests and neither fixed. (a) `getLevelStats` counts Hard (2) as a failed recall while its comment described counting it as a success; the comment was corrected to the code, since the code is what every displayed recall rate has been computed from, but which of the two is the better proxy is genuinely open. (b) `ts-fsrs`'s `rollback` reconstructs `due` from the log's review timestamp rather than the card's previous due date, so undoing a rating leaves the card due immediately rather than restoring its original schedule. Impact today is near zero (undo reverses a mis-tap seconds later, on a card that was already due), and `fsrs.test.ts` missed it because it rolls back an empty card whose due already equals `now`. Both are recorded rather than changed mid-freeze; both belong in the port's design rather than in a patch to code being replaced.
- Should multiple-choice results feed the FSRS scheduler, or remain a separate, non-scheduling mode? (§8.2; scheduled as Phase 3, §13, where the open part is the calibration: correct → Good or Hard.)
- **Does the imported mock exam replace Exam mode, or coexist with it?** `src/lib/exam.ts` builds 問題１/問題２ algorithmically from `Word` rows with confusability-scored distractors and no FSRS coupling (§8.6); the absorbed Kalima session is a timed sitting drawn from the stored question pool (§4.2). Two modes that both call themselves an exam need either a stated division of labour (quick benchmark vs full sitting) or a retirement. **This subsumes the earlier "should Exam mode be timed?" question**, which was asked before there was a timed sitting to compare against: the answer now depends on whether Exam mode keeps its own identity at all. Blocks the §6 model (§4.2). **Pulled forward on 2026-07-26**: it was to be answered when the imported-question work began, but the migration redesigns the data model (§6) and cannot design the question store without it, so it is now due during the migration milestone (§13) instead.
- **Is the mock exam reachable without signing in?** Kalima's homepage is deliberately open because that is most of its value to a recruiter, whereas this app gates everything through `proxy.ts` except an explicit allowlist of paths. If it stays public, the paths go in as exact matches rather than a prefix, following the `/api/demo/login` precedent and its reasoning (§11.8). Note that a public, budget-bearing endpoint raises the stakes on the limiter question in §11.4.
- **Dark mode: support it, or declare it an explicit non-goal?** Deferred on 2026-07-26 rather than answered. The interim state is light-only and now *declared* as such: `color-scheme: light` (`globals.css`) stops a phone in dark mode painting UA-owned chrome (form controls, the browse search field, scrollbars) in dark styling against the cream surfaces. That closes the leak, not the question. Answering "support it" is not a CSS-variable swap: BRAND.md §3 is a single light palette with no dark ramp, and the measured AA ratios in §8.4 are all against `--paper`, so a dark theme means a second palette and a second set of contrast measurements. **Nor is it blocked by the app's ~330 inline `style={{}}` objects, contrary to what TODO.md asserted until 2026-07-26**: those read the tokens (`background: "var(--surface)"`), so redefining `:root` reaches every one of them without a single call-site edit. Measured, only 23 hardcoded colour values exist across all `.tsx`, and nearly all are the parrot mascot (brand-coloured in any theme) and `global-error.tsx` (deliberately token-free, since it must render when the stylesheet has not loaded). The obstacle is therefore entirely the design work above, and migrating the inline styles to Tailwind utilities is an independent change that must be justified on its own merits: the per-render allocation, and the fact that an inline style beats any `hover:` / `focus-visible:` / media-query variant, which is why `.focus-ring` exists. Whichever way it goes, the call belongs in DECISIONS.md, because "we chose not to" and "we never got to it" are different facts and only one of them is stable.
- **What replaces Auth.js when the app moves to Nuxt?** (§5.2, due during the migration milestone, §13.) Auth.js's Next.js integration is its most mature; the Nuxt options are a genuine fork between Auth.js's own Nuxt support and the community alternatives. The question is not primarily ergonomic: the chosen library dictates the shape of the `User` / `Account` / `Session` / `VerificationToken` tables, so it is an input to the §6 redesign, and every hardening requirement in §11.3 must be re-established against it rather than assumed to carry. The magic-link flow, the allowlist, the database-session strategy and the HMAC-signed demo cookie (§11.8) are the concrete acceptance criteria.
- Furigana: store the reading as plain kana (current) or as ruby-annotated markup?
- MCQ distractor difficulty mix: how many confusable vs random distractors per question, and should the ratio adapt to the user's level/performance? When (if ever) should rule-based scoring graduate to embeddings + pgvector? (§8.2)

---

## 16. Decision log

The dated log of decisions that shaped this design lives in **[DECISIONS.md](DECISIONS.md)**, newest first. It was extracted from this section on 2026-07-26 because it is append-only while the rest of this document is rewritten in place; the rows themselves are unchanged. Record every new or reversed decision there, and keep the analysis of rejected options in §14 above.
