// Rough USD cost from a Messages API `usage` object, for logging in the seed scripts.
// Rates are estimates — VERIFY against current Anthropic pricing for claude-haiku-4-5.
import type Anthropic from "@anthropic-ai/sdk";

const PER_MTOK = {
  input: 1.0,
  output: 5.0,
  cacheWrite: 1.25, // 1.25× input (5-min cache)
  cacheRead: 0.1, //  0.1× input
};

export function costUSD(u: Anthropic.Messages.Usage): number {
  const m = (n: number | null | undefined) => (n ?? 0) / 1_000_000;
  return (
    m(u.input_tokens) * PER_MTOK.input +
    m(u.output_tokens) * PER_MTOK.output +
    m(u.cache_creation_input_tokens) * PER_MTOK.input * PER_MTOK.cacheWrite +
    m(u.cache_read_input_tokens) * PER_MTOK.input * PER_MTOK.cacheRead
  );
}
