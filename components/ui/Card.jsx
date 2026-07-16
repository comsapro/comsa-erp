import { cn } from "@/lib/utils/cn";

export function Card({ className, children }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-white shadow-[var(--shadow-card)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return (
    <div className={cn("border-b border-border px-5 py-4", className)}>
      {children}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export default Card;
