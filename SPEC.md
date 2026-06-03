# Bayana — Design Document

**Spaced-repetition JLPT vocabulary trainer with AI-generated example sentences.**

| | |
|---|---|
| **Status** | Draft |
| **Author** | Chairul Akmal |
| **Last updated** | 2026-06-03 |
| **Target platform** | Mobile-first responsive web (Next.js 16, deployed on Railway) |

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
  in they pick a **mode** (Anki or Duolingo) for their remembered **active level** and go —
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
  newCardsPerDay Int     @default(20)     // daily NEW-card cap for the FSRS queue
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

Bayana offers two complementary study modes the user can switch between: **Anki mode**
(serious spaced-repetition recall) and **Duolingo mode** (fast, low-friction
multiple-choice practice). Anki mode is the retention engine; Duolingo mode is the
lightweight on-ramp and warm-up.

**Level scope.** Both modes operate within a **single JLPT level at a time — the user's
*active level***, chosen once at onboarding (§8.5) and changeable later (stored on
`UserProfile.activeLevel`, §6). The Anki queue and the Duolingo quiz are both filtered to
it, so scheduling, new-card selection, and multiple-choice distractors all stay within one
level's vocabulary. The two modes are thus *separated by level* — you study or quiz one
level at a time, not the whole deck at once.

**Minimal-friction entry.** A **public marketing homepage** lives at `/` (brand + mascot + a
single **Sign in** CTA, for logged-out visitors); the authenticated app lives at `/study`. A
**returning** user signing in lands on a simple **mode picker** (Anki or Duolingo) for their
active level and starts with one tap — no deck selection or config (§2). A **first-time**
user is routed through onboarding first (§8.5). The home/landing look-and-feel follows
**[BRAND.md](BRAND.md)**.

### 8.1 Anki mode — flashcard review (FSRS)
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

### 8.2 Duolingo mode — multiple choice
A gamified, tap-to-answer quiz in the spirit of Duolingo: pick the right answer from four
options, get instant feedback, keep momentum. Optimized for quick mobile sessions. Questions
are drawn from the user's **active level** (§8.5), and the first-run warm-up is five such
questions, run as a **non-scheduling** practice (it doesn't affect FSRS state).

- `GET /api/quiz` returns a target word plus one correct option and three distractors.
- Variants: show `expression` → choose `meaning`, or `meaning` → choose
  `expression`/`reading`.
- Instant correct/incorrect feedback with the cached example sentence shown on reveal.
- Whether Duolingo-mode results feed the FSRS scheduler (correct ≈ Good, wrong ≈ Again) or
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
  later enhancement (§13).
- **Implementation:** Tailwind CSS with a mobile-first breakpoint strategy (base styles
  target the SE; `sm:`/`md:`/`lg:` add desktop affordances).
- **Visual language** — palette, typography (Fredoka / Nunito / M PLUS Rounded 1c), the
  mascot Pī, and components — is specified in **[BRAND.md](BRAND.md)** (design tokens in its
  §8); the iPhone SE baseline above is the shared design target for both docs.

### 8.5 Onboarding & session flows
Two user stories drive entry into the app. Both reach the same two level-scoped engines
(§8.1, §8.2); they differ only in the first-run extras.

- **First-time user (first run).** Sign in via the email magic link (§11.2) → **choose a
  JLPT level** (N5–N1) → the app drops straight into a short **Duolingo-mode warm-up of 5
  questions** at that level — low-stakes and **non-scheduling** (it does not touch FSRS
  state) — so the first experience is *doing*, not reading → a brief **onboarding guide**
  then walks through the app's functionality (the two modes, flip/rate, streak, switching
  level). Completing the flow persists `UserProfile.activeLevel` and stamps `onboardedAt`
  (§6), which is what distinguishes a first-time from a returning user.
- **Returning user.** Sign in → a simple **mode picker: Anki mode or Duolingo mode** for the
  remembered active level → start. That's it. The level is not re-chosen each session
  (changing it is a secondary action in settings); there are no decks or configuration.

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
| GET | `/api/cards?level=&q=&page=` | Browse / search | required | Planned (Phase 2) |
| GET | `/api/quiz?level=` | One multiple-choice question + distractors | required | Planned (Phase 2) |
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
- **Anki-mode** review (JP→EN) via `ts-fsrs`, with **one-step undo**.
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

**Phase 2 — Duolingo mode — ◀ current focus**
- The active build target. A gamified multiple-choice quiz (§8.2): `GET /api/quiz` with
  confusability-scored distractors, instant feedback, and the cached example sentence on
  reveal.
- **UI bar — Duolingo-grade polish, deliberately restrained:** the look-and-feel should
  match Duolingo's quality (clean, satisfying, momentum-driven, mobile-first), but with
  **minimal animation** (snappy and lightweight, not flashy character/transition
  animations) and **zero ads** — the latter a core anti-Duolingo differentiator (§1, §8.2).
- **Level scope & mode picker:** add `UserProfile.activeLevel`; scope both the Anki queue
  and the quiz to it; build the returning-user **mode picker** (Anki / Duolingo) as `/study`.
- **First-run onboarding (§8.5):** level choice → 5-question Duolingo warm-up (non-scheduling)
  → guided tour; add `UserProfile.onboardedAt` to branch first-time vs. returning.
- Resolve whether MC results feed the FSRS scheduler or stay a separate practice mode
  (§8.2, §15). To improve students result, there should be some sinergy between the modes.
  More research is still required.
