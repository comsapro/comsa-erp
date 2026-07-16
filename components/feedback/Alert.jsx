import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STYLES = {
  info: { box: "bg-brand-50 text-brand-800 border-brand-200", Icon: Info },
  success: {
    box: "bg-success-50 text-success-700 border-success-500/30",
    Icon: CheckCircle2,
  },
  warning: {
    box: "bg-warning-50 text-warning-700 border-warning-500/30",
    Icon: TriangleAlert,
  },
  danger: {
    box: "bg-danger-50 text-danger-700 border-danger-500/30",
    Icon: AlertCircle,
  },
};

export function Alert({ variant = "info", title, children, className }) {
  const { box, Icon } = STYLES[variant] || STYLES.info;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-sm",
        box,
        className
      )}
      role={variant === "danger" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export default Alert;
