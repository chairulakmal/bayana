// /grammar/study — Grammar study session page shell.
// Mirrors /study and /quiz: auth check server-side, client session component handles
// the interactive flip-and-rate loop.

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/current-user";
import { getActiveLevel, hasOnboarded } from "@/lib/profile";
import { GrammarSession } from "@/components/grammar-session";

export default async function GrammarStudyPage() {
  const { userId } = await requireAuth();
  if (!(await hasOnboarded(userId))) redirect("/onboarding");

  const level = await getActiveLevel(userId);

  return <GrammarSession level={level.toString()} />;
}
