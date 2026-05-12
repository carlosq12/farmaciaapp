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
        <div className="layout-container">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '3rem' }}>
              <div style={{ 
                width: "42px", 
                height: "42px", 
                backgroundColor: "white", 
                borderRadius: "12px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
              }}>
                 <span style={{ color: "#c2185b", fontWeight: 900, fontSize: "24px" }}>P</span>
              </div>
              <span className="logo-text" style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.05em' }}>PERSONAL</span>
            </div>

            <nav style={{ flex: 1 }}>
              <div className="nav-item active">
                <span>📦</span>
                <span>Inventario</span>
              </div>
              {/* Opciones personalizadas irán aquí */}
            </nav>

            <div className="nav-item" style={{ marginTop: "auto" }}>
              <span>👤</span>
              <span>Usuario Admin</span>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
