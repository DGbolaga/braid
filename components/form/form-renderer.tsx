"use client";

import { useMemo } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { components } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/icon/icons";
import {
  visibleFieldIds,
  visibleFieldsInSection,
  type FormValues,
  type FormVersion,
} from "@/lib/form/conditions";
import { buildAnswerSchema } from "@/lib/form/zod-schema";
import { toAnswerInput } from "@/lib/form/answers";
import { FieldControl } from "./field-control";

type S = components["schemas"];

export type FormRendererProps = {
  version: FormVersion;
  /**
   * Which sections to render. Omit for all of them.
   *
   * This is the whole of what the renderer knows about being a wizard step, a
   * profile-edit panel or a builder preview: the caller decides, and the
   * renderer does not care which it is.
   */
  sectionIds?: string[];
  defaultValues?: FormValues;
  /** `guided` when the answers come from an elicitation prompt, per 4.4. */
  provenance?: S["Provenance"];
  submitLabel?: string;
  /** The verb here is the verb in the resulting toast, per 8.1. */
  onSubmit: (answers: Record<string, S["AnswerInput"]>) => Promise<void> | void;
  /** Fires on every change, for autosave once there is an endpoint to save to. */
  onValuesChange?: (values: FormValues) => void;
  submitError?: string;
  disabled?: boolean;
};

export function FormRenderer({
  version,
  sectionIds,
  defaultValues,
  provenance = "self",
  submitLabel = "Submit",
  onSubmit,
  onValuesChange,
  submitError,
  disabled,
}: FormRendererProps) {
  /**
   * The validator is rebuilt from the answers on every run rather than held in
   * state. A field hidden by a condition has not been asked, so its rules must
   * not fire — and deriving that at validation time from the values being
   * validated is the only version that cannot go stale.
   */
  const resolver = useMemo<Resolver<FormValues>>(
    () => (values, context, options) => {
      const schema = buildAnswerSchema(version, visibleFieldIds(version, values));
      // The shape is built at runtime from the form version, so zod infers
      // Record<string, unknown> and cannot know it matches FormValues. The
      // cast is at this one boundary and nowhere else.
      const validate = zodResolver(schema) as unknown as Resolver<FormValues>;
      return validate(values, context, options);
    },
    [version],
  );

  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<FormValues>({
    defaultValues: defaultValues ?? {},
    resolver,
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  // useWatch rather than watch(): it subscribes without handing back a
  // function the compiler has to bail out on, and it re-renders only this
  // component rather than the whole tree.
  const values = useWatch({ control }) as FormValues;
  const visible = visibleFieldIds(version, values);

  const sections = sectionIds
    ? version.sections.filter((s) => sectionIds.includes(s.id))
    : version.sections;

  const onScreen = sections.flatMap((s) => visibleFieldsInSection(s, visible));

  // 8.2: "Required fields are marked. Optional fields are not. Whichever is
  // rarer gets the mark." Which is rarer depends on the form, so it is counted
  // rather than assumed — and recounted as conditional questions come and go.
  const requiredCount = onScreen.filter((f) => f.required).length;
  const mark = requiredCount <= onScreen.length / 2 ? "required" : "optional";

  const failed = onScreen.filter((f) => errors[f.id]);

  const submit = handleSubmit(async () => {
    const current = getValues();
    await onSubmit(
      toAnswerInput(
        version,
        current,
        visibleFieldIds(version, current),
        provenance,
      ),
    );
  });

  return (
    <form
      noValidate
      onSubmit={submit}
      onChange={onValuesChange ? () => onValuesChange(getValues()) : undefined}
      className="flex flex-col gap-48"
    >
      {isSubmitted && failed.length > 0 && (
        <ErrorSummary
          failures={failed.map((f) => ({
            id: f.id,
            label: f.label,
            message: errors[f.id]?.message as string,
          }))}
        />
      )}

      {sections.map((section) => {
        const fields = visibleFieldsInSection(section, visible);
        if (fields.length === 0) return null;

        return (
          <section key={section.id} className="flex flex-col gap-24">
            <div className="flex flex-col gap-4">
              <h2 className="type-heading-m text-primary">{section.title}</h2>
              {section.description && (
                <p className="type-body-m text-secondary">{section.description}</p>
              )}
            </div>

            <div className="flex flex-col gap-32">
              {fields.map((field) => (
                <div key={field.id} id={anchorFor(field.id)} className="scroll-mt-32">
                  <FieldControl
                    field={field}
                    control={control}
                    register={register}
                    errors={errors}
                    mark={mark}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {submitError && (
        <p role="alert" className="flex items-start gap-8 type-body-s text-danger">
          <AlertIcon className="mt-4 size-16 shrink-0" />
          {submitError}
        </p>
      )}

      <div className="flex">
        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          loadingLabel={`${submitLabel}ing`}
          disabled={disabled}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

const anchorFor = (fieldId: string) => `field-${fieldId}`;

/**
 * Listed and linked, not just outlined in red. Someone who submits a long form
 * and lands back at the top with two failures twelve questions apart needs to
 * be told which two, in words.
 */
function ErrorSummary({
  failures,
}: {
  failures: Array<{ id: string; label: string; message: string }>;
}) {
  return (
    <div
      role="alert"
      tabIndex={-1}
      className="flex flex-col gap-8 rounded-md border border-danger bg-surface p-16"
    >
      <p className="flex items-center gap-8 type-heading-s text-primary">
        <AlertIcon className="size-16 shrink-0 text-danger" />
        {failures.length === 1
          ? "One question needs another look"
          : `${failures.length} questions need another look`}
      </p>
      <ul className="flex flex-col gap-4">
        {failures.map((f) => (
          <li key={f.id}>
            <a href={`#${anchorFor(f.id)}`} className="type-body-s text-link underline">
              {f.label}
            </a>{" "}
            <span className="type-body-s text-secondary">{f.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
