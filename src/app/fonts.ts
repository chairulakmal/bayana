/**
 * Brand web fonts, downloaded at build time and served from our own origin.
 *
 * This module is the single place the three brand faces (BRAND.md §4) are declared.
 * `next/font/google` fetches each face from Google during `next build`, writes the
 * `.woff2` files into `.next/static/media`, and inlines the generated `@font-face`
 * rules into the page CSS. Nothing is requested from Google at runtime.
 *
 * Why this replaced the `@import` that used to sit at the top of `globals.css`
 * (rationale in SPEC §14.12): that `@import` put the fonts on a four-step serial
 * chain: HTML → `globals.css` → `fonts.googleapis.com` stylesheet → `fonts.gstatic.com`
 * files, because the browser could not even learn the fonts existed until our CSS had
 * downloaded and parsed. Self-hosting collapses that to HTML → CSS (rules already
 * present) → same-origin file, removing two dependent round trips and two third-party
 * connection setups, and letting the CSP drop both Google hosts.
 *
 * Each face exports a `.variable` class name that defines one CSS custom property.
 * `layout.tsx` puts all three on `<html>`; `globals.css` then maps the brand tokens
 * (`--f-display`, `--f-body`, `--f-jp`) onto them. The indirection is deliberate: it keeps
 * the ~200 call sites naming brand roles rather than font families, so replacing a face is
 * a single edit here.
 *
 * One thing this migration does NOT currently buy, contrary to what next/font's docs
 * suggest: `adjustFontFallback` (on by default) is meant to emit a metric-matched
 * `local("Arial")` fallback face with `size-adjust` / `ascent-override`, which would cut
 * the layout shift when a webfont swaps in. Verified against a real 16.2.7 build: the
 * Turbopack implementation of next/font emits no such face (and does not hash family
 * names either, unlike the webpack code path). The option is left at its default so the
 * benefit appears for free if Turbopack gains it; just do not count on it today.
 */
import { Fredoka, M_PLUS_Rounded_1c, Nunito } from "next/font/google";

/**
 * Display face: headings, buttons, chips, stat labels (`--f-display`).
 *
 * Passing no `weight` selects Fredoka's *variable* font, a single file whose weight axis
 * spans 300–700 continuously. That is strictly better than listing 400/500/600/700: four
 * static instances would be four files and four downloads, where the variable font is one
 * file covering the same range (and anything between). It also means the weight list no
 * longer has to be kept in sync with what the app renders; any value in range just works.
 *
 * Fredoka also has a `wdth` (width) axis. next/font omits every non-weight axis unless it
 * is named in `axes`, so we do not pay for width data the design never varies.
 */
export const fredoka = Fredoka({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fredoka",
  fallback: ["system-ui", "sans-serif"],
});

/**
 * Body face: paragraphs, glosses, secondary text (`--f-body`).
 *
 * Variable as well (weight axis 200–1000), for the same reason as Fredoka: one file
 * instead of the three static instances the app used to request.
 */
export const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
  fallback: ["system-ui", "sans-serif"],
});

/**
 * Japanese face: all kana and kanji (`--f-jp`).
 *
 * Two deliberate departures from the Latin faces above:
 *
 * 1. `weight: ["400", "700"]`. M PLUS Rounded 1c has no variable version, so each weight
 *    is a separate set of files. Japanese is chunked by Google into ~126 `unicode-range`
 *    slices *per weight*, which is why the weight list here is worth guarding (BRAND.md
 *    §4). 400 is what `.jp` text inherits when nothing sets a weight; 700 is the emphasis
 *    used by headwords and prompts.
 *
 * 2. `preload: false`, which is load-bearing. next/font emits a `<link rel="preload">`
 *    for every file belonging to a declared subset, and preloading ~126 Japanese chunks
 *    on every page would be far worse than the on-demand fetching it replaced, since the
 *    browser would eagerly download the entire CJK range to paint a handful of glyphs.
 *    With preload off, all the chunks are still self-hosted and their `@font-face` rules
 *    still inlined; the browser simply picks the one or two chunks a page actually needs,
 *    via `unicode-range`, from our origin.
 *
 * Note that `subsets` is intentionally absent. next/font never sends a `subset` parameter
 * to Google (it downloads every face in the returned stylesheet regardless), so the
 * option only ever selects what to *preload*, and it is neither required nor validated
 * when preloading is off. This matters here because next/font's metadata for this family
 * does not list `japanese` as a subset at all; naming it would be an error, and omitting
 * it costs nothing.
 */
export const mPlusRounded1c = M_PLUS_Rounded_1c({
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-m-plus-rounded",
  fallback: ["Hiragino Maru Gothic ProN", "sans-serif"],
});

/** Every brand face's variable class, ready to spread onto `<html>`. */
export const fontVariables = [
  fredoka.variable,
  nunito.variable,
  mPlusRounded1c.variable,
].join(" ");
