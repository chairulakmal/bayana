# CLAUDE.md

Guidance for Claude Code working in this repository. **The rule that matters most: every design decision is recorded in SPEC.md and DECISIONS.md in the same commit that makes it, so the documentation and the code never drift.** Below, in order: what the project is and which document owns what, the ranked objectives that settle open forks, the stack and its trip-wires, the layout, how to run it, and the working agreements.

Read [TODO.md](TODO.md)'s Sequence section before starting anything: most of the backlog is deliberately frozen, and it names what is actually in scope today.

## What this project is

**Bayana** is a mobile-first, spaced-repetition JLPT vocabulary and grammar web app with AI-generated example sentences. It turns an existing ~8,100-word Anki deck (N5–N1) into flashcards scheduled by FSRS, where each word is paired with example sentences generated once by Claude Haiku and cached in Postgres. Four study modes: **Flashcard** (serious SRS recall), **Quiz** (gamified multiple choice), **Exam** (JLPT-style benchmark), and **Grammar** (a separate FSRS queue). Details in SPEC.md §8.

**[SPEC.md](SPEC.md) is the single source of truth** for the design: architecture, data model, generation pipeline, security, milestones, and the rationale behind every major decision. Read it before proposing or implementing anything, and **keep it updated** when a decision changes (it is a living design doc, not a frozen artifact).

**[BRAND.md](BRAND.md) is the single source of truth** for the styles and brand voice (it is the committed one; the interactive guide it was distilled from is local-only).

**[README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md) are the public face** of the repo, written for a general technical audience. Every claim in them must be true of the code as it stands; when behaviour changes, they change in the same commit.

## North star: four ranked objectives

**[SPEC.md](SPEC.md) §2 states the project's north star, and it is the tie-breaker on every open fork.** Read the ranking before proposing scope; when two objectives point different ways, apply the order rather than settling it in passing, and say which one you applied so the author can log it.

1. **Be the best study app for its loyal users.** Today that is one person, the author, and that is the standard rather than a placeholder: measurable improvement to the author's daily review loop outranks breadth or a hypothetical audience. It is why the app optimizes for retention and daily return over acquisition.
2. **Be the reference consumer of bayan.** Built on the dataset and grading its releases into a real scheduler, not importing questions into a corner of the app (SPEC §4.3).
3. **Be a learning vehicle for the author, scoped to mobile layout, PWA, and design implementation.** Real, but third, and the rank bounds it: it justifies taking the harder path *within* a piece of work far more readily than it justifies choosing the work. Outside those three areas, prefer the boring option.
4. **Be a current Nuxt application.** Nuxt 4 at the migration, Nuxt 5 once stable. The author contributes to Nuxt upstream, so currency is dogfooding rather than churn. This objective, not objective 3, is what argues for Nuxt specifically: mobile layout, PWA and design work are framework-independent.

### Objective 3 in practice: how to work with the author

**Optimize every interaction for the author's understanding and growth, even when that is slower than doing it yourself.** This part is about *how* the work is done and applies to every task, not only to the three scoped areas above. Concretely:

- **Explain the "why," not just the "what."** When you write or suggest code, briefly explain the reasoning, the alternatives, and the tradeoffs, the same way SPEC.md does.
- **Teach, then build.** Prefer walking through an approach and letting the author write or drive the non-trivial parts. Offer to hand off implementation rather than autocompleting everything in one shot.
- **Don't over-deliver silently.** Avoid dumping large amounts of finished code without context. Smaller, explained increments the author can follow beat a big opaque diff.
- **Surface decisions instead of hiding them.** When you hit a fork (a library choice, a data-modeling call, an API shape), name it, give the options and tradeoffs, and let the author decide, mirroring the "Alternatives considered" discipline in SPEC.md.
- **Point to fundamentals.** Where a concept is new (FSRS scheduling, prompt caching, Auth.js sessions, Next.js Server Actions), explain the underlying idea, not just the incantation, and link to docs when useful.
- **Encourage good habits.** Nudge toward typing, tests, small commits, and reading error messages, but explain the benefit rather than asserting the rule.

When the author explicitly asks you to "just do it," do it, but the default mode is collaborative and explanatory.

## Stack and trip-wires

- **The stack is decided; do not restate or relitigate it here.** It is a single full-stack Next.js 16 service, and every component choice plus its rationale lives in SPEC.md §5/§5.1 (with rejected alternatives in §14.1); check there before adding a dependency or proposing a split backend.
- **A migration to Nuxt is decided but not started** (2026-07-26), as a greenfield app that takes over the production URL. **Target Nuxt 4, and Nuxt 5 once it is stable**, per north-star objective 4; never scaffold against an older major. Scope, open forks, and what does and does not port are in TODO.md, "Gate 2". Until it starts, this is a Next.js 16 app and the Next.js rules in this section still apply; weigh any large Next-specific refactor against the fact that it will be discarded or done twice.
- **Brand v2 for the Nuxt app lives outside this repo, in the Claude Design project "Bayana"** (`94b90684-2ec4-4a65-899e-3699eb016db4`, read over the `claude_design` MCP; run `/design-login` if the read fails). Its `bayana-brand/` folder holds the v2 guide and `nuxt/` a drop-in token and component bundle. Read it before writing any UI, token, or mascot code for the Nuxt app, but treat it as **a proposal, not an adopted spec**: it contradicts BRAND.md on dark mode, the mascot cast, gamification, the app-icon colour and the text ramp. **BRAND.md wins until a fork is settled**; the forks are listed in TODO.md under "Brand v2".
- **Route guards live in `proxy.ts` at the project root, never `middleware.ts`.** Mechanics (export shape, matcher, Node.js runtime) are in SPEC.md §11.9.

