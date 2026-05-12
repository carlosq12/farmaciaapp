"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  Timestamp 
} from "firebase/firestore";

interface Reintegro {
  id: string;
  docId: string;
  nombreMedicamento: string;
  cantidadCajas: number;
  cantidadComprimidos: number;
  ingresadoPor: string;
  fecha: any;
}

export default function InventoryPage() {
  const [reintegros, setReintegros] = useState<Reintegro[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombreMedicamento: "",
    cantidadCajas: "",
    cantidadComprimidos: "",
    ingresadoPor: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("🔥 Conectado al proyecto:", db.app.options.projectId);
    
    const q = query(collection(db, "reintegros"), orderBy("fecha", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      })) as Reintegro[];
      setReintegros(docs);
    });

    return () => unsubscribe();
  }, []);

  const filteredReintegros = reintegros.filter(r => 
    r.nombreMedicamento.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateAutoId = () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `MED-${randomNum}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombreMedicamento) return;

    setLoading(true);
    try {
      const autoId = generateAutoId();
      await addDoc(collection(db, "reintegros"), {
        ...formData,
        id: autoId,
        cantidadCajas: Number(formData.cantidadCajas),
        cantidadComprimidos: Number(formData.cantidadComprimidos),
        fecha: Timestamp.now()
      });
      
      setFormData({
        nombreMedicamento: "",
        cantidadCajas: "",
        cantidadComprimidos: "",
        ingresadoPor: ""
      });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al guardar:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header Area */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "3rem" }}>
        <div>
          <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)", marginBottom: "0.5rem" }}>Hospital de Curepto</p>
          <h2 style={{ fontSize: "2rem", fontWeight: 800 }}>Inventario</h2>
          <p style={{ color: "var(--text-muted)" }}>Gestión centralizada de medicamentos y reintegros.</p>
        </div>
        <button className="primary" onClick={() => setIsModalOpen(true)}>
          + Nuevo Producto
        </button>
      </div>

      {/* Main Container */}
      <div className="card" style={{ padding: "2.5rem", borderRadius: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Listado General</h3>
          <div style={{ position: "relative" }}>
            <input 
              type="text" 
              placeholder="Buscar por nombre o ID..." 
              style={{ minWidth: "320px", paddingLeft: "1rem" }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="list-container">
          {filteredReintegros.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📦</div>
              <p>No hay productos registrados en el inventario.</p>
            </div>
          ) : (
            filteredReintegros.map((item) => (
              <div key={item.docId} className="list-item">
                <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
                  <div style={{ 
                    width: "52px", 
                    height: "52px", 
                    borderRadius: "14px", 
                    background: "#fdf2f8", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    color: "var(--primary)", 
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    userSelect: "none",
                    cursor: "default"
                  }}>
                    {item.nombreMedicamento.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{item.nombreMedicamento}</h4>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      <span style={{ fontWeight: 700, color: "var(--primary)" }}>{item.id}</span> • Por: {item.ingresadoPor || "Admin"}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "var(--primary)", fontWeight: 800, fontSize: "1.3rem" }}>
                    {item.cantidadCajas} <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>cajas</span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    {item.cantidadComprimidos} comprimidos
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal - Vercel Style */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <button 
              style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#94a3b8" }}
              onClick={() => setIsModalOpen(false)}
            >
              &times;
            </button>
            
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Nuevo Producto</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Ingresa los detalles para el registro de inventario.</p>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label>Nombre del Medicamento</label>
                <input 
                  type="text" 
                  placeholder="Nombre genérico o comercial" 
                  value={formData.nombreMedicamento}
                  onChange={(e) => setFormData({...formData, nombreMedicamento: e.target.value})}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <div className="form-group">
                  <label>Stock Cajas</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={formData.cantidadCajas}
                    onChange={(e) => setFormData({...formData, cantidadCajas: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Total Comprimidos</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={formData.cantidadComprimidos}
                    onChange={(e) => setFormData({...formData, cantidadComprimidos: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "2.5rem" }}>
                <label>Funcionario Responsable</label>
                <input 
                  type="text" 
                  placeholder="Nombre de quien registra" 
                  value={formData.ingresadoPor}
                  onChange={(e) => setFormData({...formData, ingresadoPor: e.target.value})}
                />
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? "Registrando..." : "Guardar Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
