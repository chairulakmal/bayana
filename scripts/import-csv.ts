// Imports JLPT vocabulary from decks/*.csv into the `Word` table.
//
// Usage:
//   npx tsx scripts/import-csv.ts        # import all levels (N5–N1)
//   npx tsx scripts/import-csv.ts n3     # import a single level
//
// Idempotent: rows are upserted by `guid` (the stable Anki id), so re-running
// updates existing words rather than duplicating them (SPEC §4).
//
// `dotenv/config` must come first so DATABASE_URL is in the environment before
// the Prisma client module is evaluated.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import { Level } from "@/generated/prisma/enums";

const DECKS_DIR = join(process.cwd(), "decks");

// The CSV *filename* is authoritative for level. The `tags` column carries
// overlapping/legacy JLPT levels (an N5 word may be tagged JLPT_3), so we don't
// trust it for the level (SPEC §4).
const FILE_LEVEL: Record<string, Level> = {
  "n5.csv": Level.N5,
  "n4.csv": Level.N4,
  "n3.csv": Level.N3,
  "n2.csv": Level.N2,
  "n1.csv": Level.N1,
};

// One parsed CSV row. The header row (expression,reading,meaning,tags,guid)
// drives these keys.
type CsvRow = {
  expression: string;
  reading: string;
  meaning: string;
  tags: string;
  guid: string;
};

/** Parse a deck CSV into rows. csv-parse handles quoted fields containing commas
 *  (e.g. "to meet, to see"), which a naive split on `,` would mangle. */
function readDeck(file: string): CsvRow[] {
  const content = readFileSync(join(DECKS_DIR, file), "utf8");
  return parse(content, {
    columns: true, // first row is the header → each record is an object
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
}

/** Split the space-separated tag string into a clean array, dropping empties and
 *  the `MediaMissing` noise tag (irrelevant to this product — SPEC §4). */
function parseTags(raw: string): string[] {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((tag) => tag !== "MediaMissing");
}

/** Upsert every row of one deck file, keyed by guid. Returns the row count.
 *  Work is done in bounded-concurrency batches so we don't flood the pool. */
async function importFile(file: string, level: Level): Promise<number> {
  // Skip rows missing the essentials (defensive against stray/blank lines).
  const rows = readDeck(file).filter((r) => r.guid && r.expression);
  const BATCH = 100;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await Promise.all(
      batch.map((r) => {
        const fields = {
          expression: r.expression,
          reading: r.reading,
          meaning: r.meaning,
          level,
          tags: parseTags(r.tags),
        };
        return db.word.upsert({
          where: { guid: r.guid },
          create: { guid: r.guid, ...fields },
          update: fields, // re-import overwrites mutable fields, keeps the same row
        });
      }),
    );
  }
  return rows.length;
}

async function main() {
  // Optional CLI arg picks a single level: "n3", "N3", or "n3.csv".
  const arg = process.argv[2]?.toLowerCase().replace(/\.csv$/, "");
  const files = arg ? [`${arg}.csv`] : Object.keys(FILE_LEVEL);

  for (const file of files) {
    const level = FILE_LEVEL[file];
    if (!level) {
      throw new Error(
        `Unknown deck file "${file}". Expected one of: ${Object.keys(FILE_LEVEL).join(", ")}`,
      );
    }
    const count = await importFile(file, level);
    console.log(`Imported ${count} words from ${file} (${level}).`);
  }

  const total = await db.word.count();
  console.log(`Done. Word table now holds ${total} rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
