import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, "../../docs/catalogo-notificaciones-comsa.pdf");

const doc = new PDFDocument({
  margin: 42,
  size: "LETTER",
  info: {
    Title: "Catalogo de notificaciones COMSA ERP",
    Author: "COMSA ERP",
  },
});

const stream = fs.createWriteStream(out);
doc.pipe(stream);

const left = () => doc.page.margins.left;
const right = () => doc.page.width - doc.page.margins.right;
const width = () => right() - left();
const bottom = () => doc.page.height - doc.page.margins.bottom;

function ensureSpace(needed = 72) {
  if (doc.y + needed > bottom()) doc.addPage();
}

function titlePage() {
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#0f2744")
    .text("COMSA ERP", left(), doc.y, { width: width() });
  doc.moveDown(0.35);
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#1e3a5f")
    .text("Catalogo de notificaciones posibles", { width: width() });
  doc.moveDown(0.35);
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#555555")
    .text("Referencia por roles y permisos del sistema. Fecha: 9 sep 2026.", {
      width: width(),
    });
  doc.moveDown(0.5);
  note(
    "Estado actual: no existe un modulo de notificaciones de negocio. Solo hay un stub de reset de acceso (sin SMTP real). El resto es el catalogo posible alineado a permisos, roles de sistema y la propuesta de infraestructura (Mailgun)."
  );
}

function h1(text) {
  ensureSpace(48);
  doc.moveDown(0.6);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#0f2744")
    .text(text, { width: width() });
  doc
    .moveTo(left(), doc.y + 2)
    .lineTo(right(), doc.y + 2)
    .strokeColor("#c5d0de")
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.55);
}

function h2(text) {
  ensureSpace(36);
  doc.moveDown(0.35);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#1e3a5f")
    .text(text, { width: width() });
  doc.moveDown(0.25);
}

function note(text) {
  ensureSpace(40);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#444444")
    .text(text, { width: width(), lineGap: 2 });
  doc.moveDown(0.35);
}

function bullet(text) {
  ensureSpace(28);
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#333333")
    .text(`•  ${text}`, { width: width(), lineGap: 1.5 });
}

/** Tarjeta por notificacion: evita solapamiento de columnas. */
function notifyCard({ name, trigger, recipients, roles }) {
  const pad = 8;
  const labelW = 78;
  const valueW = width() - pad * 2 - labelW;
  const lines = [
    ["Notificacion", name],
    ["Disparo", trigger],
    ["Destinatarios", recipients],
    ["Roles / permiso", roles],
  ];

  let contentH = pad;
  for (const [, value] of lines) {
    contentH +=
      doc.heightOfString(String(value || "—"), {
        width: valueW,
        lineGap: 1,
      }) + 6;
  }
  contentH += pad;

  ensureSpace(contentH + 10);
  const y0 = doc.y;

  doc
    .save()
    .roundedRect(left(), y0, width(), contentH, 4)
    .fillAndStroke("#f7f9fc", "#d7dee8")
    .restore();

  let y = y0 + pad;
  for (const [label, value] of lines) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor("#5a6b7d")
      .text(label, left() + pad, y, { width: labelW, lineBreak: false });
    const h = doc.heightOfString(String(value || "—"), {
      width: valueW,
      lineGap: 1,
    });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#1a1a1a")
      .text(String(value || "—"), left() + pad + labelW, y, {
        width: valueW,
        lineGap: 1,
      });
    y += h + 6;
  }

  doc.y = y0 + contentH + 8;
}

function section(title, items) {
  h2(title);
  for (const item of items) notifyCard(item);
}

titlePage();

h1("1. Criterio de ruteo recomendado");
bullet("Por permiso (ej. quotes.approve -> aviso de cotizacion pendiente).");
bullet("Por dueno del documento (vendedor, creador, responsable asignado).");
bullet("Por equipo / peers cuando aplique sales.view_team.");
bullet(
  "No depender solo del nombre del rol; los permisos efectivos pueden venir de roles directos o de equipos."
);

h1("2. Auth / sistema");
section("Eventos", [
  {
    name: "Reset de acceso",
    trigger: "Solicitud de recuperacion",
    recipients: "Ese usuario",
    roles: "Cualquier usuario ACTIVE (stub actual)",
  },
  {
    name: "Usuario creado / desactivado",
    trigger: "Alta o baja de usuario",
    recipients: "Usuario afectado; opcional Admin",
    roles: "users.create / users.edit",
  },
]);

