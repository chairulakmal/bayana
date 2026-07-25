# Bayana — Design Document

**Spaced-repetition JLPT vocabulary trainer with AI-generated example sentences.**

| | |
|---|---|
| **Status** | Living document; Phases 1a through 3.5 implemented and deployed (§13) |
| **Author** | Chairul Akmal |
| **Last updated** | 2026-07-26 (§16 decision log extracted to [DECISIONS.md](DECISIONS.md); this section is now a pointer. 2026-07-25, documentation-consistency pass: §8 intro, §8.6, §9, §11.2/§11.3/§11.6 and §13 corrected against the implementation; §13 phases renumbered to admit the MC↔FSRS coupling phase. Earlier the same day: §8.5 rewritten for the `/home` landing and the revamped public `/`; §14.7/§14.8 added; deck-size figure corrected in §3) |
| **Target platform** | Mobile-first responsive web (Next.js 16, deployed on Railway) |

---

## TL;DR

Bayana turns an existing ~8,100-word JLPT vocabulary deck (N5–N1, Anki export) into a
modern web flashcard app. Cards are scheduled with **FSRS** (the algorithm used by
current Anki), and each word is paired with **example sentences generated once by
Claude Haiku and cached permanently** in Postgres. It offers four study modes (§8): a
serious spaced-repetition **"Flashcard mode,"** a fast, gamified multiple-choice
**"Quiz mode,"** a JLPT-style **"Exam mode"** benchmark, and a separate FSRS queue for
**grammar points**. The app ships as a **single
full-stack Next.js service** on Railway. It launches single-user with **passwordless
email magic-link authentication** (Auth.js + Resend, restricted to an email allowlist that
holds one address today) and a data model that is multi-user-ready from day one.

---

## 1. Background & motivation

JLPT learners memorize large vocabulary lists, but isolated word↔meaning pairs are weak
memory anchors. Contextual example sentences materially improve retention, yet writing
~8,100 of them by hand is impractical and licensing pre-made sentence banks is costly.

We start with a clean, structured deck in Anki export format. By
generating one set of high-quality, level-appropriate example sentences per word with a
cheap LLM and caching them, we get the pedagogical benefit at a near-zero, one-time
cost — and a study experience tailored to our own data and scheduling.

## 2. Goals & non-goals

**Goals**
- **Match Anki's core review loop** (FSRS scheduling, undo, suspend, meaningful stats)
  while eliminating its setup overhead — and without user-authored decks (see non-goals).
- Import the existing deck and present it as study-ready flashcards.
- Schedule reviews with a modern SRS (FSRS) for strong long-term retention.
- Attach AI-generated, level-appropriate example sentences to every word, generated
  once and served from cache thereafter.
- Ship as the smallest reasonable deployable footprint on Railway.
- Be secure by default despite a single-user launch, and extend cleanly to multi-user.
- Deliver a **mobile-first** experience optimized for small phone screens (iPhone SE
  baseline) that remains fully usable on desktop.
