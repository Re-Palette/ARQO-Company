"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ mode }: { mode: "supabase" | "local" }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  if (state.sent) {
    return <p className="text-sm text-live">ログインリンクを送信しました。メールを確認してください。</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">CEO メールアドレス</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} key={state.email} />
      </div>
      {mode === "local" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">パスワード（開発用ローカル認証）</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-critical">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {mode === "supabase" ? "ログインリンクを送る" : "本社に入る"}
      </Button>
    </form>
  );
}
