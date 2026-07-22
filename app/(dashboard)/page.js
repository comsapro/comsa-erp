import Link from "next/link";
import {
  Users,
  Contact,
  Truck,
  Package,
  Warehouse,
  FolderTree,
  ArrowRight,
  ShieldCheck,
  FileText,
  ClipboardList,
  Factory,
  Clock3,
  CircleCheck,
  CircleX,
  Banknote,
  AlertTriangle,
} from "lucide-react";
import { requireUser, userHasPermission } from "@/lib/auth/session";
import {
  getDashboardStats,
  getStage2DashboardStats,
  getRecentActivity,
  getRecentCommercialActivity,
  getRecentProductionActivity,
} from "@/domains/dashboard/service";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime, formatMoney } from "@/lib/utils/format";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TONES,
  AUDIT_MODULE_LABELS,
} from "@/lib/audit/labels";

export const metadata = { title: "Inicio" };

const STAT_CARDS = [
  { key: "users", label: "Usuarios activos", icon: Users, permission: "users.view", href: "/usuarios", tone: "text-brand-600 bg-brand-50" },
  { key: "clients", label: "Clientes activos", icon: Contact, permission: "clients.view", href: "/clientes", tone: "text-success-700 bg-success-50" },
  { key: "suppliers", label: "Proveedores activos", icon: Truck, permission: "suppliers.view", href: "/proveedores", tone: "text-warning-700 bg-warning-50" },
  { key: "items", label: "Productos activos", icon: Package, permission: "items.view", href: "/catalogos/productos", tone: "text-brand-600 bg-brand-50" },
  { key: "warehouses", label: "Almacenes activos", icon: Warehouse, permission: "warehouses.view", href: "/catalogos/almacenes", tone: "text-success-700 bg-success-50" },
  { key: "categories", label: "Categorias activas", icon: FolderTree, permission: "categories.view", href: "/catalogos/categorias", tone: "text-warning-700 bg-warning-50" },
];

const QUOTE_KPI_CARDS = [
  { key: "draftQuotes", label: "Cotizaciones borrador", icon: FileText, permission: "quotes.view", href: "/cotizaciones", tone: "text-content-muted bg-surface-muted", format: "count" },
  { key: "pendingQuotes", label: "Pendientes de aprobacion", icon: Clock3, permission: "quotes.view", href: "/cotizaciones", tone: "text-warning-700 bg-warning-50", format: "count" },
  { key: "approvedQuotes", label: "Cotizaciones aprobadas", icon: CircleCheck, permission: "quotes.view", href: "/cotizaciones", tone: "text-success-700 bg-success-50", format: "count" },
  { key: "rejectedQuotes", label: "Cotizaciones rechazadas", icon: CircleX, permission: "quotes.view", href: "/cotizaciones", tone: "text-danger-700 bg-danger-50", format: "count" },
  { key: "quotedThisMonth", label: "Cotizado del mes", icon: Banknote, permission: "quotes.view", href: "/cotizaciones", tone: "text-brand-600 bg-brand-50", format: "money" },
  { key: "approvedThisMonth", label: "Aprobado del mes", icon: Banknote, permission: "quotes.view", href: "/cotizaciones", tone: "text-success-700 bg-success-50", format: "money" },
  { key: "quotesNearValidity", label: "Por vencer (7 dias)", icon: AlertTriangle, permission: "quotes.view", href: "/cotizaciones", tone: "text-warning-700 bg-warning-50", format: "count" },
];

const DIRECT_ORDER_KPI_CARDS = [
  { key: "directOrdersPending", label: "Ordenes directas pendientes", icon: ClipboardList, permission: "direct_orders.view", href: "/ordenes-directas", tone: "text-warning-700 bg-warning-50", format: "count" },
];

const PRODUCTION_KPI_CARDS = [
  { key: "productionInProgress", label: "Produccion en progreso", icon: Factory, permission: "production.view", href: "/produccion", tone: "text-brand-600 bg-brand-50", format: "count" },
  { key: "productionCompleted", label: "Produccion completada", icon: CircleCheck, permission: "production.view", href: "/produccion", tone: "text-success-700 bg-success-50", format: "count" },
];

const QUICK_LINKS = [
  { label: "Usuarios", href: "/usuarios", icon: Users, permission: "users.view" },
  { label: "Roles y permisos", href: "/roles", icon: ShieldCheck, permission: "roles.view" },
  { label: "Clientes", href: "/clientes", icon: Contact, permission: "clients.view" },
  { label: "Cotizaciones", href: "/cotizaciones", icon: FileText, permission: "quotes.view" },
  { label: "Ordenes directas", href: "/ordenes-directas", icon: ClipboardList, permission: "direct_orders.view" },
  { label: "Produccion", href: "/produccion", icon: Factory, permission: "production.view" },
  { label: "Proveedores", href: "/proveedores", icon: Truck, permission: "suppliers.view" },
  { label: "Productos e insumos", href: "/catalogos/productos", icon: Package, permission: "items.view" },
];