- **Minimal-friction start.** Returning users are a single tap from studying: signing in
  lands them on the home hub, whose primary CTA is routed to the highest-priority work for
  their remembered **active level**, with the four modes one tap away. No decks, note types,
  or configuration. First-time users complete a one-time level choice first (§8.5).
  Frictionless entry is a core differentiator from Anki.

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
[**open-anki-jlpt-decks**](https://github.com/jamsinclair/open-anki-jlpt-decks), **MIT-licensed** and freely usable with attribution. Our copy is
committed at `decks/*.csv` — Anki export format, one file per JLPT level.

| File | Rows (≈) | Level |
|------|----------|-------|
| `n5.csv` | 717 | N5 (easiest) |
| `n4.csv` | 667 | N4 |
| `n3.csv` | 2,140 | N3 |
| `n2.csv` | 1,906 | N2 |
| `n1.csv` | 2,698 | N1 (hardest) |
| **Total** | **8,128 rows → 8,101 words** | after `guid` de-duplication on import |

**Columns:** `expression` (kanji/word), `reading` (kana), `meaning` (English),
`tags` (space-separated, e.g. `JLPT JLPT_N5 Genki`), `guid` (stable Anki identifier).
- `guid` is the natural **unique key** and guarantees idempotent re-imports.
- `tags` encode legacy/overlapping levels (an N5 word may also be tagged `JLPT_3`).
  The **source file** is authoritative for level; surplus tags are stored as metadata.

The original Anki card templates (EN→JP and JP→EN directions plus `styles.css`) served as
a visual reference for the card UI during Phase 1a. They are **not committed**: the card UI
has since diverged from them and [BRAND.md](BRAND.md) is the visual reference now.

**Import considerations**
- Some `meaning` fields are quoted CSV containing commas (`"to meet, to see"`); use a
  spec-compliant CSV parser.
- Some entries use placeholder markers (`〜` / `～`) and parenthetical notes
  (e.g. `(かさを～) さす`); preserve raw text but flag these for the generation prompt.
- The `MediaMissing` tag is irrelevant to this product and may be discarded.

### 4.1 Grammar source data

Grammar points (§13 Phase 3.5) come from a source not licensed for redistribution,
unlike the MIT-licensed vocabulary above. `decks/grammar-*.md` is therefore
**gitignored, not committed** — the repo ships the schema and seed script, but not
the content itself. Anyone reproducing this project needs to supply their own
grammar deck in the same markdown shape (`## Lesson N – Title` / `### pattern reading`
heading tag / meanings / `**例文:**` sentence / translation — see the header comment
in `scripts/seed-grammar.ts`).

| File | Points | Lessons | Level |
|------|--------|---------|-------|
| `grammar-n3.md` | 220 | 22 | N3 |

---

## 5. System architecture

The system is a **single full-stack Next.js 16 (App Router) application**. The browser UI,
the JSON API (Route Handlers / Server Actions), the FSRS scheduling logic, and the
Anthropic integration all live in one deployable, backed by a managed Postgres instance.

```
┌─────────────────────────── Railway ────────────────────────────┐
│                                                                  │
│  Next.js (App Router) — single service                          │
│   ├─ /app                React UI (Flashcard, Quiz, Exam, Grammar) │
│   ├─ /app/api/review     POST rating → FSRS → next due date      │
│   ├─ /app/api/cards      study queue, browse, search             │
│   ├─ /app/api/quiz       multiple-choice question + distractors  │
│   ├─ /app/api/exam       JLPT-style kanji reading/writing round  │
│   ├─ /app/api/grammar/*  grammar queue + FSRS review             │
│   ├─ /app/api/demo/*     ephemeral demo session (prod-available) │
│   ├─ /app/api/auth/*     Auth.js (Email provider via Resend)     │
│   └─ /app/api/dev/*      dev-only session bypass (404 in prod)   │
│        │                                                         │
│        ├── Prisma ───────────────►  Postgres (Railway plugin)    │
│        ├── @anthropic-ai/sdk ────►  Claude Haiku (Messages/Batch)│
│        └── Resend SDK ───────────►  Email (magic links)          │
│                                                                  │
│  scripts/ (run via `railway run` or locally)                    │
│   ├─ import-csv.ts       seed Word rows from decks/*.csv          │
│   ├─ seed-sentences.ts   build & submit Batch jobs (N3 first)    │
│   ├─ collect-batch.ts    poll + write results into ExampleSentence│
│   ├─ seed-grammar.ts     seed GrammarPoint rows from decks/grammar-*.md │
│   └─ batch-status.ts / cost.ts / export-words.ts / split-words.ts (utilities)│
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

**Identity vs. profile.** `User` is the **authentication identity** — once Auth.js is added
(§11), its Prisma adapter owns this model (alongside `Account` / `Session` /
`VerificationToken`) and expects a specific shape. App-specific data (display name, study
preferences, role) therefore lives in a separate **one-to-one `UserProfile`**, keeping
library-managed auth concerns decoupled from our own. `UserProfile` is also where the study
**direction preference** (§8.1) and the **admin role** (gating the admin audit page, §13)
live.

```prisma
model User {
  id            String            @id @default(cuid())
  email         String?           @unique        // null only for the seeded pre-auth user
  emailVerified DateTime?                        // set by Auth.js when a magic link is confirmed
  image         String?
  createdAt     DateTime          @default(now())
  profile       UserProfile?                     // 1:1 — app-specific data (see below)
  reviews       ReviewState[]
  grammarProgress GrammarProgress[]
  accounts      Account[]                        // Auth.js — unused with email-only provider
  sessions      Session[]                        // Auth.js database sessions (§11.3)
}

// App-specific per-user data, one-to-one with User. Kept separate from the
// auth-managed User so library concerns and product concerns don't mix.
model UserProfile {
  id          String   @id @default(cuid())
  userId      String   @unique           // one row per user → enforces 1:1
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  displayName String?
  role        Role     @default(MEMBER)  // ADMIN gates the admin sentence-audit page (§13)
  // study preferences
  activeLevel    Level?                   // JLPT level both modes operate on; set at onboarding (§8.5), changeable
  onboardedAt    DateTime?                // set when first-run (level → warm-up → guide) completes; gates onboarding
  studyReverse   Boolean @default(false) // also review EN→JP (recall); default is JP→EN only (§8.1)
  newCardsPerDay Int     @default(10)     // NEW-card pace per queue build, not a hard daily cap (§16)
  timezone       String  @default("UTC")  // IANA tz; defines the "day" for limits/streaks/stats
  dayStartHour   Int     @default(4)       // local hour a new day begins (Anki-style 4am rollover)
  // FSRS tuning — defaults now; personalized from ReviewLog later (§8.1)
  fsrsParams       Float[]                 // FSRS weights w[]; empty ⇒ ts-fsrs library defaults
  desiredRetention Float   @default(0.9)   // FSRS target recall probability
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum Role { MEMBER ADMIN }

// Auth.js adapter models — owned by @auth/prisma-adapter; do not modify field names.
// `Account` is populated only by OAuth providers (none yet but adapter requires it).
// `Session` stores server-side database sessions (§11.3). `VerificationToken` holds
// the hashed magic-link token (single-use, short TTL — §11.3 hardening requirements).
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime
  @@id([identifier, token])
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
  word        Word     @relation(fields: [wordId], references: [id], onDelete: Cascade)
  japanese    String                    // sentence using the word
  reading     String                    // furigana/kana reading of sentence
  english     String                    // translation
  model       String                    // e.g. "claude-haiku-4-5"
  source      GenSource                 // BATCH | ONDEMAND
  createdAt   DateTime @default(now())
  @@index([wordId])
}

enum GenSource { BATCH ONDEMAND }

// FSRS per-(user,word) scheduling state — fields mirror the ts-fsrs `Card` struct
// (camelCase here; a thin app adapter maps to/from ts-fsrs's snake_case).
model ReviewState {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  wordId        String
  word          Word      @relation(fields: [wordId], references: [id], onDelete: Cascade)
  // FSRS fields (ts-fsrs Card)
  stability     Float?
  difficulty    Float?
  due           DateTime  @default(now())
  lastReview    DateTime?
  elapsedDays   Int       @default(0)   // days since previous review at last rating
  scheduledDays Int       @default(0)   // interval assigned at last rating
  learningSteps Int       @default(0)   // index into (re)learning steps
  reps          Int       @default(0)
  lapses        Int       @default(0)
  state         FsrsState @default(NEW)
  @@unique([userId, wordId])
  @@index([userId, due])
}

// Append-only review history: one row per rating event. Powers statistics,
// one-step undo (restore the card's prior scheduling state), and future FSRS
// re-optimization. Never updated or deleted; kept decoupled from User/Word
// (indexed scalar ids, no FK relation) so it stays immutable history.
model ReviewLog {
  id            String    @id @default(cuid())
  userId        String
  wordId        String
  // Fields mirror the ts-fsrs ReviewLog so we can rollback() for one-step undo.
  rating        Int                       // 1=Again, 2=Hard, 3=Good, 4=Easy
  state         FsrsState                 // card state at review time
  due           DateTime                  // due date this review assigned
  stability     Float?
  difficulty    Float?
  elapsedDays   Int       @default(0)
  scheduledDays Int       @default(0)
  learningSteps Int       @default(0)      // (re)learning step index at review time
  reviewedAt    DateTime  @default(now())
  @@index([userId, reviewedAt])
  @@index([userId, wordId])
}

enum FsrsState { NEW LEARNING REVIEW RELEARNING }

// Grammar points — separate from vocabulary, with their own FSRS queue.
//
// `GrammarPoint` holds static content parsed from decks/grammar-*.md.
// `level` is a plain String (not the Level enum) so the same table accepts
// N5–N1 grammar decks as they are added later, without a schema migration.

model GrammarPoint {
  id          String @id @default(cuid())
  level       String // "N3", "N2", etc. — plain string so new levels need no migration
  lesson      Int    // lesson number within the level
  lessonTitle String // e.g. "During, While, and Sequence" — denormalized from the
                      // source file's lesson heading (like `level`, repeated per row
                      // so the browse view can group without a second lookup)
  position  Int      // 1-indexed position within the lesson
  pattern   String   // display form, e.g. "ばいい"
  reading   String   // kana reading (may equal pattern; stored separately to allow differ)
  meanings  String[] // English meanings, e.g. ["Can", "Should", "It'd be good if"]
  exampleJp String   // example sentence in Japanese
  exampleEn String   // English translation of the example
  progress  GrammarProgress[]
  @@unique([level, lesson, position]) // natural idempotency key for upserts
  @@index([level])
}

// FSRS scheduling state for one (user, grammar point) pair.
// Field names and types mirror ReviewState exactly so the CardLike interface
// (src/lib/fsrs.ts) lets the same FSRS adapter functions serve both queues.
model GrammarProgress {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  grammarPointId String
  grammarPoint   GrammarPoint @relation(fields: [grammarPointId], references: [id], onDelete: Cascade)
  // FSRS fields — same shape as ReviewState
  stability     Float?
  difficulty    Float?
  due           DateTime  @default(now())
  lastReview    DateTime?
  elapsedDays   Int       @default(0)
  scheduledDays Int       @default(0)
  learningSteps Int       @default(0)
  reps          Int       @default(0)
  lapses        Int       @default(0)
  state         FsrsState @default(NEW)
  @@unique([userId, grammarPointId])
  @@index([userId, due])
}
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
- **One sentence per word** at launch — simplest and lowest cost. The schema already
  permits multiple `ExampleSentence` rows per word (§6), so generating more later needs no
  core change. A future **admin review/audit** workflow (§13 Phase 4) will let an admin
  accept or reject each generated sentence before it surfaces to learners.

### 7.3 Seeding order
1. **N3 batch first** (priority) — ~2,140 words.
2. Then N5, N4, N2, N1.
3. `scripts/seed-sentences.ts` chunks words, builds Batch request files, and submits.
4. `scripts/collect-batch.ts` polls status and, on completion, parses results and upserts
   `ExampleSentence` rows (`source = BATCH`), keyed by word `guid`/`id`. Each model output
   is **schema-validated** (well-formed JSON with non-empty `japanese`/`reading`/`english`);
   malformed or empty results are skipped and logged for retry, never stored.
5. The pipeline is re-runnable: words that already have cached sentences are skipped.

### 7.4 On-demand fallback
`POST /api/generate` — when a card is opened and has zero `ExampleSentence` rows (e.g. a
level not yet seeded), the server makes a single synchronous Haiku call, **validates the
JSON output** (same schema check as seeding), stores the result (`source = ONDEMAND`), and
returns it. First view incurs ~1s latency; subsequent views are
cache hits. This endpoint is authenticated (§11) to prevent unauthorized cost.

### 7.5 Cost estimate (order of magnitude — verify against current Haiku pricing)
Assumptions: ~300 input tokens/word (including amortized cached system prompt) and ~450
output tokens/word (≈3 sentences). At ~8,800 words this is ~2.6M input + ~4.0M output
tokens. At Haiku-class rates with the Batch 50% discount, total one-time cost lands in the
**low-single-digit to ~$10** range; prompt caching reduces input cost further. Treat this
as a budget ceiling, not a quote — confirm against current published Haiku pricing.

**Measured actual (2026-06-03).** The full one-time seed of all five levels (≈8,100 words,
one sentence each) via the Batch API cost **≈ $2.55 cumulative** (Anthropic console) — N3
first (~$0.62), then N5/N4/N2/N1 (~$1.7), plus a few cents of prompt-quality gating and
straggler retries. Output tokens dominate (they can't be cached); the Batch discount and
cached system prompt kept it well under the ceiling above. This confirms the core premise:
the contextual-sentence benefit is achieved at a near-zero, one-time cost.

---

## 8. Study experience

Bayana offers four complementary study modes: **Flashcard mode** (serious
spaced-repetition recall, §8.1), **Quiz mode** (fast, gamified JP→EN multiple choice,
§8.2), **Exam mode** (JLPT-style reading/writing questions, §8.6), and **grammar study**
(a separate FSRS queue over grammar points, §13 Phase 3.5). Flashcard mode is the
retention engine; Quiz mode is the lightweight warm-up; Exam mode is the benchmark;
grammar runs alongside all three on its own schedule. Browse/search (§8.3) is a reference
tool rather than a mode.

**Level scope.** Every mode operates within a **single JLPT level at a time, the user's
*active level***, chosen once at onboarding (§8.5) and changeable later (stored on
`UserProfile.activeLevel`, §6). Queues, new-card selection, and multiple-choice
distractors all stay within one level's vocabulary, so the modes are *separated by level*:
you study one level at a time, not the whole deck at once. The one deliberate exception is
the home hub's words-due count, which is level-agnostic for the reason given in §8.5.

**Entry points.** A **public marketing page** lives at `/` for logged-out visitors and the
authenticated app opens on the home hub. Onboarding, the hub, and the routing between them
are specified in **§8.5**; the look-and-feel follows **[BRAND.md](BRAND.md)**.

### 8.1 Flashcard mode — SRS review (FSRS)
The classic spaced-repetition flashcard loop, modeled on Anki.

- The daily queue selects `ReviewState` rows where `due <= now` for the current user
  **at their active level** (§8.5), ordered by due date, plus a configurable number of `NEW` cards/day **selected in
  randomized order** so similar-sounding words (adjacent in the source deck) aren't
  clustered together.
- The card UI mirrors the Anki templates: the front shows the expression (or the meaning,
  in reverse direction); flipping reveals reading, meaning, and a **cached example
  sentence**.
- The user rates **Again / Hard / Good / Easy**; `POST /api/review` invokes `ts-fsrs` to
  compute the new `stability`, `difficulty`, `due`, and `state`, which are persisted.
- **Continuous sessions:** the study screen loads a batch of cards and, when it is
  exhausted, **auto-refetches** the queue — so cards that have just become due (a card
  rated *Again*, or a learning-step card) cycle back without a manual reload. The "all
  caught up" state appears only when a fresh fetch returns nothing (with a *Check for more*
  action to refetch).
- Each rating is also appended to the immutable **`ReviewLog`** (§6), which powers
  statistics, future FSRS re-optimization, and **one-step undo** — restoring the card's
  prior scheduling state right after a misrating. Undo ships in the MVP.
- **Direction:** new users default to **JP→EN** (recognition); **EN→JP** (recall) is
  opt-in via user preferences. Example sentences are generated for the Japanese word only
  (§7) and are therefore direction-independent — the same cached sentence appears on the
  reveal side in either direction.

### 8.2 Quiz mode — multiple choice
A gamified, tap-to-answer quiz in the spirit of Duolingo: pick the right answer from four
options, get instant feedback, keep momentum. Optimized for quick mobile sessions. Questions
are drawn from the user's **active level** (§8.5), and the first-run warm-up is five such
questions, run as a **non-scheduling** practice (it doesn't affect FSRS state).

- `GET /api/quiz` returns a target word plus one correct option and three distractors.
- Variants: show `expression` → choose `meaning`, or `meaning` → choose
  `expression`/`reading`.
- Instant correct/incorrect feedback with the cached example sentence shown on reveal.
- Whether Quiz mode results feed the FSRS scheduler (correct ≈ Good, wrong ≈ Again) or
  remain a separate, non-scheduling practice mode is **Phase 3** (§13; open question #1
  in §15).

#### UI & feel — Duolingo-grade, deliberately restrained
The mode should *feel* as polished and satisfying as Duolingo — that bar is the point — but
with two deliberate departures that are part of the product thesis (§1):

- **Minimal animation.** Snappy, lightweight transitions (instant answer feedback, a brief
  correct/incorrect state) — **not** heavy character animations, celebratory cutscenes, or
  motion that delays the next question. Momentum comes from speed and low friction, not
  spectacle. Respect `prefers-reduced-motion`.
- **Zero ads, ever.** No advertising, no interstitials, no upsell modals. This is a core
  anti-Duolingo differentiator, not a future monetization slot.
- Otherwise it inherits the mobile-first ergonomics of §8.4 (full-width thumb-reachable
  options, ≥44×44 px targets, iPhone SE baseline) and shows the cached example sentence on
  reveal for context.
Distractors are chosen to be *plausibly confusable* with the target rather than random, so
that answering correctly requires actually knowing the word. Confusability is scored along
three independent axes, all derivable from existing `Word` fields:

- **Orthographic** — shares one or more kanji with the target's `expression`
  (e.g. 見る / 見える).
- **Phonetic** — identical or near-identical `reading`; homophones such as 会う / 合う are the
  classic JLPT trap.
- **Semantic** — overlapping `meaning`.

**Implementation (MVP).** A single same-level query fetches the candidate pool
(`WHERE level = $level AND id <> $targetId`; only ~700–2,700 rows), and candidates are
**scored in application code** as a weighted sum of the three signals; the top-scoring
candidates become the distractors, with a fallback to random same-level words when too few
confusable candidates exist. Keeping the scoring in TypeScript (rather than SQL) keeps the
weighting and guardrails readable and unit-testable, while SQL stays a plain pool fetch.

**Fairness guardrail.** A distractor must never be a legitimate answer. Candidates whose
`meaning` is a near-duplicate or superset of the target's (true synonyms) are excluded, so
the semantic axis selects *similar-but-distinct*, never equivalent. The orthographic and
phonetic axes do not carry this risk.

**Difficulty mix.** Each question blends confusable and random distractors (e.g. two
confusable + one random) so it is challenging but solvable; the exact ratio is tunable and
is an open question (§15).

**Scale path (Phase 2+).** If per-request scoring ever needs to move into the database, the
Postgres-native upgrades are: a kanji `text[]` column with a GIN overlap index
(orthographic), `pg_trgm` trigram similarity (phonetic/lexical), and **pgvector** over a
one-time pass of `meaning` embeddings (true semantic similarity). None are required at
launch scale.

### 8.3 Browse / search
A whole-deck lookup tool scoped to the active level. The user can search by kanji,
reading, or English meaning; tapping any word reveals its cached example sentence.

**Implementation.** `GET /api/browse?level=` returns the level's full word list (id,
expression, reading, meaning — **no sentences**) with `Cache-Control: private,
max-age=3600, stale-while-revalidate=86400`. The browser caches this response; repeat
visits within the hour cost zero server round-trips. The client (`BrowseClient`) filters
in memory per keystroke — no server request per search. Results are **paginated at 50 per
page** with previous/next controls and an editable page-number input (clamped to
`totalPages` so shrinking results mid-session never leaves the user on a phantom page);
this replaces an earlier render cap that had no way to reach later pages. Sentences are
lazy-loaded per word via `GET /api/words/[id]/sentence` (cached 24 h) when a row is
tapped, keeping the initial payload small. Rows expand/collapse in an accordion (one open
at a time).

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
- **Installable PWA (basics shipped 2026-06-04):** a Web App Manifest (`src/app/manifest.ts`,
  served at `/manifest.webmanifest`) plus PNG icons (192 / 512 / maskable, generated from
  `src/app/icon.svg` by `scripts/gen-pwa-icons.mjs`) make Bayana installable to the home
  screen. `display: "fullscreen"` runs the study/quiz session chrome-free and edge-to-edge
  on Android; iOS Safari ignores `fullscreen` and degrades to `standalone` (chrome-free but
  the status bar remains) — an accepted limitation, as the author is on Android (§16).
  `viewport-fit=cover` plus `env(safe-area-inset-*)` (`.pt-safe`/`.pb-safe`, applied to the
  session `<main>`) keep controls clear of the notch and home indicator, and `dvh` sizing
  fills the screen without browser-chrome clipping. The **offline shell (service worker)**
  remains deferred (§13).
- **Implementation:** Tailwind CSS with a mobile-first breakpoint strategy (base styles
  target the SE; `sm:`/`md:`/`lg:` add desktop affordances).
- **Visual language** — palette, typography (Fredoka / Nunito / M PLUS Rounded 1c), the
  mascot Pī, and components — is specified in **[BRAND.md](BRAND.md)** (design tokens in its
  §8); the iPhone SE baseline above is the shared design target for both docs.

### 8.5 Onboarding & session flows
Two user stories drive entry into the app. Both reach the same level-scoped engines
(§8.1, §8.2, §8.6, plus the grammar queue of Phase 3.5); they differ only in the
first-run extras.

- **First-time user (first run).** Sign in via the email magic link (§11.2) *or* start a
  demo session (`POST /api/demo/login`, §11.8) → routed to `/onboarding` (gated on
  `UserProfile.onboardedAt` being unset) → **choose a JLPT level** (N5–N1) → the app
  then drops straight into the home hub. The `/onboarding` level-choice screen is
  **implemented** (Phase 3.5). The follow-on **Quiz mode warm-up** (5 non-scheduling
  questions) and **guided tour** remain deferred to the multi-user phase (§13). Completing
  the level choice persists `UserProfile.activeLevel` and stamps `onboardedAt` (§6), which is what
  distinguishes a first-time from a returning user thereafter.
- **Returning user.** Sign in → **the post-login landing** → start. That's it.

**Post-login landing: `/home`.** Sign-in (`redirectTo`), the dev login, `/onboarding`
completion, `/onboarding`'s already-onboarded bounce, the public `/` redirect, and the PWA
manifest's `start_url` all resolve to the home hub. This reverses the temporary
`/grammar` reprioritization of 2026-07-02 (§16): that change existed because the hub
carried no status of its own, so opening on it cost a tap and told the user nothing. The
hub now reports what is due across both queues, which removes the reason to bypass it.

**The hub (`/home`).** A **light dashboard**, in four bands, ordered by how often each is
used:

1. **Today panel** — words due, grammar points due, and reviews completed today, plus a
   progress bar for the active level (started / total). This is the "where am I" glance the
   hub previously lacked entirely.
2. **Primary CTA** — a single button routed by `pickNextAction` (`src/lib/home.ts`) to the
   highest-priority work: due vocab, then due grammar, then new vocab, then Quiz as a
   never-a-dead-end fallback. This is what preserves the one-tap, no-config promise (§2)
   now that the hub shows more than three buttons.
3. **Mode grid** — four tiles (Flashcard `/study`, Quiz `/quiz`, Exam `/exam`, Grammar
   `/grammar`) in a 2×2 layout, each with a subtitle derived from live counts. Grammar is
   included here because the hub is the app's default page; a mode absent from it is
   effectively hidden. **No tile is ever disabled.** Each is the sole route to its mode, so
   a dimmed tile removes a section of the app: with the Grammar nav tab gone, disabling the
   Grammar tile on levels with no seeded deck (only N3 is seeded, §4.1) made `/grammar` and
   all existing grammar progress unreachable behind a level switch. Caveats go in the
   subtitle instead, and `/grammar` itself distinguishes "no deck for this level" from
   "all caught up" rather than reporting a deck that does not exist as finished.
4. **Inline level selector** — the five JLPT chips, persisting `UserProfile.activeLevel`
   via a server action and re-scoping every engine. The level is changed *here*, not on a
   separate settings page. It sits **below** the mode grid: a level is chosen once and
   revisited rarely, whereas a mode is chosen every session.

**Scoping asymmetry, stated deliberately.** The Today panel's *words due* count is **not**
level-scoped, because `getStudyQueue` (§8.1) returns due cards regardless of level so
nothing already in progress is stranded. A level-scoped number here would promise a
smaller session than the one the tile actually opens. The progress bar *is* level-scoped
and is labelled with the level to make that explicit.

**Still not the full dashboard.** Streak, history, and charts remain deferred to the later
stats/dashboard work (§13, Phase 6); `/stats` keeps the heavier per-level aggregates
(including the 30-day recall rate, which the hub deliberately does not compute — see the header comment in
`src/lib/home.ts` for why the hub has its own narrower query set rather than reusing
`getLevelStats`).

**`BottomNav` lists places, not modes:** Home, Stats, Browse. Grammar was a fourth tab only
while it was itself the post-login landing; with all four modes on the hub, keeping one mode
in the tab bar mixed two categories and made the other three look arbitrarily omitted
(§16, 2026-07-25; rejected alternative in §14.8).

### 8.6 Exam mode — JLPT-style reading & writing

A benchmark mode that presents 20 questions in two sections mirroring the
vocabulary sub-problems of the JLPT Reading section. **No timer is implemented**; earlier
revisions of this section described the mode as "timed," which it never was. Whether to add
one is an open item: with per-question feedback (below), the mode is a study tool rather
than a mock sitting, and a countdown would change that character.

- **問題１ — 漢字の読み方 (kanji reading):** An example sentence is shown with the
  target word underlined in its kanji form. The student picks its kana reading from four
  options. Correct answer = `Word.reading`; distractors are readings of orthographically
  and phonetically confusable same-level words (kanji Jaccard + reading similarity,
  matching Quiz mode's distractor strategy applied to the `reading` field).

- **問題２ — 漢字の書き方 (kanji writing):** The example sentence is shown with the
  target word's kanji replaced by its kana reading (the first occurrence in the sentence
  is substituted). The student picks the correct kanji form from four options. Correct
  answer = `Word.expression`; distractors are expressions of words whose readings sound
  similar to the target (reading similarity as the primary axis; shared kanji as a bonus).

**Question count.** Default 20 (10 + 10); the endpoint accepts `?count=` up to 40.

**Section structure.** Questions 1–10 are 問題１; questions 11–20 are 問題２. A
lightweight **section-break screen** appears between them (showing the 問題１ score before
the student proceeds), mirroring the experience of turning a page in a real JLPT paper.

**Immediate feedback.** Unlike a real exam's submit-all-at-end model, Exam mode reveals
the correct answer after each question. This is optimal for a study tool: the student
connects the correction to the question immediately rather than after a full 20-question
delay.

**Independence from FSRS.** Exam mode neither reads from nor writes to `ReviewState`.
Questions are drawn at random from the active level's word pool — not from the FSRS due
queue. The mode is a pure benchmark; its results do not schedule or unschedule anything.
Flashcard, Quiz, and Exam are independent today, and FSRS coupling is a **permanent**
non-goal for Exam specifically (§16 decision log); Quiz gains it in Phase 3 (§13). Grammar
schedules against its own separate queue either way.

**Sentence substitution edge case.** For 問題２, the kana replacement uses `String.replace`
on the first occurrence of `Word.expression` in the sentence. If the sentence uses a
conjugated or inflected form of the word rather than the bare `expression`, the replacement
finds no match and the sentence is displayed unmodified (the underline target is then the
kana reading standing alone — functionally still a valid question). This occurs rarely and
is accepted as-is.

---

## 9. API surface (Next.js Route Handlers)

The **Status** column reflects what is actually built today vs. designed-but-not-yet-built,
so the auth/protection guarantees below can't be assumed for routes that don't yet exist.
Batch operations are currently **scripts only** (run locally), not HTTP endpoints — there
is intentionally no web-reachable, cost-incurring Anthropic route at present (see §11.4).

| Method | Route | Purpose | Auth | Status |
|--------|-------|---------|------|--------|
| GET | `/api/cards/queue` | Today's FSRS study queue | required | **Implemented** |
| POST | `/api/review` | Submit a rating → FSRS update | required | **Implemented** |
| POST | `/api/review/undo` | Revert the most recent review (one-step undo) | required | **Implemented** |
| `*` | `/api/auth/*` | Auth.js (sign-in request, callback, session) | public (rate-limited) | **Implemented** |
| GET | `/api/quiz?level=&count=` | Batch of JP→EN multiple-choice questions (non-scheduling) | required | **Implemented** — confusability-scored distractors (shared kanji + reading similarity, §8.2) |
| GET | `/api/exam?level=&count=` | JLPT-style exam round: 問題１ (kanji reading) + 問題２ (kanji writing), non-scheduling | required | **Implemented** — 10+10 questions, two-section with break screen (§8.6) |
| GET | `/api/grammar/queue` | Grammar FSRS study queue (due + new `GrammarProgress` rows) | required | **Implemented** |
| POST | `/api/grammar/review` | Submit a grammar rating → FSRS update (`GrammarProgress` upsert) | required | **Implemented** |
| GET | `/api/grammar/browse?level=` | Every grammar point for one level, grouped by lesson, with per-point progress status | required | **Implemented** — whole dataset in one payload (§13 Phase 3.5 addendum); `Cache-Control` mirrors `/api/browse` |
| POST | `/api/demo/login` | Start an ephemeral demo session: create `User` + `UserProfile`, sign with HMAC, redirect to `/onboarding` | public (rate-limited, origin-checked) | **Implemented** — production-available; POST-only, session identity is a time-bound HMAC-signed cookie (§11.8) |
| GET | `/api/dev/login` | **Dev-only**: mint a session for the seeded user (skip the magic link) | none (dev-only) | **Implemented** — 404 in prod; gated by `DEV_AUTH` (§11.7) |
| GET | `/api/browse?level=` | Word list for one level (id, expression, reading, meaning — no sentences); browser-cached | required | **Implemented** — `Cache-Control: private, max-age=3600, stale-while-revalidate=86400` |
| GET | `/api/words/[id]/sentence` | Lazy-load one word's cached example sentence | required | **Implemented** — `Cache-Control: private, max-age=86400, stale-while-revalidate=604800` |
| POST | `/api/generate` | On-demand single-sentence fallback | required + rate-limited | Planned (Phase 4, optional — see §11.4) |
| POST | `/api/batch/submit` | Submit a generation batch | admin | Not planned (scripts only) |
| GET | `/api/batch/:id` | Poll batch status / collect | admin | Not planned (scripts only) |

---

## 10. Caching strategy

1. **Sentence cache (primary)** — `ExampleSentence` rows in Postgres. This is the core of
   the product: each word's sentences are generated once and reused for every view by every
   user. Cache key = word; a miss triggers on-demand generation (§7.4).
2. **Anthropic prompt caching** — the shared system prompt is cached across batch and
   on-demand requests to reduce input-token cost.
3. **HTTP browser caching** — the browse word list (`GET /api/browse`) is served with
   `Cache-Control: private, max-age=3600, stale-while-revalidate=86400`; lazy-loaded
   sentences (`GET /api/words/[id]/sentence`) with 24 h max-age / 7-day stale window.
   Both datasets change ~never (seeded once), so the browser avoids repeat fetches within
   the cache window entirely. The study queue and review writes are `force-dynamic` and
   never cached.

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
**Resend** (already provisioned). Access is restricted to an **email allowlist**:
`AUTH_ALLOWED_EMAIL` is parsed as a comma-separated list into a `Set` (a single address is
the degenerate case, and is what production runs today). We chose passwordless magic links
over a seeded password deliberately:

- **No long-lived shared secret lives in the application.** A seeded password is a static
  credential that must be stored, rotated, and kept out of source control, env dumps, and
  logs — a recurring leak vector for self-hosted apps. The magic-link flow stores no
  reusable password; authentication reduces to *proving control of the allowlisted inbox*.
- **It delegates to a stronger security boundary.** The owner's email account is almost
  certainly protected by a strong password and 2FA that we maintain anyway. Leaning on it
  is stronger than any password store we would build, and removes a redundant secret rather
  than adding one.
- **The allowlist contains blast radius.** Even if the sign-in endpoint is discovered, a
  link can only ever be delivered to an allowlisted address, so an attacker cannot have one
  sent to themselves. The list is kept to the few addresses that genuinely need access
  (today: one), which is what keeps this property meaningful.

### 11.3 Hardening requirements (the magic link is only secure if these hold)
A magic link is a bearer token in transit; the implementation **must** enforce:

1. **High-entropy tokens** (≥ 256 bits) stored **hashed at rest** — never the raw token.
2. **Single-use** tokens, invalidated immediately on redemption.
3. **Short TTL** — 10–15 minutes.
4. **Server-side allowlist enforcement** (case-insensitive membership in the
   `AUTH_ALLOWED_EMAIL` set, normalized on both sides) *before* any email is sent, and
   **failing closed** if the allowlist is unset. Without this the endpoint is an open
   email-spam relay. The check is repeated in the `signIn` callback at verification time,
   as defense in depth.
5. **Rate limiting** on the sign-in request endpoint (per-IP and global) to prevent inbox
   bombing and token-guessing.
6. **Secure sessions** — `httpOnly`, `Secure`, `SameSite=Lax` cookies with a sane expiry
   and rotation; sessions stored server-side (Auth.js database sessions via Prisma).
7. **HTTPS everywhere** — provided by Railway TLS; redirect HTTP→HTTPS.
8. **Security response headers** on every route (`next.config.ts`): HSTS (makes the
   HTTPS redirect durable in the browser), a Content-Security-Policy that blocks all
   external script/frame/object loads (`'unsafe-inline'` is retained for script/style
   because Next.js hydration requires it; per-request nonces were judged not worth the
   dynamic-rendering cost for an app with no third-party scripts), `frame-ancestors
   'none'`/`X-Frame-Options: DENY` (clickjacking), `X-Content-Type-Options: nosniff`,
   and `Referrer-Policy: strict-origin-when-cross-origin` (keeps magic-link URLs out
   of third-party Referer logs).

   **Two development-only relaxations**, gated on `process.env.NODE_ENV === "development"`
   so the production policy is unaffected: `'unsafe-eval'` in `script-src`, and `ws:`/`wss:`
   in `connect-src`. React's development build calls `eval()` for debugging features (it
   reconstructs cross-environment callstacks for the error overlay) and Turbopack's HMR
   runtime evaluates hot-updated modules, so without the first the dev server throws
   `eval() is not supported in this environment` and the overlay degrades; the second covers
   the HMR websocket, which CSP 3 says `'self'` already permits on the same origin but which
   browsers have handled inconsistently. `'unsafe-eval'` is deliberately **not** granted in
   production: it would make any injected string executable and undo much of what this
   policy exists to prevent. React never uses `eval()` in production builds, so nothing
   needs it there.

