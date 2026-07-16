import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title = "Sin resultados",
  description,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-content-muted">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold text-content">{title}</p>
        {description && (
          <p className="mt-1 max-w-sm text-sm text-content-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export default EmptyState;
