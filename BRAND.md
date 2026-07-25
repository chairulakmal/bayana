# Bayana — Brand & Design Guide

**ばやな · 毎日ちょっとずつ — spaced-repetition JLPT vocabulary and grammar, with
AI-written example sentences.**

This is the source of truth for Bayana's visual language: build every screen against the
tokens and rules here, not against a screenshot or an older comp. It covers personality
and voice, the mascot Pī, color, typography, iconography, the app icon, components, and
the CSS custom properties that implement all of it (§8).

It was distilled from an interactive guide kept locally in `notes/bayana/bayana-brand/`
(gitignored: `bayana Brand Guide.html` + `styles.css` + `brand.js`). That guide is a
historical exploration, useful for anything not yet captured here, but **this file wins**
wherever they disagree, because it is the version the repo and the code can see. Where the
guide describes a gamified product Bayana did not become (XP, lives, gems, leagues), it is
a record of an idea, not a spec; §5 says what the app actually ships.

**The app is light-only.** There is no dark ramp here and none in the code; `globals.css`
declares `color-scheme: light` so a phone in dark mode cannot paint UA-owned chrome (form
controls, scrollbars) in dark styling against these cream surfaces. Whether to design a
dark palette at all is still open (TODO.md).

It complements **[SPEC.md](SPEC.md)** (the architecture/engineering doc): SPEC §8.4 owns
the responsive/mobile-first *rules*, this file owns the *look, feel, and tokens*.

> **Platform focus.** Bayana is a **mobile-first web app** (no native apps). The design
> target is the **phone browser at the iPhone SE baseline — 375 × 667 CSS px**: every
> screen must look right and be fully usable there *first*, with full-width, thumb-reachable
> controls (≥ 44 × 44 px) low in the viewport. Larger phones, tablets, and desktop are
> additive breakpoints, never the design center — desktop stays usable but caps width and
> centers rather than stretching. Design and review at 375 px wide before anything else.
> (Engineering rules and rationale: SPEC §8.4.)

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

The canonical geometry is [src/components/parrot.tsx](src/components/parrot.tsx)
(`viewBox="0 0 240 268"`), the committed, typed component every screen renders. It was
ported from `brand.js` in the local guide, but that file is gitignored, so it cannot be the
source of truth for something the app depends on. The favicon at
[src/app/icon.svg](src/app/icon.svg) is the same geometry as a static "happy" head.

**Expressions** — a small fixed cast. Reuse these; don't invent poses. Each is the same
silhouette with only the **eyes and beak** changing, so the family always reads as one bird.
Four expressions cover more moments than there are expressions, so the mapping below is the
full list of sanctioned uses, not just the obvious ones.

| Mood | When to show it |
|------|-----------------|
| **Happy** | Default / home / a finished session with work still waiting |
| **Wow** (sparkle eyes, open beak) | Celebration: all caught up, a finished quiz round, a day with study already done |
| **Wink** | Hint / tip / closing invitation |
| **Sleepy** | Low-energy states: loading, an empty queue, a failed load |

**Sleepy carries the error state on purpose.** There is no sad or alarmed Pī, and there will
not be one: a mascot that looks upset when a fetch fails makes a technical failure feel like
the learner's fault, which is exactly what §1 forbids. Sleepy reads as "nothing happening
here," which is true of loading, empty, and broken alike, and the copy beside it carries the
actual distinction.

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
| `--ink-faint` | `#7d6a7a` | Tertiary text: captions, stat labels, furigana, disabled |
| `--paper` | `#fcfaf1` | App background |
| `--surface` | `#ffffff` | Cards |
| `--surface-cream` | `#fff7e4` | Inset surfaces (example-sentence box) |
| `--line` | `#efe4e9` | Borders / dividers |

### N1 "premium" accent
`--murasaki` `#3d1452` (imperial purple — historically Japan's highest-rank colour, the
*forbidden colour* 禁色 reserved for the elite) + `--gold` `#f0c75e` (kin). Reserved for the
**N1 level chip** so the top level feels earned. Chosen deliberately bluer/deeper than the
magenta ramp so N1 reads as *special*, not merely "a darker N2." Purple + gold is the
classic imperial pairing. Not for general decoration.

