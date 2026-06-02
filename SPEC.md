# Bayana — Design Document

**Spaced-repetition JLPT vocabulary trainer with AI-generated example sentences.**

| | |
|---|---|
| **Status** | Draft |
| **Author** | Chairul Akmal |
| **Last updated** | 2026-06-03 |
| **Target platform** | Mobile-first responsive web (Next.js, deployed on Railway) |

---

## TL;DR

Bayana turns an existing ~8,800-word JLPT vocabulary deck (N5–N1, Anki export) into a
modern web flashcard app. Cards are scheduled with **FSRS** (the algorithm used by
current Anki), and each word is paired with **example sentences generated once by
Claude Haiku and cached permanently** in Postgres. It offers two study modes — a serious
spaced-repetition **"Anki mode"** and a fast, gamified multiple-choice **"Duolingo mode."**
The app ships as a **single
full-stack Next.js service** on Railway. It launches single-user with **passwordless
email magic-link authentication** (Auth.js + Resend, restricted to one allowlisted
address) and a data model that is multi-user-ready from day one.

---

## 1. Background & motivation

JLPT learners memorize large vocabulary lists, but isolated word↔meaning pairs are weak
memory anchors. Contextual example sentences materially improve retention, yet writing
~8,800 of them by hand is impractical and licensing pre-made sentence banks is costly.

We start with a clean, structured deck in Anki export format. By
generating one set of high-quality, level-appropriate example sentences per word with a
cheap LLM and caching them, we get the pedagogical benefit at a near-zero, one-time
cost — and a study experience tailored to our own data and scheduling.

## 2. Goals & non-goals

**Goals**
- Import the existing deck and present it as study-ready flashcards.
- Schedule reviews with a modern SRS (FSRS) for strong long-term retention.
- Attach AI-generated, level-appropriate example sentences to every word, generated
  once and served from cache thereafter.
- Ship as the smallest reasonable deployable footprint on Railway.
- Be secure by default despite a single-user launch, and extend cleanly to multi-user.
- Deliver a **mobile-first** experience optimized for small phone screens (iPhone SE
  baseline) that remains fully usable on desktop.

**Non-goals (initial release)**
- Native mobile apps (mobile-first responsive web only; see §8.4).
- User-authored decks or editing of source vocabulary.
- Social/sharing features, leaderboards.
- Real-time collaboration or multi-device live sync beyond standard server state.

## 3. Terminology

- **Word** — a vocabulary entry from the source deck (`expression`, `reading`, `meaning`).
- **Example sentence** — an AI-generated sentence using a word, with reading + translation.
- **Review state** — per-user, per-word FSRS scheduling data.
- **Cache hit/miss** — whether a word already has stored example sentences.
- **Seeding** — the one-time bulk generation of example sentences via the Batch API.

---

## 4. Source data

