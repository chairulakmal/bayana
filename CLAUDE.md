# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this project is

**Bayana** — a mobile-first, spaced-repetition JLPT vocabulary web app with
AI-generated example sentences. It turns an existing ~8,800-word Anki deck (N5–N1) into
flashcards scheduled by FSRS, where each word is paired with example sentences generated
once by Claude Haiku and cached in Postgres. Two study modes: **Flashcard mode** (serious SRS
recall) and **Quiz mode** (gamified multiple choice).

**[SPEC.md](SPEC.md) is the single source of truth** for the design — architecture,
data model, generation pipeline, security, milestones, and the rationale behind every
major decision. Read it before proposing or implementing anything, and **keep it
updated** when a decision changes (it is a living design doc, not a frozen artifact).

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

## Tech stack (decided — see SPEC.md for rationale)

- **Full-stack Next.js 16** (App Router, React 19, Turbopack) — a single deployable; UI +
  API (Route Handlers / Server Actions) + FSRS logic + Anthropic integration in one
  service. Not a split frontend/backend (see SPEC.md §5.1 and §14.1 for why).
- **TypeScript** end-to-end.
- **Postgres** via **Prisma**.
- **FSRS** scheduling via `ts-fsrs`.
- **Claude Haiku** via `@anthropic-ai/sdk`, using the **Batch API** for bulk sentence
  generation and **prompt caching** for the shared system prompt.
- **Auth.js** Email provider (passwordless magic link) via **Resend**, single-email
  allowlist at launch.
- **Tailwind CSS v4** (PostCSS plugin), mobile-first (iPhone SE 375×667 baseline).
- **Railway** for hosting (1 web service + Postgres plugin).

## Next.js 16 gotchas

- **Route guards use `proxy.ts`, not `middleware.ts`.** v16 renamed middleware →
  proxy; a `middleware.ts` file is **ignored**. Export a function named `proxy` (type
  `NextProxy`, or use `NextRequest`/`NextResponse` from `next/server` as before). A
  `config.matcher` array still scopes which paths it runs on. The proxy runs in the
  **Node.js runtime** by default (not Edge).

## Project layout

- `SPEC.md` — the design document. Start here.
- `decks/*.csv` — the source JLPT vocabulary (MIT-licensed open-anki-jlpt-decks), one
  file per level, plus `decks/templates/` (original Anki card templates, a styling
  reference). This is committed; the gitignored files are not the source of truth.

## Working agreements

- **Status:** early build. SPEC.md is settled enough to start Phase 1 (see its
  Milestones section). Confirm scope against SPEC.md before large changes.
- **Track execution state in [TODO.md](TODO.md); keep it current.** It is the
  cross-session "where we left off" checklist. Boundary: TODO.md holds *task state* only —
  the plan/rationale stays in SPEC.md (§13 Milestones) and decisions go in SPEC.md §16,
  never in TODO.md.
- **Document decisions and tradeoffs in SPEC.md as part of the same change.** Whenever a
  design choice is made or changed, record it in SPEC.md so the doc and code never drift —
  and don't just record the *what*, capture the *why*: the reasoning, the options weighed,
  and what was given up. Follow the doc's existing discipline:
  - State the chosen approach where it lives (the relevant section), with a one-line
    rationale.
  - For any non-trivial fork, add (or update) an entry in **§14 Alternatives considered**
    naming the rejected option and *why* it lost.
  - Append a dated, newest-first row to the **§16 Decision log**. Entries may be *trimmed*
    for brevity, but **never change an entry's date or reorder rows** — the chronology is
    the record.
  - Update the **Status / Last updated** header and, if scope shifts, the **Milestones**
    and **Open questions** sections.
- **Keep SPEC.md in formal "Google-style" design-doc language** — neutral, precise prose,
  including its decision logs (§14 and §16). The doc's register is part of the deliverable.
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
