import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Farmacia de Curepto | Sistema de Reintegro",
  description: "Gestión de inventario de reintegro para Farmacia de Curepto",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={outfit.variable}>
        {children}
      </body>
    </html>
  );
}
