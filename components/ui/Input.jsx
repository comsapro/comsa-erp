import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export const Input = forwardRef(function Input(
  { className, invalid = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-[var(--radius-sm)] border bg-white px-3 text-sm text-content transition-colors",
        "placeholder:text-content-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2",
        invalid
          ? "border-danger-500 focus-visible:outline-danger-500"
          : "border-border focus-visible:outline-brand-600",
        "disabled:cursor-not-allowed disabled:bg-surface-muted",
        className
      )}
      {...props}
    />
  );
});

export default Input;
