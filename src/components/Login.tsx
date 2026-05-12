"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const formatRut = (value: string) => {
    // Basic RUT formatter, remove anything that is not a number or k
    let clean = value.replace(/[^0-9kK]/g, "");
    if (clean.length > 9) clean = clean.slice(0, 9);
    
    // Auto format XX.XXX.XXX-X
    if (clean.length > 1) {
      const dv = clean.slice(-1);
      let numbers = clean.slice(0, -1);
      
      let formatted = "";
      while (numbers.length > 3) {
        formatted = "." + numbers.slice(-3) + formatted;
        numbers = numbers.slice(0, -3);
      }
      formatted = numbers + formatted + "-" + dv;
      return formatted.toUpperCase();
    }
    
    return clean.toUpperCase();
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRut(formatRut(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setIsLoading(true);

    if (isRegistering) {
      if (!nombreCompleto || !rut || !password) {
        setError("Todos los campos son obligatorios.");
        setIsLoading(false);
        return;
      }
      try {
        // Verificar si el RUT ya existe
        const q = query(collection(db, "usuarios"), where("rut", "==", rut));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          setError("Este RUT ya está registrado.");
          setIsLoading(false);
          return;
        }

        await addDoc(collection(db, "usuarios"), {
          nombreCompleto,
          rut,
          password,
          rol: "Funcionario",
          estado: "Pendiente"
        });

        setSuccessMsg("Registro exitoso. Tu cuenta está pendiente de validación por un Administrador.");
        setIsRegistering(false);
        setNombreCompleto("");
        setPassword("");
      } catch (err) {
        setError("Error al registrarse. Inténtalo más tarde.");
      }
    } else {
      const response = await login(rut, password);
      
      if (!response.success) {
        setError(response.message || "Error al iniciar sesión.");
      }
    }
    
    setIsLoading(false);
  };


  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      background: "#f1f5f9"
    }}>
      <div style={{
        background: "white",
        padding: "3rem",
        borderRadius: "24px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
        width: "100%",
        maxWidth: "420px",
        animation: "fadeIn 0.5s ease-out"
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ 
            width: "64px", 
            height: "64px", 
            backgroundColor: "#fdf2f8", 
            borderRadius: "16px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            boxShadow: "0 4px 12px rgba(194, 24, 91, 0.1)"
          }}>
             <span style={{ color: "#c2185b", fontWeight: 900, fontSize: "32px" }}>F</span>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>
            Servicio de Farmacia
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Hospital de Curepto
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label>Nombre Completo</label>
              <input 
                type="text" 
                placeholder="Ej: Juan Pérez" 
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                required
                style={{ padding: "0.85rem 1rem" }}
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: "1.5rem" }}>
            <label>RUT</label>
            <input 
              type="text" 
              placeholder="Ej: 12.345.678-9" 
              value={rut}
              onChange={handleRutChange}
              required
              style={{ padding: "0.85rem 1rem" }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "2rem" }}>
            <label>Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: "0.85rem 1rem" }}
            />
          </div>

          {error && (
            <div style={{ 
              background: "#fef2f2", 
              color: "#ef4444", 
              padding: "0.75rem", 
              borderRadius: "12px", 
              fontSize: "0.85rem",
              marginBottom: "1.5rem",
              textAlign: "center",
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{ 
              background: "#f0fdf4", 
              color: "#16a34a", 
              padding: "0.75rem", 
              borderRadius: "12px", 
              fontSize: "0.85rem",
              marginBottom: "1.5rem",
              textAlign: "center",
              fontWeight: 600
            }}>
              {successMsg}
            </div>
          )}

          <button 
            type="submit" 
            className="primary" 
            style={{ width: "100%", padding: "0.85rem", fontSize: "1rem", marginBottom: "1rem" }}
            disabled={isLoading}
          >
            {isLoading ? "Procesando..." : (isRegistering ? "Registrarse" : "Ingresar al Sistema")}
          </button>
          
          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
                setSuccessMsg("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--primary)",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.9rem"
              }}
            >
              {isRegistering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
