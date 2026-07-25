# COMSA ERP

ERP para COMSA PRO (manufactura CNC / industrial).

- **Etapa 1**: autenticacion, roles/permisos, layout, catalogos base, bitacora.
- **Etapa 2**: empresas emisoras, procesos, instalaciones, biblioteca de items,
  cotizaciones, ordenes directas, produccion y KPIs del dashboard.
- **Etapa 3**: inventario (existencias/movimientos/transferencias), ordenes de
  compra y recepciones, alertas de stock bajo, dashboard final y reportes PDF.

## Stack

- Next.js 16 (App Router) + React 19
- JavaScript (sin TypeScript)
- Tailwind CSS v4
- PostgreSQL + Prisma 6
- NextAuth v5 (Auth.js) - Credenciales + sesiones JWT
- Zod, React Hook Form, Lucide React
- PDFKit (PDFs binarios servidor)

## Instalacion

```bash
npm install
cp .env.example .env
# Edita DATABASE_URL y AUTH_SECRET

npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

App en `http://localhost:3000`. Credenciales del admin: `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`.

Tras actualizar Etapa 3, vuelve a ejecutar `npm run db:seed` para sincronizar
permisos y roles del sistema.

## Scripts

| Script | Descripcion |
| --- | --- |
| `npm run dev` | Desarrollo |
| `npm run build` / `npm start` | Produccion |
| `npm test` | Pruebas (permisos, calculos, inventario, OC) |
| `npm run db:deploy` | Aplica migraciones |
| `npm run db:seed` | Permisos, roles, admin |
| `npm run db:seed:legacy` | Importa catálogos, existencias, cotizaciones, producción y OC del dump MySQL |

## Migraciones

1. `20260715000000_init` — Etapa 1
2. `20260722000000_etapa2` — Folios, empresas, procesos, instalaciones,
   templates, quotes, direct orders, production
3. `20260722120000_etapa3` — Inventario, transferencias, ordenes de compra,
   recepciones

## Modulos Etapa 3 (rutas UI)

| Ruta | Modulo |
| --- | --- |
| `/inventario` | Existencias por almacen/item |
| `/inventario/movimientos` | Libro de movimientos |
| `/inventario/bajo-stock` | Alertas de stock bajo |
| `/transferencias` | Transferencias entre almacenes |
| `/ordenes-compra` | Ordenes de compra |
| `/recepciones` | Recepciones de compra |
| `/reportes` | Reportes PDF operativos |

## APIs principales Etapa 3

- `/api/inventario`, `/api/inventario/bajo-stock`
- `/api/inventario/movimientos`, `/api/inventario/entradas|salidas|ajustes`
- `/api/transferencias` (+ acciones submit/approve/complete/cancel)
- `/api/ordenes-compra` (+ acciones submit/approve/reject/cancel)
- `/api/recepciones`
- `/api/cotizaciones/[id]/pdf`, `/api/ordenes-compra/[id]/pdf`
- `/api/reportes/cotizaciones|produccion|inventario|compras`
- `/api/produccion/[id]/inventario`

## Permisos nuevos

- `inventory.view|view_cost|create_entry|create_exit|adjust|transfer`
- `purchase_orders.view|create|edit|submit|approve|reject|cancel|receive|print`
- `reports.quotations_pdf|production_pdf|inventory_pdf|purchases_pdf`

## Reglas de inventario

- El stock **no se edita** desde formularios: solo via movimientos.
- Cantidad nunca negativa; disponible = cantidad - reservado.
- Movimientos inmutables; correcciones con movimientos compensatorios.
- Actualizaciones con bloqueo de fila (`FOR UPDATE`) en transaccion.
- Completar transferencia genera TRANSFER_OUT + TRANSFER_IN atomicos.
- Recibir OC genera ENTRY, actualiza recibidos y estatus
  (PARTIALLY_RECEIVED / COMPLETED) en una sola transaccion.

## PDFs

- Cotizacion y OC: documentos por folio.
- Reportes: usan filtros de query string; incluyen titulo, fecha, usuario,
  filtros, filas, totales y numero de pagina.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | PostgreSQL |
| `AUTH_SECRET` | NextAuth |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Admin inicial |
| `LEGACY_DUMP_PATH` | Ruta al `.sql` legado (default: dump en Downloads) |