The deck originates from
[**open-anki-jlpt-decks**](https://github.com/jamsinclair/open-anki-jlpt-decks)
by Jam Sinclair, **MIT-licensed** and freely usable with attribution. Our copy is
committed at `decks/*.csv` — Anki export format, one file per JLPT level.

| File | Rows (≈) | Level |
|------|----------|-------|
| `n5.csv` | 717 | N5 (easiest) |
| `n4.csv` | 667 | N4 |
| `n3.csv` | 2,140 | N3 |
| `n2.csv` | 1,906 | N2 |
| `n1.csv` | 2,698 | N1 (hardest) |
| **Total** | **≈ 8,800 words** | |

**Columns:** `expression` (kanji/word), `reading` (kana), `meaning` (English),
`tags` (space-separated, e.g. `JLPT JLPT_N5 Genki`), `guid` (stable Anki identifier).

`decks/templates/` contains the original Anki card templates (EN→JP and JP→EN
directions plus `styles.css`); these serve as a visual reference for the card UI.

**Import considerations**
- Some `meaning` fields are quoted CSV containing commas (`"to meet, to see"`); use a
  spec-compliant CSV parser.
- Some entries use placeholder markers (`〜` / `～`) and parenthetical notes
  (e.g. `(かさを～) さす`); preserve raw text but flag these for the generation prompt.
- The `MediaMissing` tag is irrelevant to this product and may be discarded.
- `guid` is the natural **unique key** and guarantees idempotent re-imports.
- `tags` encode legacy/overlapping levels (an N5 word may also be tagged `JLPT_3`).
  The **source file** is authoritative for level; surplus tags are stored as metadata.

---

## 5. System architecture

The system is a **single full-stack Next.js (App Router) application**. The browser UI,
the JSON API (Route Handlers / Server Actions), the FSRS scheduling logic, and the
Anthropic integration all live in one deployable, backed by a managed Postgres instance.

```
┌─────────────────────────── Railway ────────────────────────────┐
│                                                                  │
│  Next.js (App Router) — single service                          │
│   ├─ /app                React UI (Anki mode, Duolingo mode, browse)│
│   ├─ /app/api/review     POST rating → FSRS → next due date      │
│   ├─ /app/api/cards      study queue, browse, search             │
│   ├─ /app/api/quiz       multiple-choice question + distractors  │
│   ├─ /app/api/generate   on-demand fallback (single sentence)    │
│   ├─ /app/api/auth/*     Auth.js (Email provider via Resend)     │
│   └─ /app/api/batch/*    submit + poll Anthropic Batch jobs      │
│        │                                                         │
│        ├── Prisma ───────────────►  Postgres (Railway plugin)    │
│        ├── @anthropic-ai/sdk ────►  Claude Haiku (Messages/Batch)│
│        └── Resend SDK ───────────►  Email (magic links)          │
│                                                                  │
│  scripts/ (run via `railway run` or locally)                    │
│   ├─ import-csv.ts       seed Word rows from decks/*.csv          │
│   ├─ seed-sentences.ts   build & submit Batch jobs (N3 first)    │
│   └─ collect-batch.ts    poll + write results into ExampleSentence│
└──────────────────────────────────────────────────────────────────┘
```

### 5.1 Why a single full-stack service is sufficient (vs. a separate API)

A split backend (e.g. a Rails or standalone Node API behind a separate frontend) is a
common default, but it is **unjustified for this product's actual requirements**. The
decision to use one Next.js service is deliberate:

- **No cross-client API contract to honor.** The only consumer of our backend is our own
  web frontend. A standalone API earns its keep when multiple independent clients
  (mobile apps, third parties, other services) must share it. We have exactly one client,
  so a public, versioned API surface is overhead with no payoff. Next.js Route Handlers
  and Server Actions give us typed, server-only endpoints colocated with the UI that
  consumes them.

- **No heavy background-processing tier is needed.** The one long-running workload —
  bulk sentence generation — is delegated to **Anthropic's Batch API**, which executes
  asynchronously on Anthropic's side. Our system only submits jobs and polls for results,
  work that a lightweight scheduled route or a one-off script handles cleanly. This is the
  usual reason teams reach for a separate API + worker tier (Sidekiq, Celery, etc.); here
  that reason does not apply.

- **Every feature is a database query or a single LLM call.** FSRS scheduling is pure
  in-process computation (`ts-fsrs`). Multiple-choice distractors are a same-level
  `SELECT` over existing words — no AI, no extra service. On-demand sentence fallback is
  one synchronous Haiku request. None of this benefits from a network hop to a separate
  backend; a split would only add latency and a second failure domain.

- **One language, one toolchain, one deploy.** TypeScript end-to-end means shared types
  between server and client, a single dependency graph, one CI/CD pipeline, and one
  Railway service to operate, observe, and scale. A separate API would roughly double the
  operational surface (extra service, extra build, extra inter-service auth) for no
  capability we require.

- **Scaling is horizontal and stateless.** App state lives in Postgres; the Next.js
  service is stateless and scales out by adding replicas behind Railway's load balancer.
  We do not have a workload profile (e.g. CPU-bound media processing) that warrants
  isolating the backend onto its own scaling unit.

**When we would revisit this:** if we later add independent clients that must share the
backend, introduce continuous/streaming generation pipelines that need a dedicated worker
fleet, or require a CPU/memory profile incompatible with the web tier. None are on the
roadmap. The data model (§6) and generation design (§7) are framework-agnostic, so
extracting a service later is an option, not a prerequisite. See §14 for the full
alternatives analysis.

---

## 6. Data model

The schema is **single-user at launch but multi-user-ready**: one seeded `User` row owns
all review state today. Introducing real authentication later means populating additional
users and scoping queries by `userId` — no change to the core shape.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String?  @unique           // null for the default local user
  createdAt DateTime @default(now())
  reviews   ReviewState[]
}

