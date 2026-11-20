# Dashboard gerencial y KPIs

Vista ejecutiva para la junta semanal. Todo se calcula en línea desde la base
del ERP (no hay Excel ni capturas duplicadas).

## Rutas

| Ruta | Uso | Permiso |
| --- | --- | --- |
| `/dashboard-gerencial` | 5 bloques + detalle por pestaña, selector de periodo, Excel/PDF | `kpis.view` |
| `/dashboard-gerencial/junta` | Modo Junta (semana N, bloques grandes, compromisos, reporte de junta) | `kpis.view` |
| `/dashboard-gerencial/proyecto/[orderId]` | Proyecto conectado: cotizado → comprado → horas → errores → facturado → cobrado | `kpis.view` |
| `/dashboard-gerencial/catalogos` | Razones de paro, causas y áreas de error, parámetros (IVA, costo hora, crédito) | `kpis.manage_catalogs` |
| `/incidencias` | Seguimiento de incidencias (cada usuario ve las suyas; acceso desde la campana) | sesión |
| `/notificaciones` | Notificaciones internas | sesión |
| `/calidad/errores` | Registro/clasificación de errores y su costo | `quality.view` / `quality.record_errors` |

El inicio (`/`) muestra los 5 bloques del mes en curso a quien tenga `kpis.view`.

## Permisos nuevos

`kpis.view`, `kpis.manage_incidents`, `kpis.update_status`, `kpis.manage_catalogs`,
`kpis.correct_data`, `kpis.export`, `quality.record_errors`.

- Administrador / Dirección: todos.
- Supervisor: ver, incidencias, estatus, exportar.
- Administración: ver y exportar.
- Calidad: registrar errores.
- El responsable asignado a una incidencia puede atenderla, comentarla y
  resolverla aunque no tenga permisos de KPIs.

## Fuentes de cada KPI

1. **Compromisos**: `production_items.commitment_date` (calendario de Producción).
   Estatus operativo = entregado > detenido (incidencia bloqueante abierta) >
   manual (`tracking_status`) > derivado de producción/calidad. "Retrasado" se
   calcula cuando el compromiso pasó y no está terminado/liberado/entregado.
2. **Ventas**: `sales_invoices.net_amount` (con IVA) vs `sales_goals`. Para
   rangos que no coinciden con el periodo de la meta se prorratea por días
   usando la granularidad más fina disponible por equipo/vendedor.
3. **Facturas por recibir**: pendientes al corte (fin del periodo u hoy).
   Tiempo medio = recepción − (envío o, si no hay, fecha de factura).
4. **Cobranza**: fecha límite = recepción + días de crédito (snapshot en la
   factura; por defecto los del cliente en "condiciones comerciales" o el
   parámetro global). Tiempo de cobro desde factura y desde recepción.
5. **Calidad**: `quality_errors` + `quality_error_costs`. Cada retrabajo
   (orden o simple) crea automáticamente un error "sin clasificar"; Calidad
   asigna causa/área/operador y costos. Las horas del retrabajo ligado se
   suman como mano de obra salvo que se capture una línea de "Horas de
   retrabajo" (evita duplicar).

Todos los indicadores muestran comparativo contra el periodo inmediato
anterior equivalente.

## Incidencias y notificaciones

Desde la vista de compromisos: razón (catálogo con ruta de módulos y
responsable sugerido), responsable, prioridad, comentario. Al guardar se crea
la incidencia bloqueante, se registra actividad en la OP, se notifica al
responsable y queda el historial (creación, atención, comentarios,
resolución, cierre, reasignación). El correo electrónico queda pendiente de
configurar; hoy la notificación es interna (campana).

## Correcciones auditadas

`POST /api/kpis/correcciones` (permiso `kpis.correct_data`) corrige fechas,
días de crédito o pago de una factura y guarda en `data_corrections` el dato
original, el nuevo, quién, cuándo y el motivo. Cambiar recepción o crédito
recalcula la fecha límite y también queda registrado.

## Exportes

`GET /api/kpis/exportar?format=xlsx|pdf&section=all|compromisos|ventas|recepcion|cobranza|calidad&period=...`

El Excel se genera sin dependencias (`lib/export/xlsx.js`); el PDF usa PDFKit.

## Migración

`20261119120000_kpi_dashboard`: tablas nuevas, columnas en facturas/partidas/
incidencias/metas, catálogos iniciales, permisos y backfill de cliente,
crédito y fecha límite en facturas existentes. Es idempotente.
