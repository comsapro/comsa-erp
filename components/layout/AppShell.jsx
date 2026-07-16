"use client";

import { useState } from "react";
import { Menu, PanelLeftClose, PanelLeft } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import { UserMenu } from "./UserMenu";
import { cn } from "@/lib/utils/cn";

export function AppShell({ sections, user, appEnv, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isProd = appEnv === "production";

  return (
    <div className="flex min-h-dvh bg-surface-muted">
      <Sidebar
        sections={sections}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-[var(--radius-sm)] p-2 text-content-muted hover:bg-surface-muted lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden rounded-[var(--radius-sm)] p-2 text-content-muted hover:bg-surface-muted lg:inline-flex"
            aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          >
            {collapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>

          <div className="hidden min-w-0 sm:block">
            <Breadcrumbs />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {!isProd && (
              <span
                className={cn(
                  "hidden items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide sm:inline-flex",
                  appEnv === "staging"
                    ? "bg-warning-50 text-warning-700"
                    : "bg-brand-50 text-brand-700"
                )}
              >
                {appEnv}
              </span>
            )}
            <UserMenu user={user} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