### 11.4 Secrets & API-key protection
- All secrets (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `AUTH_SECRET`, `DATABASE_URL`) are
  injected as Railway environment variables and never committed.
- The Anthropic key is **server-only**; it is never exposed to the client and no model call
  is reachable from the browser without an authenticated server route. As built, the only
  code that calls Anthropic lives in `src/lib/generate.ts` and is imported **only by the
  local `scripts/`** — there is currently **no web-reachable route that spends Anthropic
  tokens** (the on-demand endpoint below is not yet built; §9).
- **If/when `/api/generate` is added** (the optional on-demand fallback, §7.4), it becomes
  the single Anthropic cost-abuse vector and **must** ship with all of: (a) authentication
  (`getCurrentUserId` → 401); (b) **rate limiting** (reuse `src/lib/rate-limit.ts`, per-user
  and global) so an authenticated client can't loop it; (c) **cache-first** — call the model
  only when the word has zero cached sentences, so repeated requests for the same word are
  free; (d) a bounded `max_tokens`. Without (b)–(d), auth alone does not bound cost.
- Batch operations are **scripts only** (run locally), not HTTP endpoints, so they expose no
  cost-incurring route. Should they ever be exposed as `/api/batch/*`, they require an admin
  marker beyond a normal session.

### 11.5 Path to multi-user
Multi-user is reached by: removing the allowlist (or widening it from a fixed list to an
invite/allow rule), relying on the already-present `userId` scoping for all queries, and
adding explicit authorization checks so every read/write is constrained to the
session's user. No schema migration of the core shape is required (§6).

