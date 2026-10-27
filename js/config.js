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
  apiKey: "AIzaSyCFq74BZ3N4C_lGfjnvjD-MnXtiYN5A8Ig",
  authDomain: "siap-cbt6.firebaseapp.com",
  projectId: "siap-cbt6",
  storageBucket: "siap-cbt6.firebasestorage.app",
  messagingSenderId: "558315685142",
  appId: "1:558315685142:web:7f9550a98eef9bfc3afc37",
  measurementId: "G-XSS1YM7B9D"
  },

  // Correo de la persona que administra técnicamente el sistema.
  // Debe ser EXACTAMENTE el mismo que escribas en las reglas de Firestore.
  superAdminEmail: "m.miraflores@gmail.com",

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
