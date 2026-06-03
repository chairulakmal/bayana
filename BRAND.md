# Bayana — Brand & Design Guide

**ばやな · 毎日ちょっとずつ — spaced-repetition JLPT vocab, with AI-written example
sentences.**

This is the working design reference for Bayana's UI. The visual source of truth is the
interactive guide in `notes/bayana/` (gitignored, personal) — `bayana Brand Guide.html` +
`styles.css` + `brand.js`. This file distills it into something committed and
build-ready, so the Duolingo-mode UI (SPEC §8.2, §13 Phase 2) can be implemented against
real tokens. Where this and the HTML disagree, the HTML wins; update this file to match.

It complements **[SPEC.md](SPEC.md)** (the architecture/engineering doc) — SPEC §8.4 owns
the responsive/mobile-first *rules*; this file owns the *look, feel, and tokens*.

---

## 1. Personality & voice

Bayana is **cheerful, never preachy** — the friend who texts you "頑張って！" at 8am.
Energetic, warm, proudly bite-sized. We celebrate every word and never make you feel
behind.

| Trait | What it means in the UI |
|-------|--------------------------|
| **Playful** | Bright color, springy buttons, a parrot who reacts. Studying feels like a game, not homework. |
| **Encouraging** | Cheer the streak, shrug off the miss. Tone is always "let's go," never "you failed." |
| **Bite-sized** | Ten words, two minutes. Every screen does one clear thing — a lesson fits between train stops. |
| **Bilingual** | Japanese leads, English supports. Rounded type carries both scripts in one friendly voice. |

**Microcopy:** short, kind, lightly bilingual. Pair a Japanese phrase with an English gloss
(`おしい · almost`). Never scold on a wrong answer — flash, acknowledge, move on.

---

## 2. Mascot — Pī (ピー)

A pint-sized tropical parrot, named after the most beloved pet-bird name in Japan. Pī is
the study buddy: cheers your streak, naps when you're away, goes wide-eyed on an N1 word.
Built from soft rounded shapes — a **magenta body**, a **three-feather crest** (yellow /
pink / cream), a **hooked yellow beak**, white eyes, pink cheeks.

The canonical geometry lives in `notes/bayana/bayana-brand/brand.js` (`viewBox="0 0 240
268"`); the favicon at [src/app/icon.svg](src/app/icon.svg) is the rendered "happy" head.

**Expressions** — a small fixed cast. Reuse these; don't invent poses. Each is the same
silhouette with only the **eyes and beak** changing, so the family always reads as one bird.

| Mood | When to show it |
|------|-----------------|
| **Happy** | Default / home |
| **Wow** (sparkle eyes, open beak) | Correct answer / level-up |
| **Wink** | Hint / tip |
| **Sleepy** | Streak at risk / away |

**Do:** keep Pī upright and full-color. **Don't:** rotate, desaturate, recolor, or stretch.

---

## 3. Color

A loud, sugary palette. Four candy brights do the talking — **magenta leads**, **yellow
brings energy**, **pink and cream soften** — over a deep plum **ink** that keeps everything
legible.

### Hero palette
| Token | Hex | Name | Role |
|-------|-----|------|------|
| `--magenta` | `#ff61f8` | Parrot Magenta | Hero identity — big shapes, mascot, key moments |
| `--yellow` | `#ffea6c` | Sunbeam Yellow | Energy & rewards — streaks, highlights, secondary buttons |
| `--pink` | `#ffa6fb` | Bubblegum Pink | Soft support — surfaces, belly, gentle fills |
| `--cream` | `#fffba7` | Custard Cream | Calm support — backgrounds, cards, wings |

### Ramps (100 → 700)
- **Magenta:** `#ffd6ff` `#ffb1ff` `#ff88ff` **`#ff61f8`** `#d128cc` `#a600a3` `#760075`
- **Yellow:** `#fcf4c1` `#eee08f` `#dbc95a` **`#ffea6c`** `#c9b324` `#9a8500` `#6a5900`
- **Pink:** `#ffe2ff` `#ffc6ff` `#f7a7f3` **`#ffa6fb`** `#cd76ca` `#a04e9e` `#702e6f`
- **Cream:** `#f5f4d0` `#e4e2a9` `#cfcc82` **`#fffba7`** `#c6c16d` `#95903e` `#66621d`

### Action & neutrals
| Token | Hex | Use |
|-------|-----|-----|
| `--grape` | `#b717b2` | Primary button fill (white text passes AA) |
| `--grape-edge` | `#7c0079` | Primary button bottom "lip" |
| `--ink` | `#341832` | All body text, pupils |
| `--ink-soft` | `#684e65` | Secondary text |
| `--ink-faint` | `#9a8597` | Disabled / hints |
| `--paper` | `#fcfaf1` | App background |
| `--surface` | `#ffffff` | Cards |
| `--surface-cream` | `#fff7e4` | Inset surfaces (example-sentence box) |
| `--line` | `#efe4e9` | Borders / dividers |

### Functional (system states only — never decoration)
| State | Hex | JP |
|-------|-----|----|
| **Correct** | `--good` `#2fbf71` | 正解 |
| **Almost** | `--yellow` `#ffea6c` | おしい |
| **Try again** | `--bad` `#ff5470` | もう一度 |

### Contrast — the one rule that bites
**Never put white text on bright magenta or yellow** — it fails contrast. Drop to **Grape
(`--grape` / mag-600+)** whenever you need white type on a magenta surface.

| Pairing | Ratio | Use |
|---------|-------|-----|
| White on Grape | AA | Primary buttons |
| Ink on Yellow | 13.5 : 1 | Go anywhere |
| Ink on Magenta | 6.5 : 1 | Use **ink**, not white |
| Ink on Paper | 16 : 1 | All body text |

