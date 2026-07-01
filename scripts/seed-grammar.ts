// Seed grammar points from decks/grammar-*.md into the GrammarPoint table.
//
// Each markdown file follows a strict structure produced by grammar-n3.md:
//   ## Lesson N – Title
//   ### pattern reading `Level Lesson N: pos/total`
//   Meaning 1, Meaning 2, ...
//   **例文:** Japanese sentence
//   English translation
//
// Run: npx tsx scripts/seed-grammar.ts
// Idempotent: rows are upserted on (level, lesson, position).

import "dotenv/config"; // loads .env before db.ts reads DATABASE_URL
import * as fs from "fs";
import * as path from "path";
import { db } from "../src/lib/db";

const DECKS_DIR = path.join(__dirname, "..", "decks");

/** Parse a grammar markdown file into structured rows. */
function parseGrammarFile(
  filePath: string,
  level: string,
): Array<{
  level: string;
  lesson: number;
  lessonTitle: string;
  position: number;
  pattern: string;
  reading: string;
  meanings: string[];
  exampleJp: string;
  exampleEn: string;
}> {
  const text = fs.readFileSync(filePath, "utf-8");
  const lines = text.split("\n");
  const results = [];

  // Track current lesson as we scan through lines.
  let currentLesson = 0;
  let currentLessonTitle = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ## Lesson N – Title  →  extract lesson number and title
    const lessonMatch = line.match(/^## Lesson (\d+)\s*[–-]\s*(.+)$/);
    if (lessonMatch) {
      currentLesson = parseInt(lessonMatch[1], 10);
      currentLessonTitle = lessonMatch[2].trim();
      continue;
    }

    // ### pattern reading `Level Lesson N: pos/total`
    // The backtick tag tells us the level/lesson/position; pattern and reading
    // are the tokens before it. pattern may include kanji+kana or be the same
    // as reading. We capture everything before the backtick as the raw head.
    const headingMatch = line.match(/^### (.+?)\s+`([^`]+)`\s*$/);
    if (!headingMatch) continue;

    const rawHead = headingMatch[1].trim();
    const tag = headingMatch[2]; // e.g. "N3 Lesson 1: 1/23"

    // Parse the tag: "N3 Lesson 1: 1/23"
    const tagMatch = tag.match(/^(\w+) Lesson (\d+): (\d+)\/\d+$/);
    if (!tagMatch) continue;
    const tagLevel = tagMatch[1];  // "N3"
    const lesson = parseInt(tagMatch[2], 10);
    const position = parseInt(tagMatch[3], 10);

    // pattern vs reading: the heading sometimes contains both separated by a
    // space, e.g. "中 ちゅう" or "の間に のあいだに". If there are two tokens
    // and the second looks like kana-heavy, split them; otherwise they're the
    // same.
    const parts = rawHead.split(/\s+/);
    let pattern: string;
    let reading: string;
    if (parts.length >= 2) {
      // Heuristic: if the last part contains only kana/hiragana characters
      // (possibly mixed), treat it as the reading; otherwise treat the whole
      // thing as both pattern and reading.
      const lastPart = parts[parts.length - 1];
      const kanaOnly = /^[぀-ゟ゠-ヿ〜～・ー\s()（）]+$/.test(lastPart);
      if (kanaOnly) {
        reading = lastPart;
        pattern = parts.slice(0, -1).join(" ");
      } else {
        pattern = rawHead;
        reading = rawHead;
      }
    } else {
      pattern = rawHead;
      reading = rawHead;
    }

    // Next non-empty line after the heading is the meanings line.
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    if (j >= lines.length) continue;
    const meaningsLine = lines[j].trim();
    const meanings = meaningsLine
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    // Find **例文:** line
    let k = j + 1;
    while (k < lines.length && !lines[k].startsWith("**例文:**")) k++;
    if (k >= lines.length) continue;
    const exampleJp = lines[k].replace("**例文:**", "").trim();

    // Next non-empty line is the English translation.
    let l = k + 1;
    while (l < lines.length && lines[l].trim() === "") l++;
    if (l >= lines.length) continue;
    const exampleEn = lines[l].trim();

    results.push({
      level: tagLevel,
      lesson,
      lessonTitle: currentLessonTitle,
      position,
      pattern,
      reading,
      meanings,
      exampleJp,
      exampleEn,
    });
  }

  return results;
}

async function main() {
  // Find all grammar-*.md files in the decks directory.
  const files = fs
    .readdirSync(DECKS_DIR)
    .filter((f) => f.startsWith("grammar-") && f.endsWith(".md"))
    .map((f) => path.join(DECKS_DIR, f));

  if (files.length === 0) {
    console.log("No grammar-*.md files found in decks/");
    return;
  }

  let total = 0;
  for (const filePath of files) {
    const fileName = path.basename(filePath);
    // Infer level from filename: grammar-n3.md → "N3"
    const levelMatch = fileName.match(/grammar-([a-z]\d)\.md/i);
    const level = levelMatch ? levelMatch[1].toUpperCase() : "UNKNOWN";

    const rows = parseGrammarFile(filePath, level);
    console.log(`${fileName}: parsed ${rows.length} grammar points (${level})`);

    for (const row of rows) {
      await db.grammarPoint.upsert({
        where: {
          level_lesson_position: {
            level: row.level,
            lesson: row.lesson,
            position: row.position,
          },
        },
        create: row,
        update: {
          lessonTitle: row.lessonTitle,
          pattern: row.pattern,
          reading: row.reading,
          meanings: row.meanings,
          exampleJp: row.exampleJp,
          exampleEn: row.exampleEn,
        },
      });
    }

    // Prune stale rows: content gets renumbered/resized across edits (a lesson's
    // item count changes, points move to a different lesson), which leaves orphan
    // rows behind under the old (level, lesson, position) key — upsert alone can't
    // catch these since they're no longer produced by the parser at all. Deleting
    // them keeps the DB an exact mirror of the file. This cascades to GrammarProgress
    // (schema: onDelete: Cascade), so any in-progress FSRS state on an orphaned point
    // is lost — acceptable for this single-user learning app, but worth knowing.
    const deleted = await db.grammarPoint.deleteMany({
      where: {
        level,
        NOT: { OR: rows.map((r) => ({ lesson: r.lesson, position: r.position })) },
      },
    });
    if (deleted.count > 0) {
      console.log(`${fileName}: pruned ${deleted.count} stale row(s) no longer in the file`);
    }

    total += rows.length;
  }

  console.log(`\nDone. ${total} grammar points seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
