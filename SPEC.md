# Bayana — Design Document

**Spaced-repetition JLPT vocabulary trainer with AI-generated example sentences.**

| | |
|---|---|
| **Status** | Draft |
| **Author** | Chairul Akmal |
| **Last updated** | 2026-06-07 (Exam mode added) |
| **Target platform** | Mobile-first responsive web (Next.js 16, deployed on Railway) |

---

## TL;DR

Bayana turns an existing ~8,800-word JLPT vocabulary deck (N5–N1, Anki export) into a
modern web flashcard app. Cards are scheduled with **FSRS** (the algorithm used by
current Anki), and each word is paired with **example sentences generated once by
Claude Haiku and cached permanently** in Postgres. It offers two study modes — a serious
spaced-repetition **"Flashcard mode"** and a fast, gamified multiple-choice **"Quiz mode."**
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
- **Minimal-friction start.** Returning users are a single tap from studying: after signing
  in they pick a **mode** (Flashcard or Quiz) for their remembered **active level** and go —
  no decks, note types, or configuration. First-time users complete a one-time level choice
  and a short warm-up first (§8.5). Frictionless entry is a core differentiator from Anki.

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

The system is a **single full-stack Next.js 16 (App Router) application**. The browser UI,
the JSON API (Route Handlers / Server Actions), the FSRS scheduling logic, and the
Anthropic integration all live in one deployable, backed by a managed Postgres instance.

```
┌─────────────────────────── Railway ────────────────────────────┐
│                                                                  │
│  Next.js (App Router) — single service                          │
│   ├─ /app                React UI (Flashcard mode, Quiz mode, browse)│
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

**Identity vs. profile.** `User` is the **authentication identity** — once Auth.js is added
(§11), its Prisma adapter owns this model (alongside `Account` / `Session` /
`VerificationToken`) and expects a specific shape. App-specific data (display name, study
preferences, role) therefore lives in a separate **one-to-one `UserProfile`**, keeping
library-managed auth concerns decoupled from our own. `UserProfile` is also where the study
**direction preference** (§8.1) and the **admin role** (gating the admin audit page, §13)
live.

```prisma
model User {
  id        String        @id @default(cuid())
  email     String?       @unique        // null for the default local user
  createdAt DateTime      @default(now())
  profile   UserProfile?                 // 1:1 — app-specific data (see below)
  reviews   ReviewState[]
  // Auth.js adapter will add: emailVerified, image, accounts[], sessions[]
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
  core change. A future **admin review/audit** workflow (§13 Phase 3) will let an admin
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

Bayana offers three complementary study modes: **Flashcard mode** (serious
spaced-repetition recall), **Quiz mode** (fast, gamified JP→EN multiple choice), and
**Exam mode** (JLPT-style reading/writing questions). Flashcard mode is the retention
engine; Quiz mode is the lightweight warm-up; Exam mode is the benchmark.

**Level scope.** Both modes operate within a **single JLPT level at a time — the user's
*active level***, chosen once at onboarding (§8.5) and changeable later (stored on
`UserProfile.activeLevel`, §6). The Flashcard queue and the Quiz are both filtered to
it, so scheduling, new-card selection, and multiple-choice distractors all stay within one
level's vocabulary. The two modes are thus *separated by level* — you study or quiz one
level at a time, not the whole deck at once.

**Minimal-friction entry.** A **public marketing homepage** lives at `/` (brand + mascot + a
single **Sign in** CTA, for logged-out visitors); the authenticated app lives at `/study`. A
**returning** user signing in lands on a simple **mode picker** (Flashcard or Quiz) for their
active level and starts with one tap — no deck selection or config (§2). A **first-time**
user is routed through onboarding first (§8.5). The home/landing look-and-feel follows
**[BRAND.md](BRAND.md)**.

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
  remain a separate, non-scheduling practice mode is deferred to Phase 2 (§15, §16).

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
in memory per keystroke — no server request per search. A **render cap of 50** results
prevents mounting thousands of DOM nodes (N1 has 2,699 words); an overflow hint prompts
the user to narrow their search. Sentences are lazy-loaded per word via `GET /api/words/
[id]/sentence` (cached 24 h) when a row is tapped, keeping the initial payload small.
Rows expand/collapse in an accordion (one open at a time).

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
Two user stories drive entry into the app. Both reach the same two level-scoped engines
(§8.1, §8.2); they differ only in the first-run extras.

- **First-time user (first run).** Sign in via the email magic link (§11.2) → **choose a
  JLPT level** (N5–N1) → the app drops straight into a short **Quiz mode warm-up of 5
  questions** at that level — low-stakes and **non-scheduling** (it does not touch FSRS
  state) — so the first experience is *doing*, not reading → a brief **onboarding guide**
  then walks through the app's functionality (the two modes, flip/rate, streak, switching
  level). Completing the flow persists `UserProfile.activeLevel` and stamps `onboardedAt`
  (§6), which is what distinguishes a first-time from a returning user.
