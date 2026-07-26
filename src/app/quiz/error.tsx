"use client";

// Error boundary for `/quiz` only. See `SessionError` for the shared reasoning.

import { SessionError } from "@/components/session-error";

export default function QuizError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SessionError
      {...props}
      title="Couldn't load the quiz"
      // Phrased around *when* it failed rather than around what Quiz mode writes. This screen
      // is only reachable while the round is being built, before a single question has been
      // answered, so the sentence stays true when Phase 3 gives Quiz its FSRS writes.
      message="That one is on us. Nothing was lost: the round hadn't started yet."
      homeHref="/home"
      homeLabel="Home"
      logLabel="Quiz"
    />
  );
}
