# Modulo de Calidad — Fase 2

## Resumen

Dominio nuevo `domains/quality` integrado con Produccion existente.

Trazabilidad: Cotizacion → OP → Partida → Pieza → Inspeccion → NCR / Retrabajo / Liberacion.

## Rutas UI

| Ruta | Permiso | Descripcion |
|------|---------|-------------|
| `/calidad` | `quality.view` | Bandeja pendientes |
| `/calidad/[orderId]` | `quality.view` | Detalle OP Calidad + QR interno |
| `/calidad/instrumentos` | `quality.manage_instruments` | Catalogo + calibraciones |
| `/calidad/alertas` | `quality.manage_alerts` | Alertas in-app |
| `/calidad/historial` | `quality.view_history` | Indice historial |
| `/calidad/historial/[orderId]` | `quality.view_history` | KPIs del proyecto |
| `/calidad/consulta/[token]` | publico | QR externo read-only |

## APIs principales

- `GET /api/calidad/pendientes`
- `GET /api/calidad/ordenes/[id]`
- `POST /api/calidad/partidas/[itemId]?action=quantities|sampling|pieces|start-inspection|release-first-piece`
- `POST /api/calidad/inspecciones/[id]/cerrar`
- `POST /api/calidad/ncr` / `?action=missing-process`
- `POST /api/calidad/retrabajos` / `?action=simple`
- `POST /api/calidad/retrabajos/[id]/horas`
- `GET|POST /api/calidad/instrumentos`
- `PATCH|POST /api/calidad/instrumentos/[id]` (update / calibracion)
- `GET /api/calidad/alertas` · `PATCH /api/calidad/alertas/[id]`
- `GET /api/calidad/historial/[orderId]`
- `POST /api/calidad/shares`
- `POST /api/calidad/evidencias` (registro post-upload Blob, pathname `calidad/...`)
- `GET /api/calidad/consulta/[token]`

## Roles

- **Calidad**: todos los `quality.*` + produccion view/add_process
- **Supervisor / Direccion**: view, history, alerts (+ subset)
- **Produccion**: view + manage_alerts
- **Administrador**: ALL

## Migracion

`prisma/migrations/20260915000000_quality_fase2/`

Tras deploy: `npx prisma migrate deploy` y `npx prisma db seed` (sincroniza permisos/rol Calidad).

## Exclusiones

Visor/anotaciones sobre planos PDF (Fase 1). Evidencias Blob multi-vinculo estan modeladas (`QualityEvidence`); upload UI completo puede ampliarse sobre el patron de produccion.
