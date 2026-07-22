# COMSA ERP

ERP para COMSA PRO (manufactura CNC / industrial).

- **Etapa 1**: autenticacion, roles/permisos, layout, catalogos base, bitacora.
- **Etapa 2**: empresas emisoras, procesos, instalaciones, biblioteca de items,
  cotizaciones, ordenes directas, produccion y KPIs del dashboard.

## Stack

- Next.js 16 (App Router) + React 19
- JavaScript (sin TypeScript)
- Tailwind CSS v4
- PostgreSQL + Prisma 6
- NextAuth v5 (Auth.js) - Credenciales + sesiones JWT
- Zod, React Hook Form, Lucide React

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

Tras actualizar Etapa 2, vuelve a ejecutar `npm run db:seed` para sincronizar
permisos y roles del sistema.

## Scripts

| Script | Descripcion |
| --- | --- |
| `npm run dev` | Desarrollo |
| `npm run build` / `npm start` | Produccion |
| `npm test` | Pruebas (permisos, calculos, transiciones) |
| `npm run db:deploy` | Aplica migraciones |
| `npm run db:seed` | Permisos, roles, admin |

## Migraciones

1. `20260715000000_init` — Etapa 1
2. `20260722000000_etapa2` — Folios, empresas, procesos, instalaciones,
   templates, quotes, direct orders, production

## Modulos Etapa 2 (rutas UI)

| Ruta | Modulo |
| --- | --- |
| `/empresas-emisoras` | Perfiles / empresas que emiten cotizaciones |
| `/procesos` | Catalogo de procesos de manufactura |
| `/instalaciones` | Catalogo de conceptos de instalacion |
| `/biblioteca-items` | Templates reutilizables de items |
| `/cotizaciones` | Cotizaciones (listado, nuevo, detalle, imprimir) |
| `/ordenes-directas` | Ordenes sin cotizacion previa |
| `/produccion` | Seguimiento de produccion |

## APIs principales

- `/api/empresas-emisoras`, `/api/procesos`, `/api/instalaciones`
- `/api/biblioteca-items` (+ `[id]/duplicar`)
- `/api/cotizaciones` (+ items, acciones: submit/approve/reject/return/cancel/send-production/insert-template/reorder)
- `/api/ordenes-directas` (+ items, acciones)
- `/api/produccion` (+ acciones de orden e item)

## Permisos nuevos (resumen)

- `issuing_companies.*` (view/create/edit/manage)
- `manufacturing_processes.*`, `installation_concepts.*`
- `quote_templates.*`
- `quotes.*` (incluye approve, edit_benefit, apply_discount, send_to_production, print, …)
- `direct_orders.*` (incluye convert_to_quote, send_to_production)
- `production.*` (start, update_progress, complete_item, complete_order, cancel)

Ventas puede crear/enviar cotizaciones pero **no** aprobar ni bajar el beneficio
bajo 30% ni aplicar descuentos. Direccion/Administrador si.

## Folios

Formato `YYMM-CONSECUTIVO-A` (ej. `2607-38-A`), generados en transaccion via
`folio_sequences` + unique en BD.

## Calculos (servidor)

Por item: costos (manufactura + materiales + extras + instalacion) → beneficio %
→ subtotal → descuento % → IVA 16% → total. Cabecera = suma de items.
Los precios de catalogo se copian como **snapshots** historicos.

## Impresion

`/cotizaciones/[id]/imprimir` — HTML imprimible (CSS `@media print`), sin PDF
binario.

## QA manual sugerido

1. Seed + login como Administrador.
2. Crear empresa emisora, proceso, concepto de instalacion.
3. Crear template en biblioteca e insertarlo en una cotizacion borrador.
4. Completar item, enviar a aprobacion (sin items debe fallar).
5. Con usuario Ventas: no puede aprobar ni beneficio &lt; 30%.
6. Aprobar como Direccion/Admin → enviar a produccion (segunda vez debe fallar).
7. Avanzar items de produccion hasta completar la orden.
8. Crear orden directa → aprobar → convertir a cotizacion o enviar a produccion.
9. Verificar KPIs en el dashboard e impresion de cotizacion.
10. Confirmar bitacora de aprobaciones/rechazos.

## Supuestos

- Revision de folio fija en `A` (sin versionado avanzado).
- `CANCELLED` es terminal; `REJECTED` puede volver a `DRAFT`.
- IVA fijo 16%; sin tipo de cambio MXN/USD.
- Contacto de cliente debe pertenecer al cliente seleccionado.
- Catalogos inactivos no se pueden seleccionar en documentos nuevos.
