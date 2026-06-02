# TODO — Bayana

Execution checklist and progress tracker. **Plan and rationale live in
[SPEC.md](SPEC.md)** (§13 Milestones, §16 Decision log); this file only tracks *task
state* — what's done and what's next. Keep it current; it's the "where we left off"
record across sessions. Decisions do **not** go here — log them in SPEC.md §16.

**Now:** Foundation — about to start Prisma + Docker Postgres + schema.

---

## Phase 1 — MVP (single user)

### Foundation
- [x] Initialize git repo
- [x] Scaffold Next.js 16 app (TS, App Router, Tailwind v4) — builds clean
- [ ] **(a)** Add Prisma + `@prisma/client`; `docker-compose.yml` for local Postgres;
  `.env` + `.env.example`; verify DB connection
- [ ] **(b)** Write `prisma/schema.prisma` from SPEC §6 (Word, ExampleSentence,
  ReviewState, User + enums); first migration; `src/lib/db.ts` client singleton

### Data import
- [ ] `scripts/import-csv.ts` — parse `decks/*.csv` → Word rows (handle quoted commas,
  `〜`/`(...)` placeholders, tag→level rules; `guid` as unique key)
- [ ] Seed the single default `User`

### AI sentence generation
- [ ] On-demand path: `POST /api/generate` + prompt design, validate on ~5 N3 words
- [ ] `scripts/seed-sentences.ts` — Batch API submit (N3 first)
- [ ] `scripts/collect-batch.ts` — poll + upsert ExampleSentence rows

### Auth
- [ ] Auth.js Email provider via Resend, single-email allowlist (`proxy.ts` route guard)
- [ ] §11.3 hardening (token TTL, single-use, rate limit, secure session)

### Study UI (Anki mode)
- [ ] Daily queue (`/api/cards/queue`) + FSRS via `ts-fsrs` (`/api/review`)
- [ ] Mobile-first card UI (flip, rate; iPhone SE baseline)

### Deploy
- [ ] Railway: web service + Postgres; env vars; migrate + import + seed

---

## Phase 2+ (later)
See SPEC.md §13 — Duolingo mode, multi-user, enhancements.

## Open questions
Tracked in SPEC.md §15.
