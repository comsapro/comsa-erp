import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const VARIANTS = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 disabled:bg-brand-300",
  secondary:
    "bg-white text-content border border-border hover:bg-surface-muted disabled:opacity-60",
  danger:
    "bg-danger-500 text-white hover:bg-danger-700 focus-visible:outline-danger-500 disabled:bg-danger-500/50",
  ghost:
    "bg-transparent text-content hover:bg-surface-muted disabled:opacity-50",
  subtle:
    "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-60",
};

const SIZES = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
  icon: "h-9 w-9 justify-center",
};

export function Button({
  as: Comp = "button",
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={Comp === "button" ? disabled || loading : undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </Comp>
  );
}

export default Button;
