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
  fecha: any;
}

export default function InventoryPage() {
  const { user } = useAuth();
  
  const [reintegros, setReintegros] = useState<Reintegro[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombreMedicamento: "",
    cantidadCajas: "",
    comprimidosPorCaja: "",
    cantidadComprimidos: 0,
    ingresadoPor: user?.nombreCompleto || "Usuario Sistema",
    regIsp: "",
    vto: ""
  });
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

  const filteredReintegros = reintegros.filter(r => {
    const matchesSearch = r.nombreMedicamento.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const isOutOfStock = Number(r.cantidadCajas) === 0 && Number(r.cantidadComprimidos) === 0;
    
    if (activeTab === "activo") return matchesSearch && !isOutOfStock;
    return matchesSearch && isOutOfStock;
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
      const autoId = generateAutoId();
      await addDoc(collection(db, "reintegros"), {
        ...formData,
        id: autoId,
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

  const handleDelete = async (docId: string) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.")) {
      try {
        await deleteDoc(doc(db, "reintegros", docId));
      } catch (error) {
        console.error("Error al eliminar:", error);
      }
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
                      <h4 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{item.nombreMedicamento}</h4>
                      <button 
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
                        onClick={() => {
                          setEditProduct(item);
                          setIsEditModalOpen(true);
                        }}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button 
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
                        onClick={() => handleDelete(item.docId)}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
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
                        vto: item.vto || ""
                      });
                      setIsDistributeModalOpen(true);
                    }}
                  >
                    📦 Crear Etiquetas
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
              <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Crear Etiquetas</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{selectedProduct.nombreMedicamento} ({selectedProduct.id})</p>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
              <div className="form-group">
                <label>Total Comprimidos</label>
                <input 
                  type="number" 
                  value={distributionForm.totalComprimidos}
                  onChange={(e) => setDistributionForm({...distributionForm, totalComprimidos: e.target.value})}
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
                <label>VTO (Vencimiento)</label>
                <input 
                  type="text" 
                  placeholder="MM/YY"
                  value={distributionForm.vto}
                  onChange={(e) => setDistributionForm({...distributionForm, vto: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>SERI (Lote)</label>
                <input 
                  type="text" 
                  value={distributionForm.seri}
                  onChange={(e) => setDistributionForm({...distributionForm, seri: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "2.5rem" }}>
              <label>REG ISP N°</label>
              <input 
                type="text" 
                value={distributionForm.regIsp}
                onChange={(e) => setDistributionForm({...distributionForm, regIsp: e.target.value})}
              />
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setIsDistributeModalOpen(false)}>
                Cancelar
              </button>
              <button 
                type="button" 
                className="primary" 
                style={{ flex: 2 }}
                onClick={() => {
                  setIsPrinting(true);
                  setTimeout(() => {
                    window.print();
                    setIsPrinting(false);
                  }, 500);
                }}
              >
                🖨️ Generar Etiquetas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Area de Impresión (Oculta en pantalla normal) */}
      <div className="print-area">
        {isPrinting && Array.from({ length: Math.ceil(Number(distributionForm.totalComprimidos) / Number(distributionForm.comprimidosPorSobre)) }).map((_, index, array) => (
          <div key={index} className="label-wrapper">
            <div className="label-header">
              HOSPITAL DE CUREPTO Pedro Antonio González 24<br/>
              SERVICIO DE FARMACIA
            </div>
            <div className="label-med-name">{selectedProduct?.nombreMedicamento}</div>
            <div className="label-unit">Comprimidos</div>
            <div className="label-dosage">{distributionForm.posologia}</div>
            <div style={{ textAlign: "center", fontSize: "9pt", fontWeight: "bold", marginBottom: "3mm" }}>
              Total: {distributionForm.comprimidosPorSobre} {Number(distributionForm.comprimidosPorSobre) === 1 ? 'comprimido' : 'comprimidos'}
            </div>
            <table className="label-table">
              <tbody>
                <tr>
                  <td><span className="label-cell-title">VTO</span>{distributionForm.vto}</td>
                  <td><span className="label-cell-title">SERI</span>{distributionForm.seri}</td>
                </tr>
                <tr>
                  <td><span className="label-cell-title">REG ISP N°</span>{distributionForm.regIsp}</td>
                  <td><span className="label-cell-title">Pre</span></td>
                </tr>
                <tr>
                  <td><span className="label-cell-title">Corr</span>{index + 1}/{array.length}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
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
                  <label>VTO (Vencimiento)</label>
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
                  <label>N° Registro ISP</label>
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
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Modifica los datos del registro <span style={{ color: "var(--primary)", fontWeight: 700 }}>{editProduct.id}</span></p>
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
                  <label>VTO (Vencimiento)</label>
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
                  <label>N° Registro ISP</label>
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
                    value={editProduct.ingresadoPor}
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