- **Returning user.** Sign in → the **home hub** (`/home`) → start. That's it.

**The home hub (`/home`).** The returning-user landing — sign-in, the dev login, and the
public `/` all redirect here. It is the **mode picker** (three large cards → Flashcard
`/study`, Quiz `/quiz`, Exam `/exam`) plus an **inline level selector** (the five JLPT
chips; tapping one persists `UserProfile.activeLevel` via a server action and re-scopes all
three engines). The level is therefore changed *here*, not on a separate settings page. The
hub is deliberately **not a full dashboard** — stats, streak, and history live in a richer
dashboard in Phase 4 (§13). `/study`, `/quiz`, and `/exam` each read the active level and
link back to the hub.

### 8.6 Exam mode — JLPT-style reading & writing

A timed benchmark mode that presents 20 questions in two sections mirroring the
vocabulary sub-problems of the JLPT Reading section:

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
All three modes (Flashcard, Quiz, Exam) are independent by design; FSRS coupling is a
deliberate non-goal for Exam mode (§16 decision log).

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
| GET | `/api/dev/login` | **Dev-only**: mint a session for the seeded user (skip the magic link) | none (dev-only) | **Implemented** — 404 in prod; gated by `DEV_AUTH` (§11.7) |
| GET | `/api/browse?level=` | Word list for one level (id, expression, reading, meaning — no sentences); browser-cached | required | **Implemented** — `Cache-Control: private, max-age=3600, stale-while-revalidate=86400` |
| GET | `/api/words/[id]/sentence` | Lazy-load one word's cached example sentence | required | **Implemented** — `Cache-Control: private, max-age=86400, stale-while-revalidate=604800` |
| POST | `/api/generate` | On-demand single-sentence fallback | required + rate-limited | Planned (Phase 1c, optional — see §11.4) |
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
4. **Server-side allowlist enforcement** (case-insensitive `email === AUTH_ALLOWED_EMAIL`,
   normalized on both sides) *before* any email is sent, and **failing closed** if the
   allowlist is unset — without this the endpoint is an open email-spam relay.
5. **Rate limiting** on the sign-in request endpoint (per-IP and global) to prevent inbox
   bombing and token-guessing.
6. **Secure sessions** — `httpOnly`, `Secure`, `SameSite=Lax` cookies with a sane expiry
   and rotation; sessions stored server-side (Auth.js database sessions via Prisma).
7. **HTTPS everywhere** — provided by Railway TLS; redirect HTTP→HTTPS.

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
  artifact. (`Word` is free to re-import from `decks/`.) Back it up with `pg_dump` (commands
  in `notes/deploy.md`); for long-term keeping, a `Word.guid`-keyed JSON export is preferred
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

**Phase 1a — Playable slice (run locally, study ASAP) — ✅ done**
- Postgres schema (incl. `ReviewLog`); seeded default `User` + `UserProfile`.
- CSV import for **N3**; batch-seed N3 example sentences.
- **Flashcard mode** review (JP→EN) via `ts-fsrs`, with **one-step undo**.
- Mobile-first card UI (flip / rate). Runs locally, end-to-end.

**Phase 1b — Shippable (public): auth + deploy — ✅ done**
- Magic-link auth (Auth.js + Resend, single-email allowlist) with §11.3 hardening and a
  `proxy.ts` route guard.
- Deployed to Railway; N3 sentence cache transferred (by `Word.guid`, §12) rather than
  regenerated.

**Phase 1c — Fill out content — ✅ done (generation)**
- All levels (N5–N1, ≈8,100 words) batch-seeded; every word now has a cached sentence
  (§7.5). The on-demand `/api/generate` fallback is **no longer needed for coverage** and
  has moved to Phase 3 (it returns there as a safety net for future additions).

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
  on the landing and home hub, **installable PWA** (pulled forward from Phase 5, §8.4).
