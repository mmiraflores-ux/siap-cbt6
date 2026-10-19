/* Núcleo compartido: estado, permisos, utilidades de UI y reglas de dominio */
import { newId } from "./store.js";
export { newId };

export const CFG = window.APP_CONFIG;
export const SEED = window.SEED;
export const BLOQUES = SEED.bloques;
export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

export const S = {
  store: null, user: null, d: {}, ix: {}, route: { view: "panel", id: null, q: {} },
  ui: {}, ready: false, errores: {}
};

/* -------- registro de vistas y acciones -------- */
export const VIEWS = {}, ACT = {}, FORMS = {};
export const view = (name, def) => (VIEWS[name] = def);

/* -------- utilidades -------- */
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
export const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Mexico_City" });
export const nowISO = () => new Date().toISOString();
export const fdate = d => { if (!d) return "—"; const x = new Date(d.length === 10 ? d + "T12:00:00" : d); return isNaN(x) ? d : x.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); };
export const fdt = d => { if (!d) return "—"; const x = new Date(d); return isNaN(x) ? d : x.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const opt = (v, l, sel) => `<option value="${esc(v)}" ${String(sel) === String(v) ? "selected" : ""}>${esc(l)}</option>`;
export const chip = (t, c = "") => `<span class="chip ${c}">${esc(t)}</span>`;
export const short = (s, n = 80) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

export function toast(msg, err = false) {
  const t = document.createElement("div"); t.className = "toast" + (err ? " err" : ""); t.textContent = msg;
  $("#toasts").appendChild(t); setTimeout(() => t.remove(), err ? 6000 : 3200);
}

/* Modal genérico. buttons: [{label, cls, act:'cerrar'|fn}] ; onSubmit(formData, modalEl) */
export function modal({ title, body, wide = false, submit = "Guardar", onSubmit = null, extra = "" }) {
  closeModal();
  const ov = document.createElement("div"); ov.className = "ov"; ov.id = "ov";
  ov.innerHTML = `<form class="modal ${wide ? "wide" : ""}" novalidate>
    <div class="mh"><h2>${esc(title)}</h2><button type="button" class="x" data-close aria-label="Cerrar">×</button></div>
    <div class="mb">${body}</div>
    <div class="mf">${extra}<span class="sp"></span><button type="button" class="btn" data-close>Cerrar</button>
    ${onSubmit ? `<button class="btn pri" type="submit">${esc(submit)}</button>` : ""}</div></form>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", e => { if (e.target === ov || e.target.closest("[data-close]")) closeModal(); });
  const f = ov.querySelector("form");
  f.addEventListener("submit", async e => {
    e.preventDefault(); if (!onSubmit) return;
    const req = [...f.querySelectorAll("[required]")].find(x => !String(x.value).trim());
    if (req) { req.focus(); toast("Completa los campos obligatorios.", true); return; }
    const btn = f.querySelector("[type=submit]"); btn.disabled = true;
    try { const r = await onSubmit(formObj(f), f); if (r !== false) closeModal(); }
    catch (er) { console.error(er); toast(errMsg(er), true); }
    finally { btn.disabled = false; }
  });
  setTimeout(() => f.querySelector("input,select,textarea")?.focus(), 30);
  return f;
}
export const closeModal = () => $("#ov")?.remove();
export function formObj(f) {
  const o = {};
  [...f.elements].forEach(el => {
    if (!el.name) return;
    if (el.type === "checkbox") { if (el.name.endsWith("[]")) { const k = el.name.slice(0, -2); o[k] = o[k] || []; if (el.checked) o[k].push(el.value); } else o[el.name] = el.checked; }
    else if (el.type === "radio") { if (el.checked) o[el.name] = el.value; else if (!(el.name in o)) o[el.name] = ""; }
    else if (el.type !== "file") o[el.name] = el.value.trim();
  });
  return o;
}
export const errMsg = e => {
  const c = e?.code || "";
  if (c.includes("permission-denied")) return "No tienes permiso para esta acción (reglas de seguridad).";
  if (c.includes("wrong-password") || c.includes("invalid-credential")) return "Correo o contraseña incorrectos.";
  if (c.includes("user-not-found")) return "No existe una cuenta con ese correo.";
  if (c.includes("email-already-in-use")) return "Ese correo ya tiene cuenta. Usa 'Iniciar sesión'.";
  if (c.includes("weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (c.includes("unavailable")) return "Sin conexión: el cambio se enviará cuando regrese internet.";
  return e?.message || String(e);
};

/* -------- datos e índices -------- */
export const L = col => S.d[col] || [];
export const byId = (col, id) => (S.ix[col] && S.ix[col][id]) || null;
export function reindex(col) { S.ix[col] = {}; (S.d[col] || []).forEach(x => S.ix[col][x.id] = x); }
export const P = id => byId("personas", id);
export const pname = id => P(id)?.nombre || (id ? "(persona no encontrada)" : "—");
export const UC = id => byId("unidades", id);
export const A = id => byId("asignaciones", id);
export const alabel = (a) => { if (typeof a === "string") a = A(a); if (!a) return "—"; const u = UC(a.unidadId); return `${u?.abrev || "?"} · ${a.grupo}`; };
export const afull = (a) => { if (typeof a === "string") a = A(a); if (!a) return "—"; const u = UC(a.unidadId); return u?.nombre || a.nombreFuente; };

/* -------- sesión y permisos (espejo de firestore.rules) -------- */
export const roles = () => S.user?.roles || [];
export const hasRole = r => roles().includes(r);
export const me = () => S.user?.personaId || null;
export const isSub = () => hasRole("subdirectora");
export const isStaff = () => hasRole("subdirectora") || hasRole("apoyo");
export const isOri = () => hasRole("orientadora");
export const canObserve = () => isStaff() || isOri();
export const isAdmin = () => hasRole("admin");
export const isDoc = () => hasRole("docente");
export const isVinc = () => hasRole("vinculadora");
export const ROLES = {
  subdirectora: "Subdirectora", apoyo: "Docente de apoyo a Subdirección", orientadora: "Orientadora",
  docente: "Docente frente a grupo", vinculadora: "Vinculadora", admin: "Administrador técnico", directivo: "Directivo (consulta)"
};

/* -------- calendario -------- */
export function periodoActual() {
  return L("calendario").find(c => c.ciclo === CFG.institucion.cicloActual && c.periodo === CFG.institucion.periodoActual) || L("calendario")[0];
}
export function parcialDe(fecha) {
  const c = periodoActual(); if (!c || !fecha) return null;
  const p = (c.parciales || []).find(p => fecha >= p.inicio && fecha <= p.fin); return p ? p.n : null;
}
export const parcialHoy = () => parcialDe(today()) || 1;

/* -------- auditoría y notificaciones -------- */
export async function audit(accion, col, docId, detalle = {}) {
  try {
    await S.store.set("auditoria", newId("au-"), {
      ts: nowISO(), uid: S.user?.uid || "", personaId: me() || "", nombre: S.user?.nombre || S.user?.email || "",
      accion, col, docId, detalle: JSON.parse(JSON.stringify(detalle))
    }, false);
  } catch (e) { console.warn("auditoría", e); }
}
export async function notify(paraId, tipo, texto, link, ref) {
  if (!paraId || paraId === me()) return;
  const id = `${tipo}_${ref || link}_${paraId}`.replace(/[^\w-]/g, "_");
  try { await S.store.set("notificaciones", id, { paraId, tipo, texto, link, ts: nowISO(), leida: false, deId: me() || "" }, false); }
  catch (e) { console.warn("notificación", e); }
}
/* guardar con auditoría */
export async function save(col, id, data, accion = "actualizar", merge = true) {
  const antes = byId(col, id);
  const payload = { ...data, actualizado: nowISO(), actualizadoPor: me() || S.user?.uid || "" };
  if (!antes) { payload.creado = nowISO(); payload.creadoPor = me() || S.user?.uid || ""; }
  await S.store.set(col, id, payload, merge);
  const cambios = {};
  if (antes) Object.keys(data).forEach(k => { if (JSON.stringify(antes[k]) !== JSON.stringify(data[k]) && !["texto"].includes(k)) cambios[k] = { antes: antes[k] ?? null, despues: data[k] }; });
  await audit(antes ? accion : "alta", col, id, antes ? cambios : { alta: true });
  return id;
}

/* -------- alertas preventivas (no sancionan, no califican) -------- */
export function alertas() {
  const out = [], pa = parcialHoy(), hoy = today();
  if (isStaff()) {
    const cal = periodoActual();
    if (cal?.porConfirmar) out.push({ cat: "Gestión", txt: "Las fechas de parciales son provisionales y requieren autorización de la Subdirectora.", link: "#/estructura?tab=calendario", lvl: "a" });
    if (cal?.propuesta) out.push({ cat: "Gestión", txt: "Hay una propuesta de cambio de calendario esperando autorización.", link: "#/estructura?tab=calendario", lvl: "a" });
    const conPlan = new Set(L("planeaciones").filter(p => p.parcial == pa && p.asignacionId && p.estado !== "Sustituida").map(p => p.asignacionId));
    const sin = L("asignaciones").filter(a => a.estado !== "Cerrada" && !conPlan.has(a.id));
    if (sin.length) out.push({ cat: "Planeaciones", txt: `${sin.length} asignaciones sin planeación registrada para el parcial ${pa}.`, link: `#/reportes?tipo=planeaciones`, lvl: "b" });
    const rev = L("planeaciones").filter(p => p.estadoAsociacion !== "Identificado" && p.estado !== "Sustituida");
    if (rev.length) out.push({ cat: "Planeaciones", txt: `${rev.length} planeaciones requieren revisión o no se han resuelto.`, link: "#/planeaciones?asoc=pend", lvl: "a" });
    const asr = L("asignaciones").filter(a => a.estado === "Requiere revisión");
    if (asr.length) out.push({ cat: "Gestión", txt: `${asr.length} asignaciones con discrepancias entre plantilla y horario.`, link: "#/estructura?tab=asignaciones&f=rev", lvl: "a" });
    const conf = conflictosHorario();
    if (conf.length) out.push({ cat: "Gestión", txt: `${conf.length} posibles conflictos de horario (una persona en dos grupos a la misma hora).`, link: "#/horarios?tab=conflictos", lvl: "r" });
    const vobo = L("observaciones").filter(o => o.estado === "Pendiente Vo.Bo.");
    if (vobo.length) out.push({ cat: "Observaciones", txt: `${vobo.length} observaciones esperan Vo.Bo.`, link: "#/observaciones?estado=Pendiente Vo.Bo.", lvl: "b" });
  }
  const obsMine = L("observaciones").filter(o => o.observadorId === me() || isStaff());
  obsMine.filter(o => o.estado === "Programada" && o.fecha && o.fecha < hoy).forEach(o =>
    out.push({ cat: "Observaciones", txt: `Observación programada el ${fdate(o.fecha)} (${alabel(o.asignacionId)}) sin registro.`, link: `#/obs/${o.id}`, lvl: "a" }));
  L("observaciones").filter(o => o.docenteId === me() && ["Registrada", "En diálogo"].includes(o.estado) && !o.autorreflexionCompleta).forEach(o =>
    out.push({ cat: "Observaciones", txt: `Tienes pendiente tu autorreflexión de la sesión del ${fdate(o.fecha)} (${alabel(o.asignacionId)}).`, link: `#/obs/${o.id}`, lvl: "m" }));
  L("acuerdos").filter(a => ["Pendiente", "En proceso"].includes(a.estado) && a.fechaCompromiso && a.fechaCompromiso < hoy && (isStaff() || a.responsableId === me() || a.docenteId === me()))
    .forEach(a => out.push({ cat: "Acuerdos", txt: `Acuerdo con fecha de compromiso ${fdate(a.fechaCompromiso)}: requiere seguimiento — “${short(a.accion, 60)}”.`, link: `#/acuerdos?id=${a.id}`, lvl: "a" }));
  return out;
}

