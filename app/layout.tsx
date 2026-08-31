import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infytter Fitness - Gestión de Gimnasio",
  description:
    "Gestión de clientes, caja y operación multi-sucursal para gimnasios.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