- MC↔FSRS coupling and Flashcard↔Quiz synergy **deferred by choice** (§15, §16) — revisit
  once there is usage data to reason about.
- First-run onboarding deferred → Phase 4 (§16).

**Phase 2 addendum — Exam mode — ✅ done (2026-06-07)**
- JLPT-style benchmark mode (§8.6): `GET /api/exam` with 10 × 問題１ (kanji reading in
  sentence context) + 10 × 問題２ (kanji writing from kana in sentence context). Sequential
  with immediate feedback; section-break screen between 問題１ and 問題２; split score
  summary.
- Exam mode is **independent of FSRS** by design — neither reads from nor writes to
  `ReviewState`. All three modes (Flashcard, Quiz, Exam) are standalone (§16 decision log).
- Home hub updated to a three-tile mode picker (Flashcard / Quiz / Exam).

**Phase 3 — Admin audit + on-demand generation — next, after Quiz mode**
- **Admin review/audit page** (admin-gated via `UserProfile.role`): inspect each
  AI-generated example sentence and accept or reject it before it surfaces to learners
  (adds a review-status field to `ExampleSentence`; optionally generate several candidates
  per word and keep the best).
- **On-demand `/api/generate`** + study-UI fetch-on-flip for any not-yet-seeded words, with
  the §11.4 guardrails (auth + rate-limit + cache-first + bounded `max_tokens`).

**Phase 4 — Multi-user**
- Widen/remove the email allowlist; real `User` rows; authorization checks scoping all
  reads/writes by `userId`.
- Per-user settings are **intentionally minimal** (see §16); multi-user does not imply a
  settings page. The active level (already inline on `/home`) is the only planned user-facing
  control; all other parameters (`newCardsPerDay`, FSRS retention target, study direction)
  remain author-set defaults.
- **First-run onboarding (§8.5)** — moved here from Phase 2: level choice → 5-question Quiz
  warm-up (non-scheduling) → guided tour; uses the existing `UserProfile.onboardedAt` column
  to branch first-time vs. returning. Deferred because a first-run experience only earns its
  keep once there are multiple real users to onboard (the sole author is already past it).

**Phase 5 — Further enhancements**
- Audio (TTS) for sentences, furigana rendering, streak/heatmap, sentence
  regeneration/voting, export back to Anki. (Installable-PWA *basics* — manifest, icons,
  fullscreen + safe-area — were pulled forward to 2026-06-04, §8.4/§16; the **offline
  shell / service worker** is what remains here.)

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
(§13 Phase 5) once there is a concrete offline use case. Also considered and rejected for
the same release: the browser **Fullscreen API** (`requestFullscreen`) to force a single
route truly fullscreen — it is unsupported on iPhone Safari, so it is not a portable answer,
whereas the manifest `display` mode covers Android cleanly.

---

## 15. Open questions

- Should multiple-choice results feed the FSRS scheduler, or remain a separate,
  non-scheduling mode? (§8.2)
- Furigana: store the reading as plain kana (current) or as ruby-annotated markup?
- MCQ distractor difficulty mix: how many confusable vs random distractors per question,
  and should the ratio adapt to the user's level/performance? When (if ever) should
  rule-based scoring graduate to embeddings + pgvector? (§8.2)

---

## 16. Decision log

A running record of decisions that shaped this design, newest first. Each entry states
**what** was decided, the **context/rationale**, and **who** decided. Detailed analysis
of rejected options lives in §14; this table is the at-a-glance history. Append a new row
whenever a decision is made or reversed — do not edit history in place.

