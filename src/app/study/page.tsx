import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudySession } from "@/components/study-session";

// The study app — Anki mode. Opens straight into the due queue (one-tap start, SPEC §2,
// §8). Server-side auth gate: unauthenticated visitors go to sign-in (also catches expired
// sessions the cookie-only proxy guard would let through). The public landing lives at `/`.
export default async function StudyPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  return <StudySession />;
}
