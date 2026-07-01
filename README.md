<p align="center">
  <img src="public/pi.svg" alt="Pī, the Bayana mascot — a little magenta parrot" width="160" height="179">
</p>

<h1 align="center">bayana <sub>ばやな</sub></h1>

<p align="center"><strong>A JLPT vocab + grammar trainer that doesn't get in your way.</strong></p>

Meet **Pī** (ピー) 🦜 — your tropical study buddy. Open the app, pick up where you left
off. No deck wrangling, no ads, no guilt-trips about streaks.

## Why?

I wanted to study JLPT vocab and bounced off the two obvious options:

- **Anki** — incredible, but *so much setup*. Decks, note types, add-ons, sync configs…
  I just wanted to start reviewing.
- **Duolingo** — fun, but ad-riddled, and there's **no real JLPT course**.

So Bayana is the thing in between: open it and study.

## What's inside

**Four study modes, each doing one thing well:**

| Mode | What it is |
|------|-----------|
| 🎴 **Flashcard** | Real spaced repetition (FSRS, the engine modern Anki runs on). Cards come back right as you're about to forget them. |
| ⚡ **Quiz** | Fast multiple-choice rounds — like Duolingo, minus the ads and the guilt-trips. Good for a two-minute gap. |
| 📝 **Exam** | A timed JLPT-style benchmark: kanji reading (問題１) then kanji writing (問題２), 10 questions each. Tells you where you actually stand. |
| 🗒️ **Grammar** | A separate FSRS queue for JLPT grammar points — 220 patterns across 22 lessons (N3 v1). Same flip-and-rate loop as Flashcard mode, plus a browsable lesson-by-lesson reference. |

**Everything else:**

- 🤖 **AI example sentences** — every vocabulary word comes with a sentence pitched to its
  JLPT level, so it sticks in context, not in a vacuum (written once by Claude Haiku, cached
  forever in Postgres; ~$2.55 for 8,100 words).
- 🔍 **Browse & search** — whole-deck lookup with live filtering and 50/page pagination.
  Tap any word to reveal its example sentence. Grammar has its own browse view too, grouped
  by lesson with search across pattern, reading, and meaning.
- 📱 **Mobile-first PWA** — thumb-friendly, installable to your home screen
  (fullscreen on Android, standalone on iOS). Designed for the iPhone SE (375 × 667 px)
  baseline.
- 🈁 **~8,800 vocab words, N5 → N1** — ready from day one, all with cached example
  sentences.

## Try it

Hit **Try a demo** on the landing page — no account needed. You'll get a private ephemeral
session (a 7-day cookie, no email required) and land straight in onboarding. Sign up with
a magic link if you want your progress to persist.

## Develop locally

Prereqs: **Node 20+** and **Docker**.

```bash
cp .env.example .env     # fill values in as features need them
docker compose up -d     # Postgres on localhost:5887
npm install
npx prisma migrate dev   # create tables + generate the Prisma client
npx tsx scripts/seed-user.ts        # create the default local user
npx tsx scripts/import-csv.ts       # import vocab from decks/*.csv
npx tsx scripts/seed-grammar.ts     # import grammar from decks/grammar-*.md
npm run dev              # http://localhost:3887
```

Ports are themed 887 (ば・や・な 🙂): Postgres `5887`, app `3887`.

To skip the magic-link round-trip locally, set `DEV_AUTH=1` in `.env` and visit
`/api/dev/login` — it mints a real session for the seeded user (404 in production).

## The nerdy details

Architecture, data model, generation pipeline, and the *why* behind every decision live in
**[SPEC.md](SPEC.md)** — including a running decision log, because future-me forgets.
Look + feel, palette, typography, and Pī himself are in **[BRAND.md](BRAND.md)**.

Built with Next.js 16 + Prisma + Postgres + `ts-fsrs`, deployed on Railway.

## Credits

Vocabulary from [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) (MIT). 🙏

Grammar content is adapted from a commercial JLPT course, so `decks/grammar-*.md` is
gitignored rather than committed — bring your own deck in the same format to seed that
table (see `scripts/seed-grammar.ts`).
