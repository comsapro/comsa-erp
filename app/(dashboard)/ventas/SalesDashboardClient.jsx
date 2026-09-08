"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus, Receipt, ShoppingCart, Target } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Card, CardBody } from "@/components/ui/Card";
import { GoalProgressCard } from "@/components/sales/GoalProgressCard";
import { QuoteStatusCards } from "@/components/sales/QuoteStatusCards";
import { MaterialsPanels } from "@/components/sales/MaterialsPanels";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";

export default function SalesDashboardClient({
  canManageGoals,
  canCreateInvoice,
  canViewTeam,
  currentUserId,
}) {
  const [period, setPeriod] = useState("general");
  const [sellerId, setSellerId] = useState("");
  const [sellers, setSellers] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canViewTeam) return;
    api
      .get(`/api/vendedores${toQuery({ pageSize: 100, sort: "name", order: "asc" })}`)
      .then((res) => setSellers(res?.data || []))
      .catch(() => setSellers([]));
  }, [canViewTeam]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(
        `/api/ventas/dashboard${toQuery({
          period,
          sellerId: sellerId || undefined,
        })}`
      );
      setData(res);
    } catch (err) {
      setError(err.message || "No se pudo cargar el dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, sellerId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  const scopeSellerId =
    data?.scope?.sellerId ||
    sellerId ||
    (!canViewTeam ? currentUserId : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard de ventas"
        description="Meta del equipo, estado de cotizaciones, materiales y compromisos."
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreateInvoice && (
              <Button as={Link} href="/ventas/facturas/nuevo" size="sm">
                <Plus className="h-4 w-4" />
                Registrar factura
              </Button>
            )}
            {canManageGoals && (
              <Button as={Link} href="/ventas/metas" variant="secondary" size="sm">
                <Target className="h-4 w-4" />
                Metas
              </Button>
            )}
            <Button as={Link} href="/ventas/calendario" variant="secondary" size="sm">
              <CalendarDays className="h-4 w-4" />
              Calendario
            </Button>
            <Button as={Link} href="/ordenes-compra/nuevo" variant="secondary" size="sm">
              <ShoppingCart className="h-4 w-4" />
              Nueva OC
            </Button>
          </div>
        }
      />

      {canViewTeam && (
        <div className="max-w-xs">
          <label className="mb-1.5 block text-sm font-medium text-content">
            Alcance
          </label>
          <Select value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
            <option value="">Todo el equipo</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <GoalProgressCard goal={data?.goal} />

          <QuoteStatusCards
            quotes={data?.quotes}
            period={period}
            onPeriodChange={setPeriod}
            sellerId={scopeSellerId}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-sm text-content-muted">Compromisos esta semana</p>
              <p className="mt-1 text-2xl font-semibold text-content">
                {data?.commitmentsThisWeek ?? 0}
              </p>
              <Link
                href="/ventas/calendario"
                className="mt-2 inline-block text-sm text-brand-700 hover:underline"
              >
                Ver calendario
              </Link>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-content-muted">Facturas</p>
              <p className="mt-1 text-sm text-content">
                Registra ventas para alimentar la meta.
              </p>
              {canCreateInvoice && (
                <Link
                  href="/ventas/facturas"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"
                >
                  <Receipt className="h-4 w-4" />
                  Ver facturas
                </Link>
              )}
            </Card>
          </div>

          <MaterialsPanels
            counts={data?.materials}
            sellerId={sellerId || undefined}
            onChanged={load}
          />

          <Card>
            <CardBody className="flex flex-wrap gap-3 text-sm">
              <Link href="/cotizaciones" className="text-brand-700 hover:underline">
                Cotizaciones
              </Link>
              <Link href="/ordenes-compra" className="text-brand-700 hover:underline">
                Órdenes de compra
              </Link>
              <Link href="/clientes" className="text-brand-700 hover:underline">
                Clientes
              </Link>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
