import { analyzePdf, textLines } from "../scripts/dev/pdf-layout.mjs";

export function pdfText(buffer) {
  const { pages } = analyzePdf(buffer);
  return pages.flatMap((page) => textLines(page).map((line) => line.text)).join("\n");
}

export function pdfImages(buffer) {
  const { pages } = analyzePdf(buffer);
  return pages.flatMap((page) => page.images || []);
}
