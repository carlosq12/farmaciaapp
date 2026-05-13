"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  Timestamp,
  updateDoc,
  doc,
  deleteDoc,
  getDocs,
  where,
  runTransaction
} from "firebase/firestore";

interface Reintegro {
  id: string;
  docId: string;
  nombreMedicamento: string;
  cantidadCajas: number;
  comprimidosPorCaja: number;
  cantidadComprimidos: number;
  ingresadoPor: string;
  regIsp?: string;
  vto?: string;
  estado?: "activo" | "realizado";
  etiquetaGuardada?: boolean;
  posologia?: string;
  comprimidosPorSobre?: string;
  solicitudPendiente?: "restaurar" | "eliminar";
  fecha: any;
  correlativoInicial?: number;
}

export default function InventoryPage() {
  const { user } = useAuth();
  
  const [reintegros, setReintegros] = useState<Reintegro[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombreMedicamento: "",
    id: "",
    cantidadCajas: "",
    comprimidosPorCaja: "",
    cantidadComprimidos: 0,
    ingresadoPor: "",
    regIsp: "",
    vto: ""
  });

  // Actualizar funcionario responsable cuando el usuario carga
  useEffect(() => {
    if (user && !formData.ingresadoPor) {
      setFormData(prev => ({ ...prev, ingresadoPor: user.nombreCompleto }));
    }
  }, [user]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"activo" | "historial">("activo");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Reintegro | null>(null);

  // Distribution State
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Reintegro | null>(null);
  const [distributionForm, setDistributionForm] = useState({
    totalComprimidos: "",
    comprimidosPorSobre: "1",
    posologia: "1 CADA DIA POR 30 DIAS",
    vto: "",
    seri: "",
    regIsp: ""
  });
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSize, setPrintSize] = useState<"10x5" | "5x3">("5x3");

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

    const handleAfterPrint = () => {
      setIsPrinting(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      unsubscribe();
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const filteredReintegros = reintegros.filter(r => {
    const matchesSearch = r.nombreMedicamento.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const isOutOfStock = Number(r.cantidadCajas) === 0 && Number(r.cantidadComprimidos) === 0;
    const isRealizado = r.estado === "realizado";
    
    // Un elemento va al historial si está marcado como realizado o si se quedó sin stock
    const isHistory = isOutOfStock || isRealizado;
    
    if (activeTab === "activo") return matchesSearch && !isHistory;
    return matchesSearch && isHistory;
  });

  const generateAutoId = () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `MED-${randomNum}`;
  };

  // Unique suggestions from inventory
  const productTemplates = Array.from(new Set(reintegros.map(r => r.nombreMedicamento.toLowerCase())))
    .map(name => {
      const lastEntry = reintegros.find(r => r.nombreMedicamento.toLowerCase() === name);
      return {
        nombre: lastEntry?.nombreMedicamento || "",
        comprimidosPorCaja: lastEntry?.comprimidosPorCaja || 0,
        regIsp: lastEntry?.regIsp || "",
        vto: lastEntry?.vto || ""
      };
    });

  const filteredSuggestions = productTemplates.filter(t => 
    t.nombre.toLowerCase().includes(formData.nombreMedicamento.toLowerCase()) &&
    formData.nombreMedicamento !== "" &&
    t.nombre.toLowerCase() !== formData.nombreMedicamento.toLowerCase()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombreMedicamento) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "reintegros"), {
        ...formData,
        id: formData.id || generateAutoId(),
        cantidadCajas: Number(formData.cantidadCajas),
        comprimidosPorCaja: Number(formData.comprimidosPorCaja),
        cantidadComprimidos: Number(formData.cantidadCajas) * Number(formData.comprimidosPorCaja),
        ingresadoPor: user?.nombreCompleto || formData.ingresadoPor,
        regIsp: formData.regIsp,
        vto: formData.vto,
        fecha: Timestamp.now()
      });
      
      setFormData({
        nombreMedicamento: "",
        id: "",
        cantidadCajas: "",
        comprimidosPorCaja: "",
        cantidadComprimidos: 0,
        ingresadoPor: user?.nombreCompleto || "Usuario Sistema",
        regIsp: "",
        vto: ""
      });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al guardar:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    setLoading(true);
    try {
      const docRef = doc(db, "reintegros", editProduct.docId);
      await updateDoc(docRef, {
        nombreMedicamento: editProduct.nombreMedicamento,
        id: editProduct.id,
        cantidadCajas: Number(editProduct.cantidadCajas),
        comprimidosPorCaja: Number(editProduct.comprimidosPorCaja),
        cantidadComprimidos: Number(editProduct.cantidadCajas) * Number(editProduct.comprimidosPorCaja),
        ingresadoPor: editProduct.ingresadoPor,
        regIsp: editProduct.regIsp || "",
        vto: editProduct.vto || ""
      });
      setIsEditModalOpen(false);
      setEditProduct(null);
    } catch (error) {
      console.error("Error al actualizar:", error);
    } finally {
      setLoading(false);
    }
  };

  const aprobarSolicitud = async (docId: string, tipo: "restaurar" | "eliminar") => {
    try {
      if (tipo === "eliminar") {
        await deleteDoc(doc(db, "reintegros", docId));
      } else if (tipo === "restaurar") {
        await updateDoc(doc(db, "reintegros", docId), {
          estado: "activo",
          solicitudPendiente: null
        });
      }
    } catch (error) {
      console.error("Error al aprobar solicitud:", error);
    }
  };

  const rechazarSolicitud = async (docId: string) => {
    try {
      await updateDoc(doc(db, "reintegros", docId), {
        solicitudPendiente: null
      });
    } catch (error) {
      console.error("Error al rechazar solicitud:", error);
    }
  };

  const handleDelete = async (docId: string) => {
    if (window.confirm("¿Estás seguro de que deseas solicitar la eliminación de este registro?")) {
      try {
        await updateDoc(doc(db, "reintegros", docId), {
          solicitudPendiente: "eliminar"
        });
        if (user?.rol?.toLowerCase() !== "administrador") {
          alert("Solicitud de eliminación enviada al administrador.");
        }
      } catch (error) {
        console.error("Error al solicitar eliminación:", error);
      }
    }
  };

  const toggleEstado = async (docId: string, currentEstado?: "activo" | "realizado") => {
    try {
      const newEstado = currentEstado === "realizado" ? "activo" : "realizado";
      
      if (newEstado === "activo" && user?.rol?.toLowerCase() !== "administrador") {
        await updateDoc(doc(db, "reintegros", docId), {
          solicitudPendiente: "restaurar"
        });
        alert("Solicitud de restauración enviada al administrador.");
        return;
      }

      await updateDoc(doc(db, "reintegros", docId), {
        estado: newEstado
      });
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  };

  const guardarEtiqueta = async () => {
    if (!selectedProduct) return;
    setLoading(true);
    try {
      const totalLabels = Math.ceil(Number(distributionForm.totalComprimidos) / (Number(distributionForm.comprimidosPorSobre) || 1));
      
      await runTransaction(db, async (transaction) => {
        const counterDocRef = doc(db, "configuracion", "contadores");
        const counterDoc = await transaction.get(counterDocRef);
        
        let currentSecuencia = 1000; // Empezamos en 1000 por defecto
        if (counterDoc.exists()) {
          currentSecuencia = counterDoc.data().secuenciaEtiquetas || 1000;
        } else {
          transaction.set(counterDocRef, { secuenciaEtiquetas: 1000 });
        }
        
        const nextSecuencia = currentSecuencia + totalLabels;
        transaction.set(counterDocRef, { secuenciaEtiquetas: nextSecuencia }, { merge: true });
        
        const reintegroRef = doc(db, "reintegros", selectedProduct.docId);
        transaction.update(reintegroRef, {
          etiquetaGuardada: true,
          posologia: distributionForm.posologia,
          comprimidosPorSobre: distributionForm.comprimidosPorSobre,
          correlativoInicial: currentSecuencia
        });
        
        // Actualizamos el estado local
        setSelectedProduct({
          ...selectedProduct,
          etiquetaGuardada: true,
          posologia: distributionForm.posologia,
          comprimidosPorSobre: distributionForm.comprimidosPorSobre,
          correlativoInicial: currentSecuencia
        });
      });
      
      alert("¡Etiqueta guardada con éxito! Ahora puedes marcar el medicamento como Listo.");
    } catch (error) {
      console.error("Error al guardar etiqueta:", error);
      alert("Error al guardar la etiqueta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header Area */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "3rem" }}>
        <div>
          <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)", marginBottom: "0.5rem" }}>Servicio de Farmacia • Hospital de Curepto</p>
          <h2 style={{ fontSize: "2rem", fontWeight: 800 }}>Reintegros</h2>
          <p style={{ color: "var(--text-muted)" }}>Pedro Antonio González 24 • Gestión centralizada.</p>
        </div>
        <button className="primary" onClick={() => setIsModalOpen(true)}>
          + Nuevo Medicamento
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <button 
          className={activeTab === "activo" ? "primary" : "secondary"}
          style={{ padding: "0.6rem 1.5rem", fontSize: "0.9rem" }}
          onClick={() => setActiveTab("activo")}
        >
          Etiquetas Activas
        </button>
        <button 
          className={activeTab === "historial" ? "primary" : "secondary"}
          style={{ padding: "0.6rem 1.5rem", fontSize: "0.9rem" }}
          onClick={() => setActiveTab("historial")}
        >
          Historial
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
              <p>No hay medicamentos registrados en el sistema.</p>
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
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <h4 style={{ fontSize: "1.1rem", fontWeight: 700, textDecoration: item.estado === "realizado" ? "line-through" : "none", color: item.estado === "realizado" ? "var(--text-muted)" : "inherit" }}>{item.nombreMedicamento}</h4>
                      
                      {item.solicitudPendiente ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fffbeb", padding: "4px 8px", borderRadius: "6px", border: "1px solid #fde68a" }}>
                          <span style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 600 }}>
                            ⏳ Solicitud: {item.solicitudPendiente}
                          </span>
                          {user?.rol?.toLowerCase() === "administrador" && (
                            <div style={{ display: "flex", gap: "4px", marginLeft: "4px" }}>
                              <button 
                                style={{ background: "#22c55e", border: "none", borderRadius: "4px", cursor: "pointer", color: "white", padding: "2px 6px", fontSize: "0.7rem", fontWeight: 700 }}
                                onClick={() => aprobarSolicitud(item.docId, item.solicitudPendiente!)}
                                title="Aprobar Solicitud"
                              >
                                ✓
                              </button>
                              <button 
                                style={{ background: "#ef4444", border: "none", borderRadius: "4px", cursor: "pointer", color: "white", padding: "2px 6px", fontSize: "0.7rem", fontWeight: 700 }}
                                onClick={() => rechazarSolicitud(item.docId)}
                                title="Rechazar Solicitud"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {activeTab === "activo" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <button 
                                style={{ 
                                  background: item.etiquetaGuardada ? "#f0fdf4" : "#f1f5f9", 
                                  border: item.etiquetaGuardada ? "1px solid #bbf7d0" : "1px solid #e2e8f0", 
                                  borderRadius: "6px", 
                                  cursor: item.etiquetaGuardada ? "pointer" : "not-allowed", 
                                  color: item.etiquetaGuardada ? "#166534" : "#94a3b8", 
                                  padding: "4px 8px", 
                                  fontSize: "0.8rem", 
                                  fontWeight: 600,
                                  opacity: item.etiquetaGuardada ? 1 : 0.6
                                }}
                                onClick={() => item.etiquetaGuardada && toggleEstado(item.docId, item.estado)}
                                title={item.etiquetaGuardada ? "Marcar como Listo/Realizado" : "Debes guardar la etiqueta primero"}
                                disabled={!item.etiquetaGuardada}
                              >
                                ✅ Listo
                              </button>
                              {!item.etiquetaGuardada && (
                                <span style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                                  ⚠️ Falta guardar etiqueta
                                </span>
                              )}
                            </div>
                          ) : (
                            <button 
                              style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", cursor: "pointer", color: "#92400e", padding: "4px 8px", fontSize: "0.8rem", fontWeight: 600 }}
                              onClick={() => toggleEstado(item.docId, item.estado)}
                              title="Restaurar a Activos"
                            >
                              ⏪ Restaurar
                            </button>
                          )}
                          {activeTab === "activo" && (
                            <button 
                              style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px", cursor: "pointer", color: "#0369a1", padding: "4px 8px", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
                              onClick={() => {
                                setEditProduct(item);
                                setIsEditModalOpen(true);
                              }}
                              title="Editar"
                            >
                              ✏️ Editar
                            </button>
                          )}
                          <button 
                            style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", cursor: "pointer", color: "#b91c1c", padding: "4px 8px", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
                            onClick={() => handleDelete(item.docId)}
                            title="Eliminar"
                          >
                            🗑️ Eliminar
                          </button>
                        </>
                      )}
                    </div>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      N° de Serie: <span style={{ fontWeight: 700, color: "var(--primary)" }}>{item.id}</span> • Por: {item.ingresadoPor || "Admin"}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "var(--primary)", fontWeight: 800, fontSize: "1.3rem" }}>
                    {item.cantidadCajas} <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>cajas</span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    {item.comprimidosPorCaja} c/u • {item.cantidadComprimidos} total
                  </div>
                  <button 
                    className="secondary" 
                    style={{ 
                      marginTop: "0.75rem", 
                      padding: "0.5rem 1rem", 
                      fontSize: "0.8rem",
                      background: "#fdf2f8",
                      color: "var(--primary)",
                      border: "1px solid #fbcfe8"
                    }}
                    onClick={() => {
                      setSelectedProduct(item);
                      setDistributionForm({
                        ...distributionForm,
                        totalComprimidos: item.cantidadComprimidos.toString(),
                        regIsp: item.regIsp || "",
                        vto: item.vto || "",
                        seri: item.id || "",
                        posologia: item.posologia || "1 CADA DIA POR 30 DIAS",
                        comprimidosPorSobre: item.comprimidosPorSobre || "1"
                      });
                      setIsDistributeModalOpen(true);
                    }}
                  >
                    {activeTab === "activo" ? "📦 Crear Etiquetas" : "📜 Ver Etiquetas"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Distribution Modal */}
      {isDistributeModalOpen && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <button 
              style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#94a3b8" }}
              onClick={() => setIsDistributeModalOpen(false)}
            >
              &times;
            </button>
            
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
                {activeTab === "activo" ? "Crear Etiquetas" : "Detalles de Etiquetas"}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{selectedProduct.nombreMedicamento} (N° de Serie: {selectedProduct.id})</p>
            </div>
            
            {activeTab === "activo" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                  <div className="form-group">
                    <label>Total Comprimidos</label>
                    <input 
                      type="number" 
                      value={distributionForm.totalComprimidos}
                      disabled
                      style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Comprimidos por Sobre</label>
                    <input 
                      type="number" 
                      value={distributionForm.comprimidosPorSobre}
                      onChange={(e) => setDistributionForm({...distributionForm, comprimidosPorSobre: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label>Posología / Instrucciones</label>
                  <input 
                    type="text" 
                    value={distributionForm.posologia}
                    onChange={(e) => setDistributionForm({...distributionForm, posologia: e.target.value})}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                  <div className="form-group">
                    <label>Vencimiento</label>
                    <input 
                      type="date" 
                      className="date-picker-input"
                      value={distributionForm.vto}
                      disabled
                      style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                    />
                  </div>
                  <div className="form-group">
                    <label>N° de Serie</label>
                    <input 
                      type="text" 
                      value={distributionForm.seri}
                      disabled
                      style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "2.5rem" }}>
                  <label>Registro de N° ISP</label>
                  <input 
                    type="text" 
                    value={distributionForm.regIsp}
                    disabled
                    style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                  />
                </div>
              </>
            )}


            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {activeTab === "activo" && (
                <button 
                  type="button" 
                  style={{ 
                    width: "100%", 
                    background: "#10b981", 
                    color: "white", 
                    padding: "0.75rem", 
                    borderRadius: "8px", 
                    fontWeight: 700, 
                    border: "none", 
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                  onClick={() => guardarEtiqueta()}
                  disabled={loading || selectedProduct.etiquetaGuardada}
                >
                  {selectedProduct.etiquetaGuardada ? "✅ Configuración Guardada" : (loading ? "Guardando..." : "💾 Guardar Configuración de Etiqueta")}
                </button>
              )}
              
              {activeTab === "activo" ? (
                <div style={{ display: "flex", gap: "1rem", opacity: !selectedProduct.etiquetaGuardada ? 0.5 : 1, pointerEvents: !selectedProduct.etiquetaGuardada ? "none" : "auto" }}>
                  <button 
                    type="button" 
                    className="primary" 
                    style={{ flex: 1, background: "#0ea5e9" }}
                    onClick={() => {
                      if (Number(distributionForm.totalComprimidos) > 5000) {
                        alert("Advertencia: Estás intentando imprimir demasiadas etiquetas a la vez. Por favor, reduce la cantidad para evitar que el navegador se bloquee.");
                        return;
                      }
                      setPrintSize("10x5");
                      setIsPrinting(true);
                      setTimeout(() => {
                        window.print();
                      }, 800); // Damos más tiempo para renderizar si son muchas
                    }}
                  >
                    🖨️ Grande (10x5cm)
                  </button>
                  <button 
                    type="button" 
                    className="primary" 
                    style={{ flex: 1, background: "#8b5cf6" }}
                    onClick={() => {
                      if (Number(distributionForm.totalComprimidos) > 5000) {
                        alert("Advertencia: Estás intentando imprimir demasiadas etiquetas a la vez. Por favor, reduce la cantidad para evitar que el navegador se bloquee.");
                        return;
                      }
                      setPrintSize("5x3");
                      setIsPrinting(true);
                      setTimeout(() => {
                        window.print();
                      }, 800);
                    }}
                  >
                    🖨️ Pequeño (5x3cm)
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem 1rem", background: "#f1f5f9", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                  <p style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: "1.5rem" }}>
                    Vista Previa de Etiquetas ({Math.ceil(Number(distributionForm.totalComprimidos) / (Number(distributionForm.comprimidosPorSobre) || 1))} en total)
                  </p>
                  
                  <div style={{
                    maxHeight: "45vh",
                    overflowY: "auto",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "1.5rem",
                    padding: "0.5rem"
                  }}>
                    {Array.from({ length: Math.ceil(Number(distributionForm.totalComprimidos) / (Number(distributionForm.comprimidosPorSobre) || 1)) }).map((_, index, array) => (
                      <div key={index} style={{ width: "75mm", height: "45mm", flexShrink: 0, position: "relative", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)", borderRadius: "4px", overflow: "hidden" }}>
                        <div className="label-wrapper size-5x3" style={{ transform: "scale(1.5)", transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
                          <div className="label-header">
                            HOSPITAL DE CUREPTO<br/>
                            SERVICIO DE FARMACIA
                          </div>
                          <div className="label-med-name">{selectedProduct?.nombreMedicamento}</div>
                          <div className="label-unit">Comprimidos</div>
                          <div className="label-dosage">{distributionForm.posologia}</div>
                          <div className="label-total-count">
                            Total: {distributionForm.comprimidosPorSobre} {Number(distributionForm.comprimidosPorSobre) === 1 ? 'comprimido' : 'comprimidos'}
                          </div>
                          <div className="label-grid">
                            <div className="label-grid-item">
                              <span className="label-cell-title">VENC:</span>
                              <span className="label-cell-value">{distributionForm.vto}</span>
                            </div>
                            <div className="label-grid-item">
                              <span className="label-cell-title">SERIE:</span>
                              <span className="label-cell-value">{distributionForm.seri}</span>
                            </div>
                            <div className="label-grid-item">
                              <span className="label-cell-title">ISP:</span>
                              <span className="label-cell-value">{distributionForm.regIsp}</span>
                            </div>
                            <div className="label-grid-item">
                              <span className="label-cell-title">N° BOL:</span>
                              <span className="label-cell-value">{index + 1}/{array.length}</span>
                            </div>
                            <div className="label-grid-item" style={{ gridColumn: "span 2", textAlign: "center", borderTop: "none", background: "#f8fafc" }}>
                              <span className="label-cell-title" style={{ fontSize: "5pt" }}>CORRELATIVO ÚNICO</span>
                              <span className="label-cell-value" style={{ fontSize: "7pt", fontWeight: 900 }}>{(selectedProduct?.correlativoInicial || 1) + index}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" className="secondary" style={{ width: "100%" }} onClick={() => setIsDistributeModalOpen(false)}>
                {activeTab === "activo" ? "Cancelar" : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Area de Impresión (Oculta en pantalla normal) */}
      <div className="print-area">
        {isPrinting && (
          printSize === "5x3" ? (
            // Formato 5x3 - Etiquetas individuales
            Array.from({ length: Math.ceil(Number(distributionForm.totalComprimidos) / (Number(distributionForm.comprimidosPorSobre) || 1)) }).map((_, index, array) => (
              <div key={index} className="label-wrapper size-5x3">
                <div className="label-header">
                  HOSPITAL DE CUREPTO<br/>
                  SERVICIO DE FARMACIA
                </div>
                <div className="label-med-name">{selectedProduct?.nombreMedicamento}</div>
                <div className="label-unit">Comprimidos</div>
                <div className="label-dosage">{distributionForm.posologia}</div>
                <div className="label-total-count">
                  Total: {distributionForm.comprimidosPorSobre} {Number(distributionForm.comprimidosPorSobre) === 1 ? 'comprimido' : 'comprimidos'}
                </div>
                <div className="label-grid">
                  <div className="label-grid-item">
                    <span className="label-cell-title">VENC:</span>
                    <span className="label-cell-value">{distributionForm.vto}</span>
                  </div>
                  <div className="label-grid-item">
                    <span className="label-cell-title">SERIE:</span>
                    <span className="label-cell-value">{distributionForm.seri}</span>
                  </div>
                  <div className="label-grid-item">
                    <span className="label-cell-title">ISP:</span>
                    <span className="label-cell-value">{distributionForm.regIsp}</span>
                  </div>
                  <div className="label-grid-item">
                    <span className="label-cell-title">N° BOL:</span>
                    <span className="label-cell-value">{index + 1}/{array.length}</span>
                  </div>
                  <div className="label-grid-item" style={{ gridColumn: "span 2", textAlign: "center", borderTop: "none" }}>
                    <span className="label-cell-title" style={{ fontSize: "5pt" }}>CORRELATIVO ÚNICO</span>
                    <span className="label-cell-value" style={{ fontSize: "7pt", fontWeight: 900 }}>{(selectedProduct?.correlativoInicial || 1) + index}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            // Formato 10x5 - Dos etiquetas por sticker
            Array.from({ length: Math.ceil((Number(distributionForm.totalComprimidos) / (Number(distributionForm.comprimidosPorSobre) || 1)) / 2) }).map((_, stickerIndex, stickersArray) => {
              const totalLabels = Math.ceil(Number(distributionForm.totalComprimidos) / (Number(distributionForm.comprimidosPorSobre) || 1));
              return (
                <div key={stickerIndex} className="label-wrapper size-10x5">
                  {[0, 1].map((offset) => {
                    const labelIndex = (stickerIndex * 2) + offset;
                    if (labelIndex >= totalLabels) return <div key={offset} className="label-sub-content empty"></div>;
                    return (
                      <div key={offset} className="label-sub-content">
                        <div className="label-header">
                          HOSPITAL DE CUREPTO<br/>
                          SERVICIO DE FARMACIA
                        </div>
                        <div className="label-med-name">{selectedProduct?.nombreMedicamento}</div>
                        <div className="label-unit">Comprimidos</div>
                        <div className="label-dosage">{distributionForm.posologia}</div>
                        <div className="label-total-count">
                          Total: {distributionForm.comprimidosPorSobre} {Number(distributionForm.comprimidosPorSobre) === 1 ? 'comprimido' : 'comprimidos'}
                        </div>
                        <div className="label-grid">
                          <div className="label-grid-item">
                            <span className="label-cell-title">VENCIMIENTO:</span>
                            <span className="label-cell-value">{distributionForm.vto}</span>
                          </div>
                          <div className="label-grid-item">
                            <span className="label-cell-title">N° DE SERIE:</span>
                            <span className="label-cell-value">{distributionForm.seri}</span>
                          </div>
                          <div className="label-grid-item">
                            <span className="label-cell-title">REGISTRO ISP:</span>
                            <span className="label-cell-value">{distributionForm.regIsp}</span>
                          </div>
                          <div className="label-grid-item">
                            <span className="label-cell-title">N° BOL:</span>
                            <span className="label-cell-value">{labelIndex + 1}/{totalLabels}</span>
                          </div>
                          <div className="label-grid-item" style={{ gridColumn: "span 2", textAlign: "center", borderTop: "none", background: "#f8fafc" }}>
                            <span className="label-cell-title" style={{ fontSize: "6pt" }}>CORRELATIVO ÚNICO</span>
                            <span className="label-cell-value" style={{ fontSize: "9pt", fontWeight: 900 }}>{(selectedProduct?.correlativoInicial || 1) + labelIndex}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )
        )}
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
              <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Nuevo Medicamento</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Ingresa los detalles para el registro de inventario.</p>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label>Nombre del Medicamento</label>
                <div style={{ position: "relative" }}>
                  <input 
                    type="text" 
                    placeholder="Nombre genérico o comercial" 
                    value={formData.nombreMedicamento}
                    onChange={(e) => {
                      setFormData({...formData, nombreMedicamento: e.target.value});
                      setShowSuggestions(true);
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    required
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="suggestions-list">
                      {filteredSuggestions.map((s, idx) => (
                        <div 
                          key={idx} 
                          className="suggestion-item"
                          onClick={() => {
                            setFormData({
                              ...formData, 
                              nombreMedicamento: s.nombre,
                              comprimidosPorCaja: s.comprimidosPorCaja.toString(),
                              regIsp: s.regIsp || "",
                              vto: s.vto || ""
                            });
                            setShowSuggestions(false);
                          }}
                        >
                          <span>{s.nombre}</span>
                          <span className="detail">{s.comprimidosPorCaja} c/u</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                  <label>Comprimidos por Caja</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={formData.comprimidosPorCaja}
                    onChange={(e) => setFormData({...formData, comprimidosPorCaja: e.target.value})}
                  />
                </div>
              </div>

              {formData.cantidadCajas && formData.comprimidosPorCaja && (
                <p style={{ marginTop: "-1rem", marginBottom: "1.5rem", fontSize: "0.85rem", color: "var(--primary)", fontWeight: 700 }}>
                  Total: {Number(formData.cantidadCajas) * Number(formData.comprimidosPorCaja)} comprimidos
                </p>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <div className="form-group">
                  <label>N° de Serie</label>
                  <input 
                    type="text" 
                    placeholder="Ej: MED-12345" 
                    value={formData.id}
                    onChange={(e) => setFormData({...formData, id: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Vencimiento</label>
                  <input 
                    type="date"
                    className="date-picker-input"
                    value={formData.vto}
                    onChange={(e) => setFormData({...formData, vto: e.target.value})}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2.5rem" }}>
                <div className="form-group">
                  <label>Registro de N° ISP</label>
                  <input 
                    type="text" 
                    placeholder="Ej: F-1234/20" 
                    value={formData.regIsp}
                    onChange={(e) => setFormData({...formData, regIsp: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Funcionario Responsable</label>
                  <input 
                    type="text" 
                    value={formData.ingresadoPor}
                    disabled
                    style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? "Registrando..." : "Guardar Medicamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editProduct && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <button 
              style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#94a3b8" }}
              onClick={() => setIsEditModalOpen(false)}
            >
              &times;
            </button>
            
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Editar Medicamento</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Modifica los datos del registro <span style={{ color: "var(--primary)", fontWeight: 700 }}>N° de Serie: {editProduct.id}</span></p>
            </div>
            
            <form onSubmit={handleUpdate}>
              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label>Nombre del Medicamento</label>
                <input 
                  type="text" 
                  value={editProduct.nombreMedicamento}
                  onChange={(e) => setEditProduct({...editProduct, nombreMedicamento: e.target.value})}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <div className="form-group">
                  <label>Stock Cajas</label>
                  <input 
                    type="number" 
                    value={editProduct.cantidadCajas}
                    onChange={(e) => setEditProduct({...editProduct, cantidadCajas: Number(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label>Comprimidos por Caja</label>
                  <input 
                    type="number" 
                    value={editProduct.comprimidosPorCaja}
                    onChange={(e) => setEditProduct({...editProduct, comprimidosPorCaja: Number(e.target.value)})}
                  />
                </div>
              </div>

              <p style={{ marginTop: "-1rem", marginBottom: "1.5rem", fontSize: "0.85rem", color: "var(--primary)", fontWeight: 700 }}>
                Total: {Number(editProduct.cantidadCajas) * Number(editProduct.comprimidosPorCaja)} comprimidos
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <div className="form-group">
                  <label>N° de Serie</label>
                  <input 
                    type="text" 
                    value={editProduct.id}
                    onChange={(e) => setEditProduct({...editProduct, id: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Vencimiento</label>
                  <input 
                    type="date"
                    className="date-picker-input"
                    value={editProduct.vto || ""}
                    onChange={(e) => setEditProduct({...editProduct, vto: e.target.value})}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2.5rem" }}>
                <div className="form-group">
                  <label>Registro de N° ISP</label>
                  <input 
                    type="text" 
                    value={editProduct.regIsp || ""}
                    onChange={(e) => setEditProduct({...editProduct, regIsp: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Funcionario Responsable</label>
                  <input 
                    type="text" 
                    value={editProduct.ingresadoPor || "Usuario Sistema"}
                    disabled
                    style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? "Guardando..." : "Actualizar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
