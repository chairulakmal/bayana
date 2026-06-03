# TODO — Bayana

Execution checklist and progress tracker. **Plan and rationale live in
[SPEC.md](SPEC.md)** (§13 Milestones, §16 Decision log); this file only tracks *task
state* — what's done and what's next. Keep it current; it's the "where we left off"
record across sessions. Decisions do **not** go here — log them in SPEC.md §16.

**Now:** Phase 1a → review API routes (queue/review/undo) + the card UI; then AI generation.

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
- [x] `scripts/import-csv.ts` — parse `decks/*.csv` → `Word` rows (quoted commas,
  `〜`/`(...)` placeholders, tag→level rules, `guid` unique key). N3 imported (2,140).
- [x] Seed the default `User` + `UserProfile` (`scripts/seed-user.ts`, idempotent);
  `DEFAULT_USER_ID` written to `.env`

### AI sentence generation (N3)
- [ ] Prompt design + `POST /api/generate` (on-demand); **validate JSON output**;
  sanity-check on ~5 N3 words
- [ ] `scripts/seed-sentences.ts` — Batch API submit (N3)
- [ ] `scripts/collect-batch.ts` — poll + upsert `ExampleSentence`; skip/log malformed

### Anki mode — review loop (JP→EN)
- [x] `ts-fsrs` adapter (`src/lib/fsrs.ts`) — Card ⇄ ReviewState, scheduler, log mapping
- [x] Review services (`src/lib/review.ts`) — `reviewWord` (+ `ReviewLog`),
  `undoLastReview` (ts-fsrs `rollback`), `getStudyQueue` — verified end-to-end
- [ ] API route handlers: `GET /api/cards/queue`, `POST /api/review`, undo endpoint
- [ ] Mobile-first card UI: flip + rate + undo (iPhone SE baseline)

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
