// Generates the PNG app icons the Web App Manifest needs, from the single source
// SVG (src/app/icon.svg — Pī's "happy" face on the brand yellow tile, BRAND.md §6).
//
// Why a script (not hand-exported PNGs): the icon is defined once in SVG, so the
// raster outputs can always be regenerated 1:1 if the artwork changes — no drift
// between the favicon and the home-screen icon. Run with:  node scripts/gen-pwa-icons.mjs
//
// Uses `sharp`, which Next.js already ships as a dependency (image optimization),
// so there's nothing extra to install for a one-off generation.

import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src/app/icon.svg");
const OUT = join(root, "public");
const TILE = "#ffea6c"; // brand Sunbeam Yellow — the tile colour baked into icon.svg

const svg = await readFile(SRC);

// `density` controls the rasterization resolution of the SVG before resize. The SVG
// viewBox is 240px; rendering at a high density first keeps edges crisp when scaled
// up to 512, instead of upscaling a low-res bitmap.
const render = (size) => sharp(svg, { density: 300 }).resize(size, size);

// 1) Standard icons (purpose "any"): the full tile, exactly as the favicon looks.
await render(192).png().toFile(join(OUT, "icon-192.png"));
await render(512).png().toFile(join(OUT, "icon-512.png"));

// 2) Maskable icon (purpose "maskable"): Android applies its own shape mask (circle,
// squircle, …) and may crop ~10% off each edge, so the bird must sit inside a central
// "safe zone". We render Pī at 80% and centre it on a full-bleed yellow square; the
// tile's own rounded corners blend into the identical background, so the result reads
// as one seamless yellow icon with safe padding all round.
const inner = await render(410).png().toBuffer(); // 410/512 ≈ 80%
await sharp({
  create: { width: 512, height: 512, channels: 4, background: TILE },
})
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(join(OUT, "icon-maskable.png"));

console.log("✓ wrote public/icon-192.png, icon-512.png, icon-maskable.png");
