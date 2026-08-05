/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDFKit lee Helvetica.afm desde node_modules; si se bundlea, __dirname
  // apunta a un path invalido (p. ej. C:\\ROOT\\...) y falla el export.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