h1("3. Cotizaciones (quotes.*)");
section("Eventos", [
  {
    name: "Cotizacion enviada a aprobacion",
    trigger: "submit",
    recipients: "Quienes puedan aprobar",
    roles: "Supervisor, Direccion, Admin (quotes.approve)",
  },
  {
    name: "Cotizacion aprobada",
    trigger: "approve",
    recipients: "Vendedor / creador",
    roles: "Ventas, Supervisor",
  },
  {
    name: "Cotizacion rechazada",
    trigger: "reject",
    recipients: "Vendedor / creador",
    roles: "Ventas",
  },
  {
    name: "Devuelta a borrador",
    trigger: "return_to_draft",
    recipients: "Vendedor / creador",
    roles: "Ventas",
  },
  {
    name: "Enviada a produccion",
    trigger: "send_to_production",
    recipients: "Produccion / supervisor de piso",
    roles: "Produccion, Supervisor",
  },
  {
    name: "Cotizacion cancelada",
    trigger: "cancel",
    recipients: "Vendedor + involucrados",
    roles: "Ventas, Supervisor",
  },
]);

h1("4. Ordenes directas (direct_orders.*)");
section("Eventos", [
  {
    name: "Enviada a aprobacion",
    trigger: "submit",
    recipients: "Aprobadores",
    roles: "Supervisor, Direccion (direct_orders.approve)",
  },
  {
    name: "Aprobada / rechazada",
    trigger: "approve / reject",
    recipients: "Creador",
    roles: "Ventas",
  },
  {
    name: "Enviada a produccion",
    trigger: "send_to_production",
    recipients: "Produccion",
    roles: "Produccion, Supervisor",
  },
]);

h1("5. Produccion (production.*)");
section("Eventos", [
  {
    name: "Nueva OP / asignacion de responsable",
    trigger: "Alta OP / assign_responsible",
    recipients: "Responsable asignado",
    roles: "Produccion",
  },
  {
    name: "OP iniciada / avance",
    trigger: "start / update_progress",
    recipients: "Supervisor / vendedor de la cotizacion",
    roles: "Supervisor, Ventas",
  },
  {
    name: "Partida u OP completada",
    trigger: "complete_item / complete_order",
    recipients: "Vendedor + Supervisor",
    roles: "Ventas, Supervisor",
  },
  {
    name: "Incidencia abierta / cerrada",
    trigger: "manage_incidents",
    recipients: "Supervisor + responsable",
    roles: "Supervisor, Produccion",
  },
  {
    name: "Material listo",
    trigger: "materials-ready",
    recipients: "Compras / Almacen",
    roles: "Compras, Almacen",
  },
  {
    name: "Fecha compromiso cambiada",
    trigger: "edit_commitment / planning",
    recipients: "Vendedor",
    roles: "Ventas, Supervisor",
  },
]);

h1("6. Compras (purchase_orders.*)");
section("Eventos", [
  {
    name: "OC creada / enviada a aprobacion",
    trigger: "create / submit",
    recipients: "Aprobadores de OC",
    roles: "Direccion, Admin (purchase_orders.approve)",
  },
  {
    name: "OC aprobada / rechazada",
    trigger: "approve / reject",
    recipients: "Quien creo la OC",
    roles: "Compras, Ventas",
  },
  {
    name: "Recepcion parcial / total",
    trigger: "receive",
    recipients: "Compras + solicitante",
    roles: "Compras, Almacen, Ventas",
  },
  {
    name: "OC cancelada",
    trigger: "cancel",
    recipients: "Involucrados",
    roles: "Compras",
  },
]);

h1("7. Inventario / almacen");
section("Eventos", [
  {
    name: "Stock bajo",
    trigger: "available <= minimo",
    recipients: "Quienes ven inventario",
    roles: "Almacen, Compras, Admin (inventory.view)",
  },
  {
    name: "Transferencia solicitada / completada",
    trigger: "Transferencias",
    recipients: "Origen y destino de almacen",
    roles: "Almacen",
  },
  {
    name: "Entrada / salida / ajuste",
    trigger: "Movimientos de inventario",
    recipients: "Almacen / auditoria",
    roles: "Almacen, Admin",
  },
]);
note(
  "Nota: el stock bajo hoy existe solo como lista/KPI en UI (inventory.view), no como notificacion email/push."
);

