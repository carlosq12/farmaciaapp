"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Login from "./Login";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, updateProfilePhoto } = useAuth();
  const pathname = usePathname();
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError("Por favor, selecciona una imagen válida.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setUploadError("La imagen es demasiado grande. Máximo 5MB.");
      return;
    }

    setUploadError("");
    setIsUploading(true);

    const result = await updateProfilePhoto(file);
    if (!result.success) {
      setUploadError(result.message || "Error al subir la imagen.");
    } else {
      setIsProfileModalOpen(false);
    }
    
    setIsUploading(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}>
        <p style={{ color: "var(--primary)", fontWeight: 800 }}>Cargando sistema...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3rem' }}>
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
             <span style={{ color: "#c2185b", fontWeight: 900, fontSize: "24px" }}>F</span>
          </div>
          <span className="logo-text" style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.05em' }}>ARMACIA</span>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>Etiquetas</span>
          </Link>
          
          {(user.rol === "Administrador" || user.rol === "Admin") && (
            <Link href="/usuarios" className={`nav-item ${pathname === '/usuarios' ? 'active' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Usuarios</span>
            </Link>
          )}
        </nav>

        <div className="profile-card">
          <div className="profile-info" onClick={() => setIsProfileModalOpen(true)} style={{ cursor: "pointer" }} title="Cambiar foto de perfil">
            <div className="profile-avatar">
              {user.photoUrl ? (
                <img src={user.photoUrl} alt="Perfil" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px" }} />
              ) : (
                user.nombreCompleto.charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "white" }}>{user.nombreCompleto}</span>
              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{user.rol}</span>
            </div>
          </div>
          
          <button 
            className="logout-btn"
            onClick={logout}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {children}
      </main>

      {/* Modal de Perfil */}
      {isProfileModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: "400px", textAlign: "center" }}>
            <button 
              style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#94a3b8" }}
              onClick={() => { setIsProfileModalOpen(false); setUploadError(""); }}
            >
              &times;
            </button>
            
            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>Tu Perfil</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "2rem" }}>Actualiza tu foto de perfil.</p>

            <div style={{ width: "100px", height: "100px", margin: "0 auto 1.5rem", borderRadius: "24px", overflow: "hidden", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", color: "var(--primary)", fontWeight: 800 }}>
              {user.photoUrl ? (
                <img src={user.photoUrl} alt="Perfil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                user.nombreCompleto.charAt(0).toUpperCase()
              )}
            </div>

            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              onChange={handlePhotoUpload}
            />

            {uploadError && (
              <p style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "1rem", fontWeight: 600 }}>{uploadError}</p>
            )}

            <button 
              className="primary" 
              style={{ width: "100%" }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? "Subiendo..." : "Seleccionar Imagen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
