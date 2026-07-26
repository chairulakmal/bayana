// /privacy — the privacy policy.
//
// Public and static (no auth, no per-user data), so it prerenders. It is allowlisted in
// `proxy.ts` as an exact path, not a prefix, following the `/api/demo/login` precedent
// (SPEC §11.8): a prefix would silently make any future `/privacy/*` route public too.
//
// **The claims here are load-bearing and several of them go false if the app changes.** Two
// in particular: "no analytics, no trackers" is only true while the CSP names no external
// origin (SPEC §11.3), and "nothing you write is sent to an AI model" is only true while
// sentence generation remains a seeding pipeline over deck words (SPEC §11.4). Both are
// flagged in TODO.md against the work that would break them. If either changes, this page
// changes in the same commit.

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata = {
  title: "Privacy",
  description: "What Bayana stores, who else can see it, and how long it is kept.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="27 July 2026"
      intro={
        <>
          Bayana is a small Japanese study app built by one person. It collects as little as
          it can get away with, and this page lists all of it.
        </>
      }
    >
      <LegalSection heading="What is stored">
        <p>
          <strong style={{ color: "var(--ink)" }}>Your email address</strong>, but only if you
          sign in with one. Bayana has no passwords: you type an address, it sends a one-time
          link, and clicking it signs you in. The address is kept so it can recognise you next
          time. The link itself is stored only as a hash, and it stops working once used or
          expired.
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>Your study progress.</strong> Which words and
          grammar points you have seen, how you rated each one, when each is next due, and your
          chosen JLPT level. This is the app: without it there is no spaced repetition.
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>Nothing else.</strong> No name, no age, no
          location, no contacts, no payment details. Bayana never asks for them and has nowhere
          to put them.
        </p>
      </LegalSection>

      <LegalSection heading="If you use the demo">
        <p>
          The demo needs no email at all. Starting one creates an anonymous account and puts a
          signed cookie in your browser, and that cookie is the only key to it. There is no way
          to reach demo progress without it — not for you, and not for me.
        </p>
        <p>
          A demo cookie stops working 7 days after it is issued, and the account behind it is
          deleted{" "}
          <strong style={{ color: "var(--ink)" }}>within 14 days of being created</strong>, by a
          job that runs daily whether or not anybody visits. Clearing your cookies makes the
          data unreachable immediately; deletion then happens on the same schedule.
        </p>
      </LegalSection>

      <LegalSection heading="No analytics, no tracking">
        <p>
          <strong style={{ color: "var(--ink)" }}>
            There are no analytics, no tracking pixels, and no third-party scripts of any kind.
          </strong>{" "}
          Not a lighter alternative to Google Analytics — none at all. Bayana&apos;s content
          security policy permits no external origin, so the browser is not allowed to load
          anything from anywhere else even by accident.
        </p>
        <p>
          The only cookies are the two that make signing in work: a session cookie for
          email accounts, or the signed demo cookie. Both are strictly necessary, neither
          follows you anywhere, and there is nothing here for a consent banner to ask about.
        </p>
      </LegalSection>

      <LegalSection heading="Who else touches it">
        <p>
          Three companies, each doing one job:
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>Resend</strong> delivers your sign-in email,
          so it necessarily handles your address. It sees nothing else.{" "}
          <strong style={{ color: "var(--ink)" }}>Railway</strong> hosts the app and the
          database it runs on, so your data physically sits on their infrastructure.
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>Anthropic</strong> wrote the example
          sentences, and this one is worth being precise about:{" "}
          <strong style={{ color: "var(--ink)" }}>
            nothing you do in the app is ever sent to an AI model.
          </strong>{" "}
          The sentences were generated once, ahead of time, from the vocabulary list alone, and
          stored in the database. Studying a card reads a sentence that already exists. There
          is no request to an AI service while you use Bayana.
        </p>
      </LegalSection>

      <LegalSection heading="How long it is kept">
        <p>
          Demo accounts: deleted within 14 days, as above.
        </p>
        <p>
          Email accounts: kept until you ask for them to be deleted, because study progress is
          only worth having if it survives. Ask and it goes — the account, the review history,
          all of it, permanently, and there is no separate backup copy to hunt down afterwards.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this page">
        <p>
          If what Bayana collects changes, this page changes with it, and the date at the top
          moves. The whole history of this file is public in the repository, so you can see
          exactly what changed and when.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