function formatKpiValue(value, format) {
  if (format === "money") return formatMoney(value);
  return value;
}

function ActivityList({ logs, emptyLabel }) {
  if (!logs.length) {
    return (
      <p className="px-5 py-6 text-sm text-content-muted">{emptyLabel}</p>
    );
  }
  return (
    <div className="divide-y divide-border">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-3 px-5 py-3">
          <Badge tone={AUDIT_ACTION_TONES[log.action] || "neutral"}>
            {AUDIT_ACTION_LABELS[log.action] || log.action}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-content">
              {AUDIT_MODULE_LABELS[log.module] || log.module} - {log.entity}
            </p>
            <p className="text-xs text-content-muted">
              {log.user?.name || "Sistema"} - {formatDateTime(log.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function KpiGrid({ cards, stats }) {
  if (!cards.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link key={card.key} href={card.href}>
            <Card className="p-5 transition-shadow hover:shadow-[var(--shadow-pop)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-content-muted">{card.label}</p>
                  <p className="mt-1 truncate text-2xl font-semibold text-content">
                    {formatKpiValue(stats[card.key], card.format)}
                  </p>
                </div>
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${card.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export default async function DashboardHome() {
  const user = await requireUser();
  const canAudit = userHasPermission(user, "audit.view");
  const canQuotes = userHasPermission(user, "quotes.view");
  const canDirectOrders = userHasPermission(user, "direct_orders.view");
  const canProduction = userHasPermission(user, "production.view");
  const needsStage2 =
    canQuotes || canDirectOrders || canProduction;

  const [stats, stage2, activity, commercialActivity, productionActivity] =
    await Promise.all([
      getDashboardStats(),
      needsStage2 ? getStage2DashboardStats() : Promise.resolve(null),
      canAudit ? getRecentActivity(8) : Promise.resolve([]),
      canQuotes || canDirectOrders
        ? getRecentCommercialActivity(8)
        : Promise.resolve([]),
      canProduction ? getRecentProductionActivity(8) : Promise.resolve([]),
    ]);

  const visibleStats = STAT_CARDS.filter((c) =>
    userHasPermission(user, c.permission)
  );
  const visibleQuoteKpis = QUOTE_KPI_CARDS.filter((c) =>
    userHasPermission(user, c.permission)
  );
  const visibleDirectKpis = DIRECT_ORDER_KPI_CARDS.filter((c) =>
    userHasPermission(user, c.permission)
  );
  const visibleProductionKpis = PRODUCTION_KPI_CARDS.filter((c) =>
    userHasPermission(user, c.permission)
  );
  const visibleLinks = QUICK_LINKS.filter((l) =>
    userHasPermission(user, l.permission)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-content">
          Bienvenido, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-content-muted">
          Este es el panel principal del ERP COMSA.
        </p>
      </div>

      {visibleStats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStats.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.key} href={card.href}>
                <Card className="p-5 transition-shadow hover:shadow-[var(--shadow-pop)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-content-muted">{card.label}</p>
                      <p className="mt-1 text-3xl font-semibold text-content">
                        {stats[card.key]}
                      </p>
                    </div>
                    <span className={`flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] ${card.tone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {stage2 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-content">
            Indicadores comerciales y produccion
          </h2>
          <KpiGrid cards={visibleQuoteKpis} stats={stage2} />
          <KpiGrid cards={visibleDirectKpis} stats={stage2} />
          <KpiGrid cards={visibleProductionKpis} stats={stage2} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {visibleLinks.length > 0 && (
          <Card className="lg:col-span-1">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-content">Accesos rapidos</h2>
            </div>
            <div className="flex flex-col p-2">
              {visibleLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm text-content transition-colors hover:bg-surface-muted"
                  >
                    <Icon className="h-4 w-4 text-content-muted" />
                    <span className="flex-1">{link.label}</span>
                    <ArrowRight className="h-4 w-4 text-content-muted" />
                  </Link>
                );
              })}
            </div>
          </Card>
        )}

        {canAudit && (
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-content">Actividad reciente</h2>
              <Link href="/bitacora" className="text-sm font-medium text-brand-700 hover:underline">
                Ver bitacora
              </Link>
            </div>
            <ActivityList
              logs={activity}
              emptyLabel="Aun no hay actividad registrada."
            />
          </Card>
        )}
      </div>

      {(canQuotes || canDirectOrders || canProduction) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {(canQuotes || canDirectOrders) && (
            <Card>
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-content">
                  Actividad comercial reciente
                </h2>
              </div>
              <ActivityList
                logs={commercialActivity}
                emptyLabel="Sin actividad comercial reciente."
              />
            </Card>
          )}
          {canProduction && (
            <Card>
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-content">
                  Actividad de produccion reciente
                </h2>
              </div>
              <ActivityList
                logs={productionActivity}
                emptyLabel="Sin actividad de produccion reciente."
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
