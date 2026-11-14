"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { btn, type BtnVariant } from "./ui";

export type ActionState = { error?: string; ok?: string } | null;
export type FormAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/** A form that shows the error or confirmation its server action returns. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.ok}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  variant?: BtnVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${btn(variant)} ${className}`}>
      {children}
    </button>
  );
}
