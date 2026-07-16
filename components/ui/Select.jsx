import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export const Select = forwardRef(function Select(
  { className, invalid = false, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-[var(--radius-sm)] border bg-white px-3 text-sm text-content transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        invalid
          ? "border-danger-500 focus-visible:outline-danger-500"
          : "border-border focus-visible:outline-brand-600",
        "disabled:cursor-not-allowed disabled:bg-surface-muted",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export default Select;
