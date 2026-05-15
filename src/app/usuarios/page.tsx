"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  deleteDoc,
  updateDoc,
  doc 
} from "firebase/firestore";
import { useAuth, User } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface UserData extends User {
  password?: string;
  estado?: string;
}

export default function UsuariosPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombreCompleto: "",
    rut: "",
    password: "",
    rol: "Funcionario"
  });
  const [loading, setLoading] = useState(false);

  // Redirigir si no es admin
  useEffect(() => {
    if (user && !["administrador", "admin", "subrogante"].includes(user.rol.toLowerCase())) {
      router.push("/");
    }
  }, [user, router]);

  useEffect(() => {
    const q = query(collection(db, "usuarios"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData: UserData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          nombreCompleto: data.nombreCompleto,
          rut: data.rut,
          rol: data.rol,
          password: data.password || "",
          estado: data.estado || "Aprobado",
          photoUrl: data.photoUrl || "",
        });
      });
      setUsuarios(usersData);
    });

    return () => unsubscribe();
  }, []);

  const formatRut = (value: string) => {
    if (value.toUpperCase() === "ADMIN") return "ADMIN";
    let clean = value.replace(/[^0-9kK]/g, "");
    if (clean.length > 9) clean = clean.slice(0, 9);
    
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
    setFormData({ ...formData, rut: formatRut(e.target.value) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editUser) {
        await updateDoc(doc(db, "usuarios", editUser.id), {
          nombreCompleto: formData.nombreCompleto,
          rut: formData.rut,
          password: formData.password,
          rol: formData.rol,
          estado: editUser.estado || "Aprobado",
        });
      } else {
        await addDoc(collection(db, "usuarios"), {
          nombreCompleto: formData.nombreCompleto,
          rut: formData.rut,
          password: formData.password,
          rol: formData.rol,
          estado: "Aprobado", // Creado por admin se aprueba automáticamente
        });
      }
      
      setFormData({
        nombreCompleto: "",
        rut: "",
        password: "",
        rol: "Funcionario"
      });
      setEditUser(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al guardar usuario:", error);
      alert("Hubo un error al guardar el usuario.");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (u: UserData) => {
    setEditUser(u);
    setFormData({
      nombreCompleto: u.nombreCompleto,
      rut: u.rut,
      password: u.password || "",
      rol: u.rol,
    });
    setIsModalOpen(true);
  };


  const handleApprove = async (docId: string) => {
    try {
      await updateDoc(doc(db, "usuarios", docId), {
        estado: "Aprobado"
      });
    } catch (error) {
      console.error("Error al aprobar usuario:", error);
      alert("Hubo un error al aprobar.");
    }
  };

  const handleDelete = async (docId: string) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este usuario?")) {
      try {
        await deleteDoc(doc(db, "usuarios", docId));
      } catch (error) {
        console.error("Error al eliminar usuario:", error);
        alert("Hubo un error al eliminar.");
      }
    }
  };

  if (!user || !["administrador", "admin", "subrogante"].includes(user.rol.toLowerCase())) {
    return null; // Don't render anything while redirecting
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "3rem" }}>
        <div>
          <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)", marginBottom: "0.5rem" }}>Administración</p>
          <h2 style={{ fontSize: "2rem", fontWeight: 800 }}>Gestor de Usuarios</h2>
          <p style={{ color: "var(--text-muted)" }}>Control de acceso y permisos del sistema.</p>
        </div>
        <button className="primary" onClick={() => {
          setEditUser(null);
          setFormData({ nombreCompleto: "", rut: "", password: "", rol: "Funcionario" });
          setIsModalOpen(true);
        }}>
          + Nuevo Usuario
        </button>
      </div>

      <div style={{ background: "white", borderRadius: "24px", padding: "1.5rem", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
        {usuarios.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
            <p>No hay usuarios registrados.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9", textAlign: "left" }}>
                <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>NOMBRE</th>
                <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>RUT</th>
                <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>ROL</th>
                <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>ESTADO</th>
                <th style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ 
                      width: "36px", height: "36px", borderRadius: "10px", 
                      background: "linear-gradient(135deg, #fce4ec 0%, #f48fb1 100%)", 
                      color: "#880e4f", display: "flex", alignItems: "center", justifyContent: "center", 
                      fontWeight: 800, fontSize: "1rem", overflow: "hidden" 
                    }}>
                      {u.photoUrl ? (
                        <img src={u.photoUrl} alt={u.nombreCompleto} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        u.nombreCompleto.charAt(0).toUpperCase()
                      )}
                    </div>
                    {u.nombreCompleto}
                  </td>
                  <td style={{ padding: "1rem", color: "var(--text-muted)", fontFamily: "monospace", fontSize: "0.95rem" }}>{u.rut}</td>
                  <td style={{ padding: "1rem" }}>
                    <span style={{ 
                      padding: "4px 12px", 
                      background: ["Administrador", "Admin", "Subrogante"].includes(u.rol) ? "#fdf2f8" : "#f1f5f9", 
                      color: ["Administrador", "Admin", "Subrogante"].includes(u.rol) ? "var(--primary)" : "#64748b",
                      borderRadius: "100px",
                      fontSize: "0.8rem",
                      fontWeight: 700
                    }}>
                      {u.rol}
                    </span>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <span style={{ 
                      padding: "4px 12px", 
                      background: u.estado === "Pendiente" ? "#fffbeb" : "#f0fdf4", 
                      color: u.estado === "Pendiente" ? "#d97706" : "#16a34a",
                      borderRadius: "100px",
                      fontSize: "0.8rem",
                      fontWeight: 700
                    }}>
                      {u.estado}
                    </span>
                  </td>
                  <td style={{ padding: "1rem", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                    {u.estado === "Pendiente" && (
                      <button 
                        onClick={() => handleApprove(u.id)}
                        style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: "1.1rem" }}
                        title="Aprobar Usuario"
                      >
                        ✅
                      </button>
                    )}
                    <button 
                      onClick={() => openEditModal(u)}
                      style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "1.1rem" }}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => handleDelete(u.id)}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.1rem" }}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: "500px" }}>
            <button 
              style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#94a3b8" }}
              onClick={() => setIsModalOpen(false)}
            >
              &times;
            </button>
            
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
                {editUser ? "Editar Usuario" : "Nuevo Usuario"}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                {editUser ? "Modifica los datos del funcionario." : "Ingresa los datos para dar acceso al sistema."}
              </p>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label>Nombre Completo</label>
                <input 
                  type="text" 
                  placeholder="Ej: Juan Pérez"
                  value={formData.nombreCompleto}
                  onChange={(e) => setFormData({...formData, nombreCompleto: e.target.value})}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label>RUT</label>
                <input 
                  type="text" 
                  placeholder="Ej: 12.345.678-9"
                  value={formData.rut}
                  onChange={handleRutChange}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2.5rem" }}>
                <div className="form-group">
                  <label>Contraseña</label>
                  <input 
                    type="text" 
                    placeholder="Contraseña inicial"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Rol en el Sistema</label>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    {[
                      { id: "Funcionario", icon: "👤" },
                      { id: "Administrador", icon: "🛡️" },
                      { id: "Subrogante", icon: "🔄" }
                    ].map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setFormData({...formData, rol: role.id})}
                        style={{
                          flex: 1,
                          padding: "0.6rem 0.4rem",
                          borderRadius: "10px",
                          border: formData.rol === role.id ? "2px solid var(--primary)" : "2px solid #f1f5f9",
                          background: formData.rol === role.id ? "#fdf2f8" : "white",
                          color: formData.rol === role.id ? "var(--primary)" : "#64748b",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span style={{ fontSize: "1.1rem" }}>{role.icon}</span>
                        {role.id}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? "Guardando..." : (editUser ? "Guardar Cambios" : "Registrar Usuario")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
