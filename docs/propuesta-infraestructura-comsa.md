# Propuesta de infraestructura — COMSA ERP

**Fecha:** 30 de agosto de 2026  
**Sistema:** ERP COMSA PRO (cotizaciones, producción, inventario, compras, calidad)  
**Moneda de tarifas:** USD  
**Tipo de cambio de referencia:** 1 USD = 17.00 MXN  
**Precios al cliente:** costo de proveedores × **1.5** (comisión del 50%)  
**IVA:** no incluido

Este documento es para compartir con dirección / finanzas. Las tarifas son públicas (agosto 2026) y pueden cambiar. El correo transaccional **aún no está implementado** en el producto; aquí se reserva el costo para cuando se conecte.

---

## 1. Resumen ejecutivo

Se recomienda operar el ERP en **Vercel + Neon (PostgreSQL) + Vercel Blob privado + Mailgun**, con copias offsite en **Cloudflare R2**.

**Escenario recomendado** (20–40 usuarios, producción + staging, **sin Sentry**):

| Concepto | USD / mes | MXN / mes | USD / año | MXN / año |
| --- | ---: | ---: | ---: | ---: |
| Costo proveedores | 235.60 | 4,005 | 2,827 | 48,062 |
| Comisión (50%) | 117.80 | 2,003 | 1,414 | 24,031 |
| **Precio al cliente** | **353.40** | **6,008** | **4,241** | **72,094** |

**Sentry Team** es útil en producción, pero **opcional**. Si se incluye:

| Concepto | USD / mes | MXN / mes | USD / año |
| --- | ---: | ---: | ---: |
| Sentry (costo) | 29.00 | 493 | 348 |
| Sentry (precio ×1.5) | 43.50 | 740 | 522 |
| **Total al cliente con Sentry** | **396.90** | **6,747** | **4,763** |

Comparativo de **precio al cliente / mes** (sin Sentry / con Sentry):

| Escenario | Usuarios | Sin Sentry | Con Sentry |
| --- | --- | ---: | ---: |
| Arranque | 10–20 | **211 USD** (~3,585 MXN) | 254 USD |
| **Recomendado** | **20–40** | **353 USD** (~6,008 MXN) | **397 USD** |
| Consolidado | 40–80, 2 turnos | **694 USD** (~11,807 MXN) | 738 USD (+ Better Stack: 774 USD) |

Hobby de Vercel **no aplica**: el ERP es uso comercial.

---

## 2. Qué se está cotizando

| Capa | Proveedor | Rol |
| --- | --- | --- |
| Aplicación Next.js | Vercel Pro (Virginia, `iad1`) | Hosting, deploys, functions, PDF, API |
| Base de datos | Neon Launch (PostgreSQL, `us-east-1`) | Datos operativos. Always-on para evitar cortes de Prisma |
| Archivos | Vercel Blob **privado** | Planos, escaneos, adjuntos. No son públicos |
| Correo | **Mailgun** (Basic o Foundation) | Notificaciones de flujo. Pendiente de implementar. Encaja con `SMTP_HOST` |
| Backup offsite | Cloudflare R2 | Dumps de Postgres + réplica del Blob |
| Restore corto | Neon PITR 7 días + 3 snapshots | Recuperación rápida *dentro* de Neon |
| Monitoreo | **Sentry Team (opcional)** | Errores de aplicación y 1 chequeo de uptime |
| Administración | Retainer mensual | Deploys, parches, verificar backups. No incluye desarrollo de módulos |

Los archivos **no se sirven con URL pública**. La descarga pasa por la API autenticada (`/api/blob`) con permisos de cotización o producción.

---

## 3. Desglose por partida

Precio al cliente = **costo × 1.5**. Comisión = **costo × 0.5**.

Leyenda de escenarios: **A** arranque · **R** recomendado · **C** consolidado.

### 3.1 Hosting — Vercel

| Partida | Detalle | Costo A | Costo R | Costo C | Precio R (×1.5) |
| --- | --- | ---: | ---: | ---: | ---: |
| Vercel Pro — asiento(s) | 1 asiento (A/R) o 2 (C). Crédito de uso $20/mes incluido | 20.00 | 20.00 | 40.00 | **30.00** |
| Vercel — uso extra | Compute, CDN y builds caben en el crédito. En C se reserva origin transfer de PDFs privados | 0.00 | 0.00 | 8.00 | **0.00** |

### 3.2 Base de datos — Neon Launch

Compute: **$0.106 / CU-hora × 730 h/mes**. 1 CU ≈ 1 vCPU + 4 GB RAM.

