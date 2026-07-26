# TODO: Bayana

Open work only: what is planned, in flight, or found-but-not-fixed. **The one thing to know before picking anything up: as of 2026-07-27 the three pre-gate workstreams are done and nothing is live.** All remaining work sits behind two gates, in this order: [bayan reaching production](#gate-1-bayan-reaches-production), then the [Nuxt migration](#gate-2-nuxt-migration) that is seeded from it. No new features land before both clear. Below: the sequence and what the freeze does and does not cover, the four user-facing items it deferred, the two gates, then everything frozen behind them.

This file is the cross-session "where we left off" record, so keep it current, and **delete an item in the commit that lands it** rather than archiving it or noting that it used to be here. Shipped work is already recorded three times over: [SPEC.md](SPEC.md) §13 Milestones at design altitude, [DECISIONS.md](DECISIONS.md) for why it was done that way, and git for the detail. Decisions do **not** go here.

## Sequence

1. **[Gate 1: bayan reaches production](#gate-1-bayan-reaches-production)**. Upstream work in a different repository, tracked here only as the precondition it now is. Reversed into this position 2026-07-27.
2. **[Gate 2: Nuxt migration](#gate-2-nuxt-migration)**. A greenfield Nuxt app in this same repository, seeded from bayan on its first run and taking over the production URL. Absorbs most of what was previously a separate bayan-consumer gate.
3. Everything else: [frozen](#frozen-until-both-gates-clear) until both gates clear.

**What the freeze does not cover.** Fatal bugs and small fixes are always in scope: ship them as they are found, in whichever app is current, and add a line here only if the fix is deferred rather than made. What the freeze rules out is *new features* and *large refactors of the Next.js codebase*, which the migration would either discard or make twice.

**The three workstreams that were live through the freeze all shipped on 2026-07-27** (headings and page titles, the four smaller UX items, the legal pages, and pinning `src/lib` with 158 characterization tests). They were kept live on one shared ground, that each survives the port; what they left behind is recorded in SPEC.md §13 at design altitude, DECISIONS.md for why, and git for the detail. Two items they *deferred* are below, in [Deferred, user-facing](#deferred-user-facing).

---

## Deferred, user-facing

Both were deferred on 2026-07-26 and the migration only strengthens the case; the third and fourth entries are findings from the 2026-07-27 characterization pass, recorded rather than fixed. Kept out of the frozen list because they are user-facing or user-visible and should be reconsidered as soon as the app they apply to is settled.

- [ ] **Subset the Japanese font face.** `src/app/fonts.ts` self-hosts M PLUS Rounded 1c at 400/700, but Google slices Japanese into ~126 `unicode-range` chunks *per weight*, so ~252 `@font-face` rules are inlined into every page's CSS for glyphs that page will never use. A `fonttools` subset of the ~2,500 characters the deck uses collapses that to a handful of rules. Now doubly deferred: it is a build-pipeline project against `next/font`, which the migration replaces outright, and it needs a decided answer for what happens when a sentence contains a kanji outside the subset, whose blast radius widens once imported bayan text this app did not author is in the corpus. **Re-measure before starting**: the ~66 KB-gzipped figure in SPEC §14.12 predates dropping weight 800 and moving both Latin faces to variable fonts.
- [ ] **Day boundaries use local-*server* midnight** (`setHours(0,0,0,0)` in `getGrammarStats` and in `startOfToday`, `src/lib/home.ts`, which powers the hub's "done today"), so a user in another timezone can watch the count reset mid-session. The stated blocker was false and **the misleading code comment is now fixed** (2026-07-27): `UserProfile.timezone` (IANA string, default `"UTC"`) and `UserProfile.dayStartHour` (default 4, Anki-style rollover) have been in the schema since it was written and are read by nothing. The source of truth was decided long ago; what is genuinely open is only how a user's value gets *set* (a control, or browser detection at onboarding). Carry both columns into the new model and wire them up there.
- [ ] **Decide whether Hard (2) counts as a recalled review.** `src/lib/stats.ts` computes the `/stats` recall rate as `rating >= 3`, so Hard is a miss. Its comment claimed the opposite until 2026-07-27, when a characterization test made the disagreement visible; the comment was corrected to the code, because the code is what every rate a user has ever read was computed from. Which threshold is the better proxy is genuinely open (SPEC §15), and the answer belongs in the redesigned model rather than in a patch that would silently move a displayed number.
- [ ] **Undo does not restore a card's original due date.** `ts-fsrs`'s `rollback` reconstructs `due` from the log's review timestamp, so an undone card becomes due immediately rather than returning to its prior schedule; every other FSRS column *is* restored exactly. Impact today is near zero (undo reverses a mis-tap seconds later, on a card that was already due) and it is pinned by a test in `review.test.ts`. `fsrs.test.ts` missed it because it rolls back an empty card, whose due already equals `now`. Decide during the model redesign whether to reproduce or correct it.

---

## Gate 1: bayan reaches production

**Reversed into this position 2026-07-27**, having been sequenced after the migration earlier the same day. The migration now waits for bayan rather than seeding from a corpus already scheduled for deletion; SPEC §14.27 records both answers and why the second one won. This gate is almost entirely work in `~/Desktop/bayan`, tracked here only because nothing below it can start.

**What Bayana needs before Gate 2 begins**, verified against bayan's repository on 2026-07-27 rather than assumed:

- [ ] **N5–N3 vocabulary lists.** `tools/generate-words.ts` exists; the lists are being regenerated and do not exist yet.
- [ ] **Vocabulary example sentences, which need a schema addition upstream.** `VocabEntrySchema` has no such field: it carries `id`, `word`, `reading`, `meaning`, `level`, `freq_score`, `context`, `pos`. `GrammarEntrySchema` already has `example` plus `example_highlight`, so the shape to copy is there.
- [ ] **A non-empty dataset release.** `dataset/export.json` is `{"count": 0, "questions": []}` at tag `beta-2026-06-26`. Bayana pins a dated tag, never "latest".
- [x] **Grammar index.** Ready today, and better than what this app has: `example_highlight` supplies the pattern spans Bayana currently derives by hand.

**Two things to carry back to bayan's own TODO**, since they are Bayana's requirements and bayan cannot infer them: the vocabulary crosswalk needs expression plus reading to be a stable natural key (bayan deliberately cannot carry an Anki identifier), and Bayana's level range narrows to N5–N3 on adoption, so N2/N1 remain the thing that restores it.

**Meanwhile, do not prune the local `ExampleSentence` backup.** The ~8,100 paid Haiku sentences are discarded at cutover rather than migrated, and the `pg_dump` that SPEC §12 already designates the backup target is what preserves them. Keeping it costs nothing; regenerating them costs money.

---

## Gate 2: Nuxt migration

**Decided 2026-07-26: a greenfield Nuxt app, built in this same repository, that takes over the production URL when it is ready.** Not an in-place translation. The deciding argument is that React to Vue offers no incremental path (Next and Nuxt cannot run in one process, and the build dies the moment Nuxt's config lands), so an "in-place migration" is the same rewrite with `main` broken for its duration. Greenfield keeps production serving throughout, makes rollback a domain repoint rather than a revert, and lets Nuxt conventions drive the structure instead of the old files translating themselves page for page. Same repository because the git history, SPEC.md, DECISIONS.md, `decks/`, `prisma/` and `scripts/` are all worth keeping and none of them are framework-specific.

Measured against the codebase, the split is: **~7,700 lines of `.tsx` get rewritten**, concentrated in five session and browse components that are 2,281 lines between them, with 152 React hook call sites to re-express; the Next-shaped layer (App Router files, Server Actions, `proxy.ts`, `next/font`, Auth.js's Next adapter) is re-decided rather than ported; and **`scripts/` plus `src/lib` (~3,300 lines) would copy across near-verbatim**, since only `src/lib/current-user.ts` imports anything from Next. That last figure now carries a condition: it holds only for as long as the data model does, and per the section below, the data model is deliberately in scope. One more fact worth holding onto while scoping: **Kalima is already a Nuxt/Nitro app**, so this gate turns most of the frozen Kalima port from a rewrite into a move, which is part of why the ordering puts Nuxt first.

### Data model restart (in scope, decided 2026-07-26)

**The migration inherits neither the current schema nor the current data.** It is free to redesign the models to fit Bayana's own vocabulary, bayan-produced words, and exam questions as one coherent design rather than three that grew in sequence. This is the cheapest moment it will ever be: nothing is live on the new app, the old one keeps serving, the question store needs new tables anyway, and as of 2026-07-27 **prod is reset at cutover rather than migrated**, so nothing in the existing database constrains the design either.

Three structural problems in the current schema are what make this worth doing, and each is a real constraint on the new design rather than an aesthetic complaint:

- **`Word.guid` is `@unique` and required**, holding the stable Anki id from the CSV. **Bayan-produced words cannot have one**: bayan's Hard legal rule #4 rests on its word lists having no third-party deck in their lineage, so there is no Anki identifier to carry. Word identity therefore has to stop being "the Anki guid" and become something both sources can satisfy, with a `source` discriminator and a natural key (expression plus reading) alongside a nullable `guid` kept only for deck idempotency. This also **breaks the sentence-cache transfer strategy in SPEC §12**, which moves `ExampleSentence` rows between databases by `Word.guid`; that strategy needs a successor before the first bayan word lands, not after.
- **The FSRS block is duplicated four times** (`ReviewState`, `ReviewLog`, `GrammarProgress`, `GrammarReviewLog`), ten fields each, because vocabulary and grammar grew as parallel hierarchies. Exam questions would make it a third pair and a sixth copy. A single studiable-item abstraction with one state table and one log table, keyed by item type plus item id, is the obvious target, and `src/lib/fsrs.ts` is **already entity-agnostic** (`CardLike`), so the adapter needs no change to serve it. It would also retire the knowingly-accepted duplication between `undoLastGrammarReview` and `undoLastReview` that is [frozen in the backlog](#review-backlog-internal-findings-2026-07-10-frozen) below.
- **`level` has two representations**: `Word.level` is the `Level` enum, `GrammarPoint.level` is a plain `String`, deliberately, so new grammar decks need no migration. Imported questions would add a third opinion. Pick one and state why.

Open work:

- [ ] **Design the new model against all three sources at once**, and write it into SPEC §6 before any migration is written. The three problems above are the inputs, not the design.
- [ ] **Decide the SPEC §15 Exam-mode fork here.** Whether `src/lib/exam.ts` stays as the algorithmic benchmark or retires in favour of bayan's question pool changes what the question store has to hold, so the model cannot be designed around it. Decide it and log it.
- [ ] **Seed the new database rather than migrating the old one.** Decided 2026-07-27: prod is reset at cutover, the FSRS history being spent now that the exam is done, so there is no carry-over script and no rehearsal. `Word` and `GrammarPoint` reseed from `decks/`; `ExampleSentence` reseeds from the **local** Postgres, which SPEC §12 already designates its authoritative copy, so it never travels out of prod at all. The only requirement this places on the new model is that word identity can be joined against that export.
- [ ] **Design for bayan, seed from what exists** (SPEC §4.3, §14.27). All source data is to consolidate onto bayan, but bayan supplies only grammar today: its vocabulary lists are being regenerated, its `VocabEntrySchema` has **no example-sentence field**, and `dataset/export.json` is `{"count": 0}`. So the model is shaped for bayan (natural key of expression plus reading, no Anki identifier in the identity, a `source` discriminator) while the seed comes from `decks/*.csv` and the local sentence cache. Adopting bayan is then a data swap against an unchanged schema, and the thing to get right *here* is only that the schema makes such a swap possible without a migration.
- [ ] **Do not delete `decks/*.csv`, `scripts/import-csv.ts`, or the §7 generation pipeline at cutover.** They were expected to die with the Next app and now outlive it, since they are the interim seed source. They are retired by the bayan swap instead.
- [ ] **Take one archival `pg_dump` of prod before the reset.** Not a prerequisite and nothing waits on it: it preserves `ReviewLog` as the only training data `UserProfile.fsrsParams` has ever had, for one command.
- [ ] **Decide whether the migration history restarts.** A redesigned schema can either accumulate onto the existing `prisma/migrations` chain or begin again with one baseline migration. The second is cleaner to read and loses the ability to replay the database's history from scratch.
- [ ] **`UserProfile.timezone` and `dayStartHour` already exist and are unused.** Whatever the new model looks like, keep them and *wire them up*: see the day-boundary item in [Deferred, user-facing](#deferred-user-facing), whose stated blocker turned out to be already resolved in the schema.
- [ ] **Fix the stale doc comment on `ReviewLog`** ("Never updated or deleted") when the model is redesigned. `GrammarReviewLog`'s comment scopes it honestly; `ReviewLog`'s does not, and both logs have always had an undo that deletes.

- [ ] **Move the Next.js app into `legacy/` and build Nuxt at the root** (author's proposal, 2026-07-27; the same convention bayan already uses). Nuxt gets its idiomatic layout with no subdirectory to promote later, and the cutover is a `rm -rf legacy/` rather than a file move. **The condition that makes this cheap is that `legacy/` is reference-only and is not expected to build**: the move then needs no path fixing, no second `tsconfig`, and no change to the live service. Directory names never collide anyway (Nuxt 4 defaults to `app/` + `server/`; the Next code is under `src/app/`), but `package.json` and `tsconfig.json` would have, which is exactly what this shape avoids.
- [ ] **If prod must keep serving during the migration, serve it from the `v-nextjs-final` tag or a `legacy-nextjs` branch**, not from the moved tree. That keeps deployment independent of repository layout, so `legacy/` can be moved, broken, or deleted without touching what is live.
- **`prisma/` is no longer a shared directory, and this is decided rather than open.** The Nuxt app owns its own redesigned schema, its own migration history, and its own database from its first commit; the existing `prisma/` stays with the Next app and is deleted alongside `src/`. Nothing is shared and nothing is read-only: the old database keeps serving the old app until cutover, then is reset. This removes the last reason the two trees would have needed to coordinate on anything.
- [ ] **Build on Nuxt 4, and treat the Nuxt 5 upgrade as scheduled work rather than a someday.** SPEC §2's fourth objective makes staying current an end the project holds, not a maintenance chore, so the version is a commitment and not whatever `nuxi` installs on the day. Two things follow and neither is free: **pin the major explicitly** at scaffold time, and **watch Nuxt 5's release track from the start** so the upgrade is planned against a known set of breaking changes rather than discovered later. Worth deciding early whether any part of the rewrite should be deferred until v5 lands, since writing something twice is the cost this objective can impose; the answer probably differs for the data layer (stable, port it) and for the app shell (framework-shaped, most exposed to a major).
- [ ] **Objective 3's scope is the design surface, so spend the learning budget there.** SPEC §2 scopes the learning goal to **mobile layout, PWA, and design implementation**, which lands squarely on this gate: the [brand v2 bundle](#brand-v2-design-assets-for-the-nuxt-app) is the design-implementation half, and **the PWA is the part with no plan at all**. Today it is one script rasterising `icon.svg` into a manifest's worth of PNGs; SPEC §13 Phase 6 parks the offline shell and service worker behind everything else. That parking was decided when the learning goal was unranked and unscoped. Re-read it against the new ranking before accepting it, and note the ordering argument cuts both ways: a service worker is exactly the kind of thing better built once on the new stack than twice.
- [ ] **Decide what ports and what gets rebuilt.** Draw the line explicitly (data layer and domain logic port; presentation and framework glue get rebuilt) so it is a decision rather than a sequence of individual judgement calls made under deadline.
- [ ] **Name the replacements for each Next-specific mechanism** before writing code, since each is a small fork with a real alternative: auth (Auth.js's Nuxt story vs. `nuxt-auth-utils` vs. Sidebase), the route guard (`proxy.ts` → Nitro server middleware), writes (Server Actions → Nitro server routes or server functions), fonts (`next/font` → `@nuxt/fonts` or local), images, and the CSP that §11.3 depends on. The security requirements in SPEC §11 are framework-independent and every one of them must land again; treat that section as the port's acceptance checklist.
- [ ] **Plan the cutover itself.** Since 2026-07-27 this is a **reseed plus a domain repoint**, which is as cheap as a cutover gets: seed the new database, point the domain at the new service, done. Decide whether the old app keeps serving behind a second URL for a grace period, and tag the last Next.js commit (`v-nextjs-final` or similar) before `src/` is deleted, so the reference implementation stays one `git checkout` away.
- [ ] **Doc housekeeping, in the same commits as the code.** SPEC §5/§5.1 (the stack and the single-service rationale, both written about Next.js), §9 (the reads/writes convention, whose vocabulary is Server Actions and route handlers), §11.9 (`proxy.ts` mechanics), §13 (a milestone for the migration), §14 (an "alternatives considered" entry: staying on Next.js, and why it lost), plus a DECISIONS.md row and the Next.js trip-wire section in CLAUDE.md. README and ARCHITECTURE both describe a Next.js app throughout and must be true of the code in the same commit that changes it.

---

### Brand v2: design assets for the Nuxt app

**The source assets exist; adopting them does not.** A v2 brand guide and a Nuxt handoff bundle were authored in the Claude Design project "Bayana" (`94b90684-2ec4-4a65-899e-3699eb016db4`) and read on 2026-07-27. Two halves: `bayana-brand/` is the interactive guide (`bayana Brand Guide v2.html`, `styles.css`, `styles-v2.css`, `guide-v2.js`, `mascot-v2.js`), the successor to the v1 guide in the gitignored `notes/bayana/bayana-brand/`; `nuxt/` is a drop-in bundle (`app/assets/css/tokens.css` + `main.css`, `PiParrot.vue`, `BayButton.vue`, `BayChip.vue`, `BayFlashcard.vue`, `BayProgress.vue`, `composables/useBayTheme.ts`, `design-tokens.json`, `nuxt.config.ts`, `README.md`). It belongs to Gate 2 rather than to the live UI/UX work because the Next app is being replaced: a token sweep across ~330 inline style objects buys nothing, and the same argument that froze [design tokens as Tailwind utilities](#design-tokens-as-tailwind-utilities-frozen-and-moot-if-the-migration-is-greenfield) applies here in full.

**What v2 genuinely adds**, measured against [BRAND.md](BRAND.md) rather than assumed:

- **A systematised token layer the brand has never had.** Spacing on a 4px base (12 steps), five radii, three elevations plus `--lip-size` as a named token, four durations and three easings, and a `clamp()` type scale. BRAND.md §8 ships `--r-lg/md/sm` and a single `--shadow`, so every other value in the app today is a literal.
- **Mascot v2.** Same `viewBox="0 0 240 268"` as `src/components/parrot.tsx`, so it is a redraw rather than a new bird: radial-gradient body shading, feather strokes, a hooked two-tone beak, per-instance gradient IDs (v1 reused them, which collides when several parrots share a page, and the shipped component inherited that), plus `face` and `mono` render variants the app currently improvises.
- **A 22-icon set on the 24px grid**, against the three shipped `BottomNav` icons and the emoji BRAND.md §5 deliberately uses for everything else.
- **Voice and tone as a specified surface**: say/don't-say pairs and a microcopy rules table (buttons, empty states, errors, notifications, numbers), where BRAND.md §1 compresses the same intent into two lines.
- **Nuxt-shaped engineering guidance**: Tailwind v4's CSS-first `@theme` reading the same custom properties, `@nuxt/fonts` for self-hosting, `@nuxt/icon` with a local `i-bay-*` collection. This is the part with no equivalent anywhere in the repo, and it overlaps the "name the replacements for each Next-specific mechanism" bullet above (fonts, and now icons).

**What has to be decided before any of it lands.** Every item below is v2 describing a product Bayana is not, or contradicting a call BRAND.md made on purpose. None of them are reasons to reject the bundle; all of them are reasons not to copy it in wholesale.

- [ ] **Dark mode: this is the open question, not a free feature.** v2 ships a full `html[data-theme="dark"]` ramp and a `useBayTheme.ts` composable. BRAND.md's platform note states the app is light-only and `globals.css` declares `color-scheme: light` so UA chrome cannot paint dark against cream surfaces; whether to design a dark palette at all is the open question this bundle now proposes an answer to. Decide it explicitly, and if yes, the greenfield app is the cheapest place it will ever be built.
- [ ] **Seven moods against a cast of four, including a `sad` one BRAND.md §2 forbids and gives a reason for** ("a mascot that looks upset when a fetch fails makes a technical failure feel like the learner's fault"). v2 adds `cheer`, `think`, and `sad`. `think` for loading is a genuine improvement over borrowing `sleepy`; `sad` for empty states re-opens a settled call. Take the cast deliberately, mood by mood.
- [ ] **Gamification is back.** The hero mock, the components lab, and the icon set carry streaks, XP, gems, a daily-goal bar and `BayProgress.vue`. BRAND.md §5 already ruled the v1 guide's `flame`/`star`/`heart`/`gem`/`bolt`/`trophy` a historical exploration of a product Bayana did not become, and none of it is on the roadmap (SPEC §13). Same call unless the Nuxt app takes on gamification, in which case that is a product decision made first, not a side effect of importing a stylesheet.
- [ ] **The contrast numbers disagree with the measured ones.** v2 claims White on Grape 4.9 : 1, Ink on Yellow 13.5 : 1, Ink on Magenta 6.5 : 1; BRAND.md §3 has 5.6, 13.0 and 6.3, measured against `--paper`. Re-measure once and keep one set. BRAND.md's are the ones an audit already acted on (the `--ink-faint` darkening, 2026-07-26).
- [ ] **v2 has no `--ink-faint`, and its `--ink-soft` differs** (`#5d3a5b` against the shipped `#684e65`). The three-step text ramp with `--ink-faint` sitting just above the AA floor is a hard-won result across ~60 call sites; it must survive into `tokens.css` rather than being dropped because the guide's neutrals row lists four swatches.
- [ ] **The app icon flips to magenta-primary.** v2 calls the magenta tile primary and yellow the alternate. Every shipped icon is yellow, deliberately: magenta-on-magenta is tone-on-tone and muddies at 16px (BRAND.md §6, DECISIONS 2026-06-04). Keep yellow, or re-open that decision on its own merits.
- [ ] **Do not port the guide's font loading.** It links Google Fonts at runtime and asks for M PLUS Rounded 1c at 400/500/700/800. Fine for a standalone HTML file; wrong for the app, where the faces are self-hosted, the CSP names no external origin (SPEC §11.3), and BRAND.md §4 explains why a third Japanese weight costs ~126 `@font-face` rules and why 800 was dropped. The weight list is the part that must not travel.
- [ ] **The layout grid is desktop-first.** v2 specifies max width 1120px, 28px gutter, 12 columns. BRAND.md's platform note designs at 375px first, and §8 records that `--maxw:1120px` was removed precisely because nothing consumed it. Reconcile, with mobile-first winning.
- [ ] **`.btn-secondary` (yellow) is a first-class button again.** BRAND.md §7 records it as specified for years and never built, with Ghost as the app's actual secondary. A greenfield app can build it; decide that rather than inherit it from a stylesheet.

**Then the mechanical work:**

- [ ] **Split the bundle by whether the code depends on it.** The guide is documentation and follows its v1 predecessor into the gitignored `notes/` tree; `tokens.css`, the components and the composable are *code* and get committed into the Nuxt app. BRAND.md §2 already records why a gitignored file cannot be the source of truth for anything the app renders, which is exactly the mistake to avoid repeating with `tokens.css`.
- [ ] **Decide whether `design-tokens.json` is kept.** It is a DTCG mirror for Figma Variables and Style Dictionary, and the guide's own rule is to regenerate rather than hand-edit it. Neither tool is in this project, so a second copy of every token with no generator is drift waiting to happen.
- [ ] **Port `PiParrot.vue` against the committed geometry, not by trusting either file.** `src/components/parrot.tsx` is the current source of truth and `mascot-v2.js` is a redraw of it; diff them deliberately so the gradient work lands and nothing else silently changes.
- [ ] **BRAND.md §8's match target changes a third time.** It has pointed at the local guide's `styles.css`, then at `globals.css`; after the migration it mirrors `app/assets/css/tokens.css`. Update it in the same commit, along with §2 (the parrot component path), §4 (`fonts.ts`), §5 (`bottom-nav.tsx`) and §6 (`icon.svg` and the PWA script), all of which name Next-app files.
- [ ] **Doc obligations when adoption is decided**, not when it is implemented: a SPEC §14 entry for whatever v2 proposes and loses (dark mode, gamification, the magenta tile), and a dated DECISIONS.md row. BRAND.md is also missing from the doc-housekeeping bullet above; it changes in the same commits as the code, same as README and ARCHITECTURE.

---

### Consumer work, folded in from what was a separate gate

**Absorbed into the migration on 2026-07-27.** Being bayan's reference consumer used to be a feature added after the port; with bayan supplying the entire corpus it is simply how the application is seeded, so these items belong to the migration rather than beside it. Kalima's mock exam, timer, radar and passage set stay [frozen](#kalima-absorption-frozen) as feature scope.

- [ ] **Import path for a pinned `export.json` release tag**: fetch, validate against a copy of bayan's Zod schema, insert with `source` set. Pin a dated tag, never "latest".
- [ ] **Shape the question store like bayan's `ExportedQuestion`, not like Kalima's `ExamQuestion`.** Kalima's five types are a subset of bayan's 22-value `question_type` enum (`reading` → `read-kanji`, `orthography` → `pick-spelling`, `contextual` → `word-choice`, `synonym` → `same-meaning`, `usage` → `right-sentence`). Keep `source` to distinguish dataset releases from any later seed rows, and leave room for `stimuli` and `provenance` so reading and listening need no second migration.
- [ ] **Vocab crosswalk, kept on this side**: match on expression plus reading. Bayan deliberately cannot carry an Anki identifier, so the join cannot come from there.
- [ ] **CC BY 4.0 attribution surface.** A licence obligation, not a nicety, and now covering the whole corpus rather than imported questions alone; coordinate with the published `/privacy` and `/terms` pages (SPEC §11.10) and README Credits so the licence story reads as one thing.
- [ ] **Acceptance test: grade an imported question into `ReviewState` end to end.** Anything short of that makes the reference-consumer claim decorative.
- [ ] **Durable rate limiting is a precondition** for any endpoint that spends money. `src/lib/rate-limit.ts` is in-memory: it does not survive a restart and cannot bound spend across replicas. SPEC §11.3 #5 accepts that only because no route currently spends anything.
- [ ] **Claims that go false when this ships; flip each in the same commit:** SPEC §11.4 ("no web-reachable route that spends Anthropic tokens"), SPEC §12 (`ExampleSentence` as the only paid, hard-to-regenerate artifact), ARCHITECTURE's "generation is a seeding pipeline", README's Credits and deck attribution, and SPEC §13's milestone numbering.

---

## Frozen until both gates clear

Nothing here is cancelled and nothing here is started. Each entry keeps only what is not already recorded in SPEC.md §13 or DECISIONS.md, so it can be picked back up without re-deriving it. Do not pull one in as filler: the point of the freeze is that work done in the Next.js app before the migration is either discarded or done twice.

### Phase 3: MC↔FSRS coupling (frozen)

Resolves SPEC §15 open question #1: MC answers seed the FSRS schedule, and MC question selection is informed by FSRS state. No new schema. Technically unblocked, frozen by choice.

- [ ] **Part A**, `src/components/quiz-session.tsx:98` in the `choose` callback: call `rateCard` (`src/app/study/actions.ts:41`) with `{ wordId: current.wordId, rating: correct ? 3 : 1 }`, fired inside a transition without blocking the UI. **Decide before coding**: correct → Good (3) or Hard (2)? MC is recognition-only, so Hard is the conservative read; Good is simpler and still rewards the answer. Log the choice.
- [ ] **Part B**, `src/lib/quiz.ts`: add `userId` to `buildQuizRound` (line 57) and `buildQuiz` (line 74); split target selection into words with `ReviewState` at this level ordered by `due asc` and words with none, taking `floor(count/2)` and `ceil(count/2)`, each filling from the other when short. Then pass `userId` from both callers, `src/app/quiz/page.tsx` and `src/app/api/quiz/route.ts`.
- [ ] **Part C**: SPEC §8.2 updated (retire "non-scheduling first-run warm-up", superseded by the coupling), SPEC §15 question #1 closed, a DECISIONS.md row for the calibration choice.
- Nice-to-have, defer if scope creep: a `ReviewLog.source` field distinguishing MC from flashcard events. Needs a migration; only worth it once the coupling is live.

### Phase 4: admin audit + on-demand generation (frozen)

- [ ] Admin sentence-audit page, admin-gated (`UserProfile.role = ADMIN`); adds a review-status field to `ExampleSentence`; accept/reject generated sentences.
- [ ] On-demand generation + study-UI fetch-on-flip, with §11.4 guardrails: auth, per-user rate limit, cache-first, bounded `max_tokens`. **Re-check the shape against the reads/writes convention**: the `/api/generate` working name predates that split, and this both spends money and writes to the sentence cache. Whichever way it lands the guardrails are identical, since a Server Action is exactly as web-reachable as a route handler.
- [ ] Shipping this breaks SPEC §11.4 ("no web-reachable route that spends Anthropic tokens") and ARCHITECTURE's "generation is a seeding pipeline, not a request-time feature". Flip both in the same commit.

### Kalima absorption (frozen)

Kalima's JLPT mock exam still moves into Bayana eventually; it is deferred as new-feature scope, and the Nuxt gate makes the port cheaper (Nuxt to Nuxt). Design altitude is SPEC §13; Kalima's own porting checklist lives in that repo. What is recorded nowhere else:

- [ ] Answer secrecy is the property the mock exam is built around: `toClientQuestion` stripping, opaque choice IDs, answers resolved only after submit. Port it first, not last.
- [ ] Timed 35-question vocabulary session (8-6-11-5-5, 30-minute timer) and the per-type accuracy radar. The radar is polar math plus SVG.
- [ ] Wrong-answer review queue, rehomed from Kalima's localStorage onto per-user rows. Consider whether it should feed `ReviewState` rather than living beside it.
- [ ] Atomic `consumeBudget()` upsert plus the per-IP throttle for the analysis call.
- [ ] Remap `wordId` from Kalima's cuids to `Word.id` via the shared Anki guid; Kalima's `words/*.json` is an export of this corpus, so it joins cleanly.
- [ ] Carry `prisma/seed-data/passages-n3.json` across (20 short, 10 medium, 5 long, 10 info, generated and audited). Paid AI output that will otherwise be regenerated.
- [ ] Fold Kalima's S-F rank review into the Phase 4 admin page under `UserProfile.role = ADMIN` rather than porting its `ADMIN_PASSWORD` HMAC path. These two admin surfaces should be one.
- [ ] **Decide whether the mock exam is public.** Kalima's homepage is deliberately open for recruiters, which is most of its value; this app gates everything except an explicit list. If it stays public, add exact paths rather than a prefix, per the `/api/demo/login` precedent in SPEC §11.8. Log it in DECISIONS.md.
- [ ] SPEC §8's four-mode count and README's mode table go false when this ships.

### Phases 5 and 6 (frozen)

Tracked only in SPEC.md §13. Phase 5: widen or remove the email allowlist, authorization checks on every read/write, the remaining first-run onboarding (5-question warm-up + guided tour). Phase 6: audio/TTS, furigana, the full stats dashboard, sentence regeneration/voting, export to Anki, PWA offline shell / service worker.

### Design tokens as Tailwind utilities (frozen, and moot if the migration is greenfield)

**Deferred 2026-07-26 because its stated justification turned out to be false.** It claimed dark mode was blocked on it. It is not: the ~327 inline `style={{}}` objects read the tokens (`background: "var(--surface)"`), so redefining `:root` reaches every one of them without touching a call site. Measured, 23 hardcoded colour values exist across all `.tsx`, nearly all the parrot mascot (brand-coloured under any theme) and `global-error.tsx` (deliberately token-free, since it must render when the stylesheet has not loaded). SPEC §15 records the correction and DECISIONS.md carries the row; do not re-derive the premise from this file's history.

What survives is smaller: inline objects allocate per render and cannot be targeted by `:hover`, `focus-visible`, a media query, or a future `dark:` variant, which is why `.focus-ring` and `.tap-44` exist as utilities at all. `globals.css` maps three tokens through `@theme inline`; extending it to the full ramp is cheap and independent of migrating any call site. **A greenfield Nuxt app writes these components once, correctly, so the ~330-site sweep may never need to happen**, which is the strongest argument yet for not doing it now.

### Review backlog: internal findings (2026-07-10, frozen)

Lower-priority internal findings. Anything user-facing from this review shipped in the 2026-07-27 pre-gate work.

- [ ] `scripts/collect-batch.ts` has no `try`/`catch` at all: add per-item handling so one malformed result does not abort a whole batch collection. **This one is a small fix and may be taken at any time**; the script is a seeding tool and outlives the migration.
- [ ] Dedup session components. `Centered` is byte-identical in all four session files and `RATINGS` is duplicated across `study-session.tsx` / `grammar-session.tsx`. The normalization half is **already absorbed** by `src/lib/study-cards.ts` and `src/lib/grammar-cards.ts`, so do not re-derive it. Two duplications are **knowingly accepted**: `undoLastGrammarReview` mirroring `undoLastReview` (~20 lines differing only in table and key names, where factoring them together means passing Prisma delegates around), and `exam-session.tsx` keeping its own `HighlightedSentence` (next item). The first of those is likely **retired rather than fixed**: a unified studiable-item model would leave one table and one undo, so do not spend effort on it here.
- [ ] `exam-session.tsx:461`: local `HighlightedSentence` → the shared `src/components/highlighted-sentence.tsx`.
- [ ] Test the highlighted-sentence token pipeline. (The other half of this item, extracting the quiz/exam scoring helpers so they can be tested, **shipped on 2026-07-27** as `src/lib/word-similarity.ts`.)
- [ ] Log hygiene: audit `console.error` calls for payloads that should not be logged.
- [ ] Decide whether `.env:8`'s `NODE_OPTIONS=--max-old-space-size=256` cap is still wanted. It mirrors the Railway runtime budget, but `start:prod` sets its own 512MB anyway, and it OOM-kills local builds. The workaround is in CLAUDE.md; what is open is whether the cap should exist at all, and the migration may retire the question by replacing the build.

---

## Open questions

Tracked in SPEC.md §15.
