"use client";

import { useActionState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { cls } from "@/components/cls";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label htmlFor="password" className={cls.label}>
        Password
      </label>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className={`${cls.input} h-11 pl-9 text-base tracking-wider`}
        />
      </div>
      {state.error ? (
        <p id="login-error" role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${cls.btnPrimary} group mt-4 h-11 w-full`}>
        {pending ? "Unlocking…" : "Unlock"}
        <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
      </button>
    </form>
  );
}
