import { NextResponse, type NextRequest } from "next/server";
import { authMode, getSession, supabaseServer } from "@/lib/auth";

/** Supabase magic-link callback. Only the CEO's address keeps a session. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (authMode() !== "supabase" || !code) return NextResponse.redirect(new URL("/login", request.url));
  const supabase = await supabaseServer();
  await supabase.auth.exchangeCodeForSession(code);
  if (!(await getSession())) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.redirect(new URL("/", request.url));
}
