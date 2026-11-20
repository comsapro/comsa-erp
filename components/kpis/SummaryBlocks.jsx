"use client";

import { CalendarClock, Banknote, FileClock, Wallet, ShieldAlert, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/feedback/Skeleton";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { DeltaBadge, ProgressBar, formatDays, formatPct } from "./ui";

function Block({ title, icon: Icon, onOpen, children, alert = false, large = false }) {
  const Comp = onOpen ? "button" : "div";
  return (
    <Card className={cn("flex flex-col", alert && "border-danger-500/40")}>
      <Comp
        type={onOpen ? "button" : undefined}
        onClick={onOpen}
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border px-4 py-3 text-left",
          onOpen && "transition-colors hover:bg-surface-muted/60"
        )}
      >
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)]",
              alert ? "bg-danger-50 text-danger-700" : "bg-brand-50 text-brand-700"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className={cn("font-semibold uppercase tracking-wide text-content", large ? "text-sm" : "text-xs")}>
            {title}
          </span>
        </span>
        {onOpen && <ChevronRight className="h-4 w-4 text-content-muted" aria-hidden />}
      </Comp>
      <div className={cn("flex flex-1 flex-col gap-3", large ? "p-5" : "p-4")}>{children}</div>
    </Card>
  );
}

function Row({ label, value, tone, large }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn("text-content-muted", large ? "text-sm" : "text-xs")}>{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          large ? "text-2xl" : "text-lg",
          tone === "danger" ? "text-danger-700" : tone === "warning" ? "text-warning-700" : "text-content"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function SummaryBlocksSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
}

/** Cinco bloques principales del Dashboard gerencial. */
export function SummaryBlocks({ blocks, onOpen, large = false }) {
  if (!blocks) return <SummaryBlocksSkeleton />;
  const { commitments: c, sales: s, reception: r, collection: k, quality: q } = blocks;
  const open = (key) => (onOpen ? () => onOpen(key) : undefined);

  return (
    <div className={cn("grid gap-4", large ? "lg:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-5")}>
      <Block title="Compromisos" icon={CalendarClock} onOpen={open("compromisos")} alert={c.overdue > 0 || c.stopped > 0} large={large}>
        <Row label="Vencidos" value={c.overdue} tone={c.overdue ? "danger" : undefined} large={large} />
        <Row label="Esta semana" value={c.thisWeek} large={large} />
        <Row label="Próxima semana" value={c.nextWeek} large={large} />
        <Row label="Detenidos" value={c.stopped} tone={c.stopped ? "warning" : undefined} large={large} />
        <p className="mt-auto text-xs text-content-muted">Semana {c.weekNumber} · {c.inProgress} en proceso</p>
      </Block>

      <Block title="Ventas" icon={Banknote} onOpen={open("ventas")} large={large}>
        <Row label="Meta" value={formatMoney(s.goal)} large={large} />
        <Row label="Facturado" value={formatMoney(s.billed)} large={large} />
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className={cn("text-content-muted", large ? "text-sm" : "text-xs")}>Avance</span>
            <span className={cn("font-semibold tabular-nums text-brand-700", large ? "text-2xl" : "text-lg")}>
              {formatPct(s.percent)}
            </span>
          </div>
          <ProgressBar percent={s.percent} label="Avance de meta de ventas" />
        </div>
        <DeltaBadge delta={s.compare.billed} format="money" className="mt-auto" />
      </Block>

      <Block title="Facturas por recibir" icon={FileClock} onOpen={open("recepcion")} large={large}>
        <Row label="Pendiente" value={formatMoney(r.pendingAmount)} tone={r.pendingCount ? "warning" : undefined} large={large} />
        <Row label="Facturas" value={r.pendingCount} large={large} />
        <Row label="Tiempo medio de recepción" value={formatDays(r.avgDays)} large={large} />
        <DeltaBadge delta={r.compare.avgDays} goodWhen="down" suffix=" d" className="mt-auto" />
      </Block>

      <Block title="Cobranza" icon={Wallet} onOpen={open("cobranza")} alert={k.overdueCount > 0} large={large}>
        <Row label="Saldo vencido" value={formatMoney(k.overdueAmount)} tone={k.overdueAmount ? "danger" : undefined} large={large} />
        <Row label="Facturas vencidas" value={k.overdueCount} large={large} />
        <Row label="Tiempo medio de cobro" value={formatDays(k.avgReceptionToPayment)} large={large} />
        <p className="text-xs text-content-muted">
          Desde factura: {formatDays(k.avgInvoiceToPayment)} · {k.overdueClients} cliente(s) con vencido
        </p>
        <DeltaBadge delta={k.compare.overdueAmount} format="money" goodWhen="down" className="mt-auto" />
      </Block>

      <Block title="Calidad" icon={ShieldAlert} onOpen={open("calidad")} alert={q.escapes > 0} large={large}>
        <Row label="Errores" value={q.errors} large={large} />
        <Row label="Retrabajos" value={q.reworks} large={large} />
        <Row label="Horas de retrabajo" value={q.reworkHours} large={large} />
        <Row label="Costo de errores" value={formatMoney(q.cost)} large={large} />
        <Row label="Escapes al cliente" value={q.escapes} tone={q.escapes ? "danger" : undefined} large={large} />
        <DeltaBadge delta={q.compare.errors} goodWhen="down" className="mt-auto" />
      </Block>
    </div>
  );
}

export default SummaryBlocks;
