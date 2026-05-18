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
  getDoc,
  where,
  runTransaction,
  setDoc
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
  solicitudPendiente?: "restaurar" | "eliminar" | "imprimir" | "finalizar";
  fecha: any;
  correlativoInicial?: number;
  correlativoPrefijo?: string;
  autorizadoImprimir?: boolean;
  fechaFinalizado?: any;
  proveedor?: string;
  fechaRegistro?: string;
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
    vto: "",
    proveedor: "",
    fechaRegistro: new Date().toISOString().split('T')[0]
  });

  // Actualizar funcionario responsable cuando el usuario carga
  useEffect(() => {
    if (user && !formData.ingresadoPor) {
      setFormData(prev => ({ 
        ...prev, 
        ingresadoPor: user.nombreCompleto,
        fechaRegistro: new Date().toISOString().split('T')[0]
      }));
    }
  }, [user]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"activo" | "historial">("activo");
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Reintegro | null>(null);

  // Distribution State
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [nextCorrelativo, setNextCorrelativo] = useState<number | null>(null);
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
  const [isPrintingReport, setIsPrintingReport] = useState(false);
  const [printSize, setPrintSize] = useState<"10x5" | "5x3">("5x3");

  // Custom Dialog State
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "warning" | "danger" | "success";
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  const showDialog = (title: string, message: string, type: "info" | "warning" | "danger" | "success", onConfirm?: () => void) => {
    setDialog({ isOpen: true, title, message, type, onConfirm });
  };

  const closeDialog = () => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  };

  const openDistributeModal = async (product: Reintegro) => {
    setSelectedProduct(product);
    setDistributionForm({
      totalComprimidos: String(product.cantidadComprimidos),
      comprimidosPorSobre: product.comprimidosPorSobre || "30",
      posologia: product.posologia || "1 CADA DIA POR 30 DIAS",
      vto: product.vto || "",
      seri: product.id || "",
      regIsp: product.regIsp || ""
    });
    
    // Obtener el próximo correlativo para la vista previa
    try {
      const counterDoc = await getDoc(doc(db, "configuracion", "contadores"));
      if (counterDoc.exists()) {
        setNextCorrelativo(counterDoc.data().secuenciaEtiquetas || 1);
      } else {
        setNextCorrelativo(1);
      }
    } catch (error) {
      console.error("Error al obtener próximo correlativo:", error);
      setNextCorrelativo(1);
    }
    
    setIsDistributeModalOpen(true);
  };

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
      setIsPrintingReport(false);
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
        proveedor: formData.proveedor,
        fechaRegistro: formData.fechaRegistro,
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
        vto: "",
        proveedor: "",
        fechaRegistro: new Date().toISOString().split('T')[0]
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
        vto: editProduct.vto || "",
        proveedor: editProduct.proveedor || ""
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
    showDialog(
      "Confirmar Eliminación",
      "¿Estás seguro de que deseas solicitar la eliminación de este registro? Esta acción enviará una solicitud al administrador.",
      "danger",
      async () => {
        try {
          await updateDoc(doc(db, "reintegros", docId), {
            solicitudPendiente: "eliminar"
          });
        } catch (error) {
          console.error("Error al solicitar eliminación:", error);
        }
      }
    );
  };

  const toggleEstado = async (docId: string, currentEstado?: "activo" | "realizado") => {
    try {
      const newEstado = currentEstado === "realizado" ? "activo" : "realizado";
      
      if (newEstado === "activo" && user?.rol?.toLowerCase() !== "administrador") {
        await updateDoc(doc(db, "reintegros", docId), {
          solicitudPendiente: "restaurar"
        });
        showDialog("Solicitud Enviada", "La solicitud de restauración fue enviada al administrador.", "info");
        return;
      }

      if (newEstado === "realizado") {
        const item = reintegros.find(r => r.docId === docId);
        if (!item) return;

        const totalLabels = Math.ceil(item.cantidadComprimidos / (Number(item.comprimidosPorSobre) || 1));
        const monthLetters = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
        const dateParts = (item.fechaRegistro || new Date().toISOString().split('T')[0]).split('-');
        const monthIndex = parseInt(dateParts[1]) - 1;
        const monthPrefix = monthLetters[monthIndex] || "X";

        showDialog(
          "¿Estás seguro?", 
          `Al marcar como Listo se asignarán los correlativos permanentes (${monthPrefix}-${totalLabels} bolsas) y no se podrán modificar.`,
          "warning",
          async () => {
            await runTransaction(db, async (transaction) => {
              const counterDocRef = doc(db, "configuracion", "contadores");
              const counterDoc = await transaction.get(counterDocRef);
              
              let currentSecuencia = 1;
              if (counterDoc.exists()) {
                currentSecuencia = counterDoc.data().secuenciaEtiquetas || 1;
              }
              
              const totalLabelsVal = Math.ceil(item.cantidadComprimidos / (Number(item.comprimidosPorSobre) || 1));
              const nextSecuencia = currentSecuencia + totalLabelsVal;
              transaction.set(counterDocRef, { secuenciaEtiquetas: nextSecuencia }, { merge: true });
              
              transaction.update(doc(db, "reintegros", docId), {
                estado: newEstado,
                correlativoInicial: currentSecuencia,
                correlativoPrefijo: monthPrefix,
                fechaFinalizado: Timestamp.now()
              });
            });
          }
        );
        return;
      } else {
        await updateDoc(doc(db, "reintegros", docId), {
          estado: newEstado
        });
      }
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  };

  const sincronizarContador = async () => {
    try {
      setLoading(true);
      const qH = query(collection(db, "reintegros"), where("estado", "==", "realizado"));
      const snapH = await getDocs(qH);
      let maxCorrelativo = 0;
      snapH.forEach((doc) => {
        const d = doc.data();
        const bolsas = Math.ceil((d.cantidadComprimidos || 0) / (Number(d.comprimidosPorSobre) || 1));
        const fin = (d.correlativoInicial || 0) + bolsas - 1;
        if (fin > maxCorrelativo) maxCorrelativo = fin;
      });
      
      const nextCorrelativoBase = maxCorrelativo + 1;
      let currentNext = nextCorrelativoBase;
      const qA = query(collection(db, "reintegros"));
      const snapA = await getDocs(qA);
      
      const activos = snapA.docs
        .map(d => ({ docId: d.id, ...d.data() } as any))
        .filter(item => {
          const isOutOfStock = Number(item.cantidadCajas) === 0 && Number(item.cantidadComprimidos) === 0;
          const isRealizado = item.estado === "realizado";
          return !isOutOfStock && !isRealizado;
        });

      activos.sort((a, b) => a.nombreMedicamento.localeCompare(b.nombreMedicamento));

      for (const item of activos) {
        const bolsas = Math.ceil((item.cantidadComprimidos || 0) / (Number(item.comprimidosPorSobre) || 1));
        await updateDoc(doc(db, "reintegros", item.docId), {
          correlativoInicial: currentNext,
          correlativoPrefijo: "M"
        });
        currentNext += bolsas;
      }
      
      await setDoc(doc(db, "configuracion", "contadores"), { secuenciaEtiquetas: nextCorrelativoBase });
      showDialog("Sincronización Exitosa", `Próximo correlativo: ${nextCorrelativoBase}`, "success");
    } catch (error) {
      console.error("Error al sincronizar:", error);
      showDialog("Error", "Error al intentar sincronizar.", "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
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

      <div style={{ 
        display: "flex", 
        gap: "6px", 
        marginBottom: "-1px", 
        paddingLeft: "1.5rem",
        position: "relative",
        zIndex: 6
      }}>
        <button 
          style={{ 
            padding: "0.75rem 1.75rem", 
            fontSize: "0.95rem", 
            fontWeight: 800,
            cursor: "pointer",
            border: "1px solid #e2e8f0",
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            borderBottomLeftRadius: "0px",
            borderBottomRightRadius: "0px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            outline: "none",
            ...(activeTab === "activo" ? {
              background: "white",
              borderBottom: "2.5px solid white",
              color: "var(--primary)",
              zIndex: 10,
              boxShadow: "0 -4px 12px -2px rgba(216, 27, 96, 0.04)"
            } : {
              background: "linear-gradient(135deg, #f472b6 0%, #d81b60 100%)",
              borderBottom: "1px solid #e2e8f0",
              color: "white",
              zIndex: 1,
              opacity: 0.85,
              transform: "translateY(3px)",
              boxShadow: "inset 0 -4px 8px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.05)"
            })
          }}
          onClick={() => {
            setActiveTab("activo");
            setSelectedHistoryIds([]);
          }}
        >
          🏷️ Etiquetas Activas
        </button>
        <button 
          style={{ 
            padding: "0.75rem 1.75rem", 
            fontSize: "0.95rem", 
            fontWeight: 800,
            cursor: "pointer",
            border: "1px solid #e2e8f0",
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            borderBottomLeftRadius: "0px",
            borderBottomRightRadius: "0px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            outline: "none",
            ...(activeTab === "historial" ? {
              background: "white",
              borderBottom: "2.5px solid white",
              color: "#7c3aed",
              zIndex: 10,
              boxShadow: "0 -4px 12px -2px rgba(124, 58, 237, 0.04)"
            } : {
              background: "linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)",
              borderBottom: "1px solid #e2e8f0",
              color: "white",
              zIndex: 1,
              opacity: 0.85,
              transform: "translateY(3px)",
              boxShadow: "inset 0 -4px 8px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.05)"
            })
          }}
          onClick={() => {
            setActiveTab("historial");
            setSelectedHistoryIds([]);
          }}
        >
          📜 Historial
        </button>
      </div>

      <div 
        className="card" 
        style={{ 
          padding: "2.5rem", 
          borderRadius: "24px",
          background: "white",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
          position: "relative",
          zIndex: 5
        }}
      >
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "2.5rem",
          padding: "0 0.5rem"
        }}>
          <div>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              {activeTab === "activo" ? "Etiquetas Activas" : "Historial de Registros"}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
              {filteredReintegros.length} medicamentos encontrados
            </p>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            {activeTab === "activo" && ["administrador", "funcionario", "subrogante"].includes(user?.rol?.toLowerCase() || "") && (
              <button 
                className="secondary" 
                style={{ 
                  padding: "0.7rem 1.2rem", 
                  background: "linear-gradient(to bottom, #ffffff, #f8fafc)", 
                  color: "#0369a1", 
                  border: "1px solid #e2e8f0", 
                  borderRadius: "12px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                  transition: "all 0.2s"
                }}
                onClick={sincronizarContador}
              >
                <span style={{ fontSize: "1.1rem" }}>🔄</span> Sincronizar Contador
              </button>
            )}
            
            {activeTab === "historial" && filteredReintegros.length > 0 && (
              <>
                <button
                  className="secondary"
                  style={{
                    padding: "0.7rem 1.2rem",
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    color: "#475569",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onClick={() => {
                    const allFilteredIds = filteredReintegros.map(item => item.docId);
                    const allSelected = allFilteredIds.every(id => selectedHistoryIds.includes(id));
                    if (allSelected) {
                      setSelectedHistoryIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                    } else {
                      setSelectedHistoryIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                    }
                  }}
                >
                  <span>{filteredReintegros.map(item => item.docId).every(id => selectedHistoryIds.includes(id)) ? "☑️" : "⬜"}</span> 
                  {filteredReintegros.map(item => item.docId).every(id => selectedHistoryIds.includes(id)) 
                    ? "Deseleccionar Todos" 
                    : "Seleccionar Todos"}
                </button>

                <button 
                  style={{ 
                    padding: "0.7rem 1.2rem", 
                    background: selectedHistoryIds.length > 0 ? "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)" : "white",
                    border: "1px solid " + (selectedHistoryIds.length > 0 ? "#7c3aed" : "#e2e8f0"),
                    color: selectedHistoryIds.length > 0 ? "white" : "#1e293b",
                    borderRadius: "12px",
                    display: "flex", 
                    alignItems: "center", 
                    gap: "8px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    boxShadow: selectedHistoryIds.length > 0 ? "0 4px 12px rgba(124, 58, 237, 0.25)" : "none",
                    transition: "all 0.2s"
                  }}
                  onClick={() => {
                    setIsPrinting(false);
                    setIsPrintingReport(true);
                    setTimeout(() => { window.print(); }, 800);
                  }}
                >
                  <span>🖨️</span> 
                  {selectedHistoryIds.length > 0 
                    ? `Imprimir Reporte (${selectedHistoryIds.length})` 
                    : "Imprimir Reporte Completo"}
                </button>
              </>
            )}

            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: "1rem", color: "#94a3b8", fontSize: "1rem" }}>🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por nombre o ID..." 
                style={{ 
                  minWidth: "350px", 
                  padding: "0.75rem 1rem 0.75rem 2.8rem", 
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  transition: "all 0.3s ease",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.01)"
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--primary)";
                  e.target.style.background = "white";
                  e.target.style.boxShadow = "0 0 0 4px #fdf2f8";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.background = "#f8fafc";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>
        </div>

        <div className="list-container">
          {activeTab === "historial" ? (
            filteredReintegros.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📦</div>
                <p>No hay medicamentos registrados en el historial.</p>
              </div>
            ) : (
              <div style={{
                background: "white",
                borderRadius: "20px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.03)",
                overflow: "hidden",
                width: "100%"
              }}>
                {filteredReintegros.map((item, idx) => (
                  <div 
                    key={item.docId} 
                    style={{ 
                      display: "flex",
                      flexDirection: "column",
                      background: "white",
                      borderBottom: idx === filteredReintegros.length - 1 ? "none" : "1px solid #f1f5f9",
                      transition: "all 0.2s ease"
                    }}
                    className="history-row"
                  >
                    {/* Fila Superior con Datos */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", width: "100%", flexWrap: "wrap", gap: "1.5rem" }}>
                      <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", minWidth: "250px" }}>
                        {/* Checkbox de Selección */}
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <input
                            type="checkbox"
                            style={{
                              width: "18px",
                              height: "18px",
                              cursor: "pointer",
                              accentColor: "#7c3aed",
                              margin: 0
                            }}
                            checked={selectedHistoryIds.includes(item.docId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedHistoryIds(prev => [...prev, item.docId]);
                              } else {
                                setSelectedHistoryIds(prev => prev.filter(id => id !== item.docId));
                              }
                            }}
                          />
                        </div>
                        <div style={{ 
                          width: "48px", 
                          height: "48px", 
                          borderRadius: "12px", 
                          background: "#f8fafc", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center", 
                          color: "#64748b", 
                          fontSize: "1.15rem",
                          fontWeight: 800,
                          border: "1px solid #e2e8f0"
                        }}>
                          {item.nombreMedicamento.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, textDecoration: "line-through", color: "var(--text-muted)" }}>
                            {item.nombreMedicamento}
                          </h4>
                          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                            ID: <span style={{ fontWeight: 700 }}>{item.id}</span> • Por: <span style={{ fontWeight: 600 }}>{item.ingresadoPor || "Admin"}</span>
                          </p>
                        </div>
                      </div>

                      {/* Caja del Stock */}
                      <div style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "0.5rem 1rem",
                        textAlign: "right",
                        minWidth: "150px"
                      }}>
                        <div style={{ color: "#475569", fontWeight: 800, fontSize: "1.15rem", lineHeight: 1.1 }}>
                          {item.cantidadCajas} <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase" }}>cajas</span>
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, marginTop: "2px" }}>
                          {item.comprimidosPorCaja} c/u • {item.cantidadComprimidos} total
                        </div>
                      </div>
                    </div>

                    {/* Fila de Acciones */}
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      padding: "0.6rem 1.5rem", 
                      background: "#fcfdfe", 
                      borderTop: "1px solid #f1f5f9",
                      width: "100%" 
                    }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button 
                          style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer", color: "#64748b", padding: "5px 10px", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}
                          onClick={() => { setEditProduct(item); setIsViewModalOpen(true); }}
                        >
                          👁️ Detalle
                        </button>
                      </div>

                      <button 
                        className="primary" 
                        style={{ 
                          padding: "0.5rem 1.2rem", 
                          fontSize: "0.8rem",
                          background: (item.autorizadoImprimir || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "")) ? "var(--primary)" : (item.solicitudPendiente === "imprimir" ? "#64748b" : "#94a3b8"),
                          borderRadius: "8px",
                          cursor: "pointer"
                        }}
                        onClick={async () => {
                          if (["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") || item.autorizadoImprimir) {
                            openDistributeModal(item);
                          } else {
                            if (!item.solicitudPendiente) {
                              try {
                                await updateDoc(doc(db, "reintegros", item.docId), {
                                  solicitudPendiente: "imprimir"
                                });
                                showDialog("Solicitud enviada", "Solicitud de impresión enviada al administrador.", "info");
                              } catch (e) { console.error(e); }
                            } else {
                              showDialog("Aviso", "Ya existe una solicitud pendiente para este registro.", "warning");
                            }
                          }
                        }}
                      >
                        {item.solicitudPendiente === "imprimir" ? "⏳ Esperando Autorización" : 
                         (item.autorizadoImprimir || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") ? 
                          "📜 Ver Etiquetas" : "🔒 Solicitar Impresión")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredReintegros.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📦</div>
                <p>No hay medicamentos registrados en el sistema.</p>
              </div>
            ) : (
              filteredReintegros.map((item) => (
                <div key={item.docId} className="list-item" style={{ flexDirection: "column", gap: "0", padding: "0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", width: "100%", flexWrap: "wrap", gap: "1.5rem" }}>
                    <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", minWidth: "250px" }}>
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
                        fontWeight: 800
                      }}>
                        {item.nombreMedicamento.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, textDecoration: item.estado === "realizado" ? "line-through" : "none", color: item.estado === "realizado" ? "var(--text-muted)" : "inherit" }}>
                          {item.nombreMedicamento}
                        </h4>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                          ID: <span style={{ fontWeight: 700, color: "var(--primary)" }}>{item.id}</span> • Ingresado por: <span style={{ fontWeight: 600 }}>{item.ingresadoPor || "Admin"}</span>
                        </p>
                      </div>
                    </div>

                    {/* Tarjeta del Stock */}
                    <div style={{
                      background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
                      border: "1px solid #fbcfe8",
                      borderRadius: "14px",
                      padding: "0.6rem 1.25rem",
                      textAlign: "right",
                      minWidth: "160px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      boxShadow: "0 2px 4px rgba(216, 27, 96, 0.03)"
                    }}>
                      <div style={{ color: "var(--primary)", fontWeight: 800, fontSize: "1.25rem", lineHeight: 1.1 }}>
                        {item.cantidadCajas} <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>cajas</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#86198f", fontWeight: 700, marginTop: "4px" }}>
                        {item.comprimidosPorCaja} c/u • {item.cantidadComprimidos} total
                      </div>
                    </div>
                  </div>

                  <div style={{ height: "1px", background: "#f1f5f9", width: "100%" }}></div>

                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    padding: "0.75rem 1.25rem", 
                    background: "#fafafa", 
                    borderBottomLeftRadius: "16px", 
                    borderBottomRightRadius: "16px",
                    width: "100%" 
                  }}>
                    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                      {item.solicitudPendiente ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fffbeb", padding: "4px 10px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                          <span style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 700 }}>
                            ⏳ PENDIENTE: {item.solicitudPendiente.toUpperCase()}
                          </span>
                          {["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") && (
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button 
                                style={{ background: "#22c55e", border: "none", borderRadius: "4px", cursor: "pointer", color: "white", padding: "2px 8px", fontSize: "0.75rem", fontWeight: 700 }}
                                onClick={async () => {
                                  if (item.solicitudPendiente === "imprimir") {
                                    await updateDoc(doc(db, "reintegros", item.docId), {
                                      solicitudPendiente: null,
                                      autorizadoImprimir: true
                                    });
                                  } else if (item.solicitudPendiente === "finalizar") {
                                    toggleEstado(item.docId, item.estado);
                                  } else {
                                    aprobarSolicitud(item.docId, item.solicitudPendiente!);
                                  }
                                }}
                              >
                                ✓
                              </button>
                              <button 
                                style={{ background: "#ef4444", border: "none", borderRadius: "4px", cursor: "pointer", color: "white", padding: "2px 8px", fontSize: "0.75rem", fontWeight: 700 }}
                                onClick={() => rechazarSolicitud(item.docId)}
                              >✕</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {activeTab === "activo" && (
                            <button 
                              style={{ 
                                background: item.etiquetaGuardada ? (item.solicitudPendiente === "finalizar" ? "#64748b" : "#22c55e") : "#f1f5f9", 
                                border: "none", 
                                borderRadius: "8px", 
                                cursor: item.etiquetaGuardada ? "pointer" : "not-allowed", 
                                color: item.etiquetaGuardada ? "white" : "#94a3b8", 
                                padding: "6px 12px", 
                                fontSize: "0.8rem", 
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                transition: "all 0.2s"
                              }}
                              onClick={async () => {
                                if (!item.etiquetaGuardada) return;
                                if (["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "")) {
                                  toggleEstado(item.docId, item.estado);
                                } else {
                                  try {
                                    await updateDoc(doc(db, "reintegros", item.docId), {
                                      solicitudPendiente: "finalizar"
                                    });
                                    showDialog("Solicitud enviada", "La finalización está pendiente de aprobación.", "info");
                                  } catch (e) { console.error(e); }
                                }
                              }}
                              disabled={!item.etiquetaGuardada || item.solicitudPendiente === "finalizar"}
                            >
                              {item.solicitudPendiente === "finalizar" ? "⏳ Esperando..." : (item.etiquetaGuardada ? "✅ Listo" : "⏳ Pendiente")}
                            </button>
                          )}
                          <button 
                            style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", cursor: "pointer", color: "#64748b", padding: "6px 12px", fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}
                            onClick={() => { setEditProduct(item); setIsViewModalOpen(true); }}
                          >
                            👁️ Detalle
                          </button>
                          {activeTab === "activo" && (
                            <>
                              <button 
                                style={{ background: "white", border: "1px solid #bae6fd", borderRadius: "8px", cursor: "pointer", color: "#0369a1", padding: "6px 12px", fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}
                                onClick={() => { setEditProduct(item); setIsEditModalOpen(true); }}
                              >
                                ✏️ Editar
                              </button>
                              {["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") && (
                                <button 
                                  style={{ background: "white", border: "1px solid #fecaca", borderRadius: "8px", cursor: "pointer", color: "#b91c1c", padding: "6px 12px", fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}
                                  onClick={() => handleDelete(item.docId)}
                                >
                                  🗑️ Borrar
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>

                    <button 
                      className="primary" 
                      style={{ 
                        padding: "0.6rem 1.2rem", 
                        fontSize: "0.85rem",
                        background: (activeTab === "activo" || item.autorizadoImprimir || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "")) ? "var(--primary)" : (item.solicitudPendiente === "imprimir" ? "#64748b" : "#94a3b8"),
                        borderRadius: "10px",
                        opacity: 1
                      }}
                      onClick={async () => {
                        if (activeTab === "activo" || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") || item.autorizadoImprimir) {
                          openDistributeModal(item);
                        } else {
                          if (!item.solicitudPendiente) {
                            try {
                              await updateDoc(doc(db, "reintegros", item.docId), {
                                solicitudPendiente: "imprimir"
                              });
                              showDialog("Solicitud enviada", "Solicitud de impresión enviada al administrador.", "info");
                            } catch (e) { console.error(e); }
                          } else {
                            showDialog("Aviso", "Ya existe una solicitud pendiente para este registro.", "warning");
                          }
                        }
                      }}
                    >
                      {item.solicitudPendiente === "imprimir" ? "⏳ Esperando Autorización" : 
                       (item.autorizadoImprimir || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") ? 
                        "📜 Ver Etiquetas" : "🔒 Solicitar Impresión")}
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
      {/* Distribution Modal */}
      {isDistributeModalOpen && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <button 
              style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#94a3b8" }}
              onClick={async () => {
                if (activeTab === "historial" && selectedProduct?.autorizadoImprimir) {
                  const docRef = doc(db, "reintegros", selectedProduct.docId);
                  await updateDoc(docRef, { autorizadoImprimir: false });
                }
                setIsDistributeModalOpen(false);
              }}
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
                    onChange={(e) => setDistributionForm({...distributionForm, posologia: e.target.value.toUpperCase()})}
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
              <div style={{ display: "flex", gap: "1rem" }}>
                <button 
                  type="button" 
                  className="primary" 
                  style={{ 
                    flex: 1, 
                    background: activeTab === "activo" || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") || selectedProduct.autorizadoImprimir ? "#0ea5e9" : "#94a3b8",
                    cursor: activeTab === "activo" || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") || selectedProduct.autorizadoImprimir ? "pointer" : "not-allowed",
                    opacity: activeTab === "activo" || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") || selectedProduct.autorizadoImprimir ? 1 : 0.6
                  }}
                  disabled={activeTab !== "activo" && !["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") && !selectedProduct.autorizadoImprimir}
                  onClick={async () => {
                    if (Number(distributionForm.totalComprimidos) > 5000) {
                      showDialog("Advertencia", "Estás intentando imprimir demasiadas etiquetas. Reduce la cantidad.", "warning");
                      return;
                    }
                    
                    if (activeTab === "activo" && selectedProduct) {
                      const docRef = doc(db, "reintegros", selectedProduct.docId);
                      await updateDoc(docRef, {
                        posologia: distributionForm.posologia,
                        comprimidosPorSobre: distributionForm.comprimidosPorSobre,
                        vto: distributionForm.vto,
                        seri: distributionForm.seri,
                        regIsp: distributionForm.regIsp,
                        etiquetaGuardada: true
                      });
                    }

                    setIsPrintingReport(false);
                    setPrintSize("10x5");
                    setIsPrinting(true);
                    setTimeout(() => { window.print(); }, 800);
                  }}
                >
                  🖨️ Grande (10x5cm)
                </button>
                <button 
                  type="button" 
                  className="primary" 
                  style={{ 
                    flex: 1, 
                    background: activeTab === "activo" || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") || selectedProduct.autorizadoImprimir ? "#8b5cf6" : "#94a3b8",
                    cursor: activeTab === "activo" || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") || selectedProduct.autorizadoImprimir ? "pointer" : "not-allowed",
                    opacity: activeTab === "activo" || ["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") || selectedProduct.autorizadoImprimir ? 1 : 0.6
                  }}
                  disabled={activeTab !== "activo" && !["administrador", "subrogante"].includes(user?.rol?.toLowerCase() || "") && !selectedProduct.autorizadoImprimir}
                  onClick={async () => {
                    if (Number(distributionForm.totalComprimidos) > 5000) {
                      showDialog("Advertencia", "Estás intentando imprimir demasiadas etiquetas. Reduce la cantidad.", "warning");
                      return;
                    }

                    if (activeTab === "activo" && selectedProduct) {
                      const docRef = doc(db, "reintegros", selectedProduct.docId);
                      await updateDoc(docRef, {
                        posologia: distributionForm.posologia,
                        comprimidosPorSobre: distributionForm.comprimidosPorSobre,
                        vto: distributionForm.vto,
                        seri: distributionForm.seri,
                        regIsp: distributionForm.regIsp,
                        etiquetaGuardada: true
                      });
                    }

                    setIsPrintingReport(false);
                    setPrintSize("5x3");
                    setIsPrinting(true);
                    setTimeout(() => { window.print(); }, 800);
                  }}
                >
                  🖨️ Pequeño (5x3cm)
                </button>
              </div>

              {activeTab === "historial" && (
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
                      <div key={index} style={{ width: "75mm", height: "45mm", flexShrink: 0, position: "relative", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", borderRadius: "4px", overflow: "hidden" }}>
                        <div className="label-wrapper size-5x3" style={{ transform: "scale(1.5)", transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
                          <div className="label-header">HOSPITAL DE CUREPTO<br/>SERVICIO DE FARMACIA</div>
                          <div className="label-med-name">{selectedProduct?.nombreMedicamento}</div>
                          <div className="label-unit">Comprimidos</div>
                          <div className="label-dosage">{distributionForm.posologia}</div>
                          <div className="label-total-count">Total: {distributionForm.comprimidosPorSobre} {Number(distributionForm.comprimidosPorSobre) === 1 ? 'comprimido' : 'comprimidos'}</div>
                          <div className="label-grid">
                            <div className="label-grid-item"><span className="label-cell-title">VENC:</span><span className="label-cell-value">{distributionForm.vto}</span></div>
                            <div className="label-grid-item"><span className="label-cell-title">SERIE:</span><span className="label-cell-value">{distributionForm.seri}</span></div>
                            <div className="label-grid-item"><span className="label-cell-title">ISP:</span><span className="label-cell-value">{distributionForm.regIsp}</span></div>
                            <div className="label-grid-item"><span className="label-cell-title">N° BOL:</span><span className="label-cell-value">{index + 1}/{array.length}</span></div>
                            <div className="label-grid-item" style={{ gridColumn: "span 2", textAlign: "center", borderTop: "none", background: "#f8fafc" }}>
                              <span className="label-cell-title" style={{ fontSize: "5pt" }}>CORRELATIVO ÚNICO</span>
                              <span className="label-cell-value" style={{ fontSize: "7pt", fontWeight: 900 }}>
                                {(selectedProduct?.correlativoInicial) ? `M-${selectedProduct.correlativoInicial + index}` : (nextCorrelativo ? `M-${nextCorrelativo + index}` : "CARGANDO...")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button 
                type="button" 
                className="secondary" 
                style={{ width: "100%" }} 
                onClick={async () => {
                  if (activeTab === "historial" && selectedProduct?.autorizadoImprimir) {
                    const docRef = doc(db, "reintegros", selectedProduct.docId);
                    await updateDoc(docRef, { autorizadoImprimir: false });
                  }
                  setIsDistributeModalOpen(false);
                }}
              >
                {activeTab === "activo" ? "Cancelar" : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Nuevo Medicamento */}
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
                  <input type="text" placeholder="Nombre genérico o comercial" value={formData.nombreMedicamento} onChange={(e) => { setFormData({...formData, nombreMedicamento: e.target.value.toUpperCase()}); setShowSuggestions(true); }} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} required />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="suggestions-list">
                      {filteredSuggestions.map((s, idx) => (
                        <div key={idx} className="suggestion-item" onClick={() => { setFormData({ ...formData, nombreMedicamento: s.nombre, comprimidosPorCaja: s.comprimidosPorCaja.toString(), regIsp: s.regIsp || "", vto: s.vto || "" }); setShowSuggestions(false); }}>
                          <span>{s.nombre}</span><span className="detail">{s.comprimidosPorCaja} c/u</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <div className="form-group"><label>Stock Cajas</label><input type="number" placeholder="0" value={formData.cantidadCajas} onChange={(e) => setFormData({...formData, cantidadCajas: e.target.value})} /></div>
                <div className="form-group"><label>Comprimidos por Caja</label><input type="number" placeholder="0" value={formData.comprimidosPorCaja} onChange={(e) => setFormData({...formData, comprimidosPorCaja: e.target.value})} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <div className="form-group"><label>N° de Serie</label><input type="text" placeholder="Ej: MED-12345" value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value})} /></div>
                <div className="form-group"><label>Vencimiento</label><input type="date" className="date-picker-input" value={formData.vto} onChange={(e) => setFormData({...formData, vto: e.target.value})} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2.5rem" }}>
                <div className="form-group"><label>Registro de N° ISP</label><input type="text" placeholder="Ej: F-1234/20" value={formData.regIsp} onChange={(e) => setFormData({...formData, regIsp: e.target.value.toUpperCase()})} /></div>
                <div className="form-group"><label>Proveedor</label><input type="text" placeholder="Ej: Laboratorio Chile" value={formData.proveedor} onChange={(e) => setFormData({...formData, proveedor: e.target.value.toUpperCase()})} /></div>
              </div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="primary" style={{ flex: 1 }} disabled={loading}>{loading ? "Registrando..." : "Guardar Medicamento"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editProduct && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <button style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#94a3b8" }} onClick={() => setIsEditModalOpen(false)}>&times;</button>
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Editar Medicamento</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Modifica los datos del registro <span style={{ color: "var(--primary)", fontWeight: 700 }}>N° de Serie: {editProduct.id}</span></p>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label>Nombre del Medicamento</label>
                <input type="text" value={editProduct.nombreMedicamento} onChange={(e) => setEditProduct({...editProduct, nombreMedicamento: e.target.value.toUpperCase()})} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <div className="form-group"><label>Stock Cajas</label><input type="number" value={editProduct.cantidadCajas} onChange={(e) => setEditProduct({...editProduct, cantidadCajas: Number(e.target.value)})} /></div>
                <div className="form-group"><label>Comprimidos por Caja</label><input type="number" value={editProduct.comprimidosPorCaja} onChange={(e) => setEditProduct({...editProduct, comprimidosPorCaja: Number(e.target.value)})} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2.5rem" }}>
                <div className="form-group"><label>N° de Serie</label><input type="text" value={editProduct.id} onChange={(e) => setEditProduct({...editProduct, id: e.target.value.toUpperCase()})} /></div>
                <div className="form-group"><label>Vencimiento</label><input type="date" className="date-picker-input" value={editProduct.vto || ""} onChange={(e) => setEditProduct({...editProduct, vto: e.target.value})} /></div>
              </div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="submit" className="primary" style={{ flex: 1 }}>Actualizar</button>
                <button type="button" className="secondary" onClick={() => setIsEditModalOpen(false)} style={{ flex: 1 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && editProduct && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: "600px" }}>
            <button style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#94a3b8" }} onClick={() => setIsViewModalOpen(false)}>&times;</button>
            <div style={{ marginBottom: "2rem" }}><h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Detalle del Medicamento</h3></div>
            <div className="view-details-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div className="detail-item" style={{ gridColumn: "span 2" }}><label style={{ fontSize: "0.75rem", fontWeight: 900, color: "#1e293b", textTransform: "uppercase" }}>Nombre</label><p style={{ fontSize: "1.1rem", fontWeight: 600 }}>{editProduct.nombreMedicamento}</p></div>
              <div className="detail-item"><label style={{ fontSize: "0.75rem", fontWeight: 900, color: "#1e293b", textTransform: "uppercase" }}>Stock</label><p>{editProduct.cantidadCajas} cajas ({editProduct.cantidadComprimidos} comp)</p></div>
              <div className="detail-item"><label style={{ fontSize: "0.75rem", fontWeight: 900, color: "#1e293b", textTransform: "uppercase" }}>Serie</label><p style={{ fontWeight: 700, color: "#0ea5e9" }}>{editProduct.id}</p></div>
              <div className="detail-item"><label style={{ fontSize: "0.75rem", fontWeight: 900, color: "#1e293b", textTransform: "uppercase" }}>Vencimiento</label><p>{editProduct.vto ? editProduct.vto.split('-').reverse().join('-') : "-"}</p></div>
              <div className="detail-item"><label style={{ fontSize: "0.75rem", fontWeight: 900, color: "#1e293b", textTransform: "uppercase" }}>Ingresado Por</label><p>{editProduct.ingresadoPor}</p></div>
            </div>
            <div style={{ marginTop: "2rem" }}><button className="primary" onClick={() => setIsViewModalOpen(false)} style={{ width: "100%" }}>Cerrar</button></div>
          </div>
        </div>
      )}

      {/* Print Area */}
      <div className={`print-area ${printSize === "5x3" ? "print-5x3" : "print-10x5"}`}>
        {isPrintingReport && (
          <div className="report-print-area">
            <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>Reporte de Historial de Preparaciones</h2>
            <table className="report-table">
              <thead><tr><th>Medicamento</th><th>Fecha</th><th>Proveedor</th><th>Serie</th><th>Vencimiento</th><th>Correlativo</th><th>Responsable</th></tr></thead>
              <tbody>
                {filteredReintegros
                  .filter((item) => selectedHistoryIds.length === 0 || selectedHistoryIds.includes(item.docId))
                  .map((item) => {
                    const totalLabels = item.comprimidosPorCaja ? Math.ceil(item.cantidadComprimidos / (Number(item.comprimidosPorSobre) || 1)) : 1;
                    return (
                      <tr key={item.docId}>
                        <td><strong>{item.nombreMedicamento}</strong><br/><span style={{ fontSize: "0.8em" }}>{item.posologia}</span></td>
                        <td>{item.fecha ? new Date(item.fecha.seconds * 1000).toLocaleDateString('es-CL') : ""}</td>
                        <td>{item.proveedor || "-"}</td>
                        <td>{item.id}</td>
                        <td>{item.vto || "-"}</td>
                        <td>{item.correlativoInicial ? `${item.correlativoPrefijo}-${item.correlativoInicial} al ${item.correlativoPrefijo}-${item.correlativoInicial + totalLabels - 1}` : "-"}</td>
                        <td>{item.ingresadoPor}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {isPrinting && (
          printSize === "5x3" ? (
            Array.from({ length: Math.ceil(Number(distributionForm.totalComprimidos) / (Number(distributionForm.comprimidosPorSobre) || 1)) }).map((_, index, array) => (
              <div key={index} className="label-wrapper size-5x3">
                <div className="label-header">HOSPITAL DE CUREPTO<br/>SERVICIO DE FARMACIA</div>
                <div className="label-med-name">{selectedProduct?.nombreMedicamento}</div>
                <div className="label-dosage">{distributionForm.posologia}</div>
                <div className="label-total-count">Total: {distributionForm.comprimidosPorSobre} comp.</div>
                <div className="label-grid">
                  <div className="label-grid-item"><span className="label-cell-title">VENC:</span><span className="label-cell-value">{distributionForm.vto}</span></div>
                  <div className="label-grid-item"><span className="label-cell-title">SERIE:</span><span className="label-cell-value">{distributionForm.seri}</span></div>
                  <div className="label-grid-item" style={{ gridColumn: "span 2", textAlign: "center" }}>
                    <span className="label-cell-title">CORRELATIVO ÚNICO</span>
                    <span className="label-cell-value" style={{ fontWeight: 900 }}>{selectedProduct?.correlativoPrefijo ? `${selectedProduct.correlativoPrefijo}-` : ""}{(selectedProduct?.correlativoInicial || 1) + index}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            Array.from({ length: Math.ceil((Number(distributionForm.totalComprimidos) / (Number(distributionForm.comprimidosPorSobre) || 1)) / 2) }).map((_, stickerIndex) => {
              const totalLabels = Math.ceil(Number(distributionForm.totalComprimidos) / (Number(distributionForm.comprimidosPorSobre) || 1));
              return (
                <div key={stickerIndex} className="label-wrapper size-10x5">
                  {[0, 1].map((offset) => {
                    const labelIndex = (stickerIndex * 2) + offset;
                    if (labelIndex >= totalLabels) return <div key={offset} className="label-sub-content empty"></div>;
                    return (
                      <div key={offset} className="label-sub-content">
                        <div className="label-header">HOSPITAL DE CUREPTO<br/>SERVICIO DE FARMACIA</div>
                        <div className="label-med-name">{selectedProduct?.nombreMedicamento}</div>
                        <div className="label-dosage">{distributionForm.posologia}</div>
                        <div className="label-total-count">Total: {distributionForm.comprimidosPorSobre} comp.</div>
                        <div className="label-grid">
                          <div className="label-grid-item"><span className="label-cell-title">VENC:</span><span className="label-cell-value">{distributionForm.vto}</span></div>
                          <div className="label-grid-item"><span className="label-cell-title">SERIE:</span><span className="label-cell-value">{distributionForm.seri}</span></div>
                          <div className="label-grid-item" style={{ gridColumn: "span 2", textAlign: "center" }}>
                            <span className="label-cell-title">CORRELATIVO ÚNICO</span>
                            <span className="label-cell-value" style={{ fontWeight: 900 }}>{selectedProduct?.correlativoPrefijo ? `${selectedProduct.correlativoPrefijo}-` : ""}{(selectedProduct?.correlativoInicial || 1) + labelIndex}</span>
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

      {/* Custom Dialog Modal (Premium Popups) */}
      {dialog.isOpen && (
        <div className="modal-overlay" style={{ 
          zIndex: 10000, 
          backdropFilter: "blur(12px)", 
          backgroundColor: "rgba(15, 23, 42, 0.4)",
          transition: "all 0.3s ease"
        }}>
          <div className="modal-content animate-fade-in" style={{ 
            maxWidth: "420px", 
            textAlign: "center", 
            padding: "2.5rem",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            background: "rgba(255, 255, 255, 0.98)",
            transform: "scale(1)",
            animation: "scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
          }}>
            <style>{`
              @keyframes scaleUp {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
            `}</style>
            
            <div style={{ 
              width: "72px", 
              height: "72px", 
              borderRadius: "22px", 
              background: dialog.type === "danger" ? "linear-gradient(135deg, #fee2e2, #fecaca)" : 
                         (dialog.type === "warning" ? "linear-gradient(135deg, #fffbeb, #fef3c7)" : 
                         (dialog.type === "success" ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "linear-gradient(135deg, #f0f9ff, #e0f2fe)")),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.2rem",
              margin: "0 auto 1.5rem",
              boxShadow: "0 8px 16px rgba(0,0,0,0.05)"
            }}>
              {dialog.type === "danger" ? "🛑" : (dialog.type === "warning" ? "⚠️" : (dialog.type === "success" ? "✅" : "ℹ️"))}
            </div>
            
            <h3 style={{ 
              fontSize: "1.6rem", 
              fontWeight: 800, 
              color: "#0f172a", 
              marginBottom: "0.75rem",
              letterSpacing: "-0.02em"
            }}>{dialog.title}</h3>
            
            <p style={{ 
              color: "#64748b", 
              fontSize: "1.05rem", 
              lineHeight: "1.6", 
              marginBottom: "2.5rem",
              fontWeight: 500
            }}>{dialog.message}</p>
            
            <div style={{ display: "flex", gap: "1rem" }}>
              <button 
                className="secondary" 
                style={{ 
                  flex: 1, 
                  padding: "0.9rem", 
                  borderRadius: "14px", 
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #e2e8f0",
                  transition: "all 0.2s"
                }} 
                onClick={closeDialog}
                onMouseOver={(e) => (e.currentTarget.style.background = "#e2e8f0")}
                onMouseOut={(e) => (e.currentTarget.style.background = "#f1f5f9")}
              >
                {dialog.onConfirm ? "Cancelar" : "Entendido"}
              </button>
              {dialog.onConfirm && (
                <button 
                  className="primary" 
                  style={{ 
                    flex: 1, 
                    padding: "0.9rem",
                    borderRadius: "14px",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    color: "white",
                    border: "none",
                    boxShadow: dialog.type === "danger" ? "0 8px 20px rgba(239, 68, 68, 0.3)" : 
                               (dialog.type === "warning" ? "0 8px 20px rgba(245, 158, 11, 0.3)" : "0 8px 20px rgba(216, 27, 96, 0.3)"),
                    background: dialog.type === "danger" ? "linear-gradient(135deg, #ef4444, #dc2626)" : 
                               (dialog.type === "warning" ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #d81b60, #ad1457)"),
                    transition: "all 0.2s"
                  }} 
                  onClick={() => {
                    dialog.onConfirm?.();
                    closeDialog();
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                  onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                >
                  Confirmar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
