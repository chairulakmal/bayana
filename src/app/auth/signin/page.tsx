import { signIn } from "@/auth";

// Minimal sign-in screen: enter the allowlisted email → receive a one-time magic link.
// The form posts to a server action that calls Auth.js `signIn`; on success Auth.js
// sends the email and shows its "check your email" page.
export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-slate-900">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold">🦜 Bayana</h1>
        <p className="mt-2 text-slate-500">Sign in with your email to study.</p>
        <form
          action={async (formData: FormData) => {
            "use server";
            await signIn("resend", {
              email: String(formData.get("email") ?? ""),
              redirectTo: "/",
            });
          }}
          className="mt-6 flex flex-col gap-3 text-left"
        >
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="min-h-12 rounded-lg border border-slate-300 px-3 text-base"
          />
          <button className="min-h-12 rounded-lg bg-slate-900 text-base font-semibold text-white active:bg-slate-700">
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