### Functional (system states only — never decoration)
| State | Hex | JP |
|-------|-----|----|
| **Correct** | `--good` `#2fbf71` | 正解 |
| **Almost** | `--yellow` `#ffea6c` | おしい |
| **Try again** | `--bad` `#ff5470` | もう一度 |

### Contrast

**The rule that bites: never put white text on bright magenta or yellow.** Drop to **Grape
(`--grape` / mag-600+)** whenever you need white type on a magenta surface.

Measured ratios, all against `--paper` unless stated. Every pairing below clears WCAG AA
(4.5 : 1 for normal text):

| Pairing | Ratio | Use |
|---------|-------|-----|
| Ink on Paper | 15.2 : 1 | All body text |
| Ink on Yellow | 13.0 : 1 | Go anywhere |
| Gold on Murasaki | 9.2 : 1 | The N1 chip |
| Ink-soft on Paper | 7.0 : 1 | Secondary text |
| Ink on Magenta | 6.3 : 1 | Use **ink**, not white |
| White on Grape | 5.6 : 1 | Primary buttons |
| Ink-faint on Paper | 4.8 : 1 | Tertiary text; the floor, nothing quieter than this |

**The text ramp is three steps and stops.** `--ink` → `--ink-soft` → `--ink-faint`, and
`--ink-faint` sits deliberately just above the AA floor: it is the quietest the app is
allowed to get. `--ink-faint` was `#9a8597` until 2026-07-26, which measured 3.25 : 1 and
failed AA. It was described here as a disabled/hint value but was doing real work across
~60 call sites (furigana readings, stat labels, tile subtitles), so it was darkened rather
than renamed.

**Two ways this palette gets quietly broken.** Both were live bugs, both are now rules:

- **Never composite a contrast-passing pair with `opacity`.** A ratio is a property of the
  final pixels, not of the tokens. `--ink-faint` at `opacity: .65` measures ~2 : 1; a
  `.chip-n5` or `.chip-n2` (white text) at `opacity: .55` measures ~3.2 : 1. If an element
  needs to recede, reach for a quieter token or a smaller size, not a lower alpha. Opacity
  is fine for *transient* states (a pending row, a disabled control) where nothing must be
  read.
- **`outline` belongs to the browser's focus ring; selection is `box-shadow`.** Drawing a
  selected state with `outline` forces `outline: none` onto every unselected sibling, which
  silently removes their focus indicator. See §7.

---

## 4. Typography

| Role | Family | Token | Weights loaded | Notes |
|------|--------|-------|----------------|-------|
| Display / UI labels | **Fredoka** | `--f-display` | 400, 500, 600, 700 | Headings, buttons, chips, stats. Tight tracking (`-0.01em`). **Fredoka stops at 700**; asking for 800 gets a synthesised faux-bold. |
| Body | **Nunito** | `--f-body` | 400, 600, 700 | Paragraphs, glosses, secondary text. |
| Japanese | **M PLUS Rounded 1c** | `--f-jp` | 400, 700, 800 | All kana/kanji, rounded to match the Latin voice. Fallback `"Hiragino Maru Gothic ProN"`. |

The weight lists are exactly what the app renders, and they are the request in
`globals.css`. Keep them in sync in both directions: a weight used but not loaded is
faux-bolded by the browser, and a weight loaded but not used is dead payload.

**Japanese always uses `--f-jp`, even inline within English.** This is the rule most often
broken, because breaking it looks *almost* right: **neither Fredoka nor Nunito contains a
single CJK glyph**, so Japanese set in them does not fail visibly. It silently falls
through the font stack to `system-ui`, and the text renders in the reader's OS font next to
brand-face Latin. Any string mixing scripts has to mark up its Japanese run:

```jsx
<span lang="ja" className="jp">問題１</span> score: {readingScore} / {readingTotal}
```

That is also why a component prop holding mixed-script copy should be a `ReactNode` rather
than a `string`: a bare string can only carry one face. Where a label is conceptually one
value with two scripts (the JLPT level names, the exam prompts), store the halves
separately rather than concatenating them.

