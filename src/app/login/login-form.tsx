"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label htmlFor="password" className="text-sm text-muted">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="h-11 rounded-lg border border-line bg-panel-2 px-3 text-base outline-none transition focus:border-accent"
      />
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 h-11 rounded-lg bg-accent font-medium text-accent-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Unlocking…" : "Unlock"}
      </button>
    </form>
  );
}
