# Bayana: Design Document

**Spaced-repetition JLPT vocabulary trainer with AI-generated example sentences.**

| | |
|---|---|
| **Status** | Living document; Phases 1a through 3.5 implemented and deployed (§13) |
| **Author** | Chairul Akmal |
| **Last updated** | 2026-07-26 (API surface split by direction: §9 restructured into §9.1 route handlers (reads) and §9.2 Server Actions (writes), the three rating routes marked for retirement and the planned on-demand generation route reclassified as a write; §14.16 records why both uniform alternatives lost, and §14.17 records the decision to decline `cacheComponents`, View Transitions and the React Compiler on deployment risk. Planned, not built. Earlier the same day: UI/UX workstream parked: the Japanese-face subset is deferred behind the bayan work and the timezone day-boundary fix behind a timezone-source decision, both tracked in TODO.md; dark mode moved from that list into §15 as the open design question it always was. Same day: grammar hub gains an inline `LevelPicker` with derived empty-deck markers, `setActiveLevel` now revalidates every level-scoped route, and §14.14 records the partial mitigation this gives the disabled-tile stranding. Same day: keyboard and screen-reader gaps closed on the browse pages and the account menu: §8.4 gains a keyboard/SR floors bullet and `UserMenu` becomes a disclosure rather than a mis-declared ARIA menu, per the new §14.15. Same day: Grammar mode tile now disabled on levels with no seeded deck, reversing §8.5's "no tile is ever disabled" rule; the reversal and its accepted cost are in the new §14.14. Same day: hit-target audit closed: the last five sub-44px controls raised to the floor and §8.4's touch-ergonomics bullet gains the `.tap-44` / `.tap-44-box` split. Same day: route states added app-wide: §8.4 gains a route-states bullet covering the four boundary files and the two-tier loading design, with the rejected shapes in the new §14.13. Same day: brand fonts self-hosted with `next/font` and the Japanese face cut to two weights: §8.4 gains a font-delivery bullet, §11.3 records a CSP with no third-party origin left in it, and §14.12 is rewritten from a deferral into the decision and its rejected alternatives. Same day: font weights trimmed to what the app renders and Japanese text returned to the Japanese face at nine sites. Same day: accessibility floors added to §8.4 with the alternatives in §14.11, following a BRAND.md review: contrast and keyboard-focus defects fixed in the session chrome, the level pickers, and the browse inputs; `--ink-faint` darkened to clear AA; BRAND.md resynced against `globals.css`. Same day: planned scope added in §2, §4.2, §13, §14.9/§14.10 and §15: the Kalima mock-exam absorption and the bayan/zaka consumer role, neither built yet. Same day: §16 decision log extracted to [DECISIONS.md](DECISIONS.md), leaving a pointer. 2026-07-25, documentation-consistency pass: §8 intro, §8.6, §9, §11.2/§11.3/§11.6 and §13 corrected against the implementation; §13 phases renumbered to admit the MC↔FSRS coupling phase. Earlier the same day: §8.5 rewritten for the `/home` landing and the revamped public `/`; §14.7/§14.8 added; deck-size figure corrected in §3) |
| **Target platform** | Mobile-first responsive web (Next.js 16, deployed on Railway) |

---

## TL;DR

Bayana turns an existing ~8,100-word JLPT vocabulary deck (N5–N1, Anki export) into a modern web flashcard app. Cards are scheduled with **FSRS** (the algorithm used by current Anki), and each word is paired with **example sentences generated once by Claude Haiku and cached permanently** in Postgres. It offers four study modes (§8): a serious spaced-repetition **"Flashcard mode,"** a fast, gamified multiple-choice **"Quiz mode,"** a JLPT-style **"Exam mode"** benchmark, and a separate FSRS queue for **grammar points**. The app ships as a **single full-stack Next.js service** on Railway. It launches single-user with **passwordless email magic-link authentication** (Auth.js + Resend, restricted to an email allowlist that holds one address today) and a data model that is multi-user-ready from day one.

---

## 1. Background & motivation

JLPT learners memorize large vocabulary lists, but isolated word↔meaning pairs are weak memory anchors. Contextual example sentences materially improve retention, yet writing ~8,100 of them by hand is impractical and licensing pre-made sentence banks is costly.

We start with a clean, structured deck in Anki export format. By generating one set of high-quality, level-appropriate example sentences per word with a cheap LLM and caching them, we get the pedagogical benefit at a near-zero, one-time cost, and a study experience tailored to our own data and scheduling.

## 2. Goals & non-goals

**Goals**
- **Match Anki's core review loop** (FSRS scheduling, undo, suspend, meaningful stats) while eliminating its setup overhead, and without user-authored decks (see non-goals).
- Import the existing deck and present it as study-ready flashcards.
- Schedule reviews with a modern SRS (FSRS) for strong long-term retention.
- Attach AI-generated, level-appropriate example sentences to every word, generated once and served from cache thereafter.
- Ship as the smallest reasonable deployable footprint on Railway.
- Be secure by default despite a single-user launch, and extend cleanly to multi-user.
- Deliver a **mobile-first** experience optimized for small phone screens (iPhone SE baseline) that remains fully usable on desktop.
- **Minimal-friction start.** Returning users are a single tap from studying: signing in lands them on the home hub, whose primary CTA is routed to the highest-priority work for their remembered **active level**, with the four modes one tap away. No decks, note types, or configuration. First-time users complete a one-time level choice first (§8.5). Frictionless entry is a core differentiator from Anki.

**Planned scope change (decided 2026-07-26, not yet built).** Two goals are being added, and together they widen the product from a single-deck vocabulary trainer into a JLPT practice app with a second upstream:

- **Host a JLPT mock exam**, absorbed from the sibling Kalima project: a timed, multi-type sitting drawn from a stored question pool rather than generated per request from the word table. This is a different object from the existing Exam mode (§8.6), and whether the two coexist or one retires is open (§15).
- **Be the reference consumer of the bayan/zaka question dataset**, importing pinned, CC BY 4.0 licensed releases and grading them into FSRS state (§4.2).

The second is the larger commitment: until now every byte of content was either committed to this repo or generated by this project, and the level of a word was decided by a file we control (§4). A published external dataset is a dependency with its own release cadence, schema, and licence obligations. Accepted because grading an imported question into a real scheduler is a capability no other consumer of that dataset has, and because the import is a pinned artifact rather than a live service call. Milestone and open forks: §13, §15.

**Non-goals (initial release)**
- Native mobile apps (mobile-first responsive web only; see §8.4).
- User-authored decks or editing of source vocabulary.
- Social/sharing features, leaderboards.
- Real-time collaboration or multi-device live sync beyond standard server state.

## 3. Terminology

- **Word**: a vocabulary entry from the source deck (`expression`, `reading`, `meaning`).
- **Example sentence**: an AI-generated sentence using a word, with reading + translation.
- **Review state**: per-user, per-word FSRS scheduling data.
- **Cache hit/miss**: whether a word already has stored example sentences.
- **Seeding**: the one-time bulk generation of example sentences via the Batch API.
- **Question store** *(planned, §4.2)*: the stored pool of pre-authored exam questions, as distinct from the questions Quiz and Exam mode build on the fly from `Word` rows.
- **Exported question** *(planned)*: one row of that pool in the shape bayan publishes, carrying its own `question_type`, `source`, and provenance.
- **Reference consumer** *(planned)*: the named downstream application that a dataset publisher points to as the worked example of using its releases. Bayana takes this role for bayan/zaka (§2, §4.2).

---

## 4. Source data

