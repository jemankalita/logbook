"use client";

import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/actions";
import { cls } from "./cls";

export { cls };

export function SubmitButton({
  children,
  pendingLabel,
  className = cls.btnPrimary,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || rest.disabled} className={className} {...rest}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** A submit button that asks first. */
export function ConfirmButton({
  message,
  children,
  className = cls.btnDanger,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { message: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (state.ok) {
    return state.message ? (
      <p role="status" className="text-sm text-success">
        {state.message}
      </p>
    ) : null;
  }
  return (
    <p role="alert" className="text-sm text-danger">
      {state.error}
    </p>
  );
}
