import { cn } from "@/lib/utils/cn";

const TONES = {
  neutral: "bg-surface-muted text-content-muted",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
};

export function Badge({ tone = "neutral", className, children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// Badge de estado ACTIVE/INACTIVE.
export function StatusBadge({ status }) {
  const active = status === "ACTIVE";
  return (
    <Badge tone={active ? "success" : "neutral"}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-success-500" : "bg-content-muted"
        )}
      />
      {active ? "Activo" : "Inactivo"}
    </Badge>
  );
}

export default Badge;
