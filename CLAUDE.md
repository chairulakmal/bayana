# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this project is

**Bayana** — a mobile-first, spaced-repetition JLPT vocabulary and grammar web app with
AI-generated example sentences. It turns an existing ~8,100-word Anki deck (N5–N1) into
flashcards scheduled by FSRS, where each word is paired with example sentences generated
once by Claude Haiku and cached in Postgres. Four study modes: **Flashcard** (serious SRS
recall), **Quiz** (gamified multiple choice), **Exam** (JLPT-style benchmark), and
**Grammar** (a separate FSRS queue). Details in SPEC.md §8.

**[SPEC.md](SPEC.md) is the single source of truth** for the design — architecture,
data model, generation pipeline, security, milestones, and the rationale behind every
major decision. Read it before proposing or implementing anything, and **keep it
updated** when a decision changes (it is a living design doc, not a frozen artifact).

**[BRAND.md](BRAND.md) is the single source of truth** for the styles and brand voice
(it is the committed one; the interactive guide it was distilled from is local-only).

**[README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md) are the public face** of
the repo, written for a general technical audience. Every claim in them must be true of
the code as it stands; when behaviour changes, they change in the same commit.

## Primary goal: this is a learning project

**The point of Bayana is to improve the author's development skills, not just to ship
software.** Optimize every interaction for the author's understanding and growth, even
when that is slower than doing it yourself. Concretely:

- **Explain the "why," not just the "what."** When you write or suggest code, briefly
  explain the reasoning, the alternatives, and the tradeoffs — the same way SPEC.md does.
- **Teach, then build.** Prefer walking through an approach and letting the author write
  or drive the non-trivial parts. Offer to hand off implementation rather than
  autocompleting everything in one shot.
- **Don't over-deliver silently.** Avoid dumping large amounts of finished code without
  context. Smaller, explained increments the author can follow beat a big opaque diff.
- **Surface decisions instead of hiding them.** When you hit a fork (a library choice, a
  data-modeling call, an API shape), name it, give the options and tradeoffs, and let the
  author decide — mirroring the "Alternatives considered" discipline in SPEC.md.
- **Point to fundamentals.** Where a concept is new (FSRS scheduling, prompt caching,
  Auth.js sessions, Next.js Server Actions), explain the underlying idea, not just the
  incantation, and link to docs when useful.
- **Encourage good habits.** Nudge toward typing, tests, small commits, and reading error
  messages — but explain the benefit rather than asserting the rule.

When the author explicitly asks you to "just do it," do it — but the default mode is
collaborative and explanatory.

## Tech stack and Next.js 16 trip-wires

- **The stack is decided; do not restate or relitigate it here.** It is a single full-stack Next.js 16 service, and every component choice plus its rationale lives in SPEC.md §5/§5.1 (with rejected alternatives in §14.1); check there before adding a dependency or proposing a split backend.
- **Route guards live in `proxy.ts` at the project root, never `middleware.ts`.** Next.js 16 renamed middleware to proxy, and a `middleware.ts` file is silently ignored, leaving every route unguarded. Full mechanics (export shape, matcher, Node.js runtime, root location): SPEC.md §11.9.

## Project layout

- `SPEC.md` — the design document. Start here.
- `DECISIONS.md` — the dated, append-only decision log (extracted from SPEC §16).
- `decks/*.csv` — the source JLPT vocabulary (MIT-licensed open-anki-jlpt-decks), one
  file per level. Committed. `decks/grammar-*.md` is **gitignored** (source not licensed
  for redistribution, SPEC.md §4.1), so grammar seeding needs a locally supplied deck.

## Working agreements

- **Status:** live on Railway; Phases 1a through 3.5 are shipped and Phase 3 (MC↔FSRS
  coupling) is next. Current state is in [TODO.md](TODO.md), the plan in SPEC.md §13.
  Confirm scope against both before large changes.
- **Track execution state in [TODO.md](TODO.md); keep it current.** It holds **open work
  only**: delete an item in the commit that lands it rather than archiving it, since
  shipped work is already recorded by SPEC.md §13 (design altitude), DECISIONS.md (why),
  and git (detail). The plan/rationale stays in SPEC.md and decisions go in DECISIONS.md,
  never in TODO.md.
- **Document decisions and tradeoffs as part of the same change.** Whenever a design
  choice is made or changed, record it so the docs and code never drift — and don't just
  record the *what*, capture the *why*: the reasoning, the options weighed, and what was
  given up. All three steps, every time:
  - State the chosen approach in SPEC.md where it lives (the relevant section), with a
    one-line rationale.
  - For any non-trivial fork, add (or update) an entry in **SPEC.md §14 Alternatives
    considered** naming the rejected option and *why* it lost.
  - Append a dated, newest-first row to **[DECISIONS.md](DECISIONS.md)**. Entries may be
    *trimmed* for brevity, but **never change an entry's date or reorder rows** — the
    chronology is the record. This step is not optional just because it is a second file.
  - Update the **Status / Last updated** header and, if scope shifts, the **Milestones**
    and **Open questions** sections.
- **Keep SPEC.md in formal "Google-style" design-doc language** — neutral, precise prose,
  including §14 and DECISIONS.md. The register is part of the deliverable.
  - When a decision was the author's call (a fork surfaced per the learning goal above),
    note who decided and the deciding factor, so it isn't relitigated later.
- **Security is not deferred** even though it's single-user: follow SPEC.md §11
  (magic-link hardening, server-only secrets, authenticated cost-incurring endpoints).
- **Secrets** live only in environment variables (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
  `AUTH_SECRET`, `DATABASE_URL`, `AUTH_ALLOWED_EMAIL`) — never commit them.
- **Cost awareness:** sentence generation costs real money. Always prefer the cache; the
  Batch API and prompt caching exist to keep the one-time fill cheap (SPEC.md §7).
- **Write code for review, not just for the machine** — this is a learning project. All
  non-trivial code must be well-documented so the author can read and learn from it:
  - A short header comment on each file/module stating its purpose and where it fits.
  - Doc comments on exported functions/types: what it does, *why*, params, and return.
  - Inline comments explaining the *why* behind any non-obvious logic, tradeoff, or
    algorithm (e.g. FSRS math, distractor confusability scoring, batch polling).
  - Favor clarity over cleverness; prefer readable code the author can follow over terse
    one-liners. Comments explain reasoning, not restate the obvious.