model Word {
  id         String   @id @default(cuid())
  guid       String   @unique           // from CSV — idempotent imports
  expression String                     // kanji/word
  reading    String                     // kana
  meaning    String                     // English
  level      Level                      // N5..N1 (authoritative = source file)
  tags       String[]                   // remaining raw tags
  sentences  ExampleSentence[]
  reviews    ReviewState[]
  @@index([level])
}

enum Level { N5 N4 N3 N2 N1 }

model ExampleSentence {
  id          String   @id @default(cuid())
  wordId      String
  word        Word     @relation(fields: [wordId], references: [id])
  japanese    String                    // sentence using the word
  reading     String                    // furigana/kana reading of sentence
  english     String                    // translation
  model       String                    // e.g. "claude-haiku-4-5"
  source      GenSource                 // BATCH | ONDEMAND
  createdAt   DateTime @default(now())
  @@index([wordId])
}

enum GenSource { BATCH ONDEMAND }

// FSRS per-(user,word) scheduling state
model ReviewState {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  wordId      String
  word        Word     @relation(fields: [wordId], references: [id])
  // FSRS fields
  stability   Float?
  difficulty  Float?
  due         DateTime @default(now())
  lastReview  DateTime?
  reps        Int      @default(0)
  lapses      Int      @default(0)
  state       FsrsState @default(NEW)
  @@unique([userId, wordId])
  @@index([userId, due])
}

