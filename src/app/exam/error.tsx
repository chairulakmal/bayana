"use client";

// Error boundary for `/exam` only. See `SessionError` for the shared reasoning.

import { SessionError } from "@/components/session-error";

export default function ExamError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SessionError
      {...props}
      title="Couldn't load the exam"
      // Exam is a pure benchmark and stays one, FSRS coupling being a *permanent* non-goal for
      // this mode (SPEC §8.6), so unlike the Quiz copy this may safely promise it schedules
      // nothing, and the reassurance is the more useful for being concrete.
      message="That one is on us. Nothing was scheduled: Exam mode never touches your reviews."
      homeHref="/home"
      homeLabel="Home"
      logLabel="Exam"
    />
  );
}
