import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudySession } from "@/components/study-session";

// The app opens straight into the study session — one-tap start, no menus (SPEC §2, §8).
// Server-side auth gate: unauthenticated visitors go to sign-in (also catches expired
// sessions the cookie-only proxy guard would let through).
export default async function Home() {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  return <StudySession />;
}