enum FsrsState { NEW LEARNING REVIEW RELEARNING }
```

`ExampleSentence` is the **cache**: once a word has rows here, no API call is made.
Permitting multiple rows per word allows several examples per card and UI rotation.

---

## 7. AI sentence generation

**Strategy: pre-generate with the Batch API (N3 first), then the remaining levels.**
On-demand generation exists only as a fallback for the rare cache miss.

### 7.1 Why the Batch API
- **≈ 50% cheaper** than synchronous calls — ideal for a one-time ~8.8k-word fill.
- Asynchronous: thousands of requests submitted, polled, and collected within ~24h.
- Seeding has no latency requirement, so the asynchronous trade-off is pure savings.

### 7.2 Prompt design (per word)
- **System prompt** (shared, identical across requests) is marked for **prompt caching**
  so repeated batch requests reuse it. It defines the task, the JSON output schema,
  per-level difficulty tuning, and rules for placeholder words (`〜`, `(...)`).
- **User message** carries the word's `expression`, `reading`, `meaning`, and `level`.
- **Output (structured JSON):**
  ```json
  {
    "japanese": "私は毎朝公園で友達に会う。",
    "reading":  "わたしはまいあさこうえんでともだちにあう。",
    "english":  "I meet my friend at the park every morning."
  }
  ```
- Sentence complexity is tuned to level: N5/N4 short and basic, N1 natural and idiomatic,
  with vocabulary/grammar restricted to at-or-below the target level where feasible.
- We may request 2–3 sentences per word (more value per call; rotated in the UI).

### 7.3 Seeding order
1. **N3 batch first** (priority) — ~2,140 words.
2. Then N5, N4, N2, N1.
3. `scripts/seed-sentences.ts` chunks words, builds Batch request files, and submits.
4. `scripts/collect-batch.ts` polls status and, on completion, parses results and upserts
   `ExampleSentence` rows (`source = BATCH`), keyed by word `guid`/`id`.
5. The pipeline is re-runnable: words that already have cached sentences are skipped.

### 7.4 On-demand fallback
`POST /api/generate` — when a card is opened and has zero `ExampleSentence` rows (e.g. a
level not yet seeded), the server makes a single synchronous Haiku call, stores the result
(`source = ONDEMAND`), and returns it. First view incurs ~1s latency; subsequent views are
cache hits. This endpoint is authenticated (§11) to prevent unauthorized cost.

### 7.5 Cost estimate (order of magnitude — verify against current Haiku pricing)
Assumptions: ~300 input tokens/word (including amortized cached system prompt) and ~450
output tokens/word (≈3 sentences). At ~8,800 words this is ~2.6M input + ~4.0M output
tokens. At Haiku-class rates with the Batch 50% discount, total one-time cost lands in the
**low-single-digit to ~$10** range; prompt caching reduces input cost further. Treat this
as a budget ceiling, not a quote — confirm against current published Haiku pricing.

---

## 8. Study experience

Bayana offers two complementary study modes the user can switch between: **Anki mode**
(serious spaced-repetition recall) and **Duolingo mode** (fast, low-friction
multiple-choice practice). Anki mode is the retention engine; Duolingo mode is the
lightweight on-ramp and warm-up.

### 8.1 Anki mode — flashcard review (FSRS)
The classic spaced-repetition flashcard loop, modeled on Anki.

- The daily queue selects `ReviewState` rows where `due <= now` for the current user, plus
  a configurable number of `NEW` cards/day, ordered by level then due date.
- The card UI mirrors the Anki templates: the front shows the expression (or the meaning,
  in reverse direction); flipping reveals reading, meaning, and a **cached example
  sentence**.
- The user rates **Again / Hard / Good / Easy**; `POST /api/review` invokes `ts-fsrs` to
  compute the new `stability`, `difficulty`, `due`, and `state`, which are persisted.
- Both directions are supported (JP→EN recognition, EN→JP recall) as a setting.

### 8.2 Duolingo mode — multiple choice
A gamified, tap-to-answer quiz in the spirit of Duolingo: pick the right answer from four
options, get instant feedback, keep momentum. Optimized for quick mobile sessions.

- `GET /api/quiz` returns a target word plus one correct option and three distractors.
- **Distractor selection (no AI):** three other words from the **same level** with
  *different* meanings, optionally biased toward similar part-of-speech/length for
  plausibility. This is a pure DB query — cheap, deterministic, zero marginal cost.
- Variants: show `expression` → choose `meaning`, or `meaning` → choose
  `expression`/`reading`.
- Instant correct/incorrect feedback with the cached example sentence shown on reveal.
- Whether Duolingo-mode results feed the FSRS scheduler (correct ≈ Good, wrong ≈ Again) or
  remain a separate, non-scheduling practice mode is deferred to Phase 2 (§15, §16).

### 8.3 Browse / search
- A paginated, level-filtered list of all words with their cached example sentences, useful
  for review and for spot-checking generated content.

### 8.4 Responsive / mobile-first design
The product is **designed for the phone first** and progressively enhanced for larger
screens; the bulk of study happens on mobile.

- **Baseline viewport:** iPhone SE (**375 × 667 CSS px**, the smallest mainstream target).
  All primary flows — study, flip, rate, quiz — must be fully usable and uncluttered at
  this size without horizontal scrolling or zoom. Larger phones, tablets, and desktop are
  treated as additive breakpoints, not the design center.
- **Layout:** a single-column, vertically-centered card layout (mirroring the source Anki
  templates) that scales up gracefully; on desktop the card is width-capped and centered
  rather than stretched edge-to-edge.
- **Touch ergonomics:** rating actions (Again/Hard/Good/Easy) and MC options are
  full-width, thumb-reachable controls with ≥ 44×44 px hit targets, placed in the lower
  portion of the viewport. Card flip is tap-anywhere; swipe gestures are an optional
  enhancement, never the only path.
- **Typography:** Japanese text (expression/reading) is sized for legibility on small
  screens and must render correctly with appropriate CJK font fallbacks; respects dynamic
  type / user font-scaling.
- **PWA-friendly:** correct viewport meta, safe-area insets for notched devices, and
  responsive sizing units (`dvh`/`svh`) so the card fills the screen without being clipped
  by mobile browser chrome. Installable-PWA polish (icons, manifest, offline shell) is a
  Phase 4 enhancement.
- **Implementation:** Tailwind CSS with a mobile-first breakpoint strategy (base styles
  target the SE; `sm:`/`md:`/`lg:` add desktop affordances).

---

## 9. API surface (Next.js Route Handlers)

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/api/cards/queue` | Today's FSRS study queue | required |
| GET | `/api/cards?level=&q=&page=` | Browse / search | required |
| POST | `/api/review` | Submit a rating → FSRS update | required |
| GET | `/api/quiz?level=` | One multiple-choice question + distractors | required |
| POST | `/api/generate` | On-demand single-sentence fallback | required |
| `*` | `/api/auth/*` | Auth.js (sign-in request, callback, session) | public (rate-limited) |
| POST | `/api/batch/submit` | Submit a generation batch (admin/script) | admin |
| GET | `/api/batch/:id` | Poll batch status / collect (admin/script) | admin |

