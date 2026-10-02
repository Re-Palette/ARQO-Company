import { redirect } from "next/navigation";
import { authMode, getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

// Auth mode and session are request-time decisions.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  const mode = authMode();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 backdrop-blur-md">
        <div className="mb-8">
          <p className="text-2xl font-semibold tracking-[0.3em] text-gold">F.R.I.D.A.Y.</p>
          <p className="mt-1 text-[10px] tracking-[0.4em] text-muted-foreground">AI COMPANY OS</p>
        </div>
        <LoginForm mode={mode} />
        {mode === "local" && (
          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
            開発環境のローカル認証です。本番では Supabase Auth（CEO のメールのみ）が使われます。
          </p>
        )}
      </div>
    </main>
  );
}
