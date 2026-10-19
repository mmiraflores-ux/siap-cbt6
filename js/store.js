/* =============================================================
   Capa de datos intercambiable
   - LocalStore    : localStorage + IndexedDB (sin servidor)
   - FirebaseStore : Cloud Firestore + Firebase Auth (tiempo real)
   Ambas exponen la misma interfaz para que la app no cambie.
   ============================================================= */
export const COLS_CATALOGO = ["personas","grupos","unidades","actividades","modulos","asignaciones","horarios","instrumentos","calendario","paec"];
export const COLS_PROCESO  = ["planeaciones","sesiones","concreciones","observaciones","autorreflexiones","dialogos","acuerdos","seguimientos","evidencias"];
export const newId = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const CHUNK = 900000; // caracteres base64 por documento (< 1 MiB)

/* ---------------- utilidades de archivos ---------------- */
const bufToB64 = buf => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const b64ToBlob = (b64, type) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };

/* ========================= LOCAL ========================= */
class LocalStore {
  constructor(seed) { this.key = "siap_db_v1"; this.seed = seed; this.subs = new Set(); this.mode = "local"; this.online = true; }
  async init() {
    if (!localStorage.getItem(this.key)) this._importSeed();
    window.addEventListener("storage", e => { if (e.key === this.key) this._emit(); });
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open("siap_files", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }).catch(() => null);
  }
  _importSeed() {
    const d = {};
    Object.entries(this.seed).forEach(([col, arr]) => { if (Array.isArray(arr) && col !== "bloques") { d[col] = {}; arr.forEach(x => d[col][x.id] = x); } });
    d._meta = { creado: new Date().toISOString(), semilla: this.seed.meta?.version };
    localStorage.setItem(this.key, JSON.stringify(d));
  }
  _all() { try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch { return {}; } }
  _save(d) {
    try { localStorage.setItem(this.key, JSON.stringify(d)); }
    catch (e) { throw new Error("El almacenamiento del navegador está lleno. Exporta un respaldo o usa el modo Firebase."); }
    this._emit();
  }
  _emit() { clearTimeout(this._t); this._t = setTimeout(() => this.subs.forEach(s => s.run()), 10); }
  subscribe(col, filter, cb) {
    const s = { run: () => { const all = Object.values(this._all()[col] || {}); cb(filter ? all.filter(x => x[filter[0]] === filter[1]) : all); } };
    this.subs.add(s); s.run(); return () => this.subs.delete(s);
  }
  async get(col, id) { return (this._all()[col] || {})[id] || null; }
  async set(col, id, data, merge = true) {
    const d = this._all(); d[col] = d[col] || {};
    d[col][id] = merge ? { ...(d[col][id] || {}), ...data, id } : { ...data, id };
    this._save(d); return id;
  }
  async del(col, id) { const d = this._all(); if (d[col]) delete d[col][id]; this._save(d); }
  async batch(ops) { const d = this._all(); ops.forEach(([col, id, data]) => { d[col] = d[col] || {}; d[col][id] = { ...(d[col][id] || {}), ...data, id }; }); this._save(d); }
  async putFile(meta, buf) {
    const id = newId("f-");
    if (!this.db) throw new Error("Este navegador no permite guardar archivos (IndexedDB).");
    await new Promise((res, rej) => { const t = this.db.transaction("files", "readwrite"); t.objectStore("files").put({ meta, blob: new Blob([buf], { type: meta.tipo }) }, id); t.oncomplete = res; t.onerror = () => rej(t.error); });
    await this.set("archivos", id, { ...meta, partes: 0 }); return id;
  }
  async getFile(id) {
    if (!this.db) return null;
    return new Promise(res => { const r = this.db.transaction("files").objectStore("files").get(id); r.onsuccess = () => res(r.result ? r.result.blob : null); r.onerror = () => res(null); });
  }
  exportAll() { return this._all(); }
  importAll(obj) { localStorage.setItem(this.key, JSON.stringify(obj)); this._emit(); }
  reset() { localStorage.removeItem(this.key); this._importSeed(); this._emit(); }
  /* autenticación simulada (solo para pruebas / piloto) */
  async currentUser() { try { return JSON.parse(sessionStorage.getItem("siap_user")); } catch { return null; } }
  async loginAs(u) { sessionStorage.setItem("siap_user", JSON.stringify(u)); return u; }
  async logout() { sessionStorage.removeItem("siap_user"); }
  onAuth(cb) { this.currentUser().then(cb); }
}

