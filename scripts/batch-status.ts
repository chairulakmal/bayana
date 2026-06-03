// Print the current status of an Anthropic batch (one-shot, no polling).
//   npx tsx scripts/batch-status.ts <batchId>
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("usage: batch-status.ts <batchId>");
  const b = await new Anthropic().messages.batches.retrieve(id);
  console.log(`status: ${b.processing_status}`);
  console.log(`counts: ${JSON.stringify(b.request_counts)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
