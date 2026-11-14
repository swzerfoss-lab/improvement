"use client";

import {
  startTransition,
  useActionState,
  type FormEvent,
  type ReactNode,
} from "react";
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
  const [state, formAction, pending] = useActionState(action, null);

  // Submitting through the `action` prop makes React clear the form when the
  // action returns, which would wipe what was typed whenever validation
  // fails. Dispatching by hand keeps the fields as they are.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  return (
    <form action={formAction} onSubmit={onSubmit}>
      <fieldset disabled={pending} className={`min-w-0 ${className ?? ""}`}>
        {children}
      </fieldset>
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
  return (
    <button type="submit" className={`${btn(variant)} ${className}`}>
      {children}
    </button>
  );
}