| Partida | Detalle | Costo A | Costo R | Costo C | Precio R |
| --- | --- | ---: | ---: | ---: | ---: |
| Compute producción | Always-on. A: 0.25 CU · R: 0.5 CU · C: 1 CU | 19.35 | 38.69 | 77.38 | **58.04** |
| Almacenamiento producción | $0.35/GB. 5 / 15 / 40 GB | 1.75 | 5.25 | 14.00 | **7.88** |
| PITR 7 días producción | $0.20/GB. Restore en la misma cuenta Neon | 1.00 | 3.00 | 8.00 | **4.50** |
| Compute staging | A: no hay. R: scale-to-zero ~50 CU-h. C: 0.25 CU always-on | — | 5.30 | 19.35 | **7.95** |
| Almacenamiento staging | 2 GB | — | 0.70 | 0.70 | **1.05** |

### 3.3 Archivos — Vercel Blob (privado)

Pro incluye **5 GB**. Extra: **$0.023 / GB-mes**. Totales estimados: 10 / 50 / 200 GB.

| Partida | Detalle | Costo A | Costo R | Costo C | Precio R |
| --- | --- | ---: | ---: | ---: | ---: |
| Almacenamiento extra | 5 / 45 / 195 GB de extra | 0.12 | 1.04 | 4.49 | **1.56** |

### 3.4 Correo — Mailgun (pendiente de implementar)

Hoy el ERP no envía notificaciones de negocio (solo hay un reset de acceso, sin SMTP real). El renglón **sí se cotiza** para cuando se conecte.

Volumen estimado de correos / mes:

| Evento | A | R | C |
| --- | ---: | ---: | ---: |
| Reset de acceso | 10 | 25 | 50 |
| Cotización (envío / aprobación / rechazo) | 80 | 250 | 600 |
| Producción (asignación, estatus, incidencia) | 150 | 500 | 1,500 |
| Órdenes de compra y recepciones | 40 | 120 | 350 |
| Transferencias y stock bajo | 30 | 80 | 200 |
| Calidad (pass / fail) | 20 | 80 | 250 |
| Recordatorios y digest | 400 | 1,200 | 4,000 |
| **Total estimado** | **~730** | **~2,250** | **~7,000** |

| Partida | Plan | Costo A | Costo R | Costo C | Precio R |
| --- | --- | ---: | ---: | ---: | ---: |
| Mailgun envío transaccional | A/R: **Basic $15 / 10,000 correos**. C: **Foundation $35 / 50,000** | 15.00 | 15.00 | 35.00 | **22.50** |

Si el volumen pasa de 10,000/mes, se sube a Foundation ($35). No incluye SMS ni WhatsApp.

### 3.5 Dominio

| Partida | Detalle | Costo A / R / C | Precio R |
| --- | --- | ---: | ---: |
| Dominio .mx + TLS | ~$20 USD/año. HTTPS lo cubre Vercel | 1.67 | **2.51** |

### 3.6 Backups

El PITR de Neon **no basta** si se pierde la cuenta o el proyecto. Por eso hay copia fuera de Neon/Vercel.

| Partida | Detalle | Costo A | Costo R | Costo C | Precio R |
| --- | --- | ---: | ---: | ---: | ---: |
| Snapshots Neon (×3) | $0.09/GB × 3 copias × tamaño de datos | 1.35 | 4.05 | 10.80 | **6.08** |
| R2 — dumps Postgres | Dump diario comprimido, ~30 días. $0.015/GB | 0.12 | 0.30 | 0.75 | **0.45** |
| R2 — réplica de Blob | Copia 1:1 de archivos privados. Egress $0 | 0.08 | 0.60 | 2.85 | **0.90** |

El job de dump/sync corre en **Vercel Cron** y se considera cubierto por el crédito del plan Pro. La prueba de restore mensual entra en las horas de administración.

### 3.7 Administración

Tarifa de operación: **$40 USD / hora**. No incluye desarrollo de funcionalidad nueva.

| Partida | Horas / mes | Costo A | Costo R | Costo C | Precio R |
| --- | ---: | ---: | ---: | ---: | ---: |
| Administración y operación | 2 / 3.5 / 6 | 80.00 | 140.00 | 240.00 | **210.00** |

Alcance: deploys, migraciones, revisar que los backups corrieron, respuesta a caídas, rotación de secretos. Fuera de alcance: nuevas pantallas, Mailgun (el desarrollo del módulo), capacitación de planta.