export function conflictosHorario() {
  const occ = {};
  L("horarios").forEach(h => Object.entries(h.celdas || {}).forEach(([k, c]) => {
    if (!c.docenteId) return; const key = c.docenteId + "|" + k; (occ[key] = occ[key] || []).push({ grupo: h.grupo, c, k });
  }));
  return Object.entries(occ).filter(([, v]) => new Set(v.map(x => x.grupo)).size > 1)
    .map(([key, v]) => ({ docenteId: key.split("|")[0], k: v[0].k, grupos: v.map(x => x.grupo) }));
}

/* Horario de una persona: [{dia, b, grupo, celda}] */
export function horarioPersona(pid) {
  const out = [];
  L("horarios").forEach(h => Object.entries(h.celdas || {}).forEach(([k, c]) => { if (c.docenteId === pid) { const [d, b] = k.split("-").map(Number); out.push({ dia: d, b, grupo: h.grupo, c }); } }));
  return out;
}

export const ESTADOS_OBS = ["Programada", "En captura", "Registrada", "En diálogo", "Pendiente Vo.Bo.", "Con Vo.Bo."];
export const chipEstado = e => {
  const m = { "Programada": "b", "En captura": "a", "Registrada": "m", "En diálogo": "d", "Pendiente Vo.Bo.": "a", "Con Vo.Bo.": "g", "Cancelada": "",
    "Identificado": "g", "Requiere revisión": "a", "No resuelto": "r", "Cargada": "b", "Validada": "g", "Observada": "m", "Sustituida": "",
    "Pendiente": "a", "En proceso": "b", "Cumplido": "g", "Cancelado": "", "Realizada": "g", "Reprogramada": "a", "Vigente": "g",
    "Publicado": "g", "Borrador": "a", "Histórico": "", "En desarrollo": "b", "Concluido": "g", "Planeación": "a" };
  return chip(e || "—", m[e] || "");
};