The deck originates from [**open-anki-jlpt-decks**](https://github.com/jamsinclair/open-anki-jlpt-decks), **MIT-licensed** and freely usable with attribution. Our copy is committed at `decks/*.csv`: Anki export format, one file per JLPT level.

| File | Rows (≈) | Level |
|------|----------|-------|
| `n5.csv` | 717 | N5 (easiest) |
| `n4.csv` | 667 | N4 |
| `n3.csv` | 2,140 | N3 |
| `n2.csv` | 1,906 | N2 |
| `n1.csv` | 2,698 | N1 (hardest) |
| **Total** | **8,128 rows → 8,101 words** | after `guid` de-duplication on import |

**Columns:** `expression` (kanji/word), `reading` (kana), `meaning` (English), `tags` (space-separated, e.g. `JLPT JLPT_N5 Genki`), `guid` (stable Anki identifier).
- `guid` is the natural **unique key** and guarantees idempotent re-imports.
- `tags` encode legacy/overlapping levels (an N5 word may also be tagged `JLPT_3`). The **source file** is authoritative for level; surplus tags are stored as metadata.

The original Anki card templates (EN→JP and JP→EN directions plus `styles.css`) served as a visual reference for the card UI during Phase 1a. They are **not committed**: the card UI has since diverged from them and [BRAND.md](BRAND.md) is the visual reference now.

**Import considerations**
- Some `meaning` fields are quoted CSV containing commas (`"to meet, to see"`); use a spec-compliant CSV parser.
- Some entries use placeholder markers (`〜` / `～`) and parenthetical notes (e.g. `(かさを～) さす`); preserve raw text but flag these for the generation prompt.
- The `MediaMissing` tag is irrelevant to this product and may be discarded.

### 4.1 Grammar source data

Grammar points (§13 Phase 3.5) come from a source not licensed for redistribution, unlike the MIT-licensed vocabulary above. `decks/grammar-*.md` is therefore **gitignored, not committed**: the repo ships the schema and seed script, but not the content itself. Anyone reproducing this project needs to supply their own grammar deck in the same markdown shape (`## Lesson N – Title` / `### pattern reading` heading tag / meanings / `**例文:**` sentence / translation; see the header comment in `scripts/seed-grammar.ts`).

| File | Points | Lessons | Level |
|------|--------|---------|-------|
| `grammar-n3.md` | 220 | 22 | N3 |

### 4.2 Imported question data (planned, decided 2026-07-26)

The mock exam and the dataset-consumer role (§2, §13) introduce a **third class of source data**: pre-authored exam questions, stored rather than generated from `Word` rows at request time. Two sources feed one table, because they are the same kind of row:

| Source | Content | Licence |
|--------|---------|---------|
| Kalima seed | 496 N3 vocabulary questions across five types, plus an audited passage set (20 short / 10 medium / 5 long / 10 info) | Author's own, moved between the author's projects |
| bayan/zaka releases | Published `ExportedQuestion` rows, pinned to a dated release tag | **CC BY 4.0** |

Three properties of this data drive the design:

- **Licence obligation, not a courtesy.** CC BY 4.0 requires attribution, so imported questions need a visible attribution surface in the UI before the first release is imported. This is the first content in the project carrying an obligation that survives into the running app; the vocabulary's MIT terms are satisfied by the README credit (§11.6), and the grammar deck is simply never redistributed (§4.1).
- **No shared identifier with our corpus.** Bayan cannot carry an Anki `guid`, because its own licensing position rests on no third-party deck appearing anywhere in its chain. The vocabulary crosswalk is therefore **expression plus reading**, computed and owned on this side, and it is lossy by nature: homographs and orthographic variants will need a documented tie-break. Contrast §4's import path, where `guid` makes the join exact and re-imports idempotent.
- **Paid, audited content.** The passage set is generated AI output that was reviewed once. Like `ExampleSentence` (§7.5, §12), it is transferred rather than regenerated, and it joins the backup target when it lands.

**Shape.** The table follows bayan's `ExportedQuestion` rather than Kalima's `ExamQuestion` (§14.9), keeping the `source` field that distinguishes seed rows from dataset releases and leaving room for `stimuli` and `provenance` so that reading and listening questions need no second migration. The concrete Prisma model is deliberately **not** written into §6 until the fork in §15 about Exam-mode overlap is resolved, since that answer changes what the table has to serve.

---

## 5. System architecture

The system is a **single full-stack Next.js 16 (App Router) application**. The browser UI, the JSON API (Route Handlers / Server Actions), the FSRS scheduling logic, and the Anthropic integration all live in one deployable, backed by a managed Postgres instance.

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

A split backend (e.g. a Rails or standalone Node API behind a separate frontend) is a common default, but it is **unjustified for this product's actual requirements**. The decision to use one Next.js service is deliberate:

- **No cross-client API contract to honor.** The only consumer of our backend is our own web frontend. A standalone API earns its keep when multiple independent clients (mobile apps, third parties, other services) must share it. We have exactly one client, so a public, versioned API surface is overhead with no payoff. Next.js Route Handlers and Server Actions give us typed, server-only endpoints colocated with the UI that consumes them.

- **No heavy background-processing tier is needed.** The one long-running workload (bulk sentence generation) is delegated to **Anthropic's Batch API**, which executes asynchronously on Anthropic's side. Our system only submits jobs and polls for results, work that a lightweight scheduled route or a one-off script handles cleanly. This is the usual reason teams reach for a separate API + worker tier (Sidekiq, Celery, etc.); here that reason does not apply.

- **Every feature is a database query or a single LLM call.** FSRS scheduling is pure in-process computation (`ts-fsrs`). Multiple-choice distractors are a same-level `SELECT` over existing words: no AI, no extra service. On-demand sentence fallback is one synchronous Haiku request. None of this benefits from a network hop to a separate backend; a split would only add latency and a second failure domain.

- **One language, one toolchain, one deploy.** TypeScript end-to-end means shared types between server and client, a single dependency graph, one CI/CD pipeline, and one Railway service to operate, observe, and scale. A separate API would roughly double the operational surface (extra service, extra build, extra inter-service auth) for no capability we require.

- **Scaling is horizontal and stateless.** App state lives in Postgres; the Next.js service is stateless and scales out by adding replicas behind Railway's load balancer. We do not have a workload profile (e.g. CPU-bound media processing) that warrants isolating the backend onto its own scaling unit.

**When we would revisit this:** if we later add independent clients that must share the backend, introduce continuous/streaming generation pipelines that need a dedicated worker fleet, or require a CPU/memory profile incompatible with the web tier. None are on the roadmap. The data model (§6) and generation design (§7) are framework-agnostic, so extracting a service later is an option, not a prerequisite. See §14 for the full alternatives analysis.

---

## 6. Data model

The schema is **single-user at launch but multi-user-ready**: one seeded `User` row owns all review state today. Introducing real authentication later means populating additional users and scoping queries by `userId`: no change to the core shape.

**Identity vs. profile.** `User` is the **authentication identity**: once Auth.js is added (§11), its Prisma adapter owns this model (alongside `Account` / `Session` / `VerificationToken`) and expects a specific shape. App-specific data (display name, study preferences, role) therefore lives in a separate **one-to-one `UserProfile`**, keeping library-managed auth concerns decoupled from our own. `UserProfile` is also where the study **direction preference** (§8.1) and the **admin role** (gating the admin audit page, §13) live.

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

`ExampleSentence` is the **cache**: once a word has rows here, no API call is made. Permitting multiple rows per word allows several examples per card and UI rotation.

---

## 7. AI sentence generation

**Strategy: pre-generate with the Batch API (N3 first), then the remaining levels.** On-demand generation exists only as a fallback for the rare cache miss.

### 7.1 Why the Batch API
- **≈ 50% cheaper** than synchronous calls, ideal for a one-time ~8.8k-word fill.
- Asynchronous: thousands of requests submitted, polled, and collected within ~24h.
- Seeding has no latency requirement, so the asynchronous trade-off is pure savings.

### 7.2 Prompt design (per word)
- **System prompt** (shared, identical across requests) is marked for **prompt caching** so repeated batch requests reuse it. It defines the task, the JSON output schema, per-level difficulty tuning, and rules for placeholder words (`〜`, `(...)`).
- **User message** carries the word's `expression`, `reading`, `meaning`, and `level`.
- **Output (structured JSON):**
  ```json
  {
    "japanese": "私は毎朝公園で友達に会う。",
    "reading":  "わたしはまいあさこうえんでともだちにあう。",
    "english":  "I meet my friend at the park every morning."
  }
  ```
- Sentence complexity is tuned to level: N5/N4 short and basic, N1 natural and idiomatic, with vocabulary/grammar restricted to at-or-below the target level where feasible.
- **One sentence per word** at launch: simplest and lowest cost. The schema already permits multiple `ExampleSentence` rows per word (§6), so generating more later needs no core change. A future **admin review/audit** workflow (§13 Phase 4) will let an admin accept or reject each generated sentence before it surfaces to learners.

### 7.3 Seeding order
1. **N3 batch first** (priority): ~2,140 words.
2. Then N5, N4, N2, N1.
3. `scripts/seed-sentences.ts` chunks words, builds Batch request files, and submits.
4. `scripts/collect-batch.ts` polls status and, on completion, parses results and upserts `ExampleSentence` rows (`source = BATCH`), keyed by word `guid`/`id`. Each model output is **schema-validated** (well-formed JSON with non-empty `japanese`/`reading`/`english`); malformed or empty results are skipped and logged for retry, never stored.
5. The pipeline is re-runnable: words that already have cached sentences are skipped.

### 7.4 On-demand fallback
`POST /api/generate`: when a card is opened and has zero `ExampleSentence` rows (e.g. a level not yet seeded), the server makes a single synchronous Haiku call, **validates the JSON output** (same schema check as seeding), stores the result (`source = ONDEMAND`), and returns it. First view incurs ~1s latency; subsequent views are cache hits. This endpoint is authenticated (§11) to prevent unauthorized cost.

### 7.5 Cost estimate (order of magnitude; verify against current Haiku pricing)
Assumptions: ~300 input tokens/word (including amortized cached system prompt) and ~450 output tokens/word (≈3 sentences). At ~8,800 words this is ~2.6M input + ~4.0M output tokens. At Haiku-class rates with the Batch 50% discount, total one-time cost lands in the **low-single-digit to ~$10** range; prompt caching reduces input cost further. Treat this as a budget ceiling, not a quote; confirm against current published Haiku pricing.

**Measured actual (2026-06-03).** The full one-time seed of all five levels (≈8,100 words, one sentence each) via the Batch API cost **≈ $2.55 cumulative** (Anthropic console): N3 first (~$0.62), then N5/N4/N2/N1 (~$1.7), plus a few cents of prompt-quality gating and straggler retries. Output tokens dominate (they can't be cached); the Batch discount and cached system prompt kept it well under the ceiling above. This confirms the core premise: the contextual-sentence benefit is achieved at a near-zero, one-time cost.

---

## 8. Study experience

Bayana offers four complementary study modes: **Flashcard mode** (serious spaced-repetition recall, §8.1), **Quiz mode** (fast, gamified JP→EN multiple choice, §8.2), **Exam mode** (JLPT-style reading/writing questions, §8.6), and **grammar study** (a separate FSRS queue over grammar points, §13 Phase 3.5). Flashcard mode is the retention engine; Quiz mode is the lightweight warm-up; Exam mode is the benchmark; grammar runs alongside all three on its own schedule. Browse/search (§8.3) is a reference tool rather than a mode.

**Level scope.** Every mode operates within a **single JLPT level at a time, the user's *active level***, chosen once at onboarding (§8.5) and changeable later (stored on `UserProfile.activeLevel`, §6). Queues, new-card selection, and multiple-choice distractors all stay within one level's vocabulary, so the modes are *separated by level*: you study one level at a time, not the whole deck at once. The one deliberate exception is the home hub's words-due count, which is level-agnostic for the reason given in §8.5.

**Entry points.** A **public marketing page** lives at `/` for logged-out visitors and the authenticated app opens on the home hub. Onboarding, the hub, and the routing between them are specified in **§8.5**; the look-and-feel follows **[BRAND.md](BRAND.md)**.

### 8.1 Flashcard mode: SRS review (FSRS)
The classic spaced-repetition flashcard loop, modeled on Anki.

- The daily queue selects `ReviewState` rows where `due <= now` for the current user **at their active level** (§8.5), ordered by due date, plus a configurable number of `NEW` cards/day **selected in randomized order** so similar-sounding words (adjacent in the source deck) aren't clustered together.
- The card UI mirrors the Anki templates: the front shows the expression (or the meaning, in reverse direction); flipping reveals reading, meaning, and a **cached example sentence**.
- The user rates **Again / Hard / Good / Easy**; `POST /api/review` invokes `ts-fsrs` to compute the new `stability`, `difficulty`, `due`, and `state`, which are persisted.
- **Continuous sessions:** the study screen loads a batch of cards and, when it is exhausted, **auto-refetches** the queue, so cards that have just become due (a card rated *Again*, or a learning-step card) cycle back without a manual reload. The "all caught up" state appears only when a fresh fetch returns nothing (with a *Check for more* action to refetch).
- Each rating is also appended to the immutable **`ReviewLog`** (§6), which powers statistics, future FSRS re-optimization, and **one-step undo**: restoring the card's prior scheduling state right after a misrating. Undo ships in the MVP.
- **Direction:** new users default to **JP→EN** (recognition); **EN→JP** (recall) is opt-in via user preferences. Example sentences are generated for the Japanese word only (§7) and are therefore direction-independent: the same cached sentence appears on the reveal side in either direction.

### 8.2 Quiz mode: multiple choice
A gamified, tap-to-answer quiz in the spirit of Duolingo: pick the right answer from four options, get instant feedback, keep momentum. Optimized for quick mobile sessions. Questions are drawn from the user's **active level** (§8.5), and the first-run warm-up is five such questions, run as a **non-scheduling** practice (it doesn't affect FSRS state).

- `GET /api/quiz` returns a target word plus one correct option and three distractors.
- Variants: show `expression` → choose `meaning`, or `meaning` → choose `expression`/`reading`.
- Instant correct/incorrect feedback with the cached example sentence shown on reveal.
- Whether Quiz mode results feed the FSRS scheduler (correct ≈ Good, wrong ≈ Again) or remain a separate, non-scheduling practice mode is **Phase 3** (§13; open question #1 in §15).

#### UI & feel: Duolingo-grade, deliberately restrained
The mode should *feel* as polished and satisfying as Duolingo (that bar is the point) but with two deliberate departures that are part of the product thesis (§1):

- **Minimal animation.** Snappy, lightweight transitions (instant answer feedback, a brief correct/incorrect state), **not** heavy character animations, celebratory cutscenes, or motion that delays the next question. Momentum comes from speed and low friction, not spectacle. Respect `prefers-reduced-motion`.
- **Zero ads, ever.** No advertising, no interstitials, no upsell modals. This is a core anti-Duolingo differentiator, not a future monetization slot.
- Otherwise it inherits the mobile-first ergonomics of §8.4 (full-width thumb-reachable options, ≥44×44 px targets, iPhone SE baseline) and shows the cached example sentence on reveal for context.
Distractors are chosen to be *plausibly confusable* with the target rather than random, so that answering correctly requires actually knowing the word. Confusability is scored along three independent axes, all derivable from existing `Word` fields:

- **Orthographic**: shares one or more kanji with the target's `expression` (e.g. 見る / 見える).
- **Phonetic**: identical or near-identical `reading`; homophones such as 会う / 合う are the classic JLPT trap.
- **Semantic**: overlapping `meaning`.

**Implementation (MVP).** A single same-level query fetches the candidate pool (`WHERE level = $level AND id <> $targetId`; only ~700–2,700 rows), and candidates are **scored in application code** as a weighted sum of the three signals; the top-scoring candidates become the distractors, with a fallback to random same-level words when too few confusable candidates exist. Keeping the scoring in TypeScript (rather than SQL) keeps the weighting and guardrails readable and unit-testable, while SQL stays a plain pool fetch.

**Fairness guardrail.** A distractor must never be a legitimate answer. Candidates whose `meaning` is a near-duplicate or superset of the target's (true synonyms) are excluded, so the semantic axis selects *similar-but-distinct*, never equivalent. The orthographic and phonetic axes do not carry this risk.

**Difficulty mix.** Each question blends confusable and random distractors (e.g. two confusable + one random) so it is challenging but solvable; the exact ratio is tunable and is an open question (§15).

**Scale path (Phase 2+).** If per-request scoring ever needs to move into the database, the Postgres-native upgrades are: a kanji `text[]` column with a GIN overlap index (orthographic), `pg_trgm` trigram similarity (phonetic/lexical), and **pgvector** over a one-time pass of `meaning` embeddings (true semantic similarity). None are required at launch scale.

### 8.3 Browse / search
A whole-deck lookup tool scoped to the active level. The user can search by kanji, reading, or English meaning; tapping any word reveals its cached example sentence.

**Implementation.** `GET /api/browse?level=` returns the level's full word list (id, expression, reading, meaning; **no sentences**) with `Cache-Control: private, max-age=3600, stale-while-revalidate=86400`. The browser caches this response; repeat visits within the hour cost zero server round-trips. The client (`BrowseClient`) filters in memory per keystroke: no server request per search. Results are **paginated at 50 per page** with previous/next controls and an editable page-number input (clamped to `totalPages` so shrinking results mid-session never leaves the user on a phantom page); this replaces an earlier render cap that had no way to reach later pages. Sentences are lazy-loaded per word via `GET /api/words/[id]/sentence` (cached 24 h) when a row is tapped, keeping the initial payload small. Rows expand/collapse in an accordion (one open at a time).

### 8.4 Responsive / mobile-first design
The product is **designed for the phone first** and progressively enhanced for larger screens; the bulk of study happens on mobile.

- **Baseline viewport:** iPhone SE (**375 × 667 CSS px**, the smallest mainstream target). All primary flows (study, flip, rate, quiz) must be fully usable and uncluttered at this size without horizontal scrolling or zoom. Larger phones, tablets, and desktop are treated as additive breakpoints, not the design center.
- **Layout:** a single-column, vertically-centered card layout (mirroring the source Anki templates) that scales up gracefully; on desktop the card is width-capped and centered rather than stretched edge-to-edge.
- **Touch ergonomics:** rating actions (Again/Hard/Good/Easy) and MC options are full-width, thumb-reachable controls with ≥ 44×44 px hit targets, placed in the lower portion of the viewport. Card flip is tap-anywhere; swipe gestures are an optional enhancement, never the only path. A control is allowed to be *painted* smaller than 44px where visual quiet matters (session-header pills, JLPT chips); its **hit target** is not, and `.tap-44` expands the target without changing the painted box (BRAND.md §7). `.tap-44` is **vertical-only** by design, so that two chips side by side can never steal each other's taps; `.tap-44-box` is the both-axis variant, reserved for a control that is narrow *and* has no horizontal neighbour (currently only the header avatar). Neither utility fixes a bare text run, which has no box to expand: those get real padding instead. As of 2026-07-26 the audit is closed and no interactive control in the app is below the floor.
- **Accessibility floors (2026-07-26):** all text clears WCAG AA (4.5 : 1), which makes `--ink-faint` the quietest value in the app rather than a decorative one; every control carries a visible keyboard focus indicator, and `outline` is reserved for that indicator so a selected state never removes it. Ratios, the token ramp, and the two ways this gets broken in practice (compositing with `opacity`, drawing selection with `outline`) are in BRAND.md §3 and §7; the alternatives weighed are in §14.11.
- **Keyboard and screen-reader floors (2026-07-26):** every disclosure has at least one keyboard exit that restores focus to its trigger; `UserMenu` is a disclosure, not an ARIA menu (§14.15). Every input carries an accessible name from `aria-label` rather than a placeholder, which is not exposed by all screen readers and vanishes once the field has content. Every expand/collapse control carries `aria-expanded`, since the ▲/▼ glyphs that convey state visually are `aria-hidden` by design. Result counts that change per keystroke sit in a `role="status"` region that is **part of the normal render**, never mounted at the moment the number changes: a live node created when it first has something to say is frequently not announced (the precedent and its comment are in `quiz-session.tsx`). An `aria-label` is only honoured where a role can carry it, so a labelled decorative `<span>` needs `role="img"`.
- **Typography:** Japanese text (expression/reading) is sized for legibility on small screens and must render correctly with appropriate CJK font fallbacks; respects dynamic type / user font-scaling.
- **Installable PWA (basics shipped 2026-06-04):** a Web App Manifest (`src/app/manifest.ts`, served at `/manifest.webmanifest`) plus PNG icons (192 / 512 / maskable, generated from `src/app/icon.svg` by `scripts/gen-pwa-icons.mjs`) make Bayana installable to the home screen. `display: "fullscreen"` runs the study/quiz session chrome-free and edge-to-edge on Android; iOS Safari ignores `fullscreen` and degrades to `standalone` (chrome-free but the status bar remains), an accepted limitation, as the author is on Android (§16). `viewport-fit=cover` plus `env(safe-area-inset-*)` (`.pt-safe`/`.pb-safe`, applied to the session `<main>`) keep controls clear of the notch and home indicator, and `dvh` sizing fills the screen without browser-chrome clipping. The **offline shell (service worker)** remains deferred (§13).
- **Implementation:** Tailwind CSS with a mobile-first breakpoint strategy (base styles target the SE; `sm:`/`md:`/`lg:` add desktop affordances).
- **Visual language**: the palette, typography (Fredoka / Nunito / M PLUS Rounded 1c), the mascot Pī, and components are specified in **[BRAND.md](BRAND.md)** (design tokens in its §8); the iPhone SE baseline above is the shared design target for both docs.
- **Route states (2026-07-26):** every route is covered by a boundary, so no navigation and no failure falls through to a Next.js default rendered against the cream surfaces. Four files at `src/app`: `error.tsx` (segment errors, a Client Component because React error boundaries are client-side, offering `reset()` for the transient cases), `global-error.tsx` (root-layout failures, which sit above `error.tsx` and so cannot be caught by it), `not-found.tsx` (prerendered static, since a 404 must not cost a database round-trip), and `loading.tsx`. The loading design is two-tier: the root file is a generic fallback whose job is only that no route is ever uncovered, and `/home`, `/browse` and `/stats` each ship a layout-shaped skeleton beside their page, which Next.js prefers because the nearest boundary wins (§14.13). Skeleton blocks use one shared `.skel` class filled with `--cream-100`, the token that is already the unfilled track behind every progress bar. Two rules govern them: **anything needing no data is rendered for real** (section labels, headings, `BottomNav`, which stays usable while the page loads), and **placeholder fidelity is dimensional, not textual**, so a skeleton never restates page copy that would then drift. `WordListSkeleton` is shared between `/browse`'s server wait and `BrowseClient`'s much longer client fetch of the level's word list, so the two waits render as one continuous load. Both error surfaces display `error.digest` when present: Next.js redacts the real message before sending it to the browser, and that hash is the join key to the server log.
- **Font delivery.** The three faces are declared in `src/app/fonts.ts`, downloaded from Google at build time by `next/font/google`, and served from our own origin out of `/_next/static/media`; nothing is fetched from Google at runtime. Each declaration exposes a CSS custom property that `globals.css` maps onto the brand tokens (`--f-display`, `--f-body`, `--f-jp`), so call sites name roles rather than families. The Japanese face sets `preload: false`, which is load-bearing rather than incidental (§14.12).

### 8.5 Onboarding & session flows
Two user stories drive entry into the app. Both reach the same level-scoped engines (§8.1, §8.2, §8.6, plus the grammar queue of Phase 3.5); they differ only in the first-run extras.

- **First-time user (first run).** Sign in via the email magic link (§11.2) *or* start a demo session (`POST /api/demo/login`, §11.8) → routed to `/onboarding` (gated on `UserProfile.onboardedAt` being unset) → **choose a JLPT level** (N5–N1) → the app then drops straight into the home hub. The `/onboarding` level-choice screen is **implemented** (Phase 3.5). The follow-on **Quiz mode warm-up** (5 non-scheduling questions) and **guided tour** remain deferred to the multi-user phase (§13). Completing the level choice persists `UserProfile.activeLevel` and stamps `onboardedAt` (§6), which is what distinguishes a first-time from a returning user thereafter.
- **Returning user.** Sign in → **the post-login landing** → start. That's it.

**Post-login landing: `/home`.** Sign-in (`redirectTo`), the dev login, `/onboarding` completion, `/onboarding`'s already-onboarded bounce, the public `/` redirect, and the PWA manifest's `start_url` all resolve to the home hub. This reverses the temporary `/grammar` reprioritization of 2026-07-02 (§16): that change existed because the hub carried no status of its own, so opening on it cost a tap and told the user nothing. The hub now reports what is due across both queues, which removes the reason to bypass it.

**The hub (`/home`).** A **light dashboard**, in four bands, ordered by how often each is used:

1. **Today panel**: words due, grammar points due, and reviews completed today, plus a progress bar for the active level (started / total). This is the "where am I" glance the hub previously lacked entirely.
2. **Primary CTA**: a single button routed by `pickNextAction` (`src/lib/home.ts`) to the highest-priority work: due vocab, then due grammar, then new vocab, then Quiz as a never-a-dead-end fallback. This is what preserves the one-tap, no-config promise (§2) now that the hub shows more than three buttons.
3. **Mode grid**: four tiles (Flashcard `/study`, Quiz `/quiz`, Exam `/exam`, Grammar `/grammar`) in a 2×2 layout, each with a subtitle derived from live counts. Grammar is included here because the hub is the app's default page; a mode absent from it is effectively hidden. **The Grammar tile is disabled on levels with no seeded deck** (only N3 is seeded, §4.1); the other three are always live. This reverses the "no tile is ever disabled" rule of 2026-07-25 (author's decision, 2026-07-26; §14.14), and the cost it was written to prevent is real and accepted rather than solved: the tile is the only UI path to `/grammar`, and `pickNextAction` cannot stand in for it because every count in `getGrammarStats` is level-scoped, so a non-N3 user's `grammarDue` is always 0. **A user who studies N3 grammar and then switches level loses access to it, and their reviews come due unseen until they switch back.** The disabled treatment is built from tokens, never `opacity` (BRAND.md §3): the tile recedes by losing elevation (paper fill, no shadow) with its text stepped down the ink ramp to values that still clear AA, and it renders as a plain `div` rather than a disabled control, since there is no action to describe. `/grammar` itself still distinguishes "no deck for this level" from "all caught up" rather than reporting a deck that does not exist as finished.
4. **Inline level selector**: the five JLPT chips, persisting `UserProfile.activeLevel` via a server action and re-scoping every engine. The level is changed *here*, not on a separate settings page. It sits **below** the mode grid: a level is chosen once and revisited rarely, whereas a mode is chosen every session.

**Scoping asymmetry, stated deliberately.** The Today panel's *words due* count is **not** level-scoped, because `getStudyQueue` (§8.1) returns due cards regardless of level so nothing already in progress is stranded. A level-scoped number here would promise a smaller session than the one the tile actually opens. The progress bar *is* level-scoped and is labelled with the level to make that explicit.

**Still not the full dashboard.** Streak, history, and charts remain deferred to the later stats/dashboard work (§13, Phase 6); `/stats` keeps the heavier per-level aggregates (including the 30-day recall rate, which the hub deliberately does not compute; see the header comment in `src/lib/home.ts` for why the hub has its own narrower query set rather than reusing `getLevelStats`).

**`BottomNav` lists places, not modes:** Home, Stats, Browse. Grammar was a fourth tab only while it was itself the post-login landing; with all four modes on the hub, keeping one mode in the tab bar mixed two categories and made the other three look arbitrarily omitted (§16, 2026-07-25; rejected alternative in §14.8).

### 8.6 Exam mode: JLPT-style reading & writing

A benchmark mode that presents 20 questions in two sections mirroring the vocabulary sub-problems of the JLPT Reading section. **No timer is implemented**; earlier revisions of this section described the mode as "timed," which it never was. Whether to add one is an open item: with per-question feedback (below), the mode is a study tool rather than a mock sitting, and a countdown would change that character.

- **問題１・漢字の読み方 (kanji reading):** An example sentence is shown with the target word underlined in its kanji form. The student picks its kana reading from four options. Correct answer = `Word.reading`; distractors are readings of orthographically and phonetically confusable same-level words (kanji Jaccard + reading similarity, matching Quiz mode's distractor strategy applied to the `reading` field).

- **問題２・漢字の書き方 (kanji writing):** The example sentence is shown with the target word's kanji replaced by its kana reading (the first occurrence in the sentence is substituted). The student picks the correct kanji form from four options. Correct answer = `Word.expression`; distractors are expressions of words whose readings sound similar to the target (reading similarity as the primary axis; shared kanji as a bonus).

**Question count.** Default 20 (10 + 10); the endpoint accepts `?count=` up to 40.

**Section structure.** Questions 1–10 are 問題１; questions 11–20 are 問題２. A lightweight **section-break screen** appears between them (showing the 問題１ score before the student proceeds), mirroring the experience of turning a page in a real JLPT paper.

**Immediate feedback.** Unlike a real exam's submit-all-at-end model, Exam mode reveals the correct answer after each question. This is optimal for a study tool: the student connects the correction to the question immediately rather than after a full 20-question delay.

**Independence from FSRS.** Exam mode neither reads from nor writes to `ReviewState`. Questions are drawn at random from the active level's word pool, not from the FSRS due queue. The mode is a pure benchmark; its results do not schedule or unschedule anything. Flashcard, Quiz, and Exam are independent today, and FSRS coupling is a **permanent** non-goal for Exam specifically (§16 decision log); Quiz gains it in Phase 3 (§13). Grammar schedules against its own separate queue either way.

**Sentence substitution edge case.** For 問題２, the kana replacement uses `String.replace` on the first occurrence of `Word.expression` in the sentence. If the sentence uses a conjugated or inflected form of the word rather than the bare `expression`, the replacement finds no match and the sentence is displayed unmodified (the underline target is then the kana reading standing alone, functionally still a valid question). This occurs rarely and is accepted as-is.

---

## 9. API surface (route handlers and Server Actions)

**The convention: reads are route handlers, writes are Server Actions** (decided 2026-07-26; rejected alternatives in §14.16). A read keeps a URL that the browser can cache, that a client component can re-request imperatively, and that can be inspected with `curl`; two read routes depend on that directly, since `/api/browse` and `/api/words/[id]/sentence` carry `Cache-Control` headers that eliminate repeat round-trips (§10). A write has none of those properties to lose: it has no consumer outside this app, is never cacheable, and gains typed arguments across the boundary plus composition with React transitions when expressed as an action.

Two things the split does **not** change. First, the security posture: a Server Action compiles to a POST endpoint whose id is discoverable in the client bundle, so it is exactly as web-reachable as a route handler and its arguments are exactly as untrusted. Every guard that applied to a route (auth via `getCurrentUserId()`, enum validation with `Object.hasOwn`, rate limiting) applies unchanged to the action that replaces it; the typed signature is a developer convenience and never a boundary. Second, the classification rule is "does this mutate or spend", not "which HTTP verb did it use to have": `POST /api/demo/login` stays a route handler because it is a public, origin-checked, rate-limited entry point rather than an in-app mutation, and `/api/auth/*` stays because Auth.js owns it.

The **Status** column reflects what is actually built today vs. designed-but-not-yet-built, so the auth/protection guarantees below can't be assumed for routes that don't yet exist. Batch operations are currently **scripts only** (run locally), not HTTP endpoints: there is intentionally no web-reachable, cost-incurring Anthropic route at present (see §11.4).

### 9.1 Route handlers (reads, the public and dev entry points, and three writes pending retirement)

| Method | Route | Purpose | Auth | Status |
|--------|-------|---------|------|--------|
| GET | `/api/cards/queue` | Today's FSRS study queue | required | **Implemented** |
| POST | `/api/review` | Submit a rating → FSRS update | required | **Implemented; being retired.** Replaced by the `rateCard` action in §9.2 |
| POST | `/api/review/undo` | Revert the most recent review (one-step undo) | required | **Implemented; being retired.** Replaced by the `undoRating` action in §9.2 |
| `*` | `/api/auth/*` | Auth.js (sign-in request, callback, session) | public (rate-limited) | **Implemented** |
| GET | `/api/quiz?level=&count=` | Batch of JP→EN multiple-choice questions (non-scheduling) | required | **Implemented**: confusability-scored distractors (shared kanji + reading similarity, §8.2) |
| GET | `/api/exam?level=&count=` | JLPT-style exam round: 問題１ (kanji reading) + 問題２ (kanji writing), non-scheduling | required | **Implemented**: 10+10 questions, two-section with break screen (§8.6) |
| GET | `/api/grammar/queue` | Grammar FSRS study queue (due + new `GrammarProgress` rows) | required | **Implemented** |
| POST | `/api/grammar/review` | Submit a grammar rating → FSRS update (`GrammarProgress` upsert) | required | **Implemented; being retired.** Replaced by the `rateGrammarPoint` action in §9.2 |
| GET | `/api/grammar/browse?level=` | Every grammar point for one level, grouped by lesson, with per-point progress status | required | **Implemented**: whole dataset in one payload (§13 Phase 3.5 addendum); `Cache-Control` mirrors `/api/browse` |
| POST | `/api/demo/login` | Start an ephemeral demo session: create `User` + `UserProfile`, sign with HMAC, redirect to `/onboarding` | public (rate-limited, origin-checked) | **Implemented**: production-available; POST-only, session identity is a time-bound HMAC-signed cookie (§11.8) |
| GET | `/api/dev/login` | **Dev-only**: mint a session for the seeded user (skip the magic link) | none (dev-only) | **Implemented**: 404 in prod; gated by `DEV_AUTH` (§11.7) |
| GET | `/api/browse?level=` | Word list for one level (id, expression, reading, meaning; no sentences); browser-cached | required | **Implemented**: `Cache-Control: private, max-age=3600, stale-while-revalidate=86400` |
| GET | `/api/words/[id]/sentence` | Lazy-load one word's cached example sentence | required | **Implemented**: `Cache-Control: private, max-age=86400, stale-while-revalidate=604800` |
| POST | `/api/batch/submit` | Submit a generation batch | admin | Not planned (scripts only) |
| GET | `/api/batch/:id` | Poll batch status / collect | admin | Not planned (scripts only) |

The on-demand single-sentence fallback (§7.4, §11.4) was tracked here as a planned `POST /api/generate`. Under the convention above it both mutates the sentence cache and spends money, so it is a write and belongs in §9.2; the route name is retained only as the historical working title.

### 9.2 Server Actions (writes)

Server Actions are colocated with the route that owns them (`src/app/<route>/actions.ts`) and every module carries the `"use server"` directive, which makes each export a POST endpoint. The **Guards** column is therefore not optional detail: it is the entire protection on a publicly reachable mutation.

| Action | Module | Purpose | Guards | Status |
|--------|--------|---------|--------|--------|
| `signOutAction` | `app/home/actions.ts` | Destroy the DB session, redirect to `/` | Auth.js `signOut` | **Implemented** |
| `demoSignOutAction` | `app/home/actions.ts` | Delete the demo cookie, redirect to `/` | none needed (deletes a cookie) | **Implemented** |
| `setActiveLevel` | `app/home/actions.ts` | Persist `UserProfile.activeLevel` | `getCurrentUserId()` + `Object.hasOwn(Level, …)`; revalidates all five level-scoped routes | **Implemented** |
| `completeOnboarding` | `app/onboarding/actions.ts` | Set the starting level and `onboardedAt` | `getCurrentUserId()` + `Object.hasOwn(Level, …)` | **Implemented** |
| `rateCard` | `app/study/actions.ts` | Apply an FSRS rating to a word (`reviewWord`) | `getCurrentUserId()` + rating ∈ {1,2,3,4} + non-empty `wordId` | Planned (replaces `POST /api/review`) |
| `undoRating` | `app/study/actions.ts` | Revert the most recent review (`undoLastReview`) | `getCurrentUserId()` + non-empty `wordId` | Planned (replaces `POST /api/review/undo`) |
| `rateGrammarPoint` | `app/grammar/actions.ts` | Apply an FSRS rating to a grammar point | as `rateCard` | Planned (replaces `POST /api/grammar/review`) |
| on-demand generation | Phase 4 | Single-sentence fallback on a cache miss | auth + per-user rate limit + cache-first + bounded `max_tokens` (§11.4) | Planned (Phase 4, optional) |

**No `revalidatePath` on the three rating actions.** A study session's card list is fixed at load time and is client-owned state from that point on (§8.1), so revalidating would refetch the page underneath a session in progress. `setActiveLevel` is the opposite case and does revalidate, because the level scopes what every other route renders.

---

## 10. Caching strategy

1. **Sentence cache (primary)**: `ExampleSentence` rows in Postgres. This is the core of the product: each word's sentences are generated once and reused for every view by every user. Cache key = word; a miss triggers on-demand generation (§7.4).
2. **Anthropic prompt caching**: the shared system prompt is cached across batch and on-demand requests to reduce input-token cost.
3. **HTTP browser caching**: the browse word list (`GET /api/browse`) is served with `Cache-Control: private, max-age=3600, stale-while-revalidate=86400`; lazy-loaded sentences (`GET /api/words/[id]/sentence`) with 24 h max-age / 7-day stale window. Both datasets change ~never (seeded once), so the browser avoids repeat fetches within the cache window entirely. The study queue and review writes are `force-dynamic` and never cached.

---

## 11. Security & authentication

### 11.1 Threat model
Although the initial release serves a single user, the app is reachable on the public internet. The assets we protect are: (a) the owner's study progress and account, and (b) the `ANTHROPIC_API_KEY`, whose abuse incurs real cost. The adversary is an unauthenticated internet actor (credential guessing, endpoint scanning, cost-abuse of the generation endpoint, email-relay abuse). High-sophistication or insider threats are out of scope for the initial release.

### 11.2 Authentication: passwordless email magic link
Authentication uses **Auth.js with the Email provider**, sending magic links via **Resend** (already provisioned). Access is restricted to an **email allowlist**: `AUTH_ALLOWED_EMAIL` is parsed as a comma-separated list into a `Set` (a single address is the degenerate case, and is what production runs today). We chose passwordless magic links over a seeded password deliberately:

- **No long-lived shared secret lives in the application.** A seeded password is a static credential that must be stored, rotated, and kept out of source control, env dumps, and logs, a recurring leak vector for self-hosted apps. The magic-link flow stores no reusable password; authentication reduces to *proving control of the allowlisted inbox*.
- **It delegates to a stronger security boundary.** The owner's email account is almost certainly protected by a strong password and 2FA that we maintain anyway. Leaning on it is stronger than any password store we would build, and removes a redundant secret rather than adding one.
- **The allowlist contains blast radius.** Even if the sign-in endpoint is discovered, a link can only ever be delivered to an allowlisted address, so an attacker cannot have one sent to themselves. The list is kept to the few addresses that genuinely need access (today: one), which is what keeps this property meaningful.

### 11.3 Hardening requirements (the magic link is only secure if these hold)
A magic link is a bearer token in transit; the implementation **must** enforce:

1. **High-entropy tokens** (≥ 256 bits) stored **hashed at rest**, never the raw token.
2. **Single-use** tokens, invalidated immediately on redemption.
3. **Short TTL**: 10–15 minutes.
4. **Server-side allowlist enforcement** (case-insensitive membership in the `AUTH_ALLOWED_EMAIL` set, normalized on both sides) *before* any email is sent, and **failing closed** if the allowlist is unset. Without this the endpoint is an open email-spam relay. The check is repeated in the `signIn` callback at verification time, as defense in depth.
5. **Rate limiting** on the sign-in request endpoint (per-IP and global) to prevent inbox bombing and token-guessing.
6. **Secure sessions**: `httpOnly`, `Secure`, `SameSite=Lax` cookies with a sane expiry and rotation; sessions stored server-side (Auth.js database sessions via Prisma).
7. **HTTPS everywhere**: provided by Railway TLS; redirect HTTP→HTTPS.
8. **Security response headers** on every route (`next.config.ts`): HSTS (makes the HTTPS redirect durable in the browser), a Content-Security-Policy that blocks all external script/frame/object loads (`'unsafe-inline'` is retained for script/style because Next.js hydration requires it; per-request nonces were judged not worth the dynamic-rendering cost for an app with no third-party scripts), `frame-ancestors 'none'`/`X-Frame-Options: DENY` (clickjacking), `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin` (keeps magic-link URLs out of third-party Referer logs). Since the `next/font` migration (§14.12) the policy names **no third-party origin at all**: `style-src` and `font-src` dropped `fonts.googleapis.com` and `fonts.gstatic.com`, so every directive is now `'self'` plus, where unavoidable, `'unsafe-inline'`. A reintroduced `@import` of Google Fonts would therefore fail closed rather than quietly re-adding a third-party dependency.

   **Two development-only relaxations**, gated on `process.env.NODE_ENV === "development"` so the production policy is unaffected: `'unsafe-eval'` in `script-src`, and `ws:`/`wss:` in `connect-src`. React's development build calls `eval()` for debugging features (it reconstructs cross-environment callstacks for the error overlay) and Turbopack's HMR runtime evaluates hot-updated modules, so without the first the dev server throws `eval() is not supported in this environment` and the overlay degrades; the second covers the HMR websocket, which CSP 3 says `'self'` already permits on the same origin but which browsers have handled inconsistently. `'unsafe-eval'` is deliberately **not** granted in production: it would make any injected string executable and undo much of what this policy exists to prevent. React never uses `eval()` in production builds, so nothing needs it there.

### 11.4 Secrets & API-key protection
- All secrets (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `AUTH_SECRET`, `DATABASE_URL`) are injected as Railway environment variables and never committed.
- The Anthropic key is **server-only**; it is never exposed to the client and no model call is reachable from the browser without an authenticated server route. As built, the only code that calls Anthropic lives in `src/lib/generate.ts` and is imported **only by the local `scripts/`**: there is currently **no web-reachable route that spends Anthropic tokens** (the on-demand endpoint below is not yet built; §9).
- **If/when `/api/generate` is added** (the optional on-demand fallback, §7.4), it becomes the single Anthropic cost-abuse vector and **must** ship with all of: (a) authentication (`getCurrentUserId` → 401); (b) **rate limiting** (reuse `src/lib/rate-limit.ts`, per-user and global) so an authenticated client can't loop it; (c) **cache-first**: call the model only when the word has zero cached sentences, so repeated requests for the same word are free; (d) a bounded `max_tokens`. Without (b)–(d), auth alone does not bound cost.
- Batch operations are **scripts only** (run locally), not HTTP endpoints, so they expose no cost-incurring route. Should they ever be exposed as `/api/batch/*`, they require an admin marker beyond a normal session.

### 11.5 Path to multi-user
Multi-user is reached by: removing the allowlist (or widening it from a fixed list to an invite/allow rule), relying on the already-present `userId` scoping for all queries, and adding explicit authorization checks so every read/write is constrained to the session's user. No schema migration of the core shape is required (§6).

### 11.6 Public repository & PII
This repository is intended to be **open-sourced**, so no personal data is committed.

- **The allowlist is configuration, not source.** `AUTH_ALLOWED_EMAIL` holds the comma-separated addresses permitted to sign in; its *value* lives only in Railway environment variables and is **never committed**. `.env.example` carries a placeholder (`you@example.com`), never a real address.
- **A dedicated alias is preferred for the allowlist** rather than a primary personal inbox: it scopes the app's reach and is trivially rotatable if abused.
- **Git commit metadata is accepted as public.** Commits are authored under an email the author already publishes, so no history rewrite or noreply alias is required. (Decision: author's call; the trade-off is permanent public exposure of that address, accepted because it is already public.)

### 11.7 Development auth bypass (must be impossible in production)
Local development skips the magic-link round-trip via a **dev-only** route, `GET /api/dev/login` (§9), which mints a real database session for the seeded user and sets its cookie. Producing a genuine session keeps full parity with the production flow: `auth()`, the `proxy.ts` guard, and `getCurrentUserId` all work unchanged. It is **doubly gated** so it cannot exist in the deployed app: the handler returns 404 when `NODE_ENV === "production"`, **and** only runs when `DEV_AUTH=1` is explicitly set (never set in prod). `proxy.ts` likewise treats `/api/dev/*` as public only outside production. We deliberately did **not** use an Auth.js Credentials provider for this: it requires the JWT session strategy, whereas Bayana uses database sessions (§11.3 #6).

### 11.8 Demo session (ephemeral, production-available)
`POST /api/demo/login` (§9) is a **production-available** path that lets visitors try the app without an email address. It is fundamentally different from the dev bypass above:

- **What it does:** creates a fresh `User` row (no email) and a `UserProfile` (no `onboardedAt`) in the database, then signs `userId:expiresAtMs` with **HMAC-SHA256** keyed by `AUTH_SECRET`, and writes the result as a 7-day `httpOnly` cookie. The user is then redirected (303) to `/onboarding`.
- **Session identity with server-enforced expiry.** No Auth.js `Session` row is created. `getCurrentUserId()` in `src/lib/current-user.ts` detects the demo cookie, verifies the HMAC (constant-time comparison), then checks the signed `expiresAtMs` against the clock; the expiry is inside the signed payload, so a client cannot extend its session by re-sending an old cookie or editing the timestamp. Cookies in the pre-expiry format (HMAC over `userId` alone) fail verification and are treated as signed-out; this was accepted over dual-format support because demo sessions are disposable by design.
- **Endpoint hardening.** Because this is the one unauthenticated write endpoint (each hit inserts a `User` + `UserProfile` row), it carries three defenses:
  1. **POST-only**: a state-changing GET can be triggered cross-site by an `<img>` tag or link prefetch without user intent; GET now returns 405.
  2. **Same-origin check**: browsers attach an `Origin` header to cross-site POSTs; any `Origin` not matching the app's public origin (derived from `AUTH_URL`) is rejected with 403. Non-browser clients that omit the header pass this check; bounding those is the rate limiter's job.
  3. **Rate limiting in `proxy.ts`**: per-IP (5/hour) and global (30/hour) fixed-window limiters bound total row creation even from rotating IPs, mirroring the sign-in limiters (§11.3 #5).
- **Ephemerality by design.** Each demo start creates a new `User`; the previous session's rows are orphaned (no cookie → unreachable). Losing the cookie means losing all data. This is intentional: demo data is cheap to create and users are expected to sign up via magic link if they want persistence.
- **Opportunistic cleanup.** Each demo login first deletes provably-unreachable demo users: `email IS NULL`, no Auth.js `Session` rows, `createdAt` older than the cookie TTL, and `id ≠ DEFAULT_USER_ID` (the local seed user), so the table stays bounded without a cron job. The filter is deliberately narrow because a wrong match cascade-deletes real study progress; see §14.5 for why a heuristic filter was chosen over an `isDemo` column.
- **`/api/demo/login` is public in `proxy.ts`** (exact path, no session check) so the route is reachable before authentication; this is the correct, intentional behaviour. The exact-path match (rather than a `/api/demo/*` prefix) ensures future demo routes do not silently ship unauthenticated. It is distinct from `/api/dev/*`, which is public **only outside production**.
- **Threat model.** The HMAC prevents a user from forging a cookie to impersonate another `userId`; the signed expiry bounds how long a leaked cookie is useful; POST + Origin checking prevents cross-site session minting; rate limits plus opportunistic cleanup bound DB row accumulation from abandoned or abusive demo starts.

### 11.9 `proxy.ts`: Next.js 16 route-guard mechanics

The route guard, session gate, and rate limiters described above all live in `proxy.ts`, and Next.js 16 changed the mechanics of that file in ways that fail silently if missed:

- Next.js 16 renamed middleware to **proxy**. A `middleware.ts` file is **ignored without error**: creating one produces no guard at all, so every route silently ships unprotected.
- The file exports a function named `proxy` (type `NextProxy`; `NextRequest`/`NextResponse` from `next/server` work as before), and a `config.matcher` array still scopes which paths it runs on.
- The proxy runs in the **Node.js runtime** by default (not Edge), which is what allows the in-memory rate limiters (§11.3 #5, §11.8) to live there.
- `proxy.ts` must sit at the **project root**, not under `src/`; the framework does not pick it up elsewhere (confirmed 2026-06-05, §16).

---

## 12. Deployment (Railway)

- **Services:** 1 × Next.js web + 1 × Postgres plugin. No Redis or worker tier is required (see §5.1, §7.1).
- **Build:** **Railpack** (Railway's current default builder; configured in `railway.json` as `build.builder: "RAILPACK"`) autodetects the Next.js app, or a Dockerfile for finer control. Nixpacks is **deprecated** and is not used.
- **Environment variables:** `DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `AUTH_SECRET`, `AUTH_ALLOWED_EMAIL`, `AUTH_EMAIL_FROM`, `AUTH_URL` (public origin, for Auth.js callbacks). `DEFAULT_USER_ID` is **not** a production variable; it is only used by the local `scripts/seed-user.ts` helper.
- **Migrations & seed:** run `prisma migrate deploy` on release; load words with `scripts/import-csv.ts`. For the example-sentence cache, **transfer the already-generated sentences from local rather than regenerating**; regeneration would re-incur API cost. Because `Word.id` cuids differ per database, transfer keyed by the stable `Word.guid` (a GUID-keyed export/import), or `pg_dump`/restore the `Word` + `ExampleSentence` tables together so ids stay aligned. `seed-sentences.ts` / `collect-batch.ts` remain for generating *new* levels directly on prod.
- **Backups:** the Railway **Hobby** plan has no managed backups. The backup target is the **local** Postgres (the `bayana-postgres` container), which is the authoritative source of the generated sentence cache (Batch results land there first, then are transferred to prod), so backing it up protects `ExampleSentence`, the only paid, hard-to-regenerate artifact. (`Word` is free to re-import from `decks/`.) Back it up with `pg_dump` (exact commands in `notes/deploy.md`, which is gitignored along with the rest of `notes/`); for long-term keeping, a `Word.guid`-keyed JSON export is preferred over a `.dump`, which is tied to the Postgres major version and schema. Dump files contain personal data and are gitignored (`/backups`).
  - **Prod is deliberately not backed up routinely**, to avoid Hobby-plan egress cost. The accepted consequence: prod-only data, chiefly `ReviewState`/`ReviewLog` (study history, which accumulates only in prod once studying happens there), is **not recoverable** if the prod database is lost. This is an accepted risk for a single-user learning project, not a recommendation for multi-user (§11.5), where study history would warrant a managed or scheduled backup.
- **Domain:** Railway-generated domain for the initial release; custom domain later.

---

## 13. Milestones & rollout

Completed phases are listed in the order they shipped, then the planned ones in intended order. That is why **Phase 3.5 appears before Phase 3**: grammar study was an unplanned interleave that shipped in June 2026, while Phase 3 (MC↔FSRS coupling) is still ahead. The half-step number is kept rather than renumbered so the decision log (§16) and TODO.md keep referring to the same thing.

**Phase 1a: Playable slice (run locally, study ASAP). ✅ done**
- Postgres schema (incl. `ReviewLog`); seeded default `User` + `UserProfile`.
- CSV import for **N3**; batch-seed N3 example sentences.
- **Flashcard mode** review (JP→EN) via `ts-fsrs`, with **one-step undo**.
- Mobile-first card UI (flip / rate). Runs locally, end-to-end.

**Phase 1b: Shippable (public), auth + deploy. ✅ done**
- Magic-link auth (Auth.js + Resend, email allowlist) with §11.3 hardening and a root-level `proxy.ts` route guard (§11.9).
- Deployed to Railway; N3 sentence cache transferred (by `Word.guid`, §12) rather than regenerated.

**Phase 1c: Fill out content. ✅ done (generation)**
- All levels (N5–N1, ≈8,100 words) batch-seeded; every word now has a cached sentence (§7.5). The on-demand `/api/generate` fallback is **no longer needed for coverage** and has moved to Phase 4 (it returns there as a safety net for future additions).

**Phase 2: Quiz mode. ✅ functionally complete**
- Gamified multiple-choice quiz (§8.2): `GET /api/quiz` with confusability-scored distractors (shared kanji + reading similarity, §8.2), instant feedback, cached example sentence on reveal. Duolingo-grade UI, minimal animation, zero ads.
- Level scope + home hub (`/home`): `UserProfile.activeLevel`, returning-user mode picker (Flashcard / Quiz), inline level selector.
- Light polish shipped: **browse/search** (`/browse`, browser-cached word list, 50/page pagination, started-words-first, inline level switcher, lazy sentence per tap, §8.3), **basic stats** (`/stats`: started/total, due, recall rate), **default `newCardsPerDay` lowered 20 → 10** with a tap-to-open `InfoBubble` explanation on the landing and home hub, **installable PWA** (pulled forward from the enhancements phase, §8.4).
- MC↔FSRS coupling and Flashcard↔Quiz synergy **deferred by choice** (§15, §16); now Phase 3 below.
- First-run onboarding deferred → multi-user phase (§16), then partly pulled forward in Phase 3.5 below.

**Phase 2 addendum: Exam mode. ✅ done (2026-06-07)**
- JLPT-style benchmark mode (§8.6): `GET /api/exam` with 10 × 問題１ (kanji reading in sentence context) + 10 × 問題２ (kanji writing from kana in sentence context). Sequential with immediate feedback; section-break screen between 問題１ and 問題２; split score summary.
- Exam mode is **independent of FSRS** by design: neither reads from nor writes to `ReviewState`. All three modes (Flashcard, Quiz, Exam) are standalone (§16 decision log).
- Home hub updated to a three-tile mode picker (Flashcard / Quiz / Exam).

**Phase 3.5: Grammar point study (N3 v1). ✅ done (2026-06-29)**
- Separate FSRS study queue for JLPT grammar points, fully independent of the vocabulary queue. Source data: `decks/grammar-n3.md`: 220 grammar points across 22 lessons (§4.1). Schema designed to accept N5–N1 grammar decks later without migration.
- **Schema:** `GrammarPoint` (`level` stored as plain `String`, not the `Level` enum) and `GrammarProgress` (FSRS fields mirroring `ReviewState`; composite unique on `[userId, grammarPointId]`). `CardLike` interface extracted from `src/lib/fsrs.ts` so the FSRS adapter functions are shared between vocab and grammar with no duplication.
- **Seed:** `scripts/seed-grammar.ts` parses `decks/grammar-*.md` and upserts grammar points idempotently keyed on `(level, lesson, position)`.
- **API:** `GET /api/grammar/queue` (due + new, same two-pool strategy as vocab); `POST /api/grammar/review` (FSRS rating → upsert `GrammarProgress`). Both auth-required.
- **Card shape:** front = grammar pattern (large JP); back = reading (if it differs from pattern) + comma-joined meanings + example sentence (pattern bolded in grape) + English translation. No undo in v1.
- **`/grammar` hub page:** inline FSRS stats (total/started/mature/due); single "Grammar Points" CTA; an inline `LevelPicker` (added 2026-07-26) so the level can be changed without a round trip through `/home`, which matters more since that round trip became a one-way door (§14.14). Rows for levels with no seeded deck are *marked* ("no deck yet"), never disabled, because the picker sets the global `activeLevel` that vocabulary study also reads; the marked set is derived from the table via `getSeededGrammarLevels`, not hardcoded to N3, since the restriction is a property of what has been imported rather than of the design. Vocab stats remain on `/stats`. Grammar also got a `BottomNav` tab here, removed on 2026-07-25 when the mode grid on `/home` made it redundant (§8.5, §14.8).
- **`/onboarding` page:** level-choice screen shown to any user whose `UserProfile.onboardedAt` is unset (both magic-link sign-ups and demo visitors). Pulled forward from the multi-user phase to support the demo flow. The follow-on Quiz warm-up and guided tour stay there (Phase 5 below).
- **Demo session (`/api/demo/login`):** ephemeral try-without-signup path; creates a new `User` + `UserProfile`, signs the userId with HMAC-SHA256, sets a 7-day cookie, and redirects to `/onboarding`. Production-available; since hardened to POST-only with a signed expiry, rate limiting, and origin checking (§11.8, 2026-07-10).

**Phase 3.5 addendum: Grammar browse + lesson titles. ✅ done (2026-07-01)**
- **`lessonTitle` column added to `GrammarPoint`** (migration `20260701130743_grammar_lesson_title`), denormalized from the source file's `## Lesson N – Title` heading the same way `level` is denormalized, repeated per row so a browse view can group and label lessons without a second lookup.
- **`GET /api/grammar/browse?level=`**: auth-gated, returns every grammar point for a level grouped into lessons in one payload (unlike `/api/browse`'s per-word lazy-load: grammar's ~220-row dataset is small enough to ship whole). `Cache-Control` mirrors `/api/browse`.
- **`/grammar/browse` page + `GrammarBrowseClient`:** collapsible per-lesson accordion (collapsed by default; 22 open lessons would be an unreasonable scroll), search box filters by pattern/reading/meaning and force-expands matching lessons. Reachable via a "Browse all grammar points" button on `/grammar`.
- **Seed script now prunes stale rows:** after upserting the freshly parsed file, it deletes any `GrammarPoint` row for that level whose `(lesson, position)` no longer appears in the file. Content gets renumbered across edits (a lesson's item count changes, a point moves to a different lesson), which otherwise leaves orphan rows behind under the old key; upsert alone can't catch these since the parser no longer produces them at all. Pruning cascades to `GrammarProgress` (`onDelete: Cascade`), so any in-progress FSRS state on an orphaned point is lost, acceptable for a single-user app, chosen over leaving orphans so the DB stays an exact mirror of the source file.

**Phase 3: MC↔FSRS coupling. ▶ next**
- Make Quiz and Flashcard genuinely complementary rather than parallel: a multiple-choice answer writes an FSRS rating (correct ≈ Good, wrong ≈ Again) through the existing `POST /api/review`, and Quiz target selection is informed by FSRS state (a split between near-due review words and never-seen ones). Resolves open question #1 (§15).
- No schema change: reuses `ReviewState`, `ReviewLog`, and the existing review endpoint. The calibration choice (correct → Good or Hard, given that multiple choice is recognition rather than active recall) is to be recorded in [DECISIONS.md](DECISIONS.md) when it is made.
- This also supersedes the "non-scheduling first-run warm-up" framing in §8.2: once the first quiz session seeds FSRS, the warm-up *is* the coupling.

**Phase 4: Admin audit + on-demand generation**
- **Admin review/audit page** (admin-gated via `UserProfile.role`): inspect each AI-generated example sentence and accept or reject it before it surfaces to learners (adds a review-status field to `ExampleSentence`; optionally generate several candidates per word and keep the best).
- **On-demand `/api/generate`** + study-UI fetch-on-flip for any not-yet-seeded words, with the §11.4 guardrails (auth + rate-limit + cache-first + bounded `max_tokens`).

**Phase 5: Multi-user**
- Widen/remove the email allowlist; real `User` rows; authorization checks scoping all reads/writes by `userId`.
- Per-user settings are **intentionally minimal** (see §16); multi-user does not imply a settings page. The active level (already inline on `/home`) is the only planned user-facing control; all other parameters (`newCardsPerDay`, FSRS retention target, study direction) remain author-set defaults.
- **First-run onboarding completion (§8.5)**: the `/onboarding` level-choice screen already exists (Phase 3.5); what remains here is the follow-on: a **5-question Quiz warm-up** (non-scheduling) and a **guided tour** of the app. Uses the existing `UserProfile.onboardedAt` column to branch first-time vs. returning. Deferred because the warm-up and tour only earn their keep once there are multiple real users to onboard (the sole author is already past it).

**Phase 6: Further enhancements**
- Audio (TTS) for sentences, furigana rendering, the full stats dashboard (streak/heatmap, history, charts; §8.5), sentence regeneration/voting, export back to Anki. (Installable-PWA *basics* (manifest, icons, fullscreen + safe-area) were pulled forward to 2026-06-04, §8.4/§16; the **offline shell / service worker** is what remains here.)

**Kalima absorption + bayan/zaka consumer (decided 2026-07-26, deliberately unsequenced)**

Kalima's JLPT mock exam moves into this app, and this app replaces Kalima as the named reference consumer of the bayan/zaka dataset. Both land in one new question store (§4.2), so they are a single milestone rather than two.

- **No phase number yet, on purpose.** A number asserts an order, and the order is not decided: this work is larger than Phase 4 and independent of Phase 3. It is tracked in TODO.md until it is sequenced, at which point it takes a number here.
- **It is coupled to Phase 4, which affects sequencing.** Kalima's S-F rank review folds into the Phase 4 admin page under `UserProfile.role` rather than porting Kalima's separate `ADMIN_PASSWORD` path. Shipping Phase 4 first therefore means building that admin surface twice.
- **Scope, in five parts** (checklist in TODO.md): the question store and its migration; the port from Kalima (answer secrecy first, then the four session endpoints, the budget and throttle, the timed session and per-type radar, the wrong-answer queue, the `wordId` remap via Anki `guid`, and the passage set); the public-access decision (§15); the bayan import path with pinned release tags and a CC BY 4.0 attribution surface; and the doc housekeeping this section is part of.
- **Prerequisite, not a cleanup task.** The in-memory rate limiter (§11.3 #5) is documented as acceptable on the grounds that this is a single instance with no spend behind any route. A budgeted analysis endpoint removes that third condition, so a durable limiter and budget store are a precondition of shipping it, not a follow-up (§11.4).
- **Acceptance test for the consumer role:** an imported question graded end to end into `ReviewState`. Anything short of that makes the "reference consumer" claim decorative.

---

## 14. Alternatives considered

### 14.1 Separate backend API (Rails or standalone Node) + Next.js frontend
**Rejected for the initial release.** A dedicated API tier is the right call when multiple independent clients share a backend, when a heavy background-worker fleet is required, or when the backend has a scaling/resource profile incompatible with the web tier. None apply here: there is a single client (our own UI), the only long job is offloaded to Anthropic's Batch API, and every operation is a DB query or a single LLM call. A split would roughly double operational surface (a second service, build, deploy, and inter-service auth) and add a network hop and failure domain for no capability we need. Because the data model and generation design are framework-agnostic, extracting a service later remains possible if requirements change (§5.1).

### 14.2 Seeded static password instead of magic link
**Rejected.** A seeded password introduces a long-lived shared secret the app must store, rotate, and keep out of source control and logs (a common leak vector), and would in practice be backstopped by email-based reset anyway, making the inbox the real security boundary. Passwordless magic links delegate directly to that stronger boundary and remove the redundant secret (§11.2). A properly hashed, rate-limited password is acceptable in principle, but strictly inferior here given Resend is already available.

### 14.3 On-demand-only sentence generation (no seeding)
**Rejected as the primary path.** Generating purely on first view eliminates upfront cost but adds latency to first views and forgoes the ≈50% Batch discount for the bulk fill. We retain it only as a fallback for cache misses (§7.4).

### 14.4 Service-worker / offline support shipped with the PWA basics
**Deferred (not rejected).** When making Bayana installable (manifest + icons + fullscreen, 2026-06-04), the option was to also add a Workbox-style service worker (e.g. `@serwist/next`, the maintained `next-pwa` successor) to precache the app shell so it opens offline. It was deferred because the install/fullscreen goal (a chrome-free, edge-to-edge study session) needs **no** service worker, while a SW adds a real maintenance surface (cache-versioning and invalidation, stale-asset bugs, extra Turbopack/Next 16 integration risk) for little benefit on an always-online, single-user app. The manifest alone is enough for an Android install; iOS "Add to Home Screen" likewise needs no SW. Offline support can be added later (§13 Phase 6) once there is a concrete offline use case. Also considered and rejected for the same release: the browser **Fullscreen API** (`requestFullscreen`) to force a single route truly fullscreen; it is unsupported on iPhone Safari, so it is not a portable answer, whereas the manifest `display` mode covers Android cleanly.

### 14.5 `isDemo` column on `User` instead of a heuristic cleanup filter

**Rejected (for now).** The opportunistic demo-user cleanup (§11.8) must identify rows that are certainly abandoned demo sessions, because a wrong match cascade-deletes real study progress. An explicit `isDemo: Boolean` column would make that identification trivial and self-documenting, but requires a migration and backfill for a property that is already fully derivable: demo users are exactly the users with `email IS NULL`, no Auth.js `Session` rows, and (for deletability) a `createdAt` older than the cookie TTL, excluding the local seed user's pinned id. The heuristic filter was chosen because it needs no schema change and each condition independently excludes a class of real user. Revisit if the demo flow grows features (e.g. demo-to-real account upgrade) that make "is a demo user" load-bearing beyond cleanup.

### 14.6 `SELECT … FOR UPDATE` row locking instead of serializable transactions

**Rejected.** The review write path (§8.1) is a read-modify-write: read the FSRS row, compute the next card state in JavaScript (`ts-fsrs`), write it back. Under Postgres's default `READ COMMITTED` isolation, two concurrent reviews of the same card both read the same prior state and the second write silently discards the first (a lost update). Explicit row locking (`SELECT … FOR UPDATE`) fixes this by serializing at the row, but in Prisma it requires `$queryRaw`, abandoning the typed query API precisely on the app's most correctness-sensitive path. Instead, the transaction runs at `SERIALIZABLE` isolation with a bounded retry on Prisma error `P2034` (serialization conflict), wrapped in a shared `serializableTxn()` helper in `src/lib/db.ts`. Contention on a single user's single card is near-zero, so retries are vanishingly rare and the stronger isolation costs nothing in practice; the helper's contract (the callback may run more than once; queries inside must be sequentially awaited, since an interactive transaction holds one connection) is documented at the definition.

### 14.7 Demo sessions skipping onboarding entirely

**Rejected.** When the home hub became the app's default page (§8.5, 2026-07-25), an option was to send `POST /api/demo/login` straight to `/home` with a preset level (N3, the only fully-seeded grammar level), on the grounds that a reviewer evaluating the app wants the shortest possible path to seeing it work. It was rejected because the active level scopes every engine, every count, and the hub's progress bar: a demo user who never chose N3 would be shown a Today panel and a progress bar describing a level picked for them, which is a worse first impression than one extra tap. The level choice is also the app's clearest statement of what it is (a JLPT tool, N5 to N1), so it doubles as orientation. Author decided; deciding factor was that onboarding is a single tap and is itself informative.

### 14.8 Grammar as a permanent `BottomNav` tab

**Rejected.** Grammar had a tab of its own from Phase 3.5, and was promoted to the leftmost tab on 2026-07-02 when `/grammar` became the post-login landing. With the hub restored as the default page and carrying all four modes (§8.5), the tab was removed instead of kept alongside the new Grammar tile. Keeping it was the conservative option and would have saved a tap when navigating from `/stats` or `/browse`, but the tab bar then listed three *places* plus one *study mode*, which both mixed categories and implied Flashcard, Quiz, and Exam had been deliberately excluded. The accepted cost: `/grammar` is a page with no corresponding tab, so no tab highlights while the user is on it. That is a standard sub-page condition and was judged the smaller wart. Author decided.

### 14.9 Kalima's `ExamQuestion` shape for the imported question store

**Rejected** in favour of bayan's `ExportedQuestion` shape (§4.2), decided 2026-07-26 before any of the table was written. Kalima's model is the one with 496 rows already in it, so reusing it would have made the port a copy rather than a translation. It lost because its five question types are a strict subset of bayan's 22-value `question_type` enum (`reading` maps to `read-kanji`, `orthography` to `pick-spelling`, `contextual` to `word-choice`, `synonym` to `same-meaning`, `usage` to `right-sentence`), so adopting it would have meant migrating the table again on the first dataset import, and a second time for reading and listening once `stimuli` and `provenance` were needed. Following the publisher's shape instead makes both sources the same row from the start, with `source` as the only discriminator. The cost accepted: the 496 seed rows are rewritten on the way in rather than copied, and this project now tracks an external schema it does not control, so a bayan schema change is a migration here.

### 14.10 Hosting the mock exam in Kalima rather than absorbing it

**Rejected.** Kalima already has the mock exam, a public homepage that recruiters land on, and its own admin path, so leaving it there was the zero-work option. It lost on capability: Kalima is N3 vocabulary only across five question types, while this app already models N5 to N1, holds ~8,100 words plus a grammar table whose `pattern` matches bayan's `grammar_points`, and has an FSRS scheduler that can turn a graded question into a review schedule. Only the last of those makes the reference-consumer role mean anything, since grading into a real scheduler is what a dataset publisher wants demonstrated. The cost accepted: Bayana stops being a single-purpose vocabulary trainer (§2), Kalima loses its main feature, and this repo takes on a public surface it did not have if the mock exam stays open to visitors (§15). Author decided.

### 14.11 Alternatives weighed in the 2026-07-26 accessibility pass

Four forks surfaced while fixing the contrast and focus defects found in the BRAND.md review (§8.4). Each is recorded because the rejected option is the one a later reader is likely to reach for again.

**A new tertiary token instead of darkening `--ink-faint`. Rejected.** `--ink-faint` (`#9a8597`, 3.25 : 1) was documented as a disabled/hints value but used as tertiary body text at ~60 call sites. Adding a compliant `--ink-tertiary` and leaving `--ink-faint` alone would have preserved the token's documented meaning, but it requires auditing all 60 sites to decide which meant "disabled" and which meant "quiet", and it leaves a failing token in the palette for the next author to reach for. Darkening the token in place to `#7d6a7a` (4.8 : 1) fixes every site at once and costs only a small loss of contrast *range* between `--ink-soft` and `--ink-faint`. The palette gains a rule instead of a token: the ramp is three steps and its last step is the AA floor.

**Padding the small controls to 44px instead of `.tap-44`. Rejected.** The honest reading of the ≥ 44px rule is to make the control 44px. It was rejected for the two places it applies: a 44px-tall session header adds ~25px of chrome to a screen whose entire purpose is the card below it, and a 44px-tall JLPT chip stops reading as a chip and starts reading as a button, which changes the meaning of a level row. The `.tap-44` overlay is the standard "expand the target past the visual bounds" technique and resolves the two. Its expansion is **vertical only**, which was itself a fork: a full 44 × 44 overlay on a horizontal chip row would make adjacent level buttons overlap, and a mis-tap that selects the *wrong level* is worse than a target that is narrow but unambiguous. Horizontal reach is met by giving chip rows real padding instead.

**Tuning the inactive-chip opacity to a passing value instead of removing it. Rejected.** Inactive JLPT chips were dimmed (`0.55` on the home picker, `0.45` on browse), which composited the white-text chips to ~3.2 : 1 and ~2.5 : 1. A safe alpha exists (~0.8 measures 5.1 : 1), but it is a magic number that holds only for the current five chip colours and would silently break if a chip's fill changed. Removing the dim entirely and carrying selection with a ring plus a slight scale (the pattern the onboarding picker already used) eliminates the failure mode rather than parameterising it, and the rows already read as inactive from their cream fill and `--ink-soft` label.

**Leaving the level-chip ring colour as `currentColor`. Rejected.** `currentColor` resolves to white on `.chip-n5` and `.chip-n2`, so a ring drawn in it disappears against `--paper`. The onboarding picker had already discovered this and carried a local `RING_COLOR` override; the browse picker needed the same map. Rather than copy it, both now import `src/components/level-chip.ts`. A duplicated contrast rule is a contrast bug with a delay on it: the second copy is the one nobody updates.

### 14.12 Font delivery, and the alternatives rejected on the way to `next/font`

**Decided: self-host via `next/font/google` (landed 2026-07-26).** The chosen design is stated in §8.4; this section records what it was chosen over. Measurements below come from production builds of the commit before and the commit after the migration.

| | Before (`@import`) | After (`next/font`) |
|---|---|---|
| Page CSS, gzipped | 6.0 KB | 72.8 KB |
| Third-party stylesheet, gzipped | 91.5 KB | none |
| Total render-blocking CSS | 97.5 KB | 72.8 KB |
| Serial steps to first font byte | 4 | 2 |
| Third-party origins contacted | 2 | 0 |
| `@font-face` rules served | 405 | 260 |
| `.next/static` | 807 KB | 4.4 MB |

**Keeping the `@import` in `globals.css` (the status quo) was rejected.** It is the slowest available entry point: the browser cannot discover the fonts until `globals.css` has itself downloaded and parsed, so the sequence was HTML, then our CSS, then the `fonts.googleapis.com` stylesheet, then the `fonts.gstatic.com` files, with a DNS and TLS setup for each of the two third-party origins. Google also serves that stylesheet `cache-control: private, max-age=86400`, so a returning visitor re-fetched 91.5 KB gzipped before a single font byte could be requested, and `private` prevents any shared cache from absorbing it. The frequently cited counter-argument, that visitors arrive with Google Fonts already cached from other sites, has not held since HTTP cache partitioning shipped in 2020.

**Bundling this migration into the 2026-07-26 weight trim was rejected** (historical; the constraint no longer applies). The trim was a one-line change with a measured saving and no behavioural risk, while the migration touches the CSP, the build, and every font declaration. Landing them together would have meant neither could be reverted alone.

**Preloading the Japanese subset was rejected.** `next/font` emits a `<link rel="preload">` for every file belonging to a declared subset, and Google chunks CJK into roughly 126 `unicode-range` slices per weight. Preloading them would have the browser eagerly fetch the entire Japanese range on every page in order to paint a handful of glyphs, which is materially worse than the on-demand fetching the migration replaced. The JP face therefore sets `preload: false`, verified against the build: `next-font-manifest.json` lists exactly two preloadable files (the Latin faces of Fredoka and Nunito) and no Japanese file.

A related unknown recorded here because it cost investigation time and reads the other way round from the documentation: `next/font` never sends a `subset` parameter to Google. It requests the full stylesheet and self-hosts **every** face in the response, so `subsets` selects only what is preloaded. This is why the JP face can omit `subsets` entirely, which matters because next/font's bundled metadata for M PLUS Rounded 1c does not list `japanese` as a subset at all: naming it is a build error, and omitting it costs nothing once preloading is off.

**Listing static weights for Fredoka and Nunito was rejected** in favour of their variable fonts. Both families ship a variable version (weight axes 300 to 700 and 200 to 1000 respectively), so omitting `weight` yields one file per subset covering the whole range instead of the four and three static instances previously requested. This also retires the maintenance burden the trim created for the Latin faces: any weight in range now works without a corresponding entry in a request URL. Fredoka's `wdth` axis is excluded, since next/font omits non-weight axes unless they are named and the design never varies width.

**A third Japanese weight was rejected** (author's call, taken in this pass; the question was left open by the previous one). M PLUS Rounded 1c 800 was loaded and used at five display sites. Dropping it removes about 126 `@font-face` rules, roughly a third of the Japanese CSS, and those five sites moved to 700. Retaining it would have been the more expensive half of the JP face for a difference visible only on large headwords. The five sites had to move rather than merely lose the weight: a `font-weight: 800` with only 400 and 700 loaded is synthesised by the browser as a faux-bold off 700, which is worse than 700 itself.

**One expected benefit is not currently realised, and the design does not depend on it.** `adjustFontFallback` is documented to emit a metric-matched `local("Arial")` fallback face carrying `size-adjust` and `ascent-override`, which would reduce layout shift when a face swaps in. Verified against a real Next 16.2.7 build, the Turbopack implementation of `next/font` emits no such face (and, unlike the webpack code path, does not hash family names). The option is left at its default so the benefit accrues automatically if Turbopack gains it, but the case for the migration rests on the request-chain and caching results above, not on layout shift.

**Accepted costs.** `.next/static` grows from 807 KB to 4.4 MB, because all 261 self-hosted `.woff2` files ship in the image whether or not a given deploy serves them; this is negligible against a Node image and is not transferred to the browser, which still fetches only the chunks a page needs. The build also acquires a network dependency on Google, since the faces are downloaded during `next build`; Next caches them under `.next/cache`, so the exposure is cold builds. Both were judged acceptable against removing a runtime third-party dependency from every page load.

### 14.13 Route-state coverage: the shapes rejected on the way to a two-tier loading design

**Decided: a generic root fallback plus layout-shaped skeletons on the three hub pages (landed 2026-07-26).** The chosen design is stated in §8.4; this section records what it was chosen over. The forcing constraint is that a root `loading.tsx` creates a Suspense boundary around *every* route lacking one of its own, so the choice is not "which pages get a loading state" but "which pages get the *good* one".

**A root fallback alone was rejected.** It is the cheapest option and it does close the literal gap, but a centred spinner is not a loading state so much as a placeholder for one: it shares no geometry with the page it precedes, so the transition is a swap rather than a resolution, and on a hub whose content is a fixed grid of known dimensions that discards information the app already has. It also inherits the marketing homepage, which awaits only a session lookup and would flash.

**Per-page skeletons with no root boundary was rejected**, despite avoiding that flash on `/`. It leaves the session routes (`/study`, `/quiz`, `/exam`) painting nothing while the server builds a queue, which is the app's most data-dependent work, and it makes coverage a property of who remembered to add a file: every future route would ship uncovered by default. Having both means the weak fallback is a floor rather than the design.

**Skeletons that restate the page's own copy were rejected**, which is why placeholder fidelity stops at dimensions. The mode tiles' titles and subtitles are the tempting case: reproducing them would make the hub skeleton near-indistinguishable from the loaded page. It would also create a second copy of that copy in a file nobody opens, and the first subtitle edit would silently desynchronise it. Text the server does not need to compute is instead rendered *for real* rather than mocked, which gets the same benefit without the duplicate.

**Leaving `BrowseClient`'s existing loading text alone was rejected** once the sequencing was traced. Browse has two consecutive waits, and the short one (auth plus active level, on the server) precedes the long one (the level's entire word list, over the network). Giving only the first a skeleton would have made the page visibly *regress* mid-load, from a laid-out placeholder to a line of centred text. Both now render the same `WordListSkeleton`, so the placeholder paints once and simply persists.

**An animated shimmer sweep was rejected** in favour of an opacity pulse. A translating gradient repaints a large area every frame, which is the wrong work to schedule on a low-end phone precisely while the response the skeleton exists to mask is still in flight.

### 14.14 Disabling the Grammar tile, and what that costs

**Decided: disable the tile on any level with no seeded deck (landed 2026-07-26, author's call).** This reverses the rule recorded in §8.5 on 2026-07-25, which held that no mode tile may ever be disabled. Recording the reversal rather than quietly editing the rule, because the reasoning behind the original still holds and is now an accepted cost rather than a refuted argument.

**The original rule's premise is unchanged and was verified again before the reversal.** The hub tile is the only UI path to `/grammar`: `BottomNav` lists Home, Stats and Browse (§8.5), and every other link to `/grammar` is *inside* the grammar section, reachable only once you are already there. `pickNextAction` is not a substitute, because `getGrammarStats` scopes `total`, `started`, `dueNow` and `studiedTodayCount` to the active level, so a non-N3 user's `grammarDue` is 0 by construction and the routed CTA never points at grammar. The consequence follows directly: a user who studies N3 grammar and then switches level has no route back to it except switching level again, and their reviews accumulate with no visible signal.

**Partially mitigated, later the same day, by the grammar hub's own level picker** (§13 Phase 3.5). Switching level *while on* `/grammar` now keeps the user there, so the round trip that used to cost a navigation is gone and the level can be switched back immediately. This does not close the hole: the one-way door is leaving `/grammar` first and changing level from `/home`, after which the tile is dead and there is no route back. The picker narrows the window; only the `GrammarProgress` condition below removes it.

**Chosen against the alternative of leaving it live.** A tile that is fully styled as actionable on four of five levels, where it leads to a hub that can only say "nothing here", spends the hub's credibility on every level except one. The author judged a wrong-looking-but-honest tile worse than an unreachable section, on the grounds that this is a single-user app whose owner knows the level switch exists, and that the N3-only deck is itself temporary (§4.1).

**Two narrower options were offered and declined**, and are recorded because they remain available if the stranding ever bites. (a) *Disable only when the user has zero `GrammarProgress` rows at any level*, which produces an identical dead tile for anyone who has never touched grammar while keeping the door open for anyone with history to lose; it costs one extra unscoped count on the hub. (b) *Keep the tile live but style it recessive*, signalling unavailability without removing the route. The author chose the flat condition for its simplicity.

**The disabled styling does not use `opacity`.** BRAND.md §3 forbids compositing a passing contrast pair with alpha, which is exactly how a conventional "greyed out" control drops below AA. The tile instead loses elevation (paper fill instead of white, no shadow) and steps its text down the ink ramp to `--ink-soft` / `--ink-faint`, both of which clear 4.5 : 1. The emoji is greyscaled rather than faded, which is safe because it is decorative and carries no contrast obligation. It renders as a plain `div`, not a disabled `button` or a dead `Link`: there is no action to make unavailable, so announcing a control that never existed would be worse than announcing none.

### 14.15 `UserMenu`: disclosure rather than an ARIA menu

**Decided: convert the account dropdown to a disclosure (landed 2026-07-26, author's call).** It had declared `role="menu"`, `role="menuitem"` and `aria-haspopup="menu"` while implementing no key handling at all, so a keyboard user could open it and have no way out: Escape did nothing, focus was neither moved nor restored, and the only dismissal was a pointer tap on the backdrop.

**Two ways to make that honest, and the trap is closed either way.** The role could have been kept and honoured, or dropped to match the widget. The panel holds one action (Sign out / End demo) plus a line of account text.

**Implementing the full menu pattern was rejected.** The APG menu contract is Up/Down between items, a roving `tabindex`, Home/End, Tab-closes, and focus moved into the menu on open: roughly sixty lines of machinery to navigate a single item. It also would not have fixed the second defect on its own, because the account header would still need to move out of the panel: a bare `<p>` is not a `menuitem`, `group` or `separator`, and a screen reader is entitled to discard invalid children of `role="menu"`, so the user's own email address was at risk of never being announced.

**The disclosure was chosen because it describes what is actually there.** The trigger owns `aria-expanded` and `aria-controls`; the panel is ordinary content, which makes the header readable again, and Tab reaches the one button unaided because the panel follows the trigger in DOM order. Declaring a menu role advertises a keyboard contract to assistive technology, and advertising one the component cannot honour is itself the accessibility defect, not merely an unfinished feature.

**Three exits, deliberately.** Escape (bound at document level, so it works whether focus is still on the avatar or already inside the panel, and it restores focus to the avatar), focus leaving the widget (a `focusout` check on the wrapper, which is what tabbing past the last control means, and without which the panel stays open behind a keyboard user while its backdrop keeps swallowing pointer clicks), and the original backdrop tap. `aria-controls` is emitted only while the panel exists, since pointing at an absent id is a dangling reference.

### 14.16 A uniform API surface, either all route handlers or all Server Actions

**Rejected in favour of the split in §9** (reads are route handlers, writes are Server Actions), decided 2026-07-26 while planning the move of session data-fetching onto the server. Both uniform options were genuinely available, and uniformity has real value: a mixed surface means a reader has to learn a rule before they can predict where a given operation lives.

**All Server Actions. Rejected on the read path.** It is the tidier-sounding option and would delete seven route handlers. It loses three things the reads actually use. (a) *HTTP caching*: an action is always a POST and is never cached, so `/api/browse`'s `private, max-age=3600, stale-while-revalidate=86400` and `/api/words/[id]/sentence`'s 24-hour window (§10) would have to be re-implemented as application state, replacing a browser primitive that already works with code that can be wrong. (b) *Imperative refetch*: "Check for more", the load-failure retry, and "Play again" all re-request a queue from an already-mounted client component. An action can serve that, but a cacheable GET is the better fit and is what those paths were built against. (c) *Inspectability*: a route can be exercised with `curl` while developing; an action's endpoint id is generated at build time and is not a stable address.

**All route handlers (the status quo). Rejected on the write path.** Keeping every mutation as a handler preserves uniformity at the cost of a hand-maintained JSON contract on both sides of each write, with no type checking across the boundary, plus the per-route ceremony of parsing and re-validating a body that the caller had in typed form a moment earlier. It also does not compose with a React transition as directly, which matters because the optimistic rating loop is the change these routes were being touched for.

**The cost accepted is the rule itself.** §9 states it in one line, and both tables name it, so the mixed surface is documented rather than discovered. The classification is deliberately "does this mutate or spend" rather than "was it a POST", which is why `/api/demo/login` stays a route handler: it is a public, origin-checked, rate-limited entry point, not an in-app mutation. Author decided; the deciding factor was that the two read routes carrying `Cache-Control` headers are the ones a uniform-actions design would measurably make worse.

### 14.17 Adopting Next.js 16's opt-in rendering features (`cacheComponents`, View Transitions, React Compiler)

**Declined for now, 2026-07-26, and recorded rather than left unexamined**, because all three are the features a reader of this codebase would reasonably expect a Next.js 16 app to be using, and "we never got to it" and "we chose not to" are different facts.

**What each would have bought.** `cacheComponents` (a top-level config key in 16.2.7, which subsumes Partial Prerendering and is the gate for the `use cache` directive) would prerender the static shell of every page and stream only the user-specific holes; today every route is fully dynamic because `requireAuth()` reads cookies at the top of the tree. It would also make the word-list query cacheable across requests, which is the single largest avoidable database read in the app: `db.word.findMany({ where: { level } })` is identical for every user and changes only when the deck is re-seeded. `experimental.viewTransition` would animate the card flip and the hub-to-session navigation, the two moments where a mobile-first PWA most wants to feel native. `reactCompiler` (also top-level) would retire the hand-written `useCallback` memoization in the session components.

**Declined on deployment risk, not on merit.** Bayana is live on a single Railway instance and is the author's daily study tool, so an opt-in rendering feature turns a routine `next` minor bump into a potential outage of the thing being used to study. Only `viewTransition` still sits under the `experimental.` namespace in 16.2.7; the other two have graduated to top-level keys but remain opt-in with evolving semantics, and the namespace is not the risk being avoided.

**One consequence follows immediately and is worth naming**, since it looks like an unrelated omission later: `use cache` is unavailable without `cacheComponents`, so the caching work uses React's `cache()` instead. That is a strictly smaller tool (request-scoped memoization, no cross-request cache) but it is stable API, and it addresses the defect actually measured: `getActiveLevel`, `hasOnboarded` and `getNewCardsPerDay` each issued their own `findUnique` for the same `UserProfile` row, so a `/home` render fetched one row three times and each grammar route fetched it twice. All eight read sites now funnel through a single `cache()`d `getProfile` in `src/lib/profile.ts`. **The saving is small today and that is the point of doing it first:** the queue builders in `review.ts` and `grammar-review.ts` read the same row, and they currently run in their own request (`/api/cards/queue`) where there is nothing to dedupe against. Once a session's initial payload is fetched during the page render (§8.1), `getActiveLevel` and `getStudyQueue` land in the same request and the dedupe starts paying on the app's most-used screen rather than only on the hub. Two properties were verified against React 19.2.4 rather than assumed, and both are what make it safe to call from route handlers and scripts as well as from a render: outside a request scope `cache()` does not throw, it passes through and calls the function, so the behaviour degrades to exactly what the code did before; and because the scope is the request, a profile edit is always visible on the next navigation. The corresponding hazard is that a Server Action and the re-render it triggers can be one request, so a writer that read the row before updating it would seed the cache with the pre-write value; no writer does, and the constraint is recorded at both `getProfile` and `setActiveLevel`. Cross-request caching of the deck stays on the table for whenever the flags are revisited. Author decided; the deciding factor was that the app is in daily use by its author and the three features are additive polish rather than blockers.

---

## 15. Open questions

- Should multiple-choice results feed the FSRS scheduler, or remain a separate, non-scheduling mode? (§8.2; scheduled as Phase 3, §13, where the open part is the calibration: correct → Good or Hard.)
- **Does the imported mock exam replace Exam mode, or coexist with it?** `src/lib/exam.ts` builds 問題１/問題２ algorithmically from `Word` rows with confusability-scored distractors and no FSRS coupling (§8.6); the absorbed Kalima session is a timed sitting drawn from the stored question pool (§4.2). Two modes that both call themselves an exam need either a stated division of labour (quick benchmark vs full sitting) or a retirement. **This subsumes the earlier "should Exam mode be timed?" question**, which was asked before there was a timed sitting to compare against: the answer now depends on whether Exam mode keeps its own identity at all. Blocks the §6 model (§4.2).
- **Is the mock exam reachable without signing in?** Kalima's homepage is deliberately open because that is most of its value to a recruiter, whereas this app gates everything through `proxy.ts` except an explicit allowlist of paths. If it stays public, the paths go in as exact matches rather than a prefix, following the `/api/demo/login` precedent and its reasoning (§11.8). Note that a public, budget-bearing endpoint raises the stakes on the limiter question in §11.4.
- **Dark mode: support it, or declare it an explicit non-goal?** Deferred on 2026-07-26 rather than answered. The interim state is light-only and now *declared* as such: `color-scheme: light` (`globals.css`) stops a phone in dark mode painting UA-owned chrome (form controls, the browse search field, scrollbars) in dark styling against the cream surfaces. That closes the leak, not the question. Answering "support it" is not a CSS-variable swap: BRAND.md §3 is a single light palette with no dark ramp, and the measured AA ratios in §8.4 are all against `--paper`, so a dark theme means a second palette and a second set of contrast measurements. Whichever way it goes, the call belongs in DECISIONS.md, because "we chose not to" and "we never got to it" are different facts and only one of them is stable.
- Furigana: store the reading as plain kana (current) or as ruby-annotated markup?
- MCQ distractor difficulty mix: how many confusable vs random distractors per question, and should the ratio adapt to the user's level/performance? When (if ever) should rule-based scoring graduate to embeddings + pgvector? (§8.2)

---

## 16. Decision log

The dated log of decisions that shaped this design lives in **[DECISIONS.md](DECISIONS.md)**, newest first. It was extracted from this section on 2026-07-26 because it is append-only while the rest of this document is rewritten in place; the rows themselves are unchanged. Record every new or reversed decision there, and keep the analysis of rejected options in §14 above.