/* ======================= FIREBASE ======================= */
class FirebaseStore {
  constructor(cfg, seed) { this.cfg = cfg; this.seed = seed; this.mode = "firebase"; this.online = navigator.onLine; }
  async init() {
    const [{ initializeApp }, A, F] = await Promise.all([
      import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")]);
    this.A = A; this.F = F;
    this.app = initializeApp(this.cfg.firebaseConfig);
    this.auth = A.getAuth(this.app);
    try { this.fs = F.initializeFirestore(this.app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
    catch { this.fs = F.getFirestore(this.app); }
    window.addEventListener("online", () => this.online = true);
    window.addEventListener("offline", () => this.online = false);
  }
  subscribe(col, filter, cb, onErr) {
    const F = this.F; let q = F.collection(this.fs, col);
    if (filter) q = F.query(q, F.where(filter[0], "==", filter[1]));
    if (col === "auditoria") q = F.query(F.collection(this.fs, col), F.orderBy("ts", "desc"), F.limit(400));
    return F.onSnapshot(q, snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      err => { console.warn("Suscripción", col, err.code); onErr && onErr(col, err); cb([]); });
  }
  async get(col, id) { const s = await this.F.getDoc(this.F.doc(this.fs, col, id)); return s.exists() ? { ...s.data(), id: s.id } : null; }
  async set(col, id, data, merge = true) { const clean = JSON.parse(JSON.stringify({ ...data, id })); await this.F.setDoc(this.F.doc(this.fs, col, id), clean, { merge }); return id; }
  async del(col, id) { await this.F.deleteDoc(this.F.doc(this.fs, col, id)); }
  async batch(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = this.F.writeBatch(this.fs);
      ops.slice(i, i + 400).forEach(([col, id, data]) => b.set(this.F.doc(this.fs, col, id), JSON.parse(JSON.stringify({ ...data, id })), { merge: true }));
      await b.commit();
    }
  }
  async putFile(meta, buf) {
    const id = newId("f-"), b64 = bufToB64(buf), n = Math.ceil(b64.length / CHUNK);
    const ops = [];
    for (let i = 0; i < n; i++) ops.push(["archivos_partes", `${id}_${i}`, { fileId: id, n: i, data: b64.slice(i * CHUNK, (i + 1) * CHUNK), docenteId: meta.docenteId || "" }]);
    for (const op of ops) await this.set(...op, false);   // uno por uno: cada parte ~900 KB
    await this.set("archivos", id, { ...meta, partes: n }, false);
    return id;
  }
  async getFile(id) {
    const m = await this.get("archivos", id); if (!m) return null;
    let b64 = "";
    for (let i = 0; i < m.partes; i++) { const p = await this.get("archivos_partes", `${id}_${i}`); b64 += p ? p.data : ""; }
    return b64ToBlob(b64, m.tipo);
  }
  async seedIfEmpty() {
    const s = await this.F.getDocs(this.F.query(this.F.collection(this.fs, "asignaciones"), this.F.limit(1)));
    if (!s.empty) return false;
    const ops = [];
    Object.entries(this.seed).forEach(([col, arr]) => { if (Array.isArray(arr) && col !== "bloques") arr.forEach(x => ops.push([col, x.id, x])); });
    await this.batch(ops); return true;
  }
  onAuth(cb) { this.A.onAuthStateChanged(this.auth, u => cb(u ? { uid: u.uid, email: (u.email || "").toLowerCase() } : null)); }
  async login(email, pass) { return this.A.signInWithEmailAndPassword(this.auth, email, pass); }
  async register(email, pass) { return this.A.createUserWithEmailAndPassword(this.auth, email, pass); }
  async reset(email) { return this.A.sendPasswordResetEmail(this.auth, email); }
  async logout() { return this.A.signOut(this.auth); }
}

export async function createStore(cfg, seed) {
  const s = cfg.mode === "firebase" ? new FirebaseStore(cfg, seed) : new LocalStore(seed);
  await s.init(); return s;
}
