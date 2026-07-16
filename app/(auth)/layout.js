import { Boxes } from "lucide-react";

export default function AuthLayout({ children }) {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV || "local";
  const isProd = appEnv === "production";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-brand-600 text-white shadow-[var(--shadow-card)]">
            <Boxes className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-content">
              COMSA ERP
            </h1>
            <p className="text-sm text-content-muted">
              Sistema de administracion
            </p>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
          {children}
        </div>

        {!isProd && (
          <p className="mt-4 text-center text-xs font-medium uppercase tracking-wide text-content-muted">
            Ambiente: {appEnv}
          </p>
        )}
      </div>
    </div>
  );
}
