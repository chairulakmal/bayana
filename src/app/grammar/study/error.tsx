"use client";

// Error boundary for `/grammar/study` only. See `SessionError` for the shared reasoning.
//
// Deliberately at this segment and not at `app/grammar/`, which would also swallow failures on
// the grammar hub and its browse page, two screens with nothing to do with a study session and
// no reason to offer "Try again" on a queue build.

import { SessionError } from "@/components/session-error";

export default function GrammarStudyError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SessionError
      {...props}
      title="Couldn't load your grammar cards"
      message="That one is on us. Your progress is safe — building the queue only reads it."
      // The grammar hub, not `/home`: it is where this session was started from and where the
      // level picker and the due count live, so it is the screen that can resume this.
      homeHref="/grammar"
      homeLabel="Back"
      logLabel="Grammar study"
    />
  );
}
