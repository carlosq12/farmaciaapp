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

export default function Dashboard() {
  const [reintegros, setReintegros] = useState<Reintegro[]>([]);
  const [formData, setFormData] = useState({
    id: "",
    nombreMedicamento: "",
    cantidadCajas: "",
    cantidadComprimidos: "",
    ingresadoPor: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // Escuchar cambios en Firestore en tiempo real
  useEffect(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombreMedicamento || !formData.id) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "reintegros"), {
        ...formData,
        cantidadCajas: Number(formData.cantidadCajas),
        cantidadComprimidos: Number(formData.cantidadComprimidos),
        fecha: Timestamp.now()
      });
      
      setFormData({
        id: "",
        nombreMedicamento: "",
        cantidadCajas: "",
        cantidadComprimidos: "",
        ingresadoPor: ""
      });
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al conectar con Firebase. ¿Configuraste las credenciales?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "3rem", textAlign: "center" }} className="animate-fade-in">
        <h1 style={{ fontSize: "2.5rem", background: "linear-gradient(to right, #10b981, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "0.5rem" }}>
          FARMACIA DE CUREPTO
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>Sistema de Inventario de Reintegro</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
        {/* Formulario */}
        <section className="glass-card animate-fade-in" style={{ padding: "2rem", height: "fit-content" }}>
          <h2 style={{ marginBottom: "1.5rem", fontSize: "1.25rem", color: "var(--primary)" }}>Nuevo Registro</h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>ID Medicamento</label>
              <input 
                type="text" 
                placeholder="Ej: MED-001" 
                value={formData.id}
                onChange={(e) => setFormData({...formData, id: e.target.value})}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>Nombre Medicamento</label>
              <input 
                type="text" 
                placeholder="Nombre completo" 
                value={formData.nombreMedicamento}
                onChange={(e) => setFormData({...formData, nombreMedicamento: e.target.value})}
                required
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>Cant. Cajas</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  value={formData.cantidadCajas}
                  onChange={(e) => setFormData({...formData, cantidadCajas: e.target.value})}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>Cant. Comprimidos</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  value={formData.cantidadComprimidos}
                  onChange={(e) => setFormData({...formData, cantidadComprimidos: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>Ingresado por</label>
              <input 
                type="text" 
                placeholder="Tu nombre" 
                value={formData.ingresadoPor}
                onChange={(e) => setFormData({...formData, ingresadoPor: e.target.value})}
              />
            </div>
            <button type="submit" className="primary" disabled={loading} style={{ marginTop: "1rem" }}>
              {loading ? "Guardando..." : "Registrar Reintegro"}
            </button>
          </form>
        </section>

        {/* Lista */}
        <section className="glass-card animate-fade-in" style={{ padding: "2rem", animationDelay: "0.2s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.25rem", color: "var(--secondary)" }}>Registros Recientes</h2>
            <input 
              type="text" 
              placeholder="Buscar medicamento..." 
              style={{ maxWidth: "250px", padding: "0.5rem 1rem" }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {filteredReintegros.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                {searchTerm ? "No se encontraron resultados." : "No hay registros aún."}
              </p>
            ) : (
              filteredReintegros.map((item) => (
                <div key={item.docId} className="glass-card" style={{ padding: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)" }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>{item.nombreMedicamento}</h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      ID: {item.id} • Por: {item.ingresadoPor || "Anónimo"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--primary)" }}>
                      {item.cantidadCajas} <span style={{ fontSize: "0.75rem", fontWeight: "400", color: "var(--text-muted)" }}>Cajas</span>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "var(--secondary)" }}>
                      {item.cantidadComprimidos} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Compr.</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