## Project layout

- `SPEC.md`: the design document. Start here.
- `DECISIONS.md`: the dated, append-only decision log. Newest first; rows are never reordered or re-dated.
- `TODO.md`: open work only, and the authority on what is in scope right now.
- `src/lib/`: the framework-independent core (FSRS adapter, quiz and exam construction, review flows). It is the layer that survives the Nuxt migration close to verbatim.
- `decks/*.csv`: the source JLPT vocabulary (MIT-licensed open-anki-jlpt-decks), one file per level. Committed. `decks/grammar-*.md` is **gitignored** (source not licensed for redistribution, SPEC.md §4.1), so grammar seeding needs a locally supplied deck.

**Sibling projects** (separate repos on this machine at `~/Desktop/`, not derivable from this codebase): **bayan/zaka** (<https://github.com/bayan-exam>), a CC BY 4.0 JLPT dataset that is to become this app's **single source of vocabulary, grammar, sentences and questions** (SPEC §4.3; read bayan's own repo before assuming what it supplies, since most of that is not built yet), and **Kalima**, whose JLPT mock exam is to be absorbed into this app later. Planned, not built: scope in SPEC.md §2/§4.2, milestone in §13, checklists in TODO.md (the bayan consumer is Gate 2; the Kalima absorption is frozen behind it), and Kalima's own porting checklist in that repo.

## Running it locally

- **`npm run dev` starts Postgres (`docker compose up -d`) and serves on port 3887**, not 3000. The author runs the dev server; inspect it with `curl localhost:3887`.
- **`next build` OOMs locally.** `.env` pins `NODE_OPTIONS=--max-old-space-size=256`, mirroring the Railway runtime budget, and that kills the TypeScript worker mid-build. Use `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.
- **`npm test`** runs Vitest once; `npm run test:watch` watches.
- **Verify a change with `npm run lint` and `npm test`.** There is no typecheck script, so a full build is the only type check, and it needs the memory override above.

## Working agreements

- **Status and current scope:** live on Railway (SPEC.md's Status header names the shipped phases, §13 the plan). **Three workstreams are live** as of 2026-07-27: the UI/UX items, the legal pages, and pinning `src/lib` with characterization tests. Everything else is frozen behind two gates, in this order: **bayan reaching production (Gate 1), then the Nuxt migration (Gate 2)** that is seeded from it. **No new features land before both clear.** Fatal bugs and small fixes are always in scope. TODO.md is authoritative on all of this and changes faster than this file; do not pull frozen work in as filler.
- **Track execution state in [TODO.md](TODO.md); keep it current.** It holds **open work only**: delete an item in the commit that lands it rather than archiving it, since shipped work is already recorded by SPEC.md §13 (design altitude), DECISIONS.md (why), and git (detail). The plan/rationale stays in SPEC.md and decisions go in DECISIONS.md, never in TODO.md.
- **Document decisions and tradeoffs as part of the same change.** Whenever a design choice is made or changed, record it so the docs and code never drift, and don't just record the *what*, capture the *why*: the reasoning, the options weighed, and what was given up. All three steps, every time:
  - State the chosen approach in SPEC.md where it lives (the relevant section), with a one-line rationale.
  - For any non-trivial fork, add (or update) an entry in **SPEC.md §14 Alternatives considered** naming the rejected option and *why* it lost.
  - Append a dated, newest-first row to **[DECISIONS.md](DECISIONS.md)**. Entries may be *trimmed* for brevity, but **never change an entry's date or reorder rows**: the chronology is the record. This step is not optional just because it is a second file.
  - Update the **Status / Last updated** header and, if scope shifts, the **Milestones** and **Open questions** sections.
- **Keep SPEC.md in formal "Google-style" design-doc language**: neutral, precise prose, including §14 and DECISIONS.md. The register is part of the deliverable.
  - When a decision was the author's call (a fork surfaced per objective 3), note who decided and the deciding factor, so it isn't relitigated later.
- **Security is not deferred** even though it's single-user: follow SPEC.md §11 (magic-link hardening, server-only secrets, authenticated cost-incurring endpoints).
- **Secrets** live only in environment variables and are never committed. `.env.example` is the canonical list; keep it in sync when a variable is added. Two are security-relevant rather than merely configuration: `AUTH_SECRET` signs both the session and the demo cookie, and `DEV_AUTH=1` opts into the auth bypass that must stay impossible in production (SPEC.md §11.7).
- **Cost awareness:** sentence generation costs real money. Always prefer the cache; the Batch API and prompt caching exist to keep the one-time fill cheap (SPEC.md §7).
- **Write code for review, not just for the machine** (objective 3). All non-trivial code must be well-documented so the author and future collaborators can read and effectively learn and work on it:
  - A short header comment on each file/module stating its purpose and where it fits.
  - Doc comments on exported functions/types: what it does, *why*, params, and return.
  - Inline comments explaining the *why* behind any non-obvious logic, tradeoff, or algorithm (e.g. FSRS math, distractor confusability scoring, batch polling).
  - Favor clarity over cleverness; prefer readable code the author can follow over terse one-liners. Comments explain reasoning, not restate the obvious.
