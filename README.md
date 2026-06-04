<p align="center">
  <img src="public/pi.svg" alt="Pī, the Bayana mascot — a little magenta parrot" width="160" height="179">
</p>

<h1 align="center">bayana <sub>ばやな</sub></h1>

<p align="center"><strong>A JLPT vocab trainer that doesn't get in your way.</strong></p>

Meet **Pī** (ピー) 🦜 — your tropical study buddy. Learn Japanese words with spaced
repetition + AI-written example sentences, on your phone, in the gaps of your day.

## Why?

I wanted to study JLPT vocab and bounced off the two obvious options:

- **Anki** — incredible, but *so much setup*. Decks, note types, add-ons, sync configs…
  I just wanted to start reviewing.
- **Duolingo** — fun, but ad-riddled, and there's **no real JLPT course**.

So Bayana is the thing in between: open it and study. No deck wrangling, no ads, JLPT
N5–N1 built in.

## What you get

- 🎴 **Flashcard mode** — real spaced repetition (FSRS, the same engine modern Anki runs
  on). Cards come back right as you're about to forget them.
- ⚡ **Quiz mode** — fast multiple-choice rounds for when you want momentum, not a marathon
  (like Duolingo, minus the ads and the guilt-trips).
- 🤖 **AI example sentences** — every word comes with a sentence pitched to its level, so it
  sticks in context, not in a vacuum (written once by Claude Haiku, kept forever).
- 📱 **Mobile-first** — thumb-friendly, made to fit between train stops; fine on a laptop too.
- 🈁 **~8,800 words, N5 → N1** — ready from day one.

## Status

Early days — being built in the open as a learning project. 🚧

## Develop locally

Prereqs: **Node 20+** and **Docker**.

```bash
cp .env.example .env     # fill values in as features need them
docker compose up -d     # Postgres on localhost:5887
npm install
npx prisma migrate dev   # create tables + generate the Prisma client
npm run dev              # http://localhost:3887
```

Ports are themed 887 (ば・や・な 🙂): Postgres `5887`, app `3887`.

## The nerdy details

Want the architecture, data model, generation pipeline, and *why* behind every choice?
It's all in **[SPEC.md](SPEC.md)** (with a decision log, because future-me forgets). The
look, feel, palette, and Pī himself live in **[BRAND.md](BRAND.md)**.

Built with Next.js 16 + Prisma + Postgres, deployed on Railway.

## Credits

Vocabulary from [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) (MIT). 🙏
