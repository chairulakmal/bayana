// Collect a finished Anthropic Batch and store the generated sentences.
//
// Usage:
//   npx tsx scripts/collect-batch.ts <batchId>
//
// Polls until the batch has ended, then streams results: each succeeded result is
// validated and upserted as an ExampleSentence (source = BATCH); errored/malformed are
// skipped and counted. Re-runnable (already-cached words are simply overwritten).
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { parseAndValidate, textFromMessage, upsertSentence } from "@/lib/generate";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const batchId = process.argv[2];
  if (!batchId) throw new Error("usage: collect-batch.ts <batchId>");
  const client = new Anthropic();

  // Poll until processing ends (succeeded/errored/canceled/expired for every request).
  let batch = await client.messages.batches.retrieve(batchId);
  while (batch.processing_status !== "ended") {
    console.log(
      `status=${batch.processing_status} counts=${JSON.stringify(batch.request_counts)} — waiting…`,
    );
    await sleep(15_000);
    batch = await client.messages.batches.retrieve(batchId);
  }

  let stored = 0;
  let malformed = 0;
  let failed = 0;
  for await (const res of await client.messages.batches.results(batchId)) {
    if (res.result.type !== "succeeded") {
      failed++;
      continue;
    }
    const data = parseAndValidate(textFromMessage(res.result.message));
    if (!data) {
      malformed++;
      continue;
    }
    await upsertSentence(res.custom_id, data, "BATCH");
    stored++;
  }

  console.log(`Done: stored=${stored}, malformed=${malformed}, failed=${failed}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
