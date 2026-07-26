// /terms — terms of use for the hosted service.
//
// Public and static, allowlisted in `proxy.ts` as an exact path (see the privacy page's
// header for why exact rather than prefix).
//
// **These terms are not the MIT licence.** The footer's MIT link covers Bayana's *source
// code*; this page governs a person's use of the *hosted app*. Conflating the two is the
// obvious failure mode here, given the footer already links one of them, so the distinction
// is stated explicitly in the "Ownership and licences" section below rather than left for a
// reader to infer.

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata = {
  title: "Terms of use",
  description: "The terms you agree to by using the hosted Bayana app.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="27 July 2026"
      intro={
        <>
          Bayana is a free personal project, offered as-is. These are the terms you agree to by
          using it. They are short because the app is small and asks very little of you.
        </>
      }
    >
      <LegalSection heading="What Bayana is">
        <p>
          A Japanese vocabulary and grammar trainer, built and run by one person as a side
          project. It is free, it carries no ads, and it sells nothing. It is not a company, a
          school, or a certified course, and it is not affiliated with the JLPT or its
          organisers.
        </p>
      </LegalSection>

      <LegalSection heading="Using it">
        <p>
          Study as much as you like. What is not on: trying to break in or read other
          people&apos;s data, hammering the app to knock it over, scripting it to mint accounts
          in bulk, or reselling access. Automated sign-in and demo requests are rate limited, and
          persistent abuse gets blocked.
        </p>
        <p>
          If you have an email account, keep your inbox to yourself — a sign-in link is the only
          credential there is, so anyone who can read your email can sign in as you.
        </p>
      </LegalSection>

      <LegalSection heading="Demo accounts are temporary">
        <p>
          A demo account lives in one browser cookie and is deleted within 14 days. Clear your
          cookies, switch browsers, or wait long enough, and the progress is gone for good. It
          cannot be recovered, by you or by me, because the cookie is the only key to it. Use an
          email account for anything you want to keep.
        </p>
      </LegalSection>

      <LegalSection heading="No guarantees">
        <p>
          Bayana is provided as-is, with no warranty of any kind. It may be down, it may lose
          data, it may change without notice, and it may be shut down entirely. Nothing here is
          a promise that it will keep running or that your progress will survive.
        </p>
        <p>
          The example sentences were written by an AI model and, like all Japanese study
          material, may contain mistakes. Treat Bayana as practice, not as an authority: for
          anything that matters, check a dictionary or ask a teacher. Study outcomes, including
          exam results, are your own.
        </p>
        <p>
          To the extent the law allows, I am not liable for any loss arising from your use of
          Bayana. Some jurisdictions do not permit excluding certain rights; where that is the
          case, those rights stand and the rest of this section still applies.
        </p>
      </LegalSection>

      <LegalSection heading="Ownership and licences">
        <p>
          <strong style={{ color: "var(--ink)" }}>
            The MIT licence linked in the footer covers Bayana&apos;s source code, not your use
            of this hosted app.
          </strong>{" "}
          You are free to read, copy, modify, and run that code under MIT&apos;s terms. This
          page is a separate thing: it governs the service running at this address.
        </p>
        <p>
          The vocabulary comes from the open-anki-jlpt-decks project, used under its MIT
          licence, with thanks. The example sentences and the app&apos;s own writing and artwork
          are mine.
        </p>
        <p>Your study data is yours. It is not sold, shared, or used to train anything.</p>
      </LegalSection>

      <LegalSection heading="Ending it">
        <p>
          Stop using Bayana whenever you want; that is the whole process. Ask and I will delete
          your account and everything attached to it. I may also suspend access that is being
          used abusively, as described above.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>
          These terms may change as the app does. The date at the top says when they last did,
          and every revision is visible in the public repository. Continuing to use Bayana after
          a change means the new terms apply.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
