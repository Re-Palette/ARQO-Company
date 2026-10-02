import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { jwtVerify, SignJWT } from "jose";

/**
 * Authentication: a single CEO account.
 *  - "supabase" (production): Supabase Auth magic link, restricted to CEO_EMAIL.
 *  - "local" (development only): password from LOCAL_AUTH_PASSWORD, signed session cookie.
 *    Refused when NODE_ENV=production.
 */
export const SESSION_COOKIE = "friday_session";

export type AuthMode = "supabase" | "local";

export function authMode(): AuthMode {
  const explicit = process.env.AUTH_PROVIDER as AuthMode | undefined;
  if (explicit === "supabase" || explicit === "local") return explicit;
  return process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? "supabase" : "local";
}

export interface Session {
  email: string;
  mode: AuthMode;
}

function ceoEmail(): string {
  const email = process.env.CEO_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("CEO_EMAIL is not set");
  return email;
}

function localSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

function assertLocalAllowed() {
  if (process.env.NODE_ENV === "production") throw new Error("Local auth is disabled in production. Configure Supabase Auth.");
}

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => {
        try {
          all.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

export async function getSession(): Promise<Session | null> {
  if (authMode() === "supabase") {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.toLowerCase();
    return email && email === ceoEmail() ? { email, mode: "supabase" } : null;
  }
  if (process.env.NODE_ENV === "production") return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, localSecret(), { issuer: "friday", audience: "ceo" });
    return payload.sub === ceoEmail() ? { email: payload.sub, mode: "local" } : null;
  } catch {
    return null;
  }
}

/** For Server Components / pages. */
export async function requireCeo(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

const attempts = new Map<string, { count: number; resetAt: number }>();
function throttle(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  a.count += 1;
  return a.count <= 5;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export async function loginLocal(email: string, password: string, clientKey: string): Promise<string | null> {
  assertLocalAllowed();
  if (!throttle(clientKey)) return "試行回数が多すぎます。1分後に再試行してください。";
  const expected = process.env.LOCAL_AUTH_PASSWORD ?? "";
  if (expected.length < 12) return "LOCAL_AUTH_PASSWORD（12文字以上）が設定されていません。";
  const okEmail = email.trim().toLowerCase() === ceoEmail();
  const okPassword = timingSafeEqual(digest(password), digest(expected));
  if (!okEmail || !okPassword) return "メールアドレスまたはパスワードが違います。";
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" }).setSubject(ceoEmail()).setIssuer("friday").setAudience("ceo")
    .setIssuedAt().setExpirationTime("12h").sign(localSecret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 12 * 3600,
  });
  return null;
}

export async function loginSupabase(email: string, origin: string, clientKey: string): Promise<string | null> {
  if (!throttle(clientKey)) return "試行回数が多すぎます。1分後に再試行してください。";
  // Same message either way: do not reveal whether the address is the CEO's.
  if (email.trim().toLowerCase() !== ceoEmail()) return null;
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: ceoEmail(), options: { emailRedirectTo: `${process.env.APP_URL ?? origin}/auth/callback`, shouldCreateUser: false },
  });
  return error ? "ログインリンクを送信できませんでした。" : null;
}

export async function logout() {
  if (authMode() === "supabase") await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(SESSION_COOKIE);
}