h1("8. Ventas / facturas (sales.*)");
section("Eventos", [
  {
    name: "Factura registrada",
    trigger: "create_invoice",
    recipients: "Vendedor / equipo (si aplica)",
    roles: "Ventas, Supervisor, Direccion",
  },
  {
    name: "Factura sin recepcion del cliente",
    trigger: "Recordatorio / digest",
    recipients: "Vendedor",
    roles: "Ventas (sales.view)",
  },
  {
    name: "Meta de ventas: avance / riesgo",
    trigger: "Digest periodico",
    recipients: "Vendedor + quien gestiona metas",
    roles: "Ventas; sales.manage_goals (Supervisor/Direccion)",
  },
]);

h1("9. Calidad (planeado; fuera de alcance actual)");
section("Eventos", [
  {
    name: "Pass / fail",
    trigger: "Resultado de calidad",
    recipients: "Produccion, Supervisor",
    roles: "Produccion, Supervisor",
  },
]);

h1("10. Digest y recordatorios (planeado)");
section("Eventos", [
  {
    name: "Resumen diario / semanal",
    trigger: "Cron",
    recipients: "Segun preferencias / rol",
    roles: "Configurable",
  },
  {
    name: "Pendientes de aprobacion",
    trigger: "Cron",
    recipients: "Quienes tengan *.approve",
    roles: "Quotes, OD, OC",
  },
  {
    name: "Compromisos de entrega proximos",
    trigger: "Cron",
    recipients: "Ventas, Supervisor",
    roles: "Fechas compromiso / ETA",
  },
]);

h1("11. Mapa rol -> familias de aviso");
const roleMap = [
  ["Administrador", "Todas (opcional: resumen critico)"],
  ["Direccion", "Aprobaciones cotizacion/OC, ventas, digest ejecutivo"],
  ["Supervisor", "Aprobaciones, produccion, incidencias, metas, compromisos"],
  [
    "Ventas",
    "Estado de sus cotizaciones/OD, facturas, compromisos, envio a produccion",
  ],
  ["Produccion", "Asignaciones, incidencias, avances de sus OPs"],
  ["Compras", "OC (flujo y recepcion), material listo, stock bajo"],
  ["Almacen", "Recepciones, transferencias, stock bajo, movimientos"],
  ["Administracion", "Poco operativo; opcional catalogos/auditoria"],
];
for (const [role, families] of roleMap) {
  notifyCard({
    name: role,
    trigger: "—",
    recipients: families,
    roles: role,
  });
}

h1("12. Volumen estimado (propuesta infraestructura)");
note("Estimacion documental de correos por mes (escenarios A / R / C):");
const volumes = [
  ["Reset de acceso", "10 / 25 / 50"],
  ["Cotizacion (envio / aprobacion / rechazo)", "80 / 250 / 600"],
  ["Produccion (asignacion, estatus, incidencia)", "150 / 500 / 1,500"],
  ["Ordenes de compra y recepciones", "40 / 120 / 350"],
  ["Transferencias y stock bajo", "30 / 80 / 200"],
  ["Calidad (pass / fail)", "20 / 80 / 250"],
  ["Recordatorios y digest", "400 / 1,200 / 4,000"],
  ["Total estimado", "~730 / ~2,250 / ~7,000"],
];
for (const [evento, vol] of volumes) {
  notifyCard({
    name: evento,
    trigger: "Volumen A / R / C",
    recipients: vol,
    roles: "Mailgun (planeado)",
  });
}

h1("13. Canales");
bullet("Email transaccional (Mailgun) — planeado.");
bullet("In-app (centro de notificaciones) — no implementado.");
bullet("Push / SMS / WhatsApp — fuera de alcance.");

doc.moveDown(0.8);
note(
  "Fuente: SYSTEM_ROLES y catalogo de permisos (lib/permissions/catalog.js), flujos de cotizacion/produccion/compras/ventas, y docs/propuesta-infraestructura-comsa.md."
);

doc.end();

await new Promise((resolve, reject) => {
  stream.on("finish", resolve);
  stream.on("error", reject);
});

console.log("Wrote", out);
