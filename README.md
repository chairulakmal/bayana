<p align="center">
  <img src="public/pi.svg" alt="Pī, the Bayana mascot, a little magenta parrot" width="160" height="179">
</p>

<h1 align="center">Bayana <sub>ばやな</sub></h1>

<p align="center"><strong>A JLPT vocab + grammar trainer that doesn't get in your way.</strong></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Bayana is a mobile-first JLPT study PWA: one Next.js 16 service that schedules ~8,100 vocabulary words and 220 N3 grammar points with FSRS (the algorithm modern Anki runs on), where every word carries an example sentence written once by Claude Haiku through the Batch API and cached in Postgres (about $2.55 for the entire deck, paid once). This README covers the study modes, the engineering highlights, the stack, local setup, and tests; [ARCHITECTURE.md](ARCHITECTURE.md) walks the design decisions behind them.

**Live demo:** [bayana.chairulakmal.com](https://bayana.chairulakmal.com). "Try the demo" needs no account and no email: one click mints a private ephemeral session and lands you in onboarding.

The motivation is the gap between the two obvious options. Anki is incredible but demands setup (decks, note types, add-ons, sync configs), and Duolingo is fun but ad-riddled with no real JLPT course. Bayana is the thing in between: open it and study, guided by Pī, with no deck wrangling, no ads, and no guilt-trips about streaks.

## Study modes

| Mode | What it is |
|------|-----------|
| **Flashcard** | Real spaced repetition (FSRS). Cards come back right as you're about to forget them. |
| **Quiz** | Fast multiple-choice rounds with confusability-scored distractors. Good for a two-minute gap. |
| **Exam** | A JLPT-style benchmark: kanji reading (問題１) then kanji writing (問題２), 10 questions each. Tells you where you actually stand. |
| **Grammar** | A separate FSRS queue for JLPT grammar points, 220 patterns across 22 lessons (N3 v1), plus a browsable lesson-by-lesson reference. |

There is also whole-deck browse and search with live filtering.

## Highlights

- **The FSRS integration is one pure module.** [src/lib/fsrs.ts](src/lib/fsrs.ts) is the only file that speaks the `ts-fsrs` dialect, it touches no database, and a shared `CardLike` type lets the vocabulary and grammar queues schedule through the same adapter. Purity is what makes [src/lib/fsrs.test.ts](src/lib/fsrs.test.ts) possible: it round-trips rows through persist-then-restore, which is exactly the cycle every card goes through between two study sessions.
- **Review writes are serializable, with retry.** Every rating reads a card's state, runs the FSRS math in JavaScript, and writes it back, so a double-tapped rating button would otherwise be a textbook lost update. `serializableTxn` ([src/lib/db.ts](src/lib/db.ts)) runs each one at SERIALIZABLE isolation and re-runs the loser of a conflict; undo replays the `ts-fsrs` rollback and deletes the log row inside the same guarantee ([src/lib/review.ts](src/lib/review.ts)).
- **AI example sentences are a one-time cost, not a running one.** [src/lib/generate.ts](src/lib/generate.ts) builds requests around a shared, cache-marked system prompt with strict JSON validation, so junk is never stored; [scripts/seed-sentences.ts](scripts/seed-sentences.ts) submits an Anthropic Batch job and [scripts/collect-batch.ts](scripts/collect-batch.ts) polls and writes the results. The full five-level seed (~8,100 words) cost about $2.55, measured on the Anthropic console.
- **Quiz distractors are scored for confusability, not picked at random.** [src/lib/quiz.ts](src/lib/quiz.ts) blends shared kanji (Jaccard overlap) with reading similarity (edit distance) to surface options you might actually confuse, while a meaning-overlap guard rejects any candidate close enough to be a second right answer. [src/lib/exam.ts](src/lib/exam.ts) applies the same signals per question type.
- **A demo session is a signed cookie and nothing else.** No account, no server-side session row: the HMAC covers both the userId and a server-enforced expiry ([src/lib/current-user.ts](src/lib/current-user.ts)). The mint endpoint is POST-only with an Origin check and per-IP plus global rate limits, and expired demo rows are cleaned up opportunistically ([src/app/api/demo/login/route.ts](src/app/api/demo/login/route.ts)).
- **The route guard is deliberately cheap.** [proxy.ts](proxy.ts), Next.js 16's rename of `middleware.ts`, checks cookie presence and rate-limits on the one X-Forwarded-For hop a client cannot spoof; real session verification happens server-side on every page and API route. Sign-in itself is a passwordless magic link (Auth.js + Resend) restricted to an email allowlist ([src/auth.ts](src/auth.ts)).
- **It installs like an app.** A mobile-first PWA designed against the iPhone SE (375 × 667) baseline, with the manifest generated in code ([src/app/manifest.ts](src/app/manifest.ts)), fullscreen on Android and standalone on iOS.

## Stack

| Layer | What the code pins |
|---|---|
| App | Next.js 16.2.7 (App Router), React 19.2.4, TypeScript 5.9 |
| Data | Prisma 7.8 via the `pg` driver adapter, PostgreSQL 16 (Docker locally, Railway managed in production) |
| Scheduling | ts-fsrs 5.4 |
| AI | @anthropic-ai/sdk 0.100, model `claude-haiku-4-5` (Messages + Batch API) |
| Auth | Auth.js (next-auth 5 beta) with Resend magic links, plus signed demo cookies |
| Styling | Tailwind CSS 4 |
| Tests | Vitest 4 |
| Deploy | Railway, Railpack builder ([railway.json](railway.json)) |

## Running locally

Prerequisites: Node 24+, Docker.

```bash
# 1. Environment and database (Postgres on localhost:5887)
cp .env.example .env
docker compose up -d

# 2. Install dependencies, create tables, generate the Prisma client
npm install
npx prisma migrate dev

# 3. Seed the default local user, then the vocabulary decks
npx tsx scripts/seed-user.ts
npx tsx scripts/import-csv.ts

# 4. App on http://localhost:3887
npm run dev
```

Ports are themed 887 (ば・や・な): Postgres `5887`, app `3887`. To skip the magic-link round-trip locally, set `DEV_AUTH=1` in `.env` and visit `/api/dev/login`; it mints a real session for the seeded user and 404s in production.

Two seeding steps are deliberately left out of the sequence above. Example sentences are generated separately (step 3 leaves them empty) because generation calls the Anthropic API and costs real money: run [scripts/seed-sentences.ts](scripts/seed-sentences.ts) and [scripts/collect-batch.ts](scripts/collect-batch.ts) with an `ANTHROPIC_API_KEY` if you want them. And `npx tsx scripts/seed-grammar.ts` needs a `decks/grammar-*.md` file that is gitignored on purpose: the grammar content comes from a source not licensed for redistribution, so the repo ships the schema and the seed script but you supply your own deck in the documented markdown shape (SPEC.md §4.1).

## Testing

One suite so far, aimed where a silent bug would do the most damage: [src/lib/fsrs.test.ts](src/lib/fsrs.test.ts) round-trips the FSRS adapter, because a mis-mapped scheduling field would never crash, it would just quietly corrupt weeks of review intervals. The module is pure, so `npm test` runs it in milliseconds ([vitest.config.ts](vitest.config.ts)). There is no CI pipeline yet.

## Design docs

[ARCHITECTURE.md](ARCHITECTURE.md) is the technical tour: six decisions, each stated as the choice, the reasoning, and the trade-off accepted, with file paths throughout. [SPEC.md](SPEC.md) is the full design document and the project's source of truth, including the alternatives analysis and a dated decision log. [BRAND.md](BRAND.md) owns the look: the palette, the typography, and Pī himself.

## Credits

Vocabulary from [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) (MIT).