### 11.6 Public repository & PII
This repository is intended to be **open-sourced**, so no personal data is committed.

- **The allowlist is configuration, not source.** `AUTH_ALLOWED_EMAIL` holds the
  comma-separated addresses permitted to sign in; its *value* lives only in Railway
  environment variables and is **never committed**. `.env.example` carries a placeholder
  (`you@example.com`), never a real address.
- **A dedicated alias is preferred for the allowlist** rather than a primary personal
  inbox — it scopes the app's reach and is trivially rotatable if abused.
- **Git commit metadata is accepted as public.** Commits are authored under an email the
  author already publishes, so no history rewrite or noreply alias is required. (Decision:
  author's call — the trade-off is permanent public exposure of that address, accepted
  because it is already public.)

### 11.7 Development auth bypass (must be impossible in production)
Local development skips the magic-link round-trip via a **dev-only** route,
`GET /api/dev/login` (§9), which mints a real database session for the seeded user and sets
its cookie. Producing a genuine session keeps full parity with the production flow — `auth()`,
the `proxy.ts` guard, and `getCurrentUserId` all work unchanged. It is **doubly gated** so it
cannot exist in the deployed app: the handler returns 404 when `NODE_ENV === "production"`,
**and** only runs when `DEV_AUTH=1` is explicitly set (never set in prod). `proxy.ts` likewise
treats `/api/dev/*` as public only outside production. We deliberately did **not** use an
Auth.js Credentials provider for this: it requires the JWT session strategy, whereas Bayana
uses database sessions (§11.3 #6).

### 11.8 Demo session (ephemeral, production-available)
`POST /api/demo/login` (§9) is a **production-available** path that lets visitors try the app
without an email address. It is fundamentally different from the dev bypass above:

- **What it does:** creates a fresh `User` row (no email) and a `UserProfile` (no
  `onboardedAt`) in the database, then signs `userId:expiresAtMs` with **HMAC-SHA256**
  keyed by `AUTH_SECRET`, and writes the result as a 7-day `httpOnly` cookie. The user is
  then redirected (303) to `/onboarding`.
- **Session identity with server-enforced expiry.** No Auth.js `Session` row is created.
  `getCurrentUserId()` in `src/lib/current-user.ts` detects the demo cookie, verifies the
  HMAC (constant-time comparison), then checks the signed `expiresAtMs` against the clock —
  the expiry is inside the signed payload, so a client cannot extend its session by
  re-sending an old cookie or editing the timestamp. Cookies in the pre-expiry format
  (HMAC over `userId` alone) fail verification and are treated as signed-out; this was
  accepted over dual-format support because demo sessions are disposable by design.
- **Endpoint hardening.** Because this is the one unauthenticated write endpoint (each hit
  inserts a `User` + `UserProfile` row), it carries three defenses:
  1. **POST-only** — a state-changing GET can be triggered cross-site by an `<img>` tag or
     link prefetch without user intent; GET now returns 405.
  2. **Same-origin check** — browsers attach an `Origin` header to cross-site POSTs; any
     `Origin` not matching the app's public origin (derived from `AUTH_URL`) is rejected
     with 403. Non-browser clients that omit the header pass this check; bounding those is
     the rate limiter's job.
  3. **Rate limiting in `proxy.ts`** — per-IP (5/hour) and global (30/hour) fixed-window
     limiters bound total row creation even from rotating IPs, mirroring the sign-in
     limiters (§11.3 #5).
- **Ephemerality by design.** Each demo start creates a new `User`; the previous session's
  rows are orphaned (no cookie → unreachable). Losing the cookie means losing all data.
  This is intentional: demo data is cheap to create and users are expected to sign up via
  magic link if they want persistence.
- **Opportunistic cleanup.** Each demo login first deletes provably-unreachable demo users
  — `email IS NULL`, no Auth.js `Session` rows, `createdAt` older than the cookie TTL, and
  `id ≠ DEFAULT_USER_ID` (the local seed user) — so the table stays bounded without a cron
  job. The filter is deliberately narrow because a wrong match cascade-deletes real study
  progress; see §14.5 for why a heuristic filter was chosen over an `isDemo` column.
- **`/api/demo/login` is public in `proxy.ts`** (exact path, no session check) so the route
  is reachable before authentication — this is the correct, intentional behaviour. The
  exact-path match (rather than a `/api/demo/*` prefix) ensures future demo routes do not
  silently ship unauthenticated. It is distinct from `/api/dev/*`, which is public **only
  outside production**.
- **Threat model.** The HMAC prevents a user from forging a cookie to impersonate another
  `userId`; the signed expiry bounds how long a leaked cookie is useful; POST + Origin
  checking prevents cross-site session minting; rate limits plus opportunistic cleanup
  bound DB row accumulation from abandoned or abusive demo starts.

### 11.9 `proxy.ts`: Next.js 16 route-guard mechanics

The route guard, session gate, and rate limiters described above all live in `proxy.ts`, and Next.js 16 changed the mechanics of that file in ways that fail silently if missed:

- Next.js 16 renamed middleware to **proxy**. A `middleware.ts` file is **ignored without error**: creating one produces no guard at all, so every route silently ships unprotected.
- The file exports a function named `proxy` (type `NextProxy`; `NextRequest`/`NextResponse` from `next/server` work as before), and a `config.matcher` array still scopes which paths it runs on.
- The proxy runs in the **Node.js runtime** by default (not Edge), which is what allows the in-memory rate limiters (§11.3 #5, §11.8) to live there.
- `proxy.ts` must sit at the **project root**, not under `src/`; the framework does not pick it up elsewhere (confirmed 2026-06-05, §16).

---

## 12. Deployment (Railway)

- **Services:** 1 × Next.js web + 1 × Postgres plugin. No Redis or worker tier is required
  (see §5.1, §7.1).
- **Build:** **Railpack** (Railway's current default builder; configured in `railway.json`
  as `build.builder: "RAILPACK"`) autodetects the Next.js app, or a Dockerfile for finer
  control. Nixpacks is **deprecated** and is not used.
- **Environment variables:** `DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
  `AUTH_SECRET`, `AUTH_ALLOWED_EMAIL`, `AUTH_EMAIL_FROM`, `AUTH_URL` (public origin, for
  Auth.js callbacks). `DEFAULT_USER_ID` is **not** a production variable — it is only used
  by the local `scripts/seed-user.ts` helper.
- **Migrations & seed:** run `prisma migrate deploy` on release; load words with
  `scripts/import-csv.ts`. For the example-sentence cache, **transfer the
  already-generated sentences from local rather than regenerating** — regeneration would
  re-incur API cost. Because `Word.id` cuids differ per database, transfer keyed by the
  stable `Word.guid` (a GUID-keyed export/import), or `pg_dump`/restore the
  `Word` + `ExampleSentence` tables together so ids stay aligned. `seed-sentences.ts` /
  `collect-batch.ts` remain for generating *new* levels directly on prod.
- **Backups:** the Railway **Hobby** plan has no managed backups. The backup target is the
  **local** Postgres (the `bayana-postgres` container), which is the authoritative source of
  the generated sentence cache — Batch results land there first, then are transferred to
  prod — so backing it up protects `ExampleSentence`, the only paid, hard-to-regenerate
  artifact. (`Word` is free to re-import from `decks/`.) Back it up with `pg_dump` (exact
  commands in `notes/deploy.md`, which is gitignored along with the rest of `notes/`);
  for long-term keeping, a `Word.guid`-keyed JSON export is preferred
  over a `.dump`, which is tied to the Postgres major version and schema. Dump files contain
  personal data and are gitignored (`/backups`).
  - **Prod is deliberately not backed up routinely**, to avoid Hobby-plan egress cost. The
    accepted consequence: prod-only data — chiefly `ReviewState`/`ReviewLog` (study history,
    which accumulates only in prod once studying happens there) — is **not recoverable** if
    the prod database is lost. This is an accepted risk for a single-user learning project,
    not a recommendation for multi-user (§11.5), where study history would warrant a managed
    or scheduled backup.
- **Domain:** Railway-generated domain for the initial release; custom domain later.

---

## 13. Milestones & rollout

Completed phases are listed in the order they shipped, then the planned ones in intended
order. That is why **Phase 3.5 appears before Phase 3**: grammar study was an unplanned
interleave that shipped in June 2026, while Phase 3 (MC↔FSRS coupling) is still ahead. The
half-step number is kept rather than renumbered so the decision log (§16) and TODO.md keep
referring to the same thing.

**Phase 1a — Playable slice (run locally, study ASAP) — ✅ done**
- Postgres schema (incl. `ReviewLog`); seeded default `User` + `UserProfile`.
- CSV import for **N3**; batch-seed N3 example sentences.
- **Flashcard mode** review (JP→EN) via `ts-fsrs`, with **one-step undo**.
- Mobile-first card UI (flip / rate). Runs locally, end-to-end.

**Phase 1b — Shippable (public): auth + deploy — ✅ done**
- Magic-link auth (Auth.js + Resend, email allowlist) with §11.3 hardening and a
  root-level `proxy.ts` route guard (§11.9).
- Deployed to Railway; N3 sentence cache transferred (by `Word.guid`, §12) rather than
  regenerated.

**Phase 1c — Fill out content — ✅ done (generation)**
- All levels (N5–N1, ≈8,100 words) batch-seeded; every word now has a cached sentence
  (§7.5). The on-demand `/api/generate` fallback is **no longer needed for coverage** and
  has moved to Phase 4 (it returns there as a safety net for future additions).

**Phase 2 — Quiz mode — ✅ functionally complete**
- Gamified multiple-choice quiz (§8.2): `GET /api/quiz` with confusability-scored
  distractors (shared kanji + reading similarity, §8.2), instant feedback, cached example
  sentence on reveal. Duolingo-grade UI, minimal animation, zero ads.
- Level scope + home hub (`/home`): `UserProfile.activeLevel`, returning-user mode picker
  (Flashcard / Quiz), inline level selector.
- Light polish shipped: **browse/search** (`/browse`, browser-cached word list, 50/page
  pagination, started-words-first, inline level switcher, lazy sentence per tap, §8.3),
  **basic stats** (`/stats` — started/total, due, recall rate),
  **default `newCardsPerDay` lowered 20 → 10** with a tap-to-open `InfoBubble` explanation
  on the landing and home hub, **installable PWA** (pulled forward from the enhancements
  phase, §8.4).
- MC↔FSRS coupling and Flashcard↔Quiz synergy **deferred by choice** (§15, §16); now
  Phase 3 below.
- First-run onboarding deferred → multi-user phase (§16), then partly pulled forward in
  Phase 3.5 below.

**Phase 2 addendum — Exam mode — ✅ done (2026-06-07)**
- JLPT-style benchmark mode (§8.6): `GET /api/exam` with 10 × 問題１ (kanji reading in
  sentence context) + 10 × 問題２ (kanji writing from kana in sentence context). Sequential
  with immediate feedback; section-break screen between 問題１ and 問題２; split score
  summary.
- Exam mode is **independent of FSRS** by design — neither reads from nor writes to
  `ReviewState`. All three modes (Flashcard, Quiz, Exam) are standalone (§16 decision log).
- Home hub updated to a three-tile mode picker (Flashcard / Quiz / Exam).

**Phase 3.5 — Grammar point study (N3 v1) — ✅ done (2026-06-29)**
- Separate FSRS study queue for JLPT grammar points, fully independent of the vocabulary
  queue. Source data: `decks/grammar-n3.md` — 220 grammar points across 22 lessons (§4.1).
  Schema designed to accept N5–N1 grammar decks later without migration.
- **Schema:** `GrammarPoint` (`level` stored as plain `String`, not the `Level` enum) and
  `GrammarProgress` (FSRS fields mirroring `ReviewState`; composite unique on
  `[userId, grammarPointId]`). `CardLike` interface extracted from `src/lib/fsrs.ts` so
  the FSRS adapter functions are shared between vocab and grammar with no duplication.
- **Seed:** `scripts/seed-grammar.ts` parses `decks/grammar-*.md` and upserts grammar
  points idempotently keyed on `(level, lesson, position)`.
- **API:** `GET /api/grammar/queue` (due + new, same two-pool strategy as vocab);
  `POST /api/grammar/review` (FSRS rating → upsert `GrammarProgress`). Both auth-required.
- **Card shape:** front = grammar pattern (large JP); back = reading (if it differs from
  pattern) + comma-joined meanings + example sentence (pattern bolded in grape) + English
  translation. No undo in v1.
- **`/grammar` hub page:** inline FSRS stats (total/started/mature/due); single "Grammar
  Points" CTA. Vocab stats remain on `/stats`. Grammar also got a `BottomNav` tab here,
  removed on 2026-07-25 when the mode grid on `/home` made it redundant (§8.5, §14.8).
- **`/onboarding` page:** level-choice screen shown to any user whose `UserProfile.onboardedAt`
  is unset (both magic-link sign-ups and demo visitors). Pulled forward from the multi-user
  phase to support the demo flow. The follow-on Quiz warm-up and guided tour stay there
  (Phase 5 below).
- **Demo session (`/api/demo/login`):** ephemeral try-without-signup path; creates a new
  `User` + `UserProfile`, signs the userId with HMAC-SHA256, sets a 7-day cookie, and
  redirects to `/onboarding`. Production-available; since hardened to POST-only with a
  signed expiry, rate limiting, and origin checking (§11.8, 2026-07-10).

**Phase 3.5 addendum — Grammar browse + lesson titles — ✅ done (2026-07-01)**
- **`lessonTitle` column added to `GrammarPoint`** (migration `20260701130743_grammar_lesson_title`),
  denormalized from the source file's `## Lesson N – Title` heading the same way `level`
  is denormalized — repeated per row so a browse view can group and label lessons
  without a second lookup.
- **`GET /api/grammar/browse?level=`** — auth-gated, returns every grammar point for a
  level grouped into lessons in one payload (unlike `/api/browse`'s per-word lazy-load:
  grammar's ~220-row dataset is small enough to ship whole). `Cache-Control` mirrors
  `/api/browse`.
- **`/grammar/browse` page + `GrammarBrowseClient`:** collapsible per-lesson accordion
  (collapsed by default — 22 open lessons would be an unreasonable scroll), search box
  filters by pattern/reading/meaning and force-expands matching lessons. Reachable via a
  "Browse all grammar points" button on `/grammar`.
- **Seed script now prunes stale rows:** after upserting the freshly parsed file, it
  deletes any `GrammarPoint` row for that level whose `(lesson, position)` no longer
  appears in the file. Content gets renumbered across edits (a lesson's item count
  changes, a point moves to a different lesson), which otherwise leaves orphan rows
  behind under the old key — upsert alone can't catch these since the parser no longer
  produces them at all. Pruning cascades to `GrammarProgress` (`onDelete: Cascade`), so
  any in-progress FSRS state on an orphaned point is lost — acceptable for a single-user
  app, chosen over leaving orphans so the DB stays an exact mirror of the source file.

**Phase 3 — MC↔FSRS coupling — ▶ next**
- Make Quiz and Flashcard genuinely complementary rather than parallel: a multiple-choice
  answer writes an FSRS rating (correct ≈ Good, wrong ≈ Again) through the existing
  `POST /api/review`, and Quiz target selection is informed by FSRS state (a split between
  near-due review words and never-seen ones). Resolves open question #1 (§15).
- No schema change: reuses `ReviewState`, `ReviewLog`, and the existing review endpoint.
  The calibration choice (correct → Good or Hard, given that multiple choice is recognition
  rather than active recall) is to be recorded in [DECISIONS.md](DECISIONS.md) when it is made.
- This also supersedes the "non-scheduling first-run warm-up" framing in §8.2: once the
  first quiz session seeds FSRS, the warm-up *is* the coupling.

**Phase 4 — Admin audit + on-demand generation**
- **Admin review/audit page** (admin-gated via `UserProfile.role`): inspect each
  AI-generated example sentence and accept or reject it before it surfaces to learners
  (adds a review-status field to `ExampleSentence`; optionally generate several candidates
  per word and keep the best).
- **On-demand `/api/generate`** + study-UI fetch-on-flip for any not-yet-seeded words, with
  the §11.4 guardrails (auth + rate-limit + cache-first + bounded `max_tokens`).

**Phase 5 — Multi-user**
- Widen/remove the email allowlist; real `User` rows; authorization checks scoping all
  reads/writes by `userId`.
- Per-user settings are **intentionally minimal** (see §16); multi-user does not imply a
  settings page. The active level (already inline on `/home`) is the only planned user-facing
  control; all other parameters (`newCardsPerDay`, FSRS retention target, study direction)
  remain author-set defaults.
- **First-run onboarding completion (§8.5)** — the `/onboarding` level-choice screen already
  exists (Phase 3.5); what remains here is the follow-on: a **5-question Quiz warm-up**
  (non-scheduling) and a **guided tour** of the app. Uses the existing `UserProfile.onboardedAt`
  column to branch first-time vs. returning. Deferred because the warm-up and tour only earn
  their keep once there are multiple real users to onboard (the sole author is already past it).

**Phase 6 — Further enhancements**
- Audio (TTS) for sentences, furigana rendering, the full stats dashboard (streak/heatmap,
  history, charts — §8.5), sentence regeneration/voting, export back to Anki.
  (Installable-PWA *basics* — manifest, icons, fullscreen + safe-area — were pulled forward
  to 2026-06-04, §8.4/§16; the **offline shell / service worker** is what remains here.)

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

### 14.4 Service-worker / offline support shipped with the PWA basics
**Deferred (not rejected).** When making Bayana installable (manifest + icons + fullscreen,
2026-06-04), the option was to also add a Workbox-style service worker (e.g. `@serwist/next`,
the maintained `next-pwa` successor) to precache the app shell so it opens offline. It was
deferred because the install/fullscreen goal — a chrome-free, edge-to-edge study session —
needs **no** service worker, while a SW adds a real maintenance surface (cache-versioning
and invalidation, stale-asset bugs, extra Turbopack/Next 16 integration risk) for little
benefit on an always-online, single-user app. The manifest alone is enough for an Android
install; iOS "Add to Home Screen" likewise needs no SW. Offline support can be added later
(§13 Phase 6) once there is a concrete offline use case. Also considered and rejected for
the same release: the browser **Fullscreen API** (`requestFullscreen`) to force a single
route truly fullscreen — it is unsupported on iPhone Safari, so it is not a portable answer,
whereas the manifest `display` mode covers Android cleanly.

### 14.5 `isDemo` column on `User` instead of a heuristic cleanup filter

**Rejected (for now).** The opportunistic demo-user cleanup (§11.8) must identify rows that
are certainly abandoned demo sessions, because a wrong match cascade-deletes real study
progress. An explicit `isDemo: Boolean` column would make that identification trivial and
self-documenting, but requires a migration and backfill for a property that is already
fully derivable: demo users are exactly the users with `email IS NULL`, no Auth.js
`Session` rows, and (for deletability) a `createdAt` older than the cookie TTL, excluding
the local seed user's pinned id. The heuristic filter was chosen because it needs no
schema change and each condition independently excludes a class of real user. Revisit if
the demo flow grows features (e.g. demo-to-real account upgrade) that make "is a demo
user" load-bearing beyond cleanup.

### 14.6 `SELECT … FOR UPDATE` row locking instead of serializable transactions

**Rejected.** The review write path (§8.1) is a read-modify-write: read the FSRS row,
compute the next card state in JavaScript (`ts-fsrs`), write it back. Under Postgres's
default `READ COMMITTED` isolation, two concurrent reviews of the same card both read the
same prior state and the second write silently discards the first (a lost update).
Explicit row locking (`SELECT … FOR UPDATE`) fixes this by serializing at the row, but in
Prisma it requires `$queryRaw` — abandoning the typed query API precisely on the app's
most correctness-sensitive path. Instead, the transaction runs at `SERIALIZABLE` isolation
with a bounded retry on Prisma error `P2034` (serialization conflict), wrapped in a shared
`serializableTxn()` helper in `src/lib/db.ts`. Contention on a single user's single card
is near-zero, so retries are vanishingly rare and the stronger isolation costs nothing in
practice; the helper's contract (the callback may run more than once; queries inside must
be sequentially awaited, since an interactive transaction holds one connection) is
documented at the definition.

### 14.7 Demo sessions skipping onboarding entirely

**Rejected.** When the home hub became the app's default page (§8.5, 2026-07-25), an option
was to send `POST /api/demo/login` straight to `/home` with a preset level (N3, the only
fully-seeded grammar level), on the grounds that a reviewer evaluating the app wants the
shortest possible path to seeing it work. It was rejected because the active level scopes
every engine, every count, and the hub's progress bar: a demo user who never chose N3 would
be shown a Today panel and a progress bar describing a level picked for them, which is a
worse first impression than one extra tap. The level choice is also the app's clearest
statement of what it is (a JLPT tool, N5 to N1), so it doubles as orientation. Author
decided; deciding factor was that onboarding is a single tap and is itself informative.

### 14.8 Grammar as a permanent `BottomNav` tab

**Rejected.** Grammar had a tab of its own from Phase 3.5, and was promoted to the leftmost
tab on 2026-07-02 when `/grammar` became the post-login landing. With the hub restored as
the default page and carrying all four modes (§8.5), the tab was removed instead of kept
alongside the new Grammar tile. Keeping it was the conservative option and would have saved
a tap when navigating from `/stats` or `/browse`, but the tab bar then listed three
*places* plus one *study mode*, which both mixed categories and implied Flashcard, Quiz, and
Exam had been deliberately excluded. The accepted cost: `/grammar` is a page with no
corresponding tab, so no tab highlights while the user is on it. That is a standard
sub-page condition and was judged the smaller wart. Author decided.

---

## 15. Open questions

- Should multiple-choice results feed the FSRS scheduler, or remain a separate,
  non-scheduling mode? (§8.2; scheduled as Phase 3, §13, where the open part is the
  calibration: correct → Good or Hard.)
- Should Exam mode be timed? It is not today, and per-question feedback pulls it toward
  study tool rather than mock sitting (§8.6).
- Furigana: store the reading as plain kana (current) or as ruby-annotated markup?
- MCQ distractor difficulty mix: how many confusable vs random distractors per question,
  and should the ratio adapt to the user's level/performance? When (if ever) should
  rule-based scoring graduate to embeddings + pgvector? (§8.2)

---

## 16. Decision log

The dated log of decisions that shaped this design lives in
**[DECISIONS.md](DECISIONS.md)**, newest first. It was extracted from this section on
2026-07-26 because it is append-only while the rest of this document is rewritten in
place; the rows themselves are unchanged. Record every new or reversed decision there, and
keep the analysis of rejected options in §14 above.
