# TODO — Bayana

Execution checklist and progress tracker. **Plan and rationale live in
[SPEC.md](SPEC.md)** (§13 Milestones, §16 Decision log); this file only tracks *task
state* — what's done and what's next. Keep it current; it's the "where we left off"
record across sessions. Decisions do **not** go here — log them in SPEC.md §16.

**Now:** Phase 1a → Data import: `scripts/import-csv.ts` for `decks/n3.csv`.

---

## ▶ Phase 1a — Playable slice (run locally, study ASAP)

Goal: a locally-running app you can actually study N3 with. No auth, no deploy yet.

### Foundation
- [x] Initialize git repo
- [x] Scaffold Next.js 16 app (TS, App Router, Tailwind v4) — builds clean
- [x] Add Prisma + `@prisma/client`; `docker-compose.yml` for local Postgres (port 5887);
  `.env` + `.env.example`; verify DB connection
- [x] Write `prisma/schema.prisma` from SPEC §6 — `User`, `UserProfile`, `Word`,
  `ExampleSentence`, `ReviewState`, **`ReviewLog`** + enums; first migration applied;
  `src/lib/db.ts` client singleton (Prisma 7 + `@prisma/adapter-pg`) — connection verified

### Data import (N3 only for now)
- [ ] `scripts/import-csv.ts` — parse `decks/n3.csv` → `Word` rows (quoted commas,
  `〜`/`(...)` placeholders, tag→level rules, `guid` unique key)
- [ ] Seed the default `User` + `UserProfile`

### AI sentence generation (N3)
- [ ] Prompt design + `POST /api/generate` (on-demand); **validate JSON output**;
  sanity-check on ~5 N3 words
- [ ] `scripts/seed-sentences.ts` — Batch API submit (N3)
- [ ] `scripts/collect-batch.ts` — poll + upsert `ExampleSentence`; skip/log malformed

### Anki mode — review loop (JP→EN)
- [ ] `ts-fsrs` adapter (map `ReviewState` ⇄ ts-fsrs `Card`)
- [ ] `GET /api/cards/queue` (due + capped NEW cards, day boundary via `UserProfile`)
- [ ] `POST /api/review` — apply FSRS, write `ReviewState` **and append `ReviewLog`**
- [ ] **One-step undo** (restore prior state from `ReviewLog`)
- [ ] Mobile-first card UI: flip + rate (iPhone SE baseline)

### Done when
- [ ] Run locally and study N3 end-to-end off the app

---

## Phase 1b — Shippable (public)
- [ ] Magic-link auth (Auth.js + Resend, single-email allowlist) + §11.3 hardening +
  `proxy.ts` guard
- [ ] Import + seed remaining levels (N5/N4/N2/N1)
- [ ] Deploy to Railway; enable daily backups

## Phase 2+ (later)
See SPEC.md §13 — Duolingo mode, suspend/leech, stats, multi-user, enhancements.

## Open questions
Tracked in SPEC.md §15.
