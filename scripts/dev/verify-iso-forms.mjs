// Reporte legible de la comparacion entre los formatos controlados generados y los
// machotes de calidad. La misma comparacion corre en tests/produccion-formatos.test.js.
// Uso: node scripts/dev/verify-iso-forms.mjs [--dump]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compareIsoForms } from "./iso-form-compare.mjs";

const dump = process.argv.includes("--dump");

function print(report) {
  console.log(`\n===== ${report.name} =====`);
  console.log(`paginas: machote=${report.pages.reference} generado=${report.pages.generated}`);
  console.log(`desviacion maxima texto: dx=${report.maxTextDx.toFixed(2)} dy=${report.maxTextDy.toFixed(2)}`);
  console.log(
    `bordes faltantes: horizontales=${report.missingH.length} verticales=${report.missingV.length}`
  );
  console.log(
    `textos sin coincidencia=${report.textMismatch.length} desplazados=${report.textShift.length} tamano distinto=${report.sizeMismatch.length}`
  );
  for (const row of report.textMismatch) {
    console.log(`  [texto] ${row.page} "${row.text}" refY=${row.refY} refX=${row.refX} genY=${row.genY} genX=${row.genX}`);
  }
  for (const row of report.textShift) {
    console.log(`  [x] ${row.page} "${row.text}" ref=${row.refX} gen=${row.genX}`);
  }
  for (const row of report.sizeMismatch) {
    console.log(`  [size] ${row.page} "${row.text}" ref=${row.refSize} gen=${row.genSize}`);
  }
  for (const row of report.missingH.slice(0, 40)) {
    console.log(`  [H] ${row.page} y=${row.y} x=${row.x1}..${row.x2}`);
  }
  for (const row of report.missingV.slice(0, 40)) {
    console.log(`  [V] ${row.page} x=${row.x} y=${row.y1}..${row.y2}`);
  }
}

const { buffers, reports } = await compareIsoForms();

if (dump) {
  const out = os.tmpdir();
  fs.writeFileSync(path.join(out, "iso-control-dimensional.pdf"), buffers.dimensional);
  fs.writeFileSync(path.join(out, "iso-orden-trabajo.pdf"), buffers.workOrder);
  fs.writeFileSync(path.join(out, "iso-cotizacion.pdf"), buffers.quote);
  console.log(`PDFs generados en ${out}`);
}

reports.forEach(print);

const failures = reports.filter(
  (r) =>
    r.missingH.length ||
    r.missingV.length ||
    r.textMismatch.length ||
    r.textShift.length ||
    r.sizeMismatch.length
);
if (failures.length) {
  console.log("\nRevisar diferencias arriba.");
  process.exitCode = 1;
} else {
  console.log("\nFormatos alineados con el machote.");
}
