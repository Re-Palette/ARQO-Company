"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authMode, loginLocal, loginSupabase, logout } from "@/lib/auth";

export interface LoginState {
  error?: string;
  sent?: boolean;
  email?: string;
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const h = await headers();
  const clientKey = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const email = String(form.get("email") ?? "");
  if (authMode() === "supabase") {
    const error = await loginSupabase(email, `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`, clientKey);
    return error ? { error, email } : { sent: true };
  }
  const error = await loginLocal(email, String(form.get("password") ?? ""), clientKey);
  if (error) return { error, email };
  redirect("/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
