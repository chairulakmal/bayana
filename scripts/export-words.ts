// Export all Words + their first ExampleSentence to backups/words-<timestamp>.json.
//
// Usage:
//   npx tsx scripts/export-words.ts
//
// Output shape matches the Word interface used by the client (id, guid, expression,
// reading, meaning, level, tags, exampleSentence). Words with no sentence yet will
// have exampleSentence: null. Each run writes a timestamped file so older exports are
// not overwritten.
import "dotenv/config";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";

async function main() {
  console.log("Querying all words + sentences…");

  const words = await db.word.findMany({
    orderBy: [{ level: "asc" }, { expression: "asc" }],
    include: {
      // Take only the first sentence per word (words are seeded with one sentence each).
      sentences: { take: 1 },
    },
  });

  console.log(`Found ${words.length} words.`);

  const exported = words.map((w) => {
    const sentence = w.sentences[0] ?? null;
    return {
      id: w.id,
      guid: w.guid,
      expression: w.expression,
      reading: w.reading,
      meaning: w.meaning,
      level: w.level,
      tags: w.tags,
      exampleSentence: sentence
        ? {
          japanese: sentence.japanese,
          reading: sentence.reading,
          english: sentence.english,
        }
        : null,
    };
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = path.join(process.cwd(), "backups", `words-${timestamp}.json`);

  fs.writeFileSync(outPath, JSON.stringify(exported, null, 2), "utf-8");
  console.log(`Exported ${exported.length} words → ${outPath}`);

  // Summary by level.
  const byLevel = Object.groupBy(exported, (w) => w.level);
  for (const [level, ws] of Object.entries(byLevel).sort()) {
    const withSentence = (ws ?? []).filter((w) => w.exampleSentence !== null).length;
    console.log(`  ${level}: ${ws?.length} words, ${withSentence} with sentence`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
