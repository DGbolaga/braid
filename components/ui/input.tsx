"use client";

// `useId` is a hook, so these are client components. Form controls carry
// handlers in every real use anyway.
import { useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { AlertIcon } from "@/components/icon/icons";

/**
 * 8.2: label above at 8px, 44px control, helper in caption, error in
 * status-danger with a 12px icon.
 *
 * `label` is required. Section 11 forbids a placeholder standing in for a
 * label, so the type signature makes that impossible rather than reviewable.
 *
 * "Required fields are marked. Optional fields are not. Whichever is rarer
 * gets the mark." Which is rarer is a per-form decision, so `mark` inverts it.
 */
type FieldOwnProps = {
  label: string;
  helper?: string;
  /** Say what went wrong and how to fix it: "Enter a date after 14 September". */
  error?: string;
  required?: boolean;
  mark?: "required" | "optional" | "none";
};

const controlClasses = (invalid: boolean) =>
  [
    "w-full rounded-sm border bg-surface px-12 type-body-m text-primary",
    "transition-[border-color,box-shadow] duration-instant ease-out",
    "placeholder:text-muted",
    "focus:outline-none focus:ring-3 focus:ring-focus-halo",
    invalid
      ? "border-danger focus:border-danger"
      : "border-default focus:border-accent",
    "disabled:cursor-not-allowed disabled:border-subtle disabled:bg-sunken disabled:text-muted",
  ].join(" ");

function FieldShell({
  label,
  helper,
  error,
  required,
  mark = "required",
  controlId,
  helperId,
  errorId,
  children,
}: FieldOwnProps & {
  controlId: string;
  helperId: string;
  errorId: string;
  children: React.ReactNode;
}) {
  const showRequired = mark === "required" && required;
  const showOptional = mark === "optional" && !required;

  return (
    <div className="flex flex-col gap-8">
      <label htmlFor={controlId} className="flex items-center gap-8 type-label text-primary">
        {label}
        {showRequired && <span className="text-muted">Required</span>}
        {showOptional && <span className="text-muted">Optional</span>}
      </label>

      {children}

      {helper && !error && (
        <p id={helperId} className="type-caption text-muted">
          {helper}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-4 type-caption text-danger"
        >
          <AlertIcon className="mt-4 size-12 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export type FieldProps = FieldOwnProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "required">;

export function Field({
  label,
  helper,
  error,
  required,
  mark,
  className = "",
  ...rest
}: FieldProps) {
  const id = useId();
  const controlId = `${id}-control`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  return (
    <FieldShell
      label={label}
      helper={helper}
      error={error}
      required={required}
      mark={mark}
      controlId={controlId}
      helperId={helperId}
      errorId={errorId}
    >
      <input
        {...rest}
        id={controlId}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : helper ? helperId : undefined}
        className={`h-field ${controlClasses(Boolean(error))} ${className}`}
      />
    </FieldShell>
  );
}

export type TextareaFieldProps = FieldOwnProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "required">;

export function TextareaField({
  label,
  helper,
  error,
  required,
  mark,
  rows = 4,
  className = "",
  ...rest
}: TextareaFieldProps) {
  const id = useId();
  const controlId = `${id}-control`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  return (
    <FieldShell
      label={label}
      helper={helper}
      error={error}
      required={required}
      mark={mark}
      controlId={controlId}
      helperId={helperId}
      errorId={errorId}
    >
      <textarea
        {...rest}
        id={controlId}
        rows={rows}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : helper ? helperId : undefined}
        className={`py-8 ${controlClasses(Boolean(error))} ${className}`}
      />
    </FieldShell>
  );
}