---

## 10. Caching strategy

1. **Sentence cache (primary)** — `ExampleSentence` rows in Postgres. This is the core of
   the product: each word's sentences are generated once and reused for every view by every
   user. Cache key = word; a miss triggers on-demand generation (§7.4).
2. **Anthropic prompt caching** — the shared system prompt is cached across batch and
   on-demand requests to reduce input-token cost.
3. **HTTP/data caching** — largely static reads (browse, word data) use Next.js route
   caching / `revalidate`; the study queue and review writes are dynamic and uncached.

---

## 11. Security & authentication

### 11.1 Threat model
Although the initial release serves a single user, the app is reachable on the public
internet. The assets we protect are: (a) the owner's study progress and account, and
(b) the `ANTHROPIC_API_KEY`, whose abuse incurs real cost. The adversary is an
unauthenticated internet actor (credential guessing, endpoint scanning, cost-abuse of the
generation endpoint, email-relay abuse). High-sophistication or insider threats are out of
scope for the initial release.

### 11.2 Authentication: passwordless email magic link
Authentication uses **Auth.js with the Email provider**, sending magic links via
**Resend** (already provisioned). Access is restricted to a **single allowlisted email
address**. We chose passwordless magic links over a seeded password deliberately:

- **No long-lived shared secret lives in the application.** A seeded password is a static
  credential that must be stored, rotated, and kept out of source control, env dumps, and
  logs — a recurring leak vector for self-hosted apps. The magic-link flow stores no
  reusable password; authentication reduces to *proving control of the allowlisted inbox*.
- **It delegates to a stronger security boundary.** The owner's email account is almost
  certainly protected by a strong password and 2FA that we maintain anyway. Leaning on it
  is stronger than any password store we would build, and removes a redundant secret rather
  than adding one.
- **The allowlist contains blast radius.** Even if the sign-in endpoint is discovered, a
  link can only ever be delivered to the one allowlisted address — an attacker cannot have
  one sent to themselves.

### 11.3 Hardening requirements (the magic link is only secure if these hold)
A magic link is a bearer token in transit; the implementation **must** enforce:

1. **High-entropy tokens** (≥ 256 bits) stored **hashed at rest** — never the raw token.
2. **Single-use** tokens, invalidated immediately on redemption.
3. **Short TTL** — 10–15 minutes.
4. **Server-side allowlist enforcement** (`email === AUTH_ALLOWED_EMAIL`) *before* any
   email is sent — without this the endpoint is an open email-spam relay.
5. **Rate limiting** on the sign-in request endpoint (per-IP and global) to prevent inbox
   bombing and token-guessing.