## Importación del sistema legado

El dump MySQL anterior (`comsa_YYYY-MM-DD.sql`) no es 1:1 con el esquema
actual. `npm run db:seed:legacy` importa de forma idempotente:

| Legado | Destino |
| --- | --- |
| `almacenes` | `warehouses` (`ALM-{id}`) |
| `itemsCategorias` | `product_categories` |
| `items` | `items` (`LEGACY-{id}` si no hay SKU; `hye`→TOOL, `pc`→PRODUCT) |
| `clientes` | `clients` |
| `proveedores` | `suppliers` |
| `comsaProcesos` | `manufacturing_processes` (`PROC-{id}`) |
| `comsaInstalaciones` | `installation_concepts` (`INST-{id}`) |
| `almacenesExistencias` | stock vía movimiento `ENTRY` / `INITIAL_BALANCE` |
| `cotizaciones` + partidas/items | `quotes` + lineas (folios legacy preservados) |
| `produccion` | `production_orders` ligadas a cotización |
| `comsaOC` + `comsaOCItems` | `purchase_orders` + items + `purchase_receipts` documentales |

### Órdenes de compra históricas y stock

Las OC/recepciones del legado se importan como **documento** (estatus,
`receivedQuantity`, `PurchaseReceipt` de auditoría). **No** llaman al motor de
stock: el saldo actual ya viene de `almacenesExistencias` (`INITIAL_BALANCE`).
Las recepciones nuevas creadas en la app sí suman inventario.

Idempotencia: folio OC o marcador `[legacy:{token}]` en `comments` / notes.

### Perfiles

- Cliente: `/clientes/[id]` — datos, contactos, cotizaciones, órdenes directas y producción (sin pagos).
- Proveedor: `/proveedores/[id]` — datos, OC, recepciones y cotizaciones vinculadas.

**No se importan** tareas de piso (`produccionTasks`) ni pagos / `comsaRecepcionMateriales`.

Requisito: haber corrido `npm run db:seed` (usuario admin para `created_by` / vendedor).

Fases (`LEGACY_PHASE`):

```bash
# PowerShell
$env:LEGACY_PHASE="catalogs"; npm run db:seed:legacy
$env:LEGACY_PHASE="quotes"; npm run db:seed:legacy
$env:LEGACY_PHASE="purchases"; npm run db:seed:legacy
# o todo: all (default)
```

## Vistas de listado (cotizaciones / órdenes directas / producción)

Cada listado incluye interruptor **Tabla / Tablero / Calendario** (persistido en
`sessionStorage`). El tablero agrupa por estatus; el calendario usa fecha de
elaboración / solicitud / aprobación según el módulo.

## UI temporalmente oculta

- Sección **Reportes** del menú lateral
- Acciones **Imprimir / PDF** en cotizaciones

Las rutas/APIs pueden seguir existiendo para un alcance posterior.

## QA manual sugerido (Etapa 3)

1. Seed + login Administrador.
2. Entrada de inventario → verificar stock.
3. Salida mayor al disponible → debe fallar.
4. Ajuste sin motivo → debe fallar.
5. Transferencia: enviar → aprobar → completar; segunda completa → conflicto.
6. OC sin items → no se puede enviar; con items → aprobar.
7. Rechazo/cancelacion requieren motivo.
8. Recepcion parcial → PARTIALLY_RECEIVED; total → COMPLETED; exceso → error.
9. Salida ligada a produccion visible en detalle de produccion.
10. Dashboard: KPIs de compras/inventario con datos reales.
11. Descargar PDFs de cotizacion, OC y reportes filtrados.
12. Confirmar bitacora de movimientos, OC y reportes.
13. `npm test` y `npm run build` OK.

## Limitaciones conocidas

- Reportes PDF / Imprimir cotización ocultos en UI (fuera de alcance actual).
- Sin MRP / calculo automatico de materiales / reservas automaticas.
- Sin versionado avanzado de cotizaciones (sufijo `A` solo de folio).
- Sin Excel, BI avanzado, contabilidad, facturacion SAT ni portales externos.
- Reportes PDF limitados a 500 filas por generacion.
- Reservacion/liberacion de stock manual (tipos en ledger), no ligada a produccion.
