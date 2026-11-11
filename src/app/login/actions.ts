"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "@/lib/auth/login-throttle";
import { isPasswordConfigured, verifyPassword } from "@/lib/auth/password";
import {
  AuthConfigError,
  createSessionToken,
  safeNextPath,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

/** Shown to visitors; details go to the server log only. */
const UNAVAILABLE = "Sign-in is unavailable right now. Check the server logs.";

const LoginInput = z.object({
  password: z.string().min(1, "Enter your password.").max(256),
  next: z.string().max(2048).optional(),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  // On Vercel, x-forwarded-for is set by the platform and can't be spoofed by the client.
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isPasswordConfigured()) {
    console.error("[login] APP_PASSWORD is missing or shorter than the minimum length.");
    return { error: UNAVAILABLE };
  }

  const parsed = LoginInput.safeParse({
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ip = await clientIp();
  try {
    if (await isLoginBlocked(ip)) {
      return { error: "Too many attempts. Try again later." };
    }
    if (!verifyPassword(parsed.data.password)) {
      await recordLoginFailure(ip);
      console.error(`[login] failed attempt from ${ip}`);
      return { error: "Wrong password." };
    }
    await clearLoginFailures(ip);
  } catch (err) {
    console.error("[login] throttle storage error", err);
    return { error: UNAVAILABLE };
  }

  let token: string;
  try {
    token = await createSessionToken();
  } catch (err) {
    if (err instanceof AuthConfigError) {
      console.error(`[login] ${err.message}`);
      return { error: UNAVAILABLE };
    }
    throw err;
  }

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(safeNextPath(parsed.data.next));
}
