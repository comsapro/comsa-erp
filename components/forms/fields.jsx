"use client";

import { Field } from "./Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export function TextField({
  label,
  name,
  register,
  error,
  required,
  hint,
  type = "text",
  ...props
}) {
  return (
    <Field label={label} htmlFor={name} error={error} hint={hint} required={required}>
      <Input
        id={name}
        type={type}
        invalid={!!error}
        {...register(name)}
        {...props}
      />
    </Field>
  );
}

export function TextareaField({
  label,
  name,
  register,
  error,
  required,
  hint,
  ...props
}) {
  return (
    <Field label={label} htmlFor={name} error={error} hint={hint} required={required}>
      <Textarea id={name} invalid={!!error} {...register(name)} {...props} />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  register,
  error,
  required,
  hint,
  children,
  ...props
}) {
  return (
    <Field label={label} htmlFor={name} error={error} hint={hint} required={required}>
      <Select id={name} invalid={!!error} {...register(name)} {...props}>
        {children}
      </Select>
    </Field>
  );
}

export function CheckboxField({ label, name, register, hint, ...props }) {
  return (
    <label className="flex items-start gap-2.5 py-1">
      <input
        id={name}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus-visible:outline-brand-600"
        {...register(name)}
        {...props}
      />
      <span>
        <span className="text-sm font-medium text-content">{label}</span>
        {hint && <span className="block text-xs text-content-muted">{hint}</span>}
      </span>
    </label>
  );
}