### 3.8 Opcional — Sentry

Sirve para ver errores reales de usuarios (piso, calidad, PDFs) sin adivinar. **No es requisito para arrancar.**

| Partida | Detalle | Costo | Precio ×1.5 |
| --- | --- | ---: | ---: |
| Sentry Team | Pago mensual $29. 50 mil errores, 1 uptime | 29.00 | **43.50** |
| Better Stack (solo consolidado) | Uptime extra / on-call ligero | 24.00 | **36.00** |

---

## 4. Totales por escenario (sin Sentry)

Cifras en **USD / mes**.

| Partida | Arranque | Recomendado | Consolidado |
| --- | ---: | ---: | ---: |
| Vercel Pro — asiento(s) | 20.00 | 20.00 | 40.00 |
| Vercel — uso extra | — | — | 8.00 |
| Neon compute producción | 19.35 | 38.69 | 77.38 |
| Neon almacenamiento producción | 1.75 | 5.25 | 14.00 |
| Neon PITR 7 días | 1.00 | 3.00 | 8.00 |
| Neon compute staging | — | 5.30 | 19.35 |
| Neon almacenamiento staging | — | 0.70 | 0.70 |
| Vercel Blob extra | 0.12 | 1.04 | 4.49 |
| Mailgun | 15.00 | 15.00 | 35.00 |
| Dominio + TLS | 1.67 | 1.67 | 1.67 |
| Snapshots Neon ×3 | 1.35 | 4.05 | 10.80 |
| R2 dumps Postgres | 0.12 | 0.30 | 0.75 |
| R2 réplica Blob | 0.08 | 0.60 | 2.85 |
| Administración | 80.00 | 140.00 | 240.00 |
| **Costo proveedores** | **140.44** | **235.60** | **462.99** |
| **Comisión 50%** | **70.22** | **117.80** | **231.50** |
| **Precio al cliente** | **210.66** | **353.40** | **694.49** |
| Precio al cliente (MXN) | ~3,581 | **~6,008** | ~11,806 |

Suma de arranque: 20+19.35+1.75+1+0.12+15+1.67+1.35+0.12+0.08+80 = **140.44**.

---

## 5. Totales con Sentry (opcional)

| Escenario | Base al cliente | + Sentry ×1.5 | Total al cliente |
| --- | ---: | ---: | ---: |
| Arranque | 210.66 | 43.50 | **254.16** |
| Recomendado | 353.40 | 43.50 | **396.90** |
| Consolidado | 694.49 | 43.50 | **737.99** |
| Consolidado + Better Stack | 694.49 | 79.50 | **773.99** |

---

## 6. Qué no está incluido

- IVA (16% si aplica como importación de servicios).
- Horas de **desarrollo** para programar las notificaciones (solo está el envío Mailgun).
- SMS, WhatsApp, mailing de marketing a clientes.
- Licencias de Google Workspace / Microsoft 365.
- Hardware de piso (tablets, pistolas QR, red de planta).
- Neon Scale (SLA 99.95%; el compute sale ~2×).
- Add-ons Vercel: SSO SAML (~$300), IPs estáticas (~$100).
- Capacitación de usuarios.

---

## 7. Recomendación

1. Contratar el **escenario recomendado sin Sentry**: **353 USD/mes** al cliente (~**6,008 MXN**), **4,241 USD el primer año**.
2. Activar **Sentry** cuando el ERP esté en piso real (+**44 USD/mes** al cliente).
3. Reservar Mailgun Basic desde el día 1 aunque el módulo de avisos se implemente después, para no rediseñar SMTP.
4. No apagar Neon (scale-to-zero): ahorra ~15–40 USD de costo, pero reintroduce cortes de conexión en producción.

---

## 8. Fuentes de tarifas (agosto 2026)

- [Vercel Pricing](https://vercel.com/pricing) — Pro $20/asiento, $20 de crédito de uso.
- [Neon Pricing](https://neon.com/pricing) — Launch $0.106/CU-h, storage $0.35/GB, PITR $0.20/GB, snapshots $0.09/GB.
- [Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing) — $0.023/GB.
- [Mailgun Pricing](https://www.mailgun.com/pricing/) — Basic $15 / 10k; Foundation $35 / 50k.
- [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/) — $0.015/GB, 10 GB free, egress $0.
- [Sentry Pricing](https://sentry.io/pricing/) — Team $29/mes en pago mensual ($26 si anual).

Administración: $40 USD/hora (retainer). Comisión comercial: **×1.5 sobre cada partida**.
