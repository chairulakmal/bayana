"use client";

// An error boundary that fails *inside* the page instead of replacing it.
//
// **Why this exists rather than another `error.tsx`.** A route-level `error.tsx` replaces the
// whole page render, keeping only the layout above it. On `/grammar/browse` the header (back
// link, level chip, account menu), the heading and the bottom nav are all rendered by the page
// itself, so an `error.tsx` there would take them down with the list — and could not rebuild
// them, because an error boundary must be a Client Component and those elements need the
// database. Before that route moved to a server render (SPEC §9.3), a failed query showed one
// red line inside intact page chrome; this restores that, and it is the same shape `/browse`
// still gets for free from its client-side fetch's error branch.
//
// **Why it catches a *server* error at all.** The failing query lives in a Server Component
// below a `<Suspense>` boundary. React streams that subtree separately and, when it throws,
// surfaces the failure on the client at the nearest error boundary — which is this one, sitting
// closer than the route's own. Nothing about the server/client split has to be reasoned about
// at the call site: put the boundary where the failure should be contained.
//
// **Why it is a class.** React exposes error catching only through `getDerivedStateFromError`
// and `componentDidCatch`. There is no hook equivalent, and this is the one place in the app
// where a class component is not a style choice.

import { Component, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Props = {
  children: ReactNode;
  /** What failed, in the user's terms. Shown as the card's headline. */
  title: string;
  /** One line of reassurance under it. Brand voice (BRAND.md §1): owns the failure. */
  message: string;
};

type State = { error: (Error & { digest?: string }) | null };

export class InlineErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error & { digest?: string }): State {
    return { error };
  }

  componentDidCatch(error: Error & { digest?: string }) {
    // Safe to log: for a server-origin error this object carries Next's *redacted* message
    // plus the digest, never the original stack or the query payload, so it cannot leak
    // anything the client did not already hold. Same reasoning as `app/error.tsx`.
    console.error("Inline error boundary caught an error:", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <InlineErrorCard
        title={this.props.title}
        message={this.props.message}
        digest={error.digest}
        // Clearing the error is only half of a retry; see the card for the other half.
        onReset={() => this.setState({ error: null })}
      />
    );
  }
}

/**
 * The fallback UI. A separate function component purely so it can use hooks — the boundary
 * above cannot, being a class.
 */
function InlineErrorCard({
  title,
  message,
  digest,
  onReset,
}: {
  title: string;
  message: string;
  digest?: string;
  onReset: () => void;
}) {
  const router = useRouter();
  const [pending, startRetry] = useTransition();

  /**
   * Retry = refresh, then reset, both inside one transition.
   *
   * Clearing the boundary's state on its own would re-render the *same* RSC payload, which
   * still carries the failure, so the error would come straight back. `router.refresh()` is
   * what re-runs the server render; pairing it with the reset inside a transition is the
   * documented way to retry a server-origin error, and it keeps the current UI on screen
   * (with `pending` true) instead of flashing a fallback while the refetch is in flight.
   */
  function retry() {
    startRetry(() => {
      router.refresh();
      onReset();
    });
  }

  return (
    // role="alert": this replaces content the user was waiting for, so it is assertive by
    // nature — they asked for a list and there is no list.
    <div
      role="alert"
      className="rounded-[var(--r-lg)] px-4 py-6 text-center"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      aria-busy={pending}
    >
      <p
        className="text-[15px]"
        style={{ fontFamily: "var(--f-display)", fontWeight: 600, color: "var(--bad)" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {message}
      </p>
      <button type="button" onClick={retry} disabled={pending} className="btn btn-ghost mt-4">
        {pending ? "Trying…" : "Try again"}
      </button>
      {/* The join key between a user's report and the stack in Railway's logs. Present only
          for server-origin errors, which is exactly the case this boundary was built for. */}
      {digest && (
        <p className="mt-3 text-[11px]" style={{ color: "var(--ink-faint)" }}>
          Reference: <code>{digest}</code>
        </p>
      )}
    </div>
  );
}