6. **Secure sessions** — `httpOnly`, `Secure`, `SameSite=Lax` cookies with a sane expiry
   and rotation; sessions stored server-side (Auth.js database sessions via Prisma).
7. **HTTPS everywhere** — provided by Railway TLS; redirect HTTP→HTTPS.

### 11.4 Secrets & API-key protection
- All secrets (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `AUTH_SECRET`, `DATABASE_URL`) are
  injected as Railway environment variables and never committed.
- The Anthropic key is **server-only**; it is never exposed to the client and no model call
  is reachable from the browser without an authenticated server route.
- All cost-incurring endpoints (`/api/generate`, `/api/batch/*`) require authentication;
  batch endpoints additionally require an admin marker so they cannot be driven by a normal
  session.

### 11.5 Path to multi-user
Multi-user is reached by: removing the single-email allowlist (or widening it to an
invite/allow rule), relying on the already-present `userId` scoping for all queries, and
adding explicit authorization checks so every read/write is constrained to the
session's user. No schema migration of the core shape is required (§6).

### 11.6 Public repository & PII
This repository is intended to be **open-sourced**, so no personal data is committed.

- **The allowlist email is configuration, not source.** `AUTH_ALLOWED_EMAIL` holds the
  single address permitted to sign in; its *value* lives only in Railway environment
  variables and is **never committed**. `.env.example` carries a placeholder
  (`you@example.com`), never a real address.
- **A dedicated alias will be used for the allowlist** rather than a primary personal
  inbox — it scopes the app's reach and is trivially rotatable if abused.
- **Git commit metadata is accepted as public.** Commits are authored under an email the
  author already publishes, so no history rewrite or noreply alias is required. (Decision:
  author's call — the trade-off is permanent public exposure of that address, accepted
  because it is already public.)

---

## 12. Deployment (Railway)

- **Services:** 1 × Next.js web + 1 × Postgres plugin. No Redis or worker tier is required
  (see §5.1, §7.1).