**Adding a Japanese weight is expensive; adding a Latin one is not.** Google splits CJK
into ~126 `unicode-range` chunks, so each M PLUS weight costs ~126 `@font-face` rules and
roughly 30 KB gzipped *in the stylesheet itself*, before any glyph is painted. Trimming
three unused weights took the served CSS from 479 KB / 541 rules to 359 KB / 405 rules.
Justify a fourth JP weight before adding it.

Headings are rounded and friendly, never thin or condensed.

---

## 5. Iconography

One rounded family, sharing Pī's DNA: **rounded, geometric, single-weight**, drawn on a
**24px grid** with rounded caps and joins. `--ink-faint` at rest, `--grape` when active.

**The shipped set is the three `BottomNav` tabs** (`home`, `stats`, `browse`), as inline
stroked SVG in [src/components/bottom-nav.tsx](src/components/bottom-nav.tsx). Draw any new
icon to match those: 26px rendered on a 24px viewBox, `strokeWidth` 2 to 2.5, `round` caps
and joins, filled only to mark the active tab.

Everything else in the UI that reads as an icon is an **emoji**, deliberately: the study
modes (🎴 ⚡ 📝 ✏️), the pace note (🌱), the demo notice (👋). Emoji ship at zero cost, carry
the playful register §1 asks for, and none of them are load-bearing: every one sits beside
a text label and is marked `aria-hidden`. Don't replace them with drawn icons without a
reason, and don't let one carry meaning on its own.

> **Not built:** the local guide's `brand.js` also defines `flame`, `star`, `heart`, `gem`,
> `bolt`, and `trophy`. Those belong to a gamified product with streaks, XP, lives, and
> leagues, none of which Bayana has, and none of which are on the roadmap (SPEC §13).
> Treat that set as a historical exploration, not a spec.

---

## 6. App icon & favicon

**One artwork, one tile: Pī's face on `--yellow`, ~22% corner radius.**
[src/app/icon.svg](src/app/icon.svg) is the single source; `scripts/gen-pwa-icons.mjs`
rasterises it to `public/icon-{192,512,maskable}.png`, so the favicon, the installed app
icon, and the Android adaptive icon are the same file at different sizes and never drift.

- **Yellow, not magenta.** The guide called a magenta tile canonical with yellow as an
  alternate; every shipped icon is yellow, and that is the correct call rather than an
  oversight. Pī's body is magenta, so a magenta tile is tone-on-tone and muddies at 16px,
  while magenta-on-yellow is the brand's strongest pairing and stays legible in a browser
  tab. The maskable icon follows the same reasoning (SPEC §14 / DECISIONS 2026-06-04).
- **Simplified face, not the full bird.** The icon drops Pī's tail and feet so the head and
  body fill the tile. The crest is kept, but note its centre feather is yellow-on-yellow and
  reads as negative space; at favicon size Pī has two visible feathers, by design.
- **Minimum sizes:** app 64px · UI 40px · favicon 24px.
- **Clear space:** keep a margin equal to the height of Pī's eye on all sides.

---

## 7. Components

Everything is **chunky, rounded, and pressable**. The signature interaction is the
**springy "lip"**: primary buttons carry a solid bottom shadow (`0 5px 0 <edge>`) that
compresses to `0 1px 0` on `:active`, with `translateY(4px)` — it makes the app feel like a
toy. (Note: in **Quiz mode** this springiness is the *one* animation we keep; SPEC §8.2
calls for minimal motion otherwise, and we respect `prefers-reduced-motion`.)

| Button | Class | Fill | Text | Lip | Use |
|--------|-------|------|------|-----|-----|
| **Primary** | `.btn-primary` | `--grape` | white | `--grape-edge` | Continue / confirm |
| **Pop** | `.btn-pop` | `--magenta` | ink | `--mag-500` | High-energy (Check) |
| **Ghost** | `.btn-ghost` | white | grape | `--line` (+ inset pink ring) | Low-emphasis ("Maybe later") |

A yellow **Secondary** button was specified here for a long time and never built; the
yellow-plus-`--yel-edge` pairing lives on instead as `.rate-hard`, one of the four Flashcard
rating buttons below. Ghost is the app's actual secondary, and every paired CTA in the
product is Primary + Ghost. Add `.btn-secondary` only when a screen genuinely needs a third
weight, not to satisfy this table.

