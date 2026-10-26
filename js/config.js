/* =============================================================
   CONFIGURACIÓN DEL SISTEMA  ·  edita SOLO este archivo
   -------------------------------------------------------------
   mode: "local"    → los datos se guardan en este navegador
                      (ideal para pruebas y piloto, sin internet).
   mode: "firebase" → los datos se guardan en la nube (Firestore)
                      y se sincronizan EN TIEMPO REAL entre todos.
   ============================================================= */
window.APP_CONFIG = {
  mode: "firebase",

  // Pega aquí el bloque "firebaseConfig" que te da Firebase
  // (Consola de Firebase → Configuración del proyecto → Tus apps → Web).
  firebaseConfig: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },

  // Correo de la persona que administra técnicamente el sistema.
  // Debe ser EXACTAMENTE el mismo que escribas en las reglas de Firestore.
  superAdminEmail: "",

  institucion: {
    nombre: "CBT No. 6 Gerardo Linares Terrón",
    ciudad: "Toluca, Estado de México",
    carrera: "Técnico en Informática",
    cicloActual: "2026-2027",
    periodoActual: "A"
  },

  // Tamaño máximo por archivo (planeaciones y evidencias) en MB.
  // En Firebase gratuito los archivos se guardan dentro de Firestore en partes.
  maxArchivoMB: 5
};
