import { cn } from "@/lib/utils/cn";

// Envoltura de campo de formulario con label, hint y mensaje de error.
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  className,
  children,
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-content"
        >
          {label}
          {required && <span className="ml-0.5 text-danger-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-content-muted">{hint}</p>
      )}
      {error && (
        <p className="text-xs font-medium text-danger-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default Field;