- **Build:** Nixpacks autodetects Next.js, or a Dockerfile for finer control.
- **Environment variables:** `DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
  `AUTH_SECRET`, `AUTH_ALLOWED_EMAIL`, `DEFAULT_USER_ID` (the seeded user until additional
  users exist).
- **Migrations & seed:** run `prisma migrate deploy` on release; run `scripts/import-csv.ts`
  once to load words, then `seed-sentences.ts` / `collect-batch.ts` via `railway run` to
  fill the sentence cache.
- **Domain:** Railway-generated domain for the initial release; custom domain later.

---

## 13. Milestones & rollout

**Phase 1 — MVP (single user)**
- CSV import, Postgres schema, seeded default user.
- Magic-link auth (Auth.js + Resend, single-email allowlist) with §11.3 hardening.
- FSRS flashcard review (both directions) with cached sentences.
- Batch-seed N3, then N5/N4/N2/N1; on-demand fallback.
- Deploy to Railway.

**Phase 2 — Multiple choice + polish**
- MC quiz mode and distractor query.
- Resolve MC↔FSRS coupling.
- Browse/search, daily new-card limits, basic stats.

**Phase 3 — Multi-user**
- Widen/remove the email allowlist; real `User` rows; authorization checks scoping all
  reads/writes by `userId`.
- Per-user settings (directions, daily limits, level focus).

**Phase 4 — Enhancements**
- Audio (TTS) for sentences, furigana rendering, streak/heatmap, sentence
  regeneration/voting, export back to Anki.

---

## 14. Alternatives considered

### 14.1 Separate backend API (Rails or standalone Node) + Next.js frontend
**Rejected for the initial release.** A dedicated API tier is the right call when multiple
independent clients share a backend, when a heavy background-worker fleet is required, or
when the backend has a scaling/resource profile incompatible with the web tier. None apply
here: there is a single client (our own UI), the only long job is offloaded to Anthropic's
Batch API, and every operation is a DB query or a single LLM call. A split would roughly
double operational surface (a second service, build, deploy, and inter-service auth) and add
a network hop and failure domain for no capability we need. Because the data model and
generation design are framework-agnostic, extracting a service later remains possible if
requirements change (§5.1).

### 14.2 Seeded static password instead of magic link
**Rejected.** A seeded password introduces a long-lived shared secret the app must store,
rotate, and keep out of source control and logs — a common leak vector — and would in
practice be backstopped by email-based reset anyway, making the inbox the real security
boundary. Passwordless magic links delegate directly to that stronger boundary and remove
the redundant secret (§11.2). A properly hashed, rate-limited password is acceptable in
principle, but strictly inferior here given Resend is already available.

### 14.3 On-demand-only sentence generation (no seeding)
**Rejected as the primary path.** Generating purely on first view eliminates upfront cost
but adds latency to first views and forgoes the ≈50% Batch discount for the bulk fill. We
retain it only as a fallback for cache misses (§7.4).

---

## 15. Open questions

- Should multiple-choice results feed the FSRS scheduler, or remain a separate,
  non-scheduling mode? (§8.2)
- How many example sentences per word — one, or 2–3 with rotation? (§7.2)
- Furigana: store the reading as plain kana (current) or as ruby-annotated markup?
- Should the reverse direction (EN→JP recall) default on or off for new users?

---

## 16. Decision log

A running record of decisions that shaped this design, newest first. Each entry states
**what** was decided, the **context/rationale**, and **who** decided. Detailed analysis
of rejected options lives in §14; this table is the at-a-glance history. Append a new row
whenever a decision is made or reversed — do not edit history in place.

| Date | Decision | Context & rationale | Decided by | Ref |
|------|----------|---------------------|------------|-----|
| 2026-06-03 | Repo will be open-sourced; allowlist email stays env-only; existing git commit email accepted as public | No PII committed. `AUTH_ALLOWED_EMAIL` value lives only in Railway env; a dedicated alias will back it. Author's commit email is already public, so no history rewrite is warranted. | Author | §11.6 |
| 2026-06-03 | Two study modes: "Anki mode" (FSRS recall) and "Duolingo mode" (gamified MC) | Serves both serious retention and a low-friction warm-up; MC distractors are a free same-level DB query, so the second mode adds little cost. | Author | §8 |
| 2026-06-03 | Mobile-first, iPhone SE (375×667) baseline; usable on desktop | Primary usage is on phones; desktop treated as an additive breakpoint rather than the design center. | Author | §8.4 |
| 2026-06-03 | Authentication: passwordless email magic link (Auth.js + Resend), single-email allowlist | Stores no reusable password, delegates to the stronger inbox security boundary, and the allowlist contains blast radius. Resend already provisioned. Seeded password rejected (§14.2). | Author | §11.2 |
| 2026-06-03 | Sentence generation: pre-seed via Batch API (N3 first), on-demand only as fallback | Batch API is ≈50% cheaper for the one-time ~8.8k-word fill and seeding has no latency requirement; N3 prioritized per author. On-demand-only rejected as primary (§14.3). | Author | §7 |
| 2026-06-03 | Scheduling algorithm: FSRS (via `ts-fsrs`) | Best-in-class retention/scheduling and what current Anki uses; mature TypeScript library. | Author | §8.1 |
| 2026-06-03 | Launch single-user, but keep the data model multi-user-ready | Fastest path to a usable personal tool; `userId` present from day one means no core migration when multi-user lands. | Author | §6, §11.5 |
| 2026-06-03 | Architecture: single full-stack Next.js service (not a separate API) | One client, the only long job is offloaded to Anthropic's Batch API, and every operation is a DB query or single LLM call — a split would double operational surface for no gained capability. Separate API rejected (§14.1). | Author | §5.1 |
| 2026-06-03 | Source deck: open-anki-jlpt-decks (MIT), committed to `decks/` | Clean, structured, freely licensed JLPT vocabulary; committed (not gitignored) so it is the source of truth for imports. | Author | §4 |
