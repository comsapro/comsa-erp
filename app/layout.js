import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: {
    default: "COMSA ERP",
    template: "%s | COMSA ERP",
  },
  description: "Sistema ERP COMSA - Administracion y catalogos",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
