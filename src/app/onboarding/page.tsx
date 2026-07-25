import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/current-user";
import { hasOnboarded } from "@/lib/profile";
import { OnboardingClient } from "@/components/onboarding-client";

// First-run onboarding screen. Shown once, to new users who have no UserProfile row yet.
// Already-onboarded users are bounced to the home hub, the app's default page (this handles
// the back-button case).
//
// Deliberately minimal: one question (level), one button, then straight to the hub.
// No skip — a level choice is required for any part of the app to work.
export default async function OnboardingPage() {
  const { userId } = await requireAuth();
  if (await hasOnboarded(userId)) redirect("/home");

  return (
    // justify-center: this is a one-time screen, so vertical centering is fine —
    // unlike the home hub, there's no dynamic content that would cause layout hops.
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-5 py-12">
      <OnboardingClient />
    </main>
  );
}