- Light polish may ride along: browse/search, daily new-card limits, basic stats.

**Phase 3 — Admin audit + on-demand generation — next, after Duolingo**
- **Admin review/audit page** (admin-gated via `UserProfile.role`): inspect each
  AI-generated example sentence and accept or reject it before it surfaces to learners
  (adds a review-status field to `ExampleSentence`; optionally generate several candidates
  per word and keep the best).
- **On-demand `/api/generate`** + study-UI fetch-on-flip for any not-yet-seeded words, with
  the §11.4 guardrails (auth + rate-limit + cache-first + bounded `max_tokens`).

**Phase 4 — Multi-user**
- Widen/remove the email allowlist; real `User` rows; authorization checks scoping all
  reads/writes by `userId`.
- Per-user settings (directions, daily limits, level focus).

**Phase 5 — Further enhancements**
- Audio (TTS) for sentences, furigana rendering, streak/heatmap, sentence
  regeneration/voting, export back to Anki, installable-PWA polish.

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
| 2026-06-03 | **Both modes are scoped to one active JLPT level** (`UserProfile.activeLevel`); **first-run flow** = pick level → 5-question Duolingo warm-up (non-scheduling) → guided tour; **returning users** get an Anki/Duolingo **mode picker**. Refines the earlier "one-tap start." | Studying/quizzing one level at a time keeps scheduling and MC distractors coherent and the queue focused; a *doing-first* warm-up beats a wall of instructions for a new user; the level is a remembered preference so returning entry stays one tap (just pick a mode). `onboardedAt` distinguishes first-time vs. returning. | Author | §2, §6, §8, §8.5 |
| 2026-06-03 | **N1 level chip = imperial purple + gold** (murasaki `#3d1452` + kin `#f0c75e`), not flat grape | In Japan purple is the historical highest-rank colour (禁色); gold is the luxury accent. N2 (`mag-600`) and the old N1 (`grape`) were both pinkish-purple and too close — shifting N1 to a deeper, bluer purple with gold text makes the top level read as "special," and is more culturally "premium" than gold alone (which also clashes with the N4 yellow). Author chose imperial-purple+gold over a gradient or solid gold. | Author | BRAND.md §3/§7 |
| 2026-06-03 | **Public landing page at `/`**; the authenticated study app moves to `/study`. Brand foundation added (tokens + fonts in `globals.css`, reusable `Parrot` component, Pī favicon) per **BRAND.md**, which now states the mobile-first / iPhone-SE (375×667) design target. | A "Sign in" homepage is for logged-out visitors, so `/` can't also be the gated app; signed-in users are redirected `/` → `/study` to preserve one-tap start (§2). Committing the brand as code/tokens lets the landing — and Phase 2's Duolingo UI — build against the real design system. | Author | §8, §8.4 |
| 2026-06-03 | **Re-prioritize roadmap: Duolingo mode is the current focus**; the **admin audit page + on-demand generation move to Phase 3** (right after Duolingo, ahead of multi-user). Duolingo UI bar set to "Duolingo-grade polish but minimal animation and zero ads." | All content is seeded (Phase 1c done), so the next user-facing value is the second study mode. On-demand generation is no longer needed for coverage, so it rides with the admin tooling as a safety net. Minimal-animation/no-ads is the product thesis (§1) — match Duolingo's quality without its spectacle or monetization. | Author | §8.2, §13 |
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
| 2026-06-03 | Two study modes: "Anki mode" (FSRS recall) and "Duolingo mode" (gamified MC) | Serves both serious retention and a low-friction warm-up; MC distractors are a free same-level DB query, so the second mode adds little cost. | Author | §8 |
| 2026-06-03 | Mobile-first, iPhone SE (375×667) baseline; usable on desktop | Primary usage is on phones; desktop treated as an additive breakpoint rather than the design center. | Author | §8.4 |
| 2026-06-03 | Authentication: passwordless email magic link (Auth.js + Resend), single-email allowlist | Stores no reusable password, delegates to the stronger inbox security boundary, and the allowlist contains blast radius. Resend already provisioned. Seeded password rejected (§14.2). | Author | §11.2 |
| 2026-06-03 | Sentence generation: pre-seed via Batch API (N3 first), on-demand only as fallback | Batch API is ≈50% cheaper for the one-time ~8.8k-word fill and seeding has no latency requirement; N3 prioritized per author. On-demand-only rejected as primary (§14.3). | Author | §7 |
| 2026-06-03 | Scheduling algorithm: FSRS (via `ts-fsrs`) | Best-in-class retention/scheduling and what current Anki uses; mature TypeScript library. | Author | §8.1 |
| 2026-06-03 | Launch single-user, but keep the data model multi-user-ready | Fastest path to a usable personal tool; `userId` present from day one means no core migration when multi-user lands. | Author | §6, §11.5 |
| 2026-06-03 | Architecture: single full-stack Next.js service (not a separate API) | One client, the only long job is offloaded to Anthropic's Batch API, and every operation is a DB query or single LLM call — a split would double operational surface for no gained capability. Separate API rejected (§14.1). | Author | §5.1 |
| 2026-06-03 | Source deck: open-anki-jlpt-decks (MIT), committed to `decks/` | Clean, structured, freely licensed JLPT vocabulary; committed (not gitignored) so it is the source of truth for imports. | Author | §4 |
