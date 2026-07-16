import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-sm)] bg-surface-muted",
        className
      )}
    />
  );
}

export default Skeleton;