| Date | Decision | Context & rationale | Decided by | Ref |
|------|----------|---------------------|------------|-----|
| 2026-06-07 | **Exam mode added as a third, fully independent study mode.** JLPT-style two-section benchmark: 問題１ (pick the kana reading for an underlined kanji word in a sentence) and 問題２ (pick the kanji form for an underlined kana word in a sentence). 20 questions per round (10 per section); sequential with immediate feedback; section-break screen between sections. **No FSRS coupling by design** — Exam is a benchmark, not a study scheduler. All three modes (Flashcard, Quiz, Exam) are independent: they operate on the same word pool but do not share scheduling state. | Two key decisions: (a) *Modes are independent* — when designing Exam mode the question arose whether Exam correct/wrong answers should feed FSRS (like the planned Quiz↔FSRS Phase 3 coupling). The author chose not to: Exam is a benchmark, and coupling would mean Exam sessions bias the user's SRS schedule in ways that are hard to reason about. The three modes solve distinct problems (retention, warm-up/engagement, benchmarking) and are cleaner as independent tools. This also simplifies the scope of Phase 3 (MC↔FSRS coupling for Quiz only). (b) *Immediate feedback over submit-all-at-end* — a real JLPT exam withholds feedback until submission, but Bayana is a study tool: connecting a correction to the moment of error is the primary teaching mechanism; deferring it wastes the learning window. | Author | §8.6, §13 |
| 2026-06-05 | **Security review run — resource-exhaustion + input-validation hardening.** Two fixes. (a) `getStudyQueue` no longer fetches the entire due-card backlog (each row joined to its `word` + first `sentence`) only to slice 20 and read `.length` for `totalDue`; it now issues a parallel `count()` + `findMany({ take: sessionLimit })`, both served by `@@index([userId, due])`. (b) Enum validation switched from `levelParam in Level` to `Object.hasOwn(Level, levelParam)` at all six call sites (the `/api/quiz`, `/api/browse`, `/api/cards/queue` routes; the `setActiveLevel` and `completeOnboarding` server actions; the `/quiz` page). Also relocated `proxy.ts` → `src/proxy.ts` (best-practice colocation under the `src/` dir). | The due-card query was **O(backlog)**: a user returning after a lapse with hundreds of overdue cards would materialize every joined row into app memory on each queue build — and the route is `force-dynamic` and auto-refetched between sessions — to use only 20 rows plus a count. That is an availability / resource-exhaustion vector (§11.1, "endpoint scanning / cost-abuse"); the count+take split makes the work proportional to what is rendered. The `in` operator walks the prototype chain, so `?level=constructor` (or `toString`, `hasOwnProperty`, …) passed the guard and reached Prisma as an invalid enum, yielding a 500 instead of a clean 400 — a latent robustness bug whose code comments falsely claimed bad input "can't reach the DB"; `Object.hasOwn` tests own properties only. The wider audit found the auth model sound — allowlist fails closed, sign-in is rate-limited (per-IP + global), every user-scoped query is keyed by the session `userId` (no IDOR), and no web-reachable route spends Anthropic tokens — and found **no classic N+1** (the heavy read paths are each a single over-fetching query, not a per-row loop). Deferred follow-up: per-user rate limiting on the authenticated read endpoints (notably `/api/quiz`, which scans the full level pool per request) when the allowlist widens in Phase 4. | Author | §11.1, §6, §8.1 |
| 2026-06-04 | **Phase 2 complete. User-defined settings are intentionally minimal** — no settings page, no user-tweakable knobs beyond active level. Parameters (`newCardsPerDay`, FSRS retention target, study direction) remain author-set opinionated defaults. | Bayana's thesis (§2) is "one-tap, no-config." A settings page contradicts this and adds maintenance surface for each parameter exposed. The one control that belongs in the user's hands — which level they're studying — is already inline on the home hub and not a dedicated settings screen. Adding UI for `newCardsPerDay` or retention target would let users work against the research-backed defaults without a clear benefit; the self-correcting feedback loop (overreach → review debt → natural pacing) is the intended mechanism. | Author | §2, §8.5, §13 |
| 2026-06-04 | **Browse iterated:** render cap of 50 replaced with true 50/page pagination; started-words-first sort (reviewed words surface first, with a magenta dot indicator); inline `BrowseLevelPicker` chip row (calls `setActiveLevel` + `router.push('/browse')` to clear stale URL params); editable page-number `type="number"` input with JS clamping on blur/Enter. | The initial render cap was a DOM-size guard masquerading as pagination — users on page 5 had no way to reach page 6. True pagination with `safePage = Math.min(currentPage, totalPages)` handles results shrinking mid-session. Started-first ordering makes the first page immediately useful (shows what the user is actively studying). The level switcher navigates without a `?level=` param because `router.refresh()` would have left a stale URL override; `key={lvl}` on `BrowseClient` triggers a clean remount. | Author | §8.3 |
| 2026-06-04 | **Browse/search shipped as Phase 2 light polish.** `/browse` (whole-deck lookup for the active level) + `GET /api/browse?level=` (browser-cached word list, no sentences) + `GET /api/words/[id]/sentence` (lazy sentence per tap, 24 h cache). Client-side filtering in memory with a render cap of 50. Linked from `/home`. The "soon" tag removed from the Quiz feature card on the landing page — Quiz is live. | Whole-deck browse chosen over "seen cards only" (a collection/history view); the latter belongs in stats. Browser `Cache-Control` headers (rather than server-side Next.js revalidation) were chosen because they eliminate repeat round-trips to Railway for data that changes ~never, and because the client-side filter means zero requests per keystroke. Render cap avoids 2,699-node DOM without requiring a virtualization library. | Author | §8.3, §9, §10 |
| 2026-06-04 | **`newCardsPerDay` is a per-queue-build pace, not a rolling per-calendar-day ceiling** — deliberately *not* tracking new cards introduced per day. After finishing a session a user can build another queue and get up to `newCardsPerDay` more new words, repeatedly. The proposed "rolling daily cap" is a **non-goal**. | Intentional: let motivated users challenge themselves *on their own terms* rather than be hard-blocked at an arbitrary daily number. The cap still shapes the gentle **default single-session pace**, and reviews-first scheduling means anyone who overreaches simply inherits the review load they created — a self-correcting feedback loop, not a paternalistic lock. | Author | §6, §8.1 |
| 2026-06-04 | **Default `newCardsPerDay` lowered 20 → 10** (migration also brings existing profiles still on the old default down). A "ten words a day" pace note with a tap-to-open rationale (`InfoBubble`) added to the landing hero and the home hub. | Research + community consensus put the sustainable JLPT pace at ~10–15 new/day; *review debt* (reviews compounding faster than they can be cleared) is the top reason learners abandon SRS, and the retention→workload curve is exponential (each new card ≈ 10 lifetime reviews, so 10/day ≈ a humane ~100 reviews/day at steady state vs ~200 at 20/day). 10 also matches the "ten words at a time" product promise. Desired retention stays 0.9 (the data-backed sweet spot). Sources: FSRS optimal-retention wiki; Cepeda et al. 2006 (spacing meta-analysis); JLPT/Anki community pacing guides. | Author | §6, §8.5 |
| 2026-06-04 | **First-run onboarding deferred from Phase 2 → Phase 4 (multi-user).** The `UserProfile.onboardedAt` column (already migrated) stays; only the flow (level → 5-question warm-up → guided tour) is postponed. Phase 2 is now considered functionally complete once **confusability-scored distractors** land. | A first-run/onboarding experience exists to convert *new* users; with a single author-user who is already fluent in the app, building it now is effort spent on a path no one walks yet. It naturally belongs with Phase 4, where the allowlist widens and real new users appear. No schema cost to defer (the column is harmless if unused). | Author | §8.5, §13 |
| 2026-06-04 | **Installable-PWA basics pulled forward** from Phase 5: Web App Manifest (`app/manifest.ts`) + PNG icons (192/512/maskable, via `scripts/gen-pwa-icons.mjs`), `display: "fullscreen"`, `orientation: "portrait"`, `viewport-fit=cover` + `env(safe-area-inset-*)` on the session screens. **Offline shell / service worker stays deferred.** Two sub-calls: (a) iOS keeps `apple-mobile-web-app-status-bar-style: "default"`, *not* `black-translucent`; (b) the maskable icon uses the **yellow** tile, not BRAND's "canonical magenta." | The author **primarily uses Android**, where `display: fullscreen` delivers the goal — a chrome-free, edge-to-edge study session like Duolingo; iOS Safari ignores `fullscreen` (falls back to `standalone`, status bar stays), accepted rather than engineered around. No service worker is needed for install or fullscreen, so offline was deferred to avoid cache-invalidation complexity on an always-online single-user app (§14.4). `black-translucent` was rejected because it draws **white** status-bar text over the light paper UI (invisible); magenta tile rejected because Pī's magenta body on magenta is muddy (the very reason the favicon is yellow, BRAND §6). | Author | §8.4, §13, §14.4 |
| 2026-06-04 | **Rename study modes**: "Anki mode" → **"Flashcard mode"**; "Duolingo mode" → **"Quiz mode"** across all UI, docs, and code comments. References to the Anki and Duolingo products are retained in descriptive/comparative context (e.g., "FSRS, the algorithm modern Anki uses"; "like Duolingo, minus the ads"). | Using third-party brand names as our own feature labels risks trademark confusion and implies endorsement. Descriptive names ("Flashcard", "Quiz") are clearer to new users and own-able long-term; the product comparison copy in the landing page "Why?" section provides the necessary context. Author decided after trademark review. | Author | §8.1, §8.2 |
| 2026-06-03 | **Home hub at `/home`** is the post-login landing: a lightweight **mode picker** + **inline level selector** (writes `UserProfile.activeLevel`). No standalone settings/dashboard page; a full **stats dashboard is deferred to Phase 4**. Login / dev-login / public `/` all redirect to `/home`; `/study` and `/quiz` read the active level. | Setting a level and choosing a mode are a chip and two buttons — a dashboard would fight the one-tap, no-config ethos (§2). Keeping level-setting inline on the hub avoids a settings page; stats genuinely warrant a richer screen, but only later. | Author | §8.5, §6 |
| 2026-06-03 | **Quiz mode MVP**: `GET /api/quiz` returns a batch of JP→EN MC questions for a level; **random distractors** with a meaning-dedupe guard, **non-scheduling** (no FSRS writes). Distractor selection isolated so confusability scoring slots in later. **Dev-only `/api/dev/login`** mints a real DB session (gated by `DEV_AUTH`, 404 in prod). | Ship the second mode fast without the Flashcard↔Quiz synergy or confusability scoring (deferred, §8.2/§15); the dedupe guard is the one correctness must-have even when random. A real-session dev bypass keeps parity with prod (Credentials provider rejected — needs JWT, we use DB sessions). | Author | §8.2, §8.5, §9, §11.7 |
| 2026-06-03 | **Both modes are scoped to one active JLPT level** (`UserProfile.activeLevel`); **first-run flow** = pick level → 5-question Quiz warm-up (non-scheduling) → guided tour; **returning users** get a Flashcard/Quiz **mode picker**. Refines the earlier "one-tap start." | Studying/quizzing one level at a time keeps scheduling and MC distractors coherent and the queue focused; a *doing-first* warm-up beats a wall of instructions for a new user; the level is a remembered preference so returning entry stays one tap (just pick a mode). `onboardedAt` distinguishes first-time vs. returning. | Author | §2, §6, §8, §8.5 |
| 2026-06-03 | **N1 level chip = imperial purple + gold** (murasaki `#3d1452` + kin `#f0c75e`), not flat grape | In Japan purple is the historical highest-rank colour (禁色); gold is the luxury accent. N2 (`mag-600`) and the old N1 (`grape`) were both pinkish-purple and too close — shifting N1 to a deeper, bluer purple with gold text makes the top level read as "special," and is more culturally "premium" than gold alone (which also clashes with the N4 yellow). Author chose imperial-purple+gold over a gradient or solid gold. | Author | BRAND.md §3/§7 |
| 2026-06-03 | **Public landing page at `/`**; the authenticated study app moves to `/study`. Brand foundation added (tokens + fonts in `globals.css`, reusable `Parrot` component, Pī favicon) per **BRAND.md**, which now states the mobile-first / iPhone-SE (375×667) design target. | A "Sign in" homepage is for logged-out visitors, so `/` can't also be the gated app; signed-in users are redirected `/` → `/study` to preserve one-tap start (§2). Committing the brand as code/tokens lets the landing — and Phase 2's Quiz mode UI — build against the real design system. | Author | §8, §8.4 |
| 2026-06-03 | **Re-prioritize roadmap: Quiz mode is the current focus**; the **admin audit page + on-demand generation move to Phase 3** (right after Quiz mode, ahead of multi-user). Quiz mode UI bar set to "Duolingo-grade polish but minimal animation and zero ads." | All content is seeded (Phase 1c done), so the next user-facing value is the second study mode. On-demand generation is no longer needed for coverage, so it rides with the admin tooling as a safety net. Minimal-animation/no-ads is the product thesis (§1) — match Duolingo's quality without its spectacle or monetization. | Author | §8.2, §13 |
| 2026-06-03 | Security review hardening: **case-insensitive allowlist** comparison; **global sign-in cap tightened 20 → 6**/10min; SPEC §9/§11.4 corrected to mark unbuilt routes "planned" and to require auth + rate-limit + cache-first + token-cap on a future `/api/generate` | Review confirmed no web-reachable Anthropic cost path exists (generate code is scripts-only) and Resend is well contained. The allowlist compare could lock out the legit user on a capitalization mismatch (availability footgun); a tighter global cap further bounds inbox-bombing for a single-user app; doc accuracy prevents assuming protections on routes that don't exist. | Author | §9, §11.3, §11.4 |
| 2026-06-03 | Sign-in rate limiting uses an **in-memory fixed-window** limiter (per-IP 5/10min + global 20/10min), enforced in `proxy.ts`; session TTL set explicitly to 30 days | Single-user on one Railway Hobby instance, so a process-local counter needs no Redis/DB and zero deps; limits reset on redeploy / aren't shared across replicas (acceptable, swappable later). The global cap is the real inbox-bombing defense since the allowlist means only one inbox can receive a link. Postgres/Upstash stores rejected as over-built for now. | Author | §11.3 |
| 2026-06-03 | Build on Railway with **Railpack**, not Nixpacks | Nixpacks is deprecated; Railpack is Railway's current default builder. Set `build.builder: "RAILPACK"` in `railway.json`. | Author | §12 |
| 2026-06-03 | **Back up the local DB only**, not prod (refines the earlier manual-`pg_dump` row) | Hobby-plan egress makes routine prod dumps costly, and the only paid/irreplaceable artifact — `ExampleSentence` — originates locally, so a local backup protects it. Accepted consequence: prod-only `ReviewState`/`ReviewLog` (study history) is unrecoverable if prod is lost — acceptable for a single-user learning project. | Author | §12 |
| 2026-06-03 | **Backups are manual `pg_dump`** (revises the earlier "Railway daily" row) | The Railway **Hobby** plan has no managed/scheduled backups, so dumps are taken by hand: before each prod migration, and from the local container (the source of the paid sentence cache). A `Word.guid`-keyed JSON export is the version-proof long-term form. | Author | §12 |
| 2026-06-03 | Ship Phase 1b with **N3 only** (auth + deploy first); seed other levels + on-demand generation after deploy (Phase 1c) | Get the app live and usable sooner; remaining levels and the on-demand fallback are content/polish that can follow on the deployed instance. | Author | §13 |
| 2026-06-03 | Reuse generated sentences in prod by transferring the cache (keyed by `Word.guid`), not regenerating | The cache is a paid one-time artifact and `Word.id` cuids differ per DB; transfer by guid (or pg_dump/restore of Word + ExampleSentence) avoids paying the API again on deploy. | Author | §12 |
| 2026-06-03 | Study session auto-refetches the queue when a batch is exhausted | Cards that become due mid-session (Again / learning steps) cycle back without a manual reload; "caught up" shows only when a fresh fetch is empty. | Author | §8.1 |
| 2026-06-03 | Randomize new-card selection in the study queue | The deck is sorted by reading, so sequential new cards cluster similar sounds; a shuffled sample spreads them out and varies sessions. | Author | §8.1 |
| 2026-06-03 | `ReviewLog` mirrors the ts-fsrs review log (added `learningSteps`); one-step undo uses ts-fsrs `rollback()` | Storing the library's log verbatim makes undo correct without hand-rolled math and feeds FSRS re-optimization later. | Author | §6, §8.1 |
| 2026-06-03 | Use **Prisma 7** with the `@prisma/adapter-pg` driver adapter (generated client in `src/generated/prisma`, config in `prisma.config.ts`) | Prisma 7 is the current major and makes driver adapters standard; pairs with the Postgres datasource. Local dev runs Postgres in Docker on port 5887. | Author | §6 |
| 2026-06-03 | **One-tap start**: after login the app opens straight into a review/lesson — no deck picking or config | Frictionless entry is the core anti-Anki differentiator; the home screen defaults to the due queue. | Author | §2, §8 |
| 2026-06-03 | Re-slice Phase 1 into **1a** (local playable: N3 review + undo) and **1b** (auth + full seed + deploy) | Get a usable study tool in hand ASAP; defer public-exposure work so it doesn't block daily use. | Author | §13 |
| 2026-06-03 | Add append-only **`ReviewLog`** (write every review from day one) and ship **one-step undo** | History can't be backfilled; it unlocks stats, undo (restore prior state), and future FSRS re-optimization. Undo is Anki table-stakes. | Author | §6, §8.1 |
| 2026-06-03 | Align `ReviewState` to the ts-fsrs **Card** shape; store FSRS params, desired retention, timezone/day-start on `UserProfile` | Avoids a mapping/migration layer; enables per-user FSRS tuning and correct day boundaries for limits/streaks. | Author | §6 |
| 2026-06-03 | Add goal: **match Anki's core loop** (FSRS, undo, suspend, stats) minus setup; no user decks | Makes competitive parity an explicit target and deck import a deliberate non-goal. | Author | §2 |
| 2026-06-03 | **Validate model output** before caching; skip/log malformed generations | LLM output is occasionally malformed; never store unvalidated sentences. | Author | §7.3 |
| 2026-06-03 | **Backups**: Railway daily + `pg_dump` before each prod migration | Review history is irreplaceable; cheap insurance around schema changes. | Author | §12 |
| 2026-06-03 | Add a one-to-one **`UserProfile`** model, separate from `User` | `User` is owned by the Auth.js adapter (fixed shape); app-specific data — display name, study preferences (direction, daily new-card cap), and `role` (admin gates the Phase 4 audit page) — belongs in a decoupled 1:1 profile rather than polluting the auth identity. | Author | §6 |
| 2026-06-03 | **One example sentence per word** at launch; an admin review/audit page (accept/reject generated examples) is deferred to Phase 4 | Simplest and cheapest to start. The schema already allows multiple sentences per word, so adding more — gated by a quality-review workflow — needs no core change later. | Author | §7.2, §13 |
| 2026-06-03 | Study direction defaults to **JP→EN** (recognition) for new users; **EN→JP** (recall) is opt-in in preferences. Example sentences are generated for Japanese words only and are direction-independent. | Recognition is the lower-friction default for new learners; recall stays available for those who want it. Anchoring sentences to the Japanese word means one cached sentence serves both directions. | Author | §8.1 |
| 2026-06-03 | MCQ distractors use **confusability scoring** (shared kanji / reading / meaning), scored in app code over a same-level pool; embeddings + pgvector as the scale path | Random distractors are too easy — confusable ones force real recall. Rule-based in-app scoring fits launch scale, stays unit-testable, and keeps SQL a plain pool fetch; trigram/pgvector deferred until needed. A fairness guardrail excludes true synonyms. | Author | §8.2 |
| 2026-06-03 | Pin the web framework to **Next.js 16** (React 19, Tailwind v4, Turbopack), scaffolded via `create-next-app` | Explicit author preference and the current stable major at project start; App Router + Server Actions + Turbopack are the modern defaults the architecture in §5 already assumes. | Author | §5 |
| 2026-06-03 | Repo will be open-sourced; allowlist email stays env-only; existing git commit email accepted as public | No PII committed. `AUTH_ALLOWED_EMAIL` value lives only in Railway env; a dedicated alias will back it. Author's commit email is already public, so no history rewrite is warranted. | Author | §11.6 |
| 2026-06-03 | Two study modes: "Flashcard mode" (FSRS recall) and "Quiz mode" (gamified MC) | Serves both serious retention and a low-friction warm-up; MC distractors are a free same-level DB query, so the second mode adds little cost. | Author | §8 |
| 2026-06-03 | Mobile-first, iPhone SE (375×667) baseline; usable on desktop | Primary usage is on phones; desktop treated as an additive breakpoint rather than the design center. | Author | §8.4 |
| 2026-06-03 | Authentication: passwordless email magic link (Auth.js + Resend), single-email allowlist | Stores no reusable password, delegates to the stronger inbox security boundary, and the allowlist contains blast radius. Resend already provisioned. Seeded password rejected (§14.2). | Author | §11.2 |
| 2026-06-03 | Sentence generation: pre-seed via Batch API (N3 first), on-demand only as fallback | Batch API is ≈50% cheaper for the one-time ~8.8k-word fill and seeding has no latency requirement; N3 prioritized per author. On-demand-only rejected as primary (§14.3). | Author | §7 |
| 2026-06-03 | Scheduling algorithm: FSRS (via `ts-fsrs`) | Best-in-class retention/scheduling and what current Anki uses; mature TypeScript library. | Author | §8.1 |
| 2026-06-03 | Launch single-user, but keep the data model multi-user-ready | Fastest path to a usable personal tool; `userId` present from day one means no core migration when multi-user lands. | Author | §6, §11.5 |
| 2026-06-03 | Architecture: single full-stack Next.js service (not a separate API) | One client, the only long job is offloaded to Anthropic's Batch API, and every operation is a DB query or single LLM call — a split would double operational surface for no gained capability. Separate API rejected (§14.1). | Author | §5.1 |
| 2026-06-03 | Source deck: open-anki-jlpt-decks (MIT), committed to `decks/` | Clean, structured, freely licensed JLPT vocabulary; committed (not gitignored) so it is the source of truth for imports. | Author | §4 |
