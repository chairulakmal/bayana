"use client";

// Error boundary for `/study` only. All the reasoning for why the four session routes need one,
// and why it does not replace the component's own retry screen, is in `SessionError`.

import { SessionError } from "@/components/session-error";

export default function StudyError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SessionError
      {...props}
      title="Couldn't load your cards"
      // Provably true and the thing a learner actually wants to know: a queue build only
      // reads, so nothing they had already rated can have been lost.
      message="That one is on us. Your progress is safe — building the queue only reads it."
      homeHref="/home"
      homeLabel="Home"
      logLabel="Study"
    />
  );
}