---

## 4. Typography

| Role | Family | Token | Notes |
|------|--------|-------|-------|
| Display / UI labels | **Fredoka** (600) | `--f-display` | Headings, buttons, chips, stats. Tight tracking (`-0.01em`). |
| Body | **Nunito** (400/700/800) | `--f-body` | Paragraphs, glosses, secondary text. |
| Japanese | **M PLUS Rounded 1c** (500/700/800) | `--f-jp` | All kana/kanji — rounded to match the Latin voice. Fallback `"Hiragino Maru Gothic ProN"`. |

Japanese always uses `--f-jp`, even inline within English. Headings are rounded and
friendly, never thin or condensed.

---

## 5. Iconography

One rounded family, sharing Pī's DNA: **thick, rounded, geometric, single-weight**, drawn
on a **24px grid** with generous corner radii. Ink by default; magenta when an icon is the
star of its moment. Core set (from `brand.js`): `flame` (streak), `star` (XP), `heart`
(lives), `gem` (gems), `check` (correct), `book` (lessons), `bolt` (energy), `trophy`
(league), `sound` (audio).

---

## 6. App icon & favicon

- **App icon (canonical):** Pī's face centered on a brand fill with a ~30px superellipse
  radius. **Magenta tile is primary**; yellow ("light") and a magenta→grape gradient
  ("seasonal") are alternates.
- **Favicon** ([src/app/icon.svg](src/app/icon.svg)): the small-size variant — Pī's head on
  a **yellow** tile (magenta-on-yellow stays legible in a 16px browser tab, where a
  tone-on-tone magenta tile would muddy). Per the guide, **below 24px drop the crest detail
  and use the simplified face** — the favicon already omits the tail and feet.
- **Minimum sizes:** app 64px · UI 40px · favicon 24px.
- **Clear space:** keep a margin equal to the height of Pī's eye on all sides.

---

## 7. Components

Everything is **chunky, rounded, and pressable**. The signature interaction is the
**springy "lip"**: primary buttons carry a solid bottom shadow (`0 5px 0 <edge>`) that
compresses to `0 1px 0` on `:active`, with `translateY(4px)` — it makes the app feel like a
toy. (Note: in **Duolingo mode** this springiness is the *one* animation we keep; SPEC §8.2
calls for minimal motion otherwise, and we respect `prefers-reduced-motion`.)

| Button | Fill | Text | Lip | Use |
|--------|------|------|-----|-----|
| **Primary** | `--grape` | white | `--grape-edge` | Continue / confirm |
| **Secondary** | `--yellow` | ink | `--yel-edge` | Skip / alt |
| **Pop** | `--magenta` | ink | `--mag-500` | High-energy (Check) |
| **Ghost** | white | grape | `--line` (+ inset pink ring) | Low-emphasis ("Maybe later") |

- **JLPT level chips:** difficulty ramps with the palette — easy greens/yellows (N5) up to
  deep grape (N1). Pill-shaped, Fredoka 600.
- **Flashcard:** white surface, `--r-lg` (28px) radius, soft shadow; big kanji (`--f-jp`
  800), magenta reading, ink gloss, example sentence in a `--surface-cream` inset box.
- **MC answer:** correct option lifts with a **green lip**; wrong flashes **coral**
  (`--bad`) then moves on — no scolding.
- **Progress / XP:** rounded track (`--cream-100`), magenta→mag-500 gradient fill.

---

## 8. Design tokens (CSS custom properties)

Drop-in `:root` block matching `notes/bayana/bayana-brand/styles.css`. Use these verbatim
when building the UI so the app and the guide never drift.

```css
:root {
  /* hero palette */
  --magenta:#ff61f8; --pink:#ffa6fb; --yellow:#ffea6c; --cream:#fffba7;

  /* ramps 100→700 */
  --mag-100:#ffd6ff; --mag-200:#ffb1ff; --mag-300:#ff88ff; --mag-400:#ff61f8;
  --mag-500:#d128cc; --mag-600:#a600a3; --mag-700:#760075;
  --pink-100:#ffe2ff; --pink-200:#ffc6ff; --pink-300:#f7a7f3; --pink-400:#ffa6fb;
  --pink-500:#cd76ca; --pink-600:#a04e9e; --pink-700:#702e6f;
  --yel-100:#fcf4c1; --yel-200:#eee08f; --yel-300:#dbc95a; --yel-400:#ffea6c;
  --yel-500:#c9b324; --yel-600:#9a8500; --yel-700:#6a5900;
  --cream-100:#f5f4d0; --cream-200:#e4e2a9; --cream-300:#cfcc82; --cream-400:#fffba7;
  --cream-500:#c6c16d; --cream-600:#95903e; --cream-700:#66621d;

  /* action / neutrals */
  --grape:#b717b2; --grape-edge:#7c0079; --grape-hi:#cf1fc9; --yel-edge:#d9c24a;
  --ink:#341832; --ink-soft:#684e65; --ink-faint:#9a8597;
  --paper:#fcfaf1; --surface:#ffffff; --surface-cream:#fff7e4; --line:#efe4e9;

  /* functional */
  --good:#2fbf71; --good-edge:#1f9457; --bad:#ff5470;

  /* shape & type */
  --r-lg:28px; --r-md:18px; --r-sm:12px;
  --shadow:0 14px 34px -16px rgba(52,24,50,.32);
  --maxw:1120px;
  --f-display:"Fredoka", system-ui, sans-serif;
  --f-body:"Nunito", system-ui, sans-serif;
  --f-jp:"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif;
}
```

Fonts load from Google Fonts: `Fredoka` (400–700), `Nunito` (400–900), `M PLUS Rounded 1c`
(400–800).
