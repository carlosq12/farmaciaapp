"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export interface User {
  id: string;
  nombreCompleto: string;
  rut: string;
  rol: string;
  estado?: string;
  photoUrl?: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (rut: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  updateProfilePhoto: (file: File) => Promise<{ success: boolean; url?: string; message?: string }>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sesión de localStorage si existe
    const storedUser = localStorage.getItem("hospital_curepto_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {}
    }
    setLoading(false);
  }, []);

  const login = async (rut: string, password: string): Promise<LoginResponse> => {
    try {
      const q = query(
        collection(db, "usuarios"), 
        where("rut", "==", rut),
        where("password", "==", password)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const userData = docSnap.data();
        
        if (userData.estado === "Pendiente") {
          return { success: false, message: "Tu cuenta está pendiente de validación por un Administrador." };
        }

        const loggedUser: User = {
          id: docSnap.id,
          nombreCompleto: userData.nombreCompleto,
          rut: userData.rut,
          rol: userData.rol,
          estado: userData.estado || "Aprobado",
          photoUrl: userData.photoUrl || "",
        };
        
        setUser(loggedUser);
        localStorage.setItem("hospital_curepto_user", JSON.stringify(loggedUser));
        return { success: true };
      } else if (rut === "ADMIN" && password === "admin") {
        // Fallback admin for initial setup
        const loggedUser: User = {
          id: "fallback-admin",
          nombreCompleto: "Administrador Sistema",
          rut: "ADMIN",
          rol: "Administrador",
          estado: "Aprobado",
          photoUrl: "",
        };
        setUser(loggedUser);
        localStorage.setItem("hospital_curepto_user", JSON.stringify(loggedUser));
        return { success: true };
      }
      return { success: false, message: "Credenciales incorrectas o usuario no encontrado." };
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      return { success: false, message: "Error de conexión con el servidor." };
    }
  };


  const logout = () => {
    setUser(null);
    localStorage.removeItem("hospital_curepto_user");
  };

  const updateProfilePhoto = async (file: File): Promise<{ success: boolean; url?: string; message?: string }> => {
    if (!user) return { success: false, message: "No hay sesión activa." };
    if (user.id === "fallback-admin") return { success: false, message: "No se puede cambiar la foto del usuario de prueba." };

    try {
      const storageRef = ref(storage, `profile_photos/${user.id}_${Date.now()}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Actualizar Firestore
      const userDocRef = doc(db, "usuarios", user.id);
      await updateDoc(userDocRef, {
        photoUrl: downloadURL
      });

      // Actualizar estado local
      const updatedUser = { ...user, photoUrl: downloadURL };
      setUser(updatedUser);
      localStorage.setItem("hospital_curepto_user", JSON.stringify(updatedUser));

      return { success: true, url: downloadURL };
    } catch (error: any) {
      console.error("Error al subir foto:", error);
      return { success: false, message: "Error al subir la imagen. Verifica las reglas de Storage." };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfilePhoto }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