- **JLPT level chips:** difficulty ramps with the palette — easy greens/yellows (N5) up
  through deep magenta/plum. **N1 is the exception: imperial purple + gold** (murasaki +
  kin, §3) — the "endgame" chip, set apart from the magenta ramp on purpose. Pill-shaped,
  Fredoka 600. **Always full opacity**: the chip is its control's label, and two of the five
  (N5, N2) use white text that fails contrast the moment it is faded (§3). Mark the selected
  one with a ring, never by dimming the rest. Ring colour comes from
  [`RING_COLOR`](src/components/level-chip.ts), not `currentColor`, for the same reason.
- **Flashcard:** white surface, `--r-lg` (28px) radius, soft shadow; big kanji (`--f-jp`
  800), magenta reading, ink gloss, example sentence in a `--surface-cream` inset box.
- **MC answer:** correct option lifts with a **green lip**; wrong flashes **coral**
  (`--bad`) then moves on — no scolding.
- **Progress:** rounded track (`--cream-100`), magenta→mag-500 gradient fill.
- **Session chrome** (the `/study` and `/quiz` header pills): quiet, but never below the
  floors. Recede with size and a quieter token, never with container opacity: a 0.65 on the
  row took Home and Undo to ~2 : 1 (§3).

### Focus and hit targets

Two rules that apply to every interactive element, in addition to the ≥ 44 × 44 px floor in
the platform note at the top of this file:

- **Every control shows a visible keyboard focus indicator.** The browser's default ring is
  fine and is the default answer: leave `outline` alone and it works. If a control must
  suppress it for visual reasons, it takes `.focus-ring` (a `--mag-300` halo), and it takes
  it in the same commit. `outline: none` without a replacement is a defect, including the
  implicit one you create by using `outline` to draw a selected state.
- **A control may be smaller than 44px, but its hit target may not.** `.tap-44` expands a
  small control's tap area vertically without changing what is painted, which is how the
  session-header pills and the level chips stay visually quiet while staying tappable.
  Expansion is vertical only, so adjacent chips in a row can never steal each other's taps;
  give chip rows enough horizontal padding to clear 44px on their own.

---

## 8. Design tokens (CSS custom properties)

This block mirrors [src/app/globals.css](src/app/globals.css), which is the copy the code
actually reads. If the two ever disagree, `globals.css` is what ships and this section is
the bug. (It used to name the local guide's `styles.css` as its match target, which put the
canonical tokens in a gitignored file.) Use these verbatim when building the UI.

```css
:root {
  color-scheme: light;              /* light-only app; see the note at the top */

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

  /* N1 "premium" accent (§3) */
  --murasaki:#3d1452; --gold:#f0c75e;

  /* action / neutrals */
  --grape:#b717b2; --grape-edge:#7c0079; --grape-hi:#cf1fc9; --yel-edge:#d9c24a;
  --ink:#341832; --ink-soft:#684e65; --ink-faint:#7d6a7a;
  --paper:#fcfaf1; --surface:#ffffff; --surface-cream:#fff7e4; --line:#efe4e9;

  /* functional */
  --good:#2fbf71; --good-edge:#1f9457; --bad:#ff5470;

  /* shape & type */
  --r-lg:28px; --r-md:18px; --r-sm:12px;
  --shadow:0 14px 34px -16px rgba(52,24,50,.32);
  --f-display:"Fredoka", system-ui, sans-serif;
  --f-body:"Nunito", system-ui, sans-serif;
  --f-jp:"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif;
}
```

`globals.css` also defines the `.btn*` / `.rate*` / `.opt*` / `.chip*` component classes and
the `.focus-ring` / `.tap-44` accessibility utilities (§7); the block above is only the
token layer.

**No `--maxw`.** This section used to declare `--maxw:1120px`, which no stylesheet defined
and nothing consumed. Width capping is done with Tailwind: `max-w-md` for app screens (the
mobile-first column) and `max-w-5xl` for the marketing page.

Fonts load from Google Fonts via an `@import` at the top of `globals.css`: `Fredoka`
(400/500/600/700), `Nunito` (400/600/700), `M PLUS Rounded 1c` (400/700/800). Those are the
weights §4 lists, and nothing else. Self-hosting them with `next/font` (fewer network hops,
no third-party origins in the CSP) is deferred, not rejected: TODO.md and SPEC §14.12.
