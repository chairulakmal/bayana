# 🦜 Bayana

**A JLPT vocab trainer that doesn't get in your way.**

Learn Japanese words with spaced repetition + AI-written example sentences — on your
phone, in the gaps of your day.

## Why?

I wanted to study JLPT vocab and bounced off the two obvious options:

- **Anki** — incredible, but *so much setup*. Decks, note types, add-ons, sync configs…
  I just wanted to start reviewing.
- **Duolingo** — fun, but ad-riddled, and there's **no real JLPT course**.

So Bayana is the thing in between: open it and study. No deck wrangling, no ads, JLPT
N5–N1 built in.

## What you get

- 🎴 **Anki mode** — proper spaced repetition (FSRS, the same algorithm modern Anki uses).
- ⚡ **Duolingo mode** — quick, gamified multiple-choice for momentum.
- 🤖 **AI example sentences** — every word gets a level-appropriate sentence (written once
  by Claude Haiku, cached forever), because words stick better in context.
- 📱 **Mobile-first** — designed for your phone, fine on a laptop.
- 🈁 **~8,800 words, N5 → N1** — ready to go.

## Status

Early days — being built in the open as a learning project. 🚧

## The nerdy details

Want the architecture, data model, generation pipeline, and *why* behind every choice?
It's all in **[SPEC.md](SPEC.md)** (with a decision log, because future-me forgets).

Built with Next.js 16 + Postgres, deployed on Railway.

## Credits

Vocabulary from [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks)
by Jam Sinclair (MIT). 🙏
