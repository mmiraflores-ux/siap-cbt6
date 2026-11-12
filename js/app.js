/* Arranque, autenticación, suscripciones en tiempo real, navegación y vistas generales */
import { createStore, COLS_CATALOGO, COLS_PROCESO } from "./store.js";
import {
  S, CFG, SEED, VIEWS, ACT, FORMS, esc, $, $$, toast, modal, closeModal, errMsg, L, reindex, P, pname, roles, me, isStaff, isOri,
  isAdmin, isDoc, isSub, isVinc, canObserve, puedeEliminarObs, ROLES, alertas, today, fdate, fdt, chip, chipEstado, alabel, parcialHoy, periodoActual,
  opt, save, audit, nowISO, newId, short, norm
} from "./core.js";
import "./views-academico.js";
import "./views-plan.js";
import "./views-obs.js";
import "./views-gestion.js";
import { panelStaff } from "./tablero.js";
import "./graficas.js";

const root = document.getElementById("root");
let unsubs = [], renderT = null, dirty = false, pendingRefresh = false;

/* ======================= ARRANQUE ======================= */
async function boot() {
  if (!window.APP_CONFIG) {
    root.innerHTML = `<div class="login"><div class="box"><div class="seal">CBT6</div><h1>El archivo config.js tiene un error</h1>
      <p class="muted">El navegador no pudo leer <code>js/config.js</code>. Suele pasar cuando se pegan también las líneas <code>import …</code> o <code>initializeApp(…)</code> que muestra Firebase, o cuando falta una coma o una llave.</p>
      <p class="note info">Usa la <a href="guia-instalacion.html#generador">guía → Generador de config.js</a> y reemplaza todo el archivo con lo que te genere.</p></div></div>`;
    return;
  }
  try {
    if (CFG.mode === "firebase") {
      const fc = resolverFirebaseConfig();
      if (!fc) return renderConfigError();
      CFG.firebaseConfig = fc;
    }
    S.store = await createStore(CFG, SEED);
    S.store.onAuth(onAuthChange);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="login"><div class="box"><h1>No se pudo iniciar</h1><p class="note err">${esc(errMsg(e))}</p>
      <p class="muted">Revisa tu conexión a internet y el archivo <code>js/config.js</code>.</p></div></div>`;
  }
}

/* Acepta los datos de Firebase aunque se hayan pegado en otro lugar del archivo:
   dentro de APP_CONFIG, anidados por error, o como "const firebaseConfig = {...}" suelto. */
function resolverFirebaseConfig() {
  const ok = o => o && typeof o === "object" && String(o.apiKey || "").trim() && String(o.projectId || "").trim();
  const cands = [CFG.firebaseConfig, CFG.firebaseConfig?.firebaseConfig, CFG.config, window.firebaseConfig];
  try { cands.push(firebaseConfig); } catch {}          // variable global suelta (const/let/var)
  return cands.find(ok) || null;
}
function renderConfigError() {
  const fc = CFG.firebaseConfig || {};
  const campos = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
  const filas = campos.map(k => `<tr><td><code>${k}</code></td><td>${String(fc[k] || "").trim() ? "✔ con dato" : "<b style='color:var(--rojo)'>✘ vacío</b>"}</td></tr>`).join("");
  root.innerHTML = `<div class="login"><div class="box" style="max-width:560px"><div class="seal">CBT6</div><h1>Falta configurar Firebase</h1>
  <p class="muted">El archivo <code>js/config.js</code> tiene <code>mode: "firebase"</code>, pero el sistema no encontró los datos de tu proyecto. Esto es lo que leyó:</p>
  <div class="tw"><table><tbody>${filas}</tbody></table></div>
  <p class="note info"><b>Solución rápida:</b> abre la <a href="guia-instalacion.html#generador">guía de instalación → Generador de config.js</a>, pega el bloque que te da Firebase y copia el archivo completo que te genera. Después reemplaza todo el contenido de <code>js/config.js</code> con él.</p>
  <p class="faint" style="font-size:.8rem">Causa más común: se pegó <code>const firebaseConfig = {…}</code> fuera de <code>window.APP_CONFIG</code>, o quedaron las comillas vacías <code>apiKey: ""</code>.</p></div></div>`;
}

async function onAuthChange(u) {
  unsubs.forEach(f => f && f()); unsubs = []; S.d = {}; S.ix = {}; S.user = null; S.ready = false;
  if (!u) return renderLogin();
  try {
    if (S.store.mode === "local") { S.user = u; }
    else { S.user = await resolveFirebaseUser(u); if (!S.user) return; }
    const p = P(S.user.personaId);
    startSubscriptions();
  } catch (e) { console.error(e); toast(errMsg(e), true); renderLogin(errMsg(e)); }
}

/* superAdminEmail acepta un correo, varios separados por coma, o una lista ["a@x.com","b@x.com"] */
export function adminEmails() {
  const v = CFG.superAdminEmail;
  return (Array.isArray(v) ? v : String(v || "").split(/[,;\s]+/)).map(x => String(x).trim().toLowerCase()).filter(Boolean);
}
async function resolveFirebaseUser(u) {
  const st = S.store, admins = adminEmails(), sup = admins.join(", "), esAdmin = admins.includes(u.email);
  let doc = await st.get("usuarios", u.uid).catch(() => null);
  if (!doc) {
    const inv = await st.get("invitaciones", u.email).catch(() => null);
    if (inv) { doc = { email: u.email, personaId: inv.personaId, roles: inv.roles, creado: nowISO() }; await st.set("usuarios", u.uid, doc, false); }
    else if (esAdmin) {
      doc = { email: u.email, personaId: "", roles: ["admin"], creado: nowISO() };
      try { await st.set("usuarios", u.uid, doc, false); }
      catch (e) {
        if (String(e.code).includes("permission-denied")) {
          root.innerHTML = `<div class="login"><div class="box"><div class="seal">CBT6</div><h1>Revisa las reglas de Firestore</h1>
          <p>Tu correo <b>${esc(u.email)}</b> sí es el administrador en <code>js/config.js</code>, pero las reglas de seguridad no lo reconocen.</p>
          <p class="note info">En Firebase → Firestore Database → <b>Reglas</b>, busca la línea <code>function isSuper()</code> y verifica que la lista incluya exactamente <code>'${esc(u.email)}'</code> (en minúsculas). Pulsa <b>Publicar</b>, espera 1 minuto y vuelve a entrar.</p>
          <button class="btn pri" id="lo">Cerrar sesión</button></div></div>`;
          $("#lo").onclick = () => st.logout(); return null;
        }
        throw e;
      }
    }
    else {
      // Filtro de entrada: se registra una solicitud que la Subdirección aprueba o rechaza
      let enviada = true;
      try { await st.set("solicitudes", u.email, { email: u.email, uid: u.uid, fecha: nowISO() }, true); } catch (e) { enviada = false; console.warn(e); }
      root.innerHTML = `<div class="login"><div class="box"><div class="seal">CBT6</div><h1>Solicitud de acceso enviada</h1>
      <p>Tu cuenta <b>${esc(u.email)}</b> está creada, pero todavía <b>no tiene autorización</b> para entrar.</p>
      <p class="note info">${enviada ? "La Subdirección ya recibió tu solicitud en <b>Administración → Usuarios y roles</b>. Cuando la apruebe, pulsa <b>Reintentar</b>." : "No se pudo registrar la solicitud automáticamente. Pide a la Subdirección que capture tu correo en <b>Administración → Usuarios y roles</b>."}</p>
      <details style="margin:10px 0"><summary class="muted" style="cursor:pointer;font-size:.85rem">¿Tú administras el sistema?</summary>
      <p style="font-size:.86rem">Solo entran sin autorización los correos de <code>superAdminEmail</code> en <code>js/config.js</code>:</p>
      <div class="tw"><table><tbody><tr><td>Correo con el que entraste</td><td><code>${esc(u.email)}</code></td></tr>
      <tr><td>Administración en config.js</td><td>${sup ? `<code>${esc(sup)}</code>` : `<b style="color:var(--rojo)">vacío</b>`}</td></tr></tbody></table></div></details>
      <div class="row"><button class="btn pri" id="re">Reintentar</button><button class="btn" id="lo">Cerrar sesión</button></div></div></div>`;
      $("#re").onclick = () => location.reload();
      $("#lo").onclick = () => st.logout(); return null;
    }
  }
  if (doc.activo === false && !esAdmin) {
    root.innerHTML = `<div class="login"><div class="box"><div class="seal">CBT6</div><h1>Acceso suspendido</h1>
      <p>La Subdirección suspendió el acceso de <b>${esc(u.email)}</b>. Tus registros se conservan.</p>
      <p class="note info">Si crees que es un error, comunícate con la Subdirección.</p><button class="btn pri" id="lo">Cerrar sesión</button></div></div>`;
    $("#lo").onclick = () => st.logout(); return null;
  }
  if (esAdmin && !doc.roles.includes("admin")) doc.roles = [...doc.roles, "admin"];
  if (esAdmin) { try { if (await st.seedIfEmpty()) toast("Catálogo inicial cargado en la nube."); } catch (e) { console.warn(e); S.ui.seedError = errMsg(e) + (e.code ? ` (${e.code})` : ""); } }
  return { uid: u.uid, email: u.email, personaId: doc.personaId, roles: doc.roles || [] };
}

/* ---------- suscripciones en tiempo real según rol ---------- */
function sub(col, filter) {
  const key = col + (filter ? ":" + filter.join("=") : "");
  S._parts = S._parts || {}; S._parts[col] = S._parts[col] || {};
  unsubs.push(S.store.subscribe(col, filter, docs => {
    S._parts[col][key] = docs;
    const m = {}; Object.values(S._parts[col]).forEach(arr => arr.forEach(d => m[d.id] = d));
    S.d[col] = Object.values(m); reindex(col); scheduleRender();
  }, (c, err) => { S.errores[c] = err.code; }));
}
function startSubscriptions() {
  S._parts = {};
  COLS_CATALOGO.forEach(c => sub(c));
  const pid = me(), staff = isStaff();
  const procesos = [...COLS_PROCESO];
  if (staff) { procesos.forEach(c => sub(c)); sub("auditoria"); }
  else {
    if (isOri()) { ["planeaciones", "sesiones", "concreciones"].forEach(c => sub(c)); ["observaciones", "autorreflexiones", "dialogos", "acuerdos", "seguimientos", "evidencias"].forEach(c => sub(c, ["observadorId", pid])); }
    if (isDoc() && pid) COLS_PROCESO.forEach(c => sub(c, ["docenteId", pid]));
    if (isDoc() && pid) sub("acuerdos", ["responsableId", pid]);
  }
  if (pid) sub("notificaciones", ["paraId", pid]);
  sub("paec_avances");
  if (isAdmin()) { sub("usuarios"); sub("invitaciones"); sub("solicitudes"); if (!staff) sub("auditoria"); }
  if (S.store.mode === "local") ["usuarios"].forEach(c => S.d[c] = S.d[c] || []);
  S.ready = true;
  // el catálogo de personas llega después (tiempo real); no fijar aquí un “no encontrada”
  if (S.user.personaId) S.user.nombre = P(S.user.personaId)?.nombre || S.user.nombre || "";
  if (!S._routeBound) { window.addEventListener("hashchange", onRoute); S._routeBound = true; }
  onRoute();
}

function scheduleRender() {
  clearTimeout(renderT);
  renderT = setTimeout(() => {
    if (S.user && S.user.personaId) S.user.nombre = P(S.user.personaId)?.nombre || S.user.nombre || "";
    if (dirty || $("#ov")) { pendingRefresh = true; const r = $("#refresh"); if (r) r.hidden = false; return; }
    render();
  }, 60);
}

/* ======================= NAVEGACIÓN ======================= */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "") || "panel";
  const [path, qs] = h.split("?"); const [view, id] = path.split("/");
  const q = Object.fromEntries(new URLSearchParams(qs || ""));
  return { view: VIEWS[view] ? view : "panel", id: id ? decodeURIComponent(id) : null, q };
}
function onRoute() { S.route = parseHash(); dirty = false; closeModal(); $(".app")?.classList.remove("open"); render(); window.scrollTo(0, 0); }
export function go(h) { location.hash = h; }
window.go = go;
export function setQ(k, v) {
  const q = { ...S.route.q }; if (v === "" || v == null) delete q[k]; else q[k] = v;
  const qs = new URLSearchParams(q).toString();
  history.replaceState(null, "", `#/${S.route.view}${S.route.id ? "/" + S.route.id : ""}${qs ? "?" + qs : ""}`);
  S.route.q = q; render();
}
/* quita un parámetro de la URL sin volver a dibujar (para acciones de un solo uso) */
export function dropQ(k) {
  const q = { ...S.route.q }; delete q[k]; S.route.q = q;
  const qs = new URLSearchParams(q).toString();
  history.replaceState(null, "", `#/${S.route.view}${S.route.id ? "/" + S.route.id : ""}${qs ? "?" + qs : ""}`);
}

const NAV = [
  { g: "Inicio" },
  { v: "panel", ico: "◧", t: "Panel", show: () => true },
  { v: "notificaciones", ico: "✉", t: "Notificaciones", show: () => !!me(), cnt: () => L("notificaciones").filter(n => !n.leida).length },
  { g: "Acompañamiento" },
  { v: "planeaciones", ico: "▤", t: "Planeaciones", show: () => isStaff() || isDoc() || isOri() },
  { v: "sesiones", ico: "◷", t: "Sesiones y concreción", show: () => isStaff() || isDoc() || isOri() },
  { v: "observaciones", ico: "◉", t: "Observaciones", show: () => canObserve() || isDoc() },
  { v: "acuerdos", ico: "✓", t: "Acuerdos y seguimiento", show: () => canObserve() || isDoc() },
  { v: "paec", ico: "⬡", t: "Proyectos PAEC", show: () => true },
  { g: "Gestión académica" },
  { v: "estructura", ico: "▦", t: "Estructura académica", show: () => true },
  { v: "horarios", ico: "▥", t: "Horarios", show: () => true },
  { v: "instrumentos", ico: "☰", t: "Instrumentos", show: () => canObserve() || isDoc() },
  { v: "reportes", ico: "▧", t: "Reportes", show: () => isStaff() || isSub() || roles().includes("directivo") },
  { g: "Sistema" },
  { v: "auditoria", ico: "⌘", t: "Auditoría", show: () => isStaff() || isAdmin() },
  { v: "admin", ico: "⚙", t: "Administración", show: () => isAdmin() || isStaff(), cnt: () => isAdmin() ? L("solicitudes").length : 0 },
  { v: "ayuda", ico: "?", t: "Ayuda e inconsistencias", show: () => true }
];

/* ======================= RENDER ======================= */
export function render() {
  if (!S.user) return renderLogin();
  pendingRefresh = false;
  const V = VIEWS[S.route.view] || VIEWS.panel;
  let body = "";
  try { body = V.render(S.route); } catch (e) { console.error(e); body = `<div class="note err">Error al mostrar esta sección: ${esc(e.message)}</div>`; }
  const items = NAV.filter(n => n.g || n.show());
  const navHtml = items.map((n, i) => n.g ? ((items[i + 1] && !items[i + 1].g) ? `<div class="grp">${n.g}</div>` : "") :
    `<a href="#/${n.v}" class="${S.route.view === n.v ? "on" : ""}"><span class="ico">${n.ico}</span>${n.t}${n.cnt && n.cnt() ? `<span class="cnt">${n.cnt()}</span>` : ""}</a>`).join("");
  const sync = S.store.mode === "firebase" ? `<span class="sync ${S.store.online ? "" : "off"}"><i></i>${S.store.online ? "En línea · tiempo real" : "Sin conexión · se sincroniza al volver"}</span>`
    : `<span class="sync off"><i></i>Modo local (este navegador)</span>`;
  const rl = roles().map(r => ROLES[r] || r).join(" · ");
  root.innerHTML = `<div class="app">
    <aside class="side"><div class="brand"><div class="seal">CBT6</div><div><b>SIAP</b><span>Sistema Integral de Acompañamiento Pedagógico</span></div></div>
      <nav class="nav">${navHtml}</nav>
      <div class="who"><b>${esc(P(S.user.personaId)?.nombre || (S.user.nombre && !S.user.nombre.startsWith("(") ? S.user.nombre : "") || S.user.email || "Usuario")}</b>${S.user.personaId && !P(S.user.personaId) && S.ready && L("personas").length ? `<small style="color:var(--amb,#a15c00)">Cuenta sin persona del catálogo; Subdirección puede vincularla en Administración → Accesos.</small>` : ""}<small>${esc(rl || "Sin rol asignado")}</small><br>
      <button class="btn sm" data-act="logout" style="margin-top:8px">Cerrar sesión</button> <button class="btn sm ghost" data-act="tema" title="Cambiar tema">◐</button></div></aside>
    <div class="main"><header class="top"><button class="burger" data-act="menu" aria-label="Menú">☰</button>
      <div class="ttl"><h1>${esc(V.title ? (typeof V.title === "function" ? V.title(S.route) : V.title) : "")}</h1><small class="muted">${esc(CFG.institucion.nombre)} · Ciclo ${esc(CFG.institucion.cicloActual)} · Periodo ${esc(CFG.institucion.periodoActual)} · Parcial ${parcialHoy()}</small></div>
      <button class="btn sm" id="refresh" hidden data-act="refrescar">↻ Datos nuevos</button>${sync}</header>
      <main class="content">${body}</main></div></div>`;
  V.after && V.after(S.route);
}

/* ======================= LOGIN ======================= */
function renderLogin(err) {
  const local = S.store?.mode !== "firebase";
  if (local) {
    const ps = SEED.personas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    const quick = [["p-georgina-garces-rodriguez", "Subdirectora"], ["p-marco-eric-miraflores-rama", "Apoyo a Subdirección"], ["p-sandivel-borja-jaimes", "Docente + apoyo"], ["p-evelin-carbajal-garcia", "Docente"], ["p-arlaet-mendez-gomora", "Orientadora"]];
    root.innerHTML = `<div class="login"><div class="box"><div class="seal">CBT6</div>
      <h1>SIAP · Modo de prueba</h1><p class="muted">Los datos se guardan solo en este navegador. Elige con qué persona entrar para probar los permisos de cada rol.</p>
      ${CFG.firebaseConfig?.apiKey ? `<p class="note err"><b>Ya pegaste los datos de Firebase, pero falta un cambio.</b> En <code>js/config.js</code> la línea dice <code>mode: "local"</code>; cámbiala a <code>mode: "firebase"</code>, guarda y recarga esta página.</p>`
        : `<p class="note info">¿Buscas la pantalla para <b>crear tu cuenta</b> (paso 7)? Aparece solo cuando <code>js/config.js</code> tiene <code>mode: "firebase"</code> y los datos de tu proyecto (paso 4).</p>`}
      ${err ? `<p class="note err">${esc(err)}</p>` : ""}
      <div class="f"><label>Entrar como</label><select id="lp">${ps.map(p => opt(p.id, `${p.nombre} — ${p.roles.map(r => ROLES[r] || r).join(", ") || "sin rol"}`)).join("")}</select></div>
      <div class="row"><button class="btn pri" data-act="loginLocal">Entrar</button><button class="btn" data-act="loginLocal" data-admin="1">Administrador técnico</button></div>
      <hr><p class="muted" style="font-size:.8rem">Accesos rápidos:</p><div class="row">${quick.map(([id, t]) => `<button class="btn sm" data-act="loginLocal" data-pid="${id}">${t}</button>`).join("")}</div>
      <p class="faint" style="font-size:.75rem;margin-top:16px">Para uso institucional con varios usuarios y datos en la nube en tiempo real, cambia a <code>mode: "firebase"</code> (ver guía de instalación).</p></div></div>`;
    return;
  }
  const tab = S.ui.loginTab || "in";
  root.innerHTML = `<div class="login"><div class="box"><div class="seal">CBT6</div><h1>SIAP</h1>
    <p class="muted">Sistema Integral de Acompañamiento Pedagógico · ${esc(CFG.institucion.nombre)}</p>
    <div class="tabs"><button class="${tab === "in" ? "on" : ""}" data-act="ltab" data-t="in">Iniciar sesión</button><button class="${tab === "up" ? "on" : ""}" data-act="ltab" data-t="up">Crear cuenta</button><button class="${tab === "rs" ? "on" : ""}" data-act="ltab" data-t="rs">Recuperar</button></div>
    ${err ? `<p class="note err">${esc(err)}</p>` : ""}
    <form id="lf"><div class="f"><label>Correo institucional o personal registrado</label><input type="email" name="email" required autocomplete="username"></div>
    ${tab !== "rs" ? `<div class="f"><label>Contraseña</label><input type="password" name="pass" required minlength="6" autocomplete="${tab === "up" ? "new-password" : "current-password"}"></div>` : ""}
    <button class="btn pri" type="submit" style="width:100%;justify-content:center">${tab === "in" ? "Entrar" : tab === "up" ? "Crear mi cuenta" : "Enviar enlace de recuperación"}</button></form>
    ${tab === "up" ? `<p class="faint" style="font-size:.78rem;margin-top:10px">Tu correo debe estar registrado por la Subdirección para que se te asignen tus funciones.</p>` : ""}</div></div>`;
  $("#lf").onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target); const em = String(f.get("email")).trim().toLowerCase(), pw = String(f.get("pass") || "");
    try {
      if (tab === "in") await S.store.login(em, pw);
      else if (tab === "up") await S.store.register(em, pw);
      else { await S.store.reset(em); toast("Te enviamos un correo para restablecer la contraseña."); }
    } catch (er) { renderLogin(errMsg(er)); }
  };
}

/* ======================= ACCIONES GENERALES ======================= */
Object.assign(ACT, {
  verPendGrupo: el => { S.ui.grupoSel = el.dataset.g || ""; render(); setTimeout(() => document.getElementById("pendientes")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30); },
  porCob: el => { S.ui.grupoSel = ""; setQ("por", el.dataset.v === "grupo" ? "" : el.dataset.v); },
  ltab: el => { S.ui.loginTab = el.dataset.t; renderLogin(); },
  async loginLocal(el) {
    const pid = el.dataset.pid || (el.dataset.admin ? "" : $("#lp").value);
    const db = S.store.exportAll(); const p = pid ? (db.personas || {})[pid] : null;
    const r = p ? [...(p.roles || [])] : ["admin"];
    if (!r.length) r.push("docente");
    await S.store.loginAs({ uid: "local-" + (pid || "admin"), email: p?.email || "admin@local", personaId: pid, roles: r, nombre: p?.nombre || "Administrador técnico" });
    S.store.onAuth(onAuthChange);
  },
  async logout() { await S.store.logout(); if (S.store.mode === "local") onAuthChange(null); },
  menu: () => $(".app").classList.toggle("open"),
  refrescar: () => { dirty = false; render(); },
  tema: () => { const r = document.documentElement; const cur = r.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); r.dataset.theme = cur === "dark" ? "light" : "dark"; try { localStorage.setItem("siap_tema", r.dataset.theme); } catch {} },
  async leerNotif(el) { await S.store.set("notificaciones", el.dataset.id, { leida: true }); if (el.dataset.link) go(el.dataset.link.replace(/^#/, "")); },
  async leerTodas() { for (const n of L("notificaciones").filter(n => !n.leida)) await S.store.set("notificaciones", n.id, { leida: true }); toast("Notificaciones marcadas como leídas."); }
});
try { const t = localStorage.getItem("siap_tema"); if (t) document.documentElement.dataset.theme = t; } catch {}

/* delegación global de eventos */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  e.preventDefault(); Promise.resolve(fn(el, e)).catch(er => { console.error(er); toast(errMsg(er), true); });
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.filter !== undefined) return setQ(el.dataset.filter, el.value);
  if (el.dataset.chg && ACT[el.dataset.chg]) Promise.resolve(ACT[el.dataset.chg](el, e)).catch(er => toast(errMsg(er), true));
});
document.addEventListener("input", e => { if (e.target.closest(".content form[data-form]")) dirty = true; });
document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault();
  const fn = FORMS[f.dataset.form]; if (!fn) return;
  const o = {}; [...f.elements].forEach(el => {
    if (!el.name) return;
    if (el.type === "checkbox") { if (el.name.endsWith("[]")) { const k = el.name.slice(0, -2); o[k] = o[k] || []; if (el.checked) o[k].push(el.value); } else o[el.name] = el.checked; }
    else if (el.type === "radio") { if (el.checked) o[el.name] = el.value; else if (!(el.name in o)) o[el.name] = ""; }
    else if (el.type !== "file") o[el.name] = el.value.trim();
  });
  const sub = e.submitter?.value || "";
  Promise.resolve(fn(o, f, sub)).then(() => { dirty = false; if (pendingRefresh) render(); }).catch(er => { console.error(er); toast(errMsg(er), true); });
});
window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
export const markClean = () => { dirty = false; };
window.SIAP = { S, render, go, setQ };

/* ======================= VISTA: PANEL ======================= */
VIEWS.panel = {
  title: "Panel de control",
  render() {
    const al = alertas();
    const alHtml = al.length ? `<div class="tw"><table><tbody>${al.slice(0, 12).map(a => `<tr><td style="width:120px">${chip(a.cat, a.lvl)}</td><td>${esc(a.txt)}</td><td class="num"><a class="btn sm" href="${a.link}">Atender</a></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Sin pendientes por ahora.</div>`;
    let html = "";
    if (isStaff()) html += panelStaff();
    if (isOri() && !isStaff()) html += panelOri();
    if (isDoc()) html += panelDocente();
    html = panelNube() + html;
    if (isAdmin() && !isStaff()) html += `<div class="card"><h2>Administración técnica</h2><p class="muted">Tu rol no incluye acceso al contenido pedagógico. Desde <a href="#/admin">Administración</a> gestionas usuarios, roles y respaldo técnico.</p></div>`;
    if (isVinc() && !isStaff()) html += `<div class="card"><h2>Vinculación</h2><p class="muted">Puedes colaborar en los <a href="#/paec">Proyectos Aula-Escuela-Comunidad</a>. La observación de clase para este rol estará disponible en una fase futura.</p></div>`;
    if (!html) html = `<div class="card"><p>Tu cuenta no tiene funciones asignadas todavía. Solicita a la Subdirección que configure tus roles.</p></div>`;
    return `${html}<div class="card"><div class="card-h"><h2>Pendientes y alertas preventivas</h2>${chip("Organizativas · no sancionan", "")}</div>${alHtml}</div>`;
  }
};

function panelOri() {
  const mine = L("observaciones").filter(o => o.observadorId === me());
  return `<div class="card"><div class="card-h"><h2>Mis observaciones como orientadora</h2><a class="btn pri" href="#/observaciones?nueva=1">Programar observación</a></div>
  ${mine.length ? listaObs(mine) : `<div class="empty">Aún no registras observaciones.</div>`}</div>`;
}
export function listaObs(arr) {
  return `<div class="tw"><table><thead><tr><th>Fecha</th><th>Asignación</th><th>Docente</th><th>Observa</th><th>Estado</th><th></th></tr></thead><tbody>
  ${arr.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).map(o => `<tr><td>${fdate(o.fecha)}</td><td>${esc(alabel(o.asignacionId))}</td><td>${esc(pname(o.docenteId))}</td><td>${esc(pname(o.observadorId))}</td><td>${chipEstado(o.estado)}</td><td class="num nowrap"><a class="btn sm" href="#/obs/${o.id}">Abrir</a>${puedeEliminarObs(o) ? ` <button class="btn sm warn" data-act="eliminarObs" data-id="${o.id}" title="Eliminar con motivo (queda registro)">Eliminar</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
}
function panelDocente() {
  const pid = me(); const mis = L("asignaciones").filter(a => a.docenteId === pid);
  const pa = parcialHoy();
  const rows = mis.map(a => {
    const st = [1, 2, 3].map(p => { const pl = L("planeaciones").filter(x => x.asignacionId === a.id && x.parcial == p && x.estado !== "Sustituida").sort((x, y) => (y.version || 1) - (x.version || 1))[0];
      return `<td>${pl ? `<a href="#/planeaciones?id=${pl.id}">${chipEstado(pl.estadoAsociacion === "Identificado" ? (pl.estado || "Cargada") : pl.estadoAsociacion)}</a>` : `<button class="btn sm" data-act="subirPlan" data-asg="${a.id}" data-parcial="${p}">Subir</button>`}</td>`; }).join("");
    return `<tr><td><b>${esc(alabel(a))}</b><span class="sub">${esc(short(afullName(a), 70))}</span></td><td class="num">${a.horasSemana || "—"}</td>${st}</tr>`;
  }).join("");
  const obs = L("observaciones").filter(o => o.docenteId === pid);
  const acs = L("acuerdos").filter(a => (a.docenteId === pid || a.responsableId === pid) && ["Pendiente", "En proceso"].includes(a.estado));
  return `<div class="card"><div class="card-h"><h2>Mis asignaciones y planeaciones</h2>${chip("Parcial actual: " + pa, "m")}</div>
    ${mis.length ? `<div class="tw"><table><thead><tr><th>Asignación</th><th class="num">Hrs/sem</th><th>Parcial 1</th><th>Parcial 2</th><th>Parcial 3</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">No tienes asignaciones académicas frente a grupo en este periodo.</div>`}</div>
    <div class="grid g2"><div class="card"><h3 style="margin-bottom:8px">Mis observaciones</h3>${obs.length ? listaObs(obs) : `<div class="empty">Sin observaciones registradas.</div>`}</div>
    <div class="card"><h3 style="margin-bottom:8px">Mis acuerdos abiertos</h3>${acs.length ? acs.map(a => `<div class="notif"><div class="dot"></div><div style="flex:1"><b>${esc(a.accion)}</b><br><small>Compromiso: ${fdate(a.fechaCompromiso)} · ${chipEstado(a.estado)}</small></div><a class="btn sm" href="#/acuerdos?id=${a.id}">Ver</a></div>`).join("") : `<div class="empty">Sin acuerdos abiertos.</div>`}</div></div>`;
}
const afullName = a => byUC(a.unidadId)?.nombre || a.nombreFuente;
const byUC = id => S.ix.unidades?.[id];

/* ======================= VISTA: NOTIFICACIONES ======================= */
VIEWS.notificaciones = {
  title: "Bandeja de notificaciones",
  render() {
    const ns = L("notificaciones").slice().sort((a, b) => b.ts.localeCompare(a.ts));
    const al = alertas();
    return `<div class="card"><div class="card-h"><h2>Avisos</h2><button class="btn sm" data-act="leerTodas">Marcar todo como leído</button></div>
      ${ns.length ? ns.map(n => `<div class="notif ${n.leida ? "read" : "unread"}"><div class="dot"></div><div style="flex:1"><b>${esc(n.texto)}</b><br><small>${fdt(n.ts)} · ${esc(n.tipo)} ${n.deId ? "· de " + esc(pname(n.deId)) : ""}</small></div>
      <button class="btn sm" data-act="leerNotif" data-id="${n.id}" data-link="${esc(n.link || "")}">${n.link ? "Abrir" : "Leído"}</button></div>`).join("") : `<div class="empty">No tienes avisos.</div>`}</div>
      <div class="card"><h2 style="margin-bottom:10px">Pendientes calculados</h2>${al.length ? al.map(a => `<div class="notif"><div class="dot"></div><div style="flex:1">${chip(a.cat, a.lvl)} ${esc(a.txt)}</div><a class="btn sm" href="${a.link}">Ir</a></div>`).join("") : `<div class="empty">Nada pendiente.</div>`}</div>`;
  }
};

/* ======================= VISTA: ADMINISTRACIÓN ======================= */
VIEWS.admin = {
  title: "Administración",
  render(r) {
    const tab = r.q.tab || (isAdmin() ? "usuarios" : "datos");
    const tabs = [["usuarios", "Usuarios y roles", isAdmin() || (S.store.mode === "local" && isStaff())], ["datos", "Respaldo de datos", true], ["conexion", "Conexión y reglas", true]].filter(t => t[2]);
    let body = "";
    if (tab === "usuarios") body = adminUsuarios();
    if (tab === "datos") body = adminDatos();
    if (tab === "conexion") body = adminConexion();
    return `<div class="tabs">${tabs.map(t => `<button class="${tab === t[0] ? "on" : ""}" onclick="SIAP.go('/admin?tab=${t[0]}')">${t[1]}</button>`).join("")}</div>${body}`;
  }
};
/* ---------- carga del catálogo y migración desde modo de prueba ---------- */
const CATALOGO = ["personas", "grupos", "unidades", "actividades", "modulos", "asignaciones", "horarios", "instrumentos", "calendario"];
const NOMBRES = { personas: "Personas", grupos: "Grupos", unidades: "Unidades curriculares", actividades: "Actividades operativas", modulos: "Módulos", asignaciones: "Asignaciones", horarios: "Horarios",
  instrumentos: "Instrumentos", calendario: "Calendario", paec: "Proyectos PAEC", paec_avances: "Avances PAEC", planeaciones: "Planeaciones", sesiones: "Sesiones", concreciones: "Concreciones",
  observaciones: "Observaciones", observacion_detalle: "Registros de observación", autorreflexiones: "Autorreflexiones", dialogos: "Diálogos", acuerdos: "Acuerdos", seguimientos: "Seguimientos", evidencias: "Evidencias", archivos: "Archivos" };
function datosPrueba() {
  try { const d = JSON.parse(localStorage.getItem("siap_db_v1") || "null"); if (!d) return null;
    const proc = ["planeaciones", "sesiones", "concreciones", "observaciones", "acuerdos", "seguimientos", "paec", "evidencias"];
    const n = proc.reduce((a, c) => a + Object.keys(d[c] || {}).length, 0); return { d, n }; } catch { return null; }
}
function resultadosHtml(res) {
  if (!res) return "";
  return `<div class="tw" style="margin-top:10px"><table><thead><tr><th>Colección</th><th class="num">Subidos</th><th>Resultado</th></tr></thead><tbody>${res.map(r => `<tr><td>${esc(NOMBRES[r.col] || r.col)}</td><td class="num">${r.ok}${r.total ? " / " + r.total : ""}</td><td>${r.err ? `<span style="color:var(--rojo)">${esc(r.err)}</span>` : chip("Correcto", "g")}</td></tr>`).join("")}</tbody></table></div>`;
}
function panelNube() {
  if (S.store.mode !== "firebase") return "";
  let h = "";
  if (!L("personas").length && (isAdmin() || isStaff())) {
    h += `<div class="card" style="border:2px solid var(--guinda)"><h2>La base de datos en la nube está vacía</h2>
      <p>Es una base nueva: todavía no tiene el catálogo del plantel. Carga los datos iniciales del ciclo 2026-2027 (36 personas, 6 grupos, 36 unidades curriculares, 72 asignaciones, horarios, calendario e instrumento).</p>
      ${S.ui.seedError ? `<p class="note err">El intento automático falló: ${esc(S.ui.seedError)}</p>` : ""}
      <button class="btn pri" data-act="cargarCatalogo">Cargar catálogo inicial</button>${resultadosHtml(S.ui.resCat)}</div>`;
  }
  const dp = datosPrueba();
  if (dp && dp.n > 0 && !S.ui.migrado) {
    h += `<div class="card"><h2>Datos del modo de prueba en este navegador</h2>
      <p>Este navegador conserva lo que capturaste en modo de prueba: <b>${dp.n}</b> registros de planeaciones, sesiones, observaciones, acuerdos y proyectos, además de tus cambios al catálogo. Esos datos <b>no se borraron</b>; simplemente no están en la nube.</p>
      ${isStaff() ? `<button class="btn pri" data-act="migrarPrueba">Subir mis datos de prueba a la nube</button>
        <p class="faint" style="font-size:.78rem">No borra nada de la nube ni del navegador. Si algún registro no se puede subir por permisos, se indica abajo.</p>`
      : `<p class="note info">Para subirlos, primero asígnate el rol <b>Docente de apoyo a Subdirección</b> en la tabla de abajo, cierra sesión y vuelve a entrar.</p>`}${resultadosHtml(S.ui.resMig)}</div>`;
  }
  return h;
}
async function subirColeccion(col, docs, porDocumento) {
  const r = { col, ok: 0, total: docs.length, err: "" };
  if (!docs.length) return r;
  if (!porDocumento) {
    try { await S.store.batch(docs.map(x => [col, x.id, x])); r.ok = docs.length; } catch (e) { r.err = errMsg(e); }
    return r;
  }
  const errs = new Set();
  for (const x of docs) { try { await S.store.set(col, x.id, x); r.ok++; } catch (e) { errs.add(errMsg(e)); } }
  if (errs.size) r.err = `${docs.length - r.ok} sin subir: ${[...errs].join(" · ")}`;
  return r;
}
Object.assign(ACT, {
  async cargarCatalogo(el) {
    el.disabled = true; el.textContent = "Cargando…";
    const res = [];
    for (const col of CATALOGO) res.push(await subirColeccion(col, (SEED[col] || []).map(x => JSON.parse(JSON.stringify(x))), false));
    S.ui.resCat = res; S.ui.seedError = "";
    const bad = res.filter(r => r.err);
    if (!bad.length) { await audit("carga de catálogo", "sistema", "seed", { colecciones: res.length }); toast("Catálogo inicial cargado en la nube."); }
    else toast(`${bad.length} colecciones no se pudieron cargar. Revisa la tabla.`, true);
    render();
  },
  async migrarPrueba(el) {
    const dp = datosPrueba(); if (!dp) return;
    el.disabled = true; el.textContent = "Subiendo…";
    const d = dp.d, res = [], vals = c => Object.values(d[c] || {});
    for (const col of [...CATALOGO, "paec", "paec_avances"]) res.push(await subirColeccion(col, vals(col), false));
    // archivos: metadatos y contenido guardado en IndexedDB
    const arch = vals("archivos"), ra = { col: "archivos", ok: 0, total: arch.length, err: "" };
    if (arch.length) {
      const db = await new Promise(r => { const q = indexedDB.open("siap_files", 1); q.onupgradeneeded = () => q.result.createObjectStore("files"); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
      const errs = new Set();
      for (const m of arch) {
        try {
          const rec = db && await new Promise(r => { const g = db.transaction("files").objectStore("files").get(m.id); g.onsuccess = () => r(g.result); g.onerror = () => r(null); });
          if (!rec) throw new Error("archivo no encontrado en el navegador");
          const { id, partes, ...meta } = m; await S.store.putFileId(m.id, meta, await rec.blob.arrayBuffer()); ra.ok++;
        } catch (e) { errs.add(errMsg(e)); }
      }
      if (errs.size) ra.err = `${arch.length - ra.ok} sin subir: ${[...errs].join(" · ")}`;
    }
    res.push(ra);
    for (const col of ["planeaciones", "sesiones", "concreciones", "evidencias"]) res.push(await subirColeccion(col, vals(col), true));
    // observaciones: primero abiertas para permitir el registro detallado, luego su estado real
    const obs = vals("observaciones");
    res.push(await subirColeccion("observaciones", obs.map(o => ({ ...o, detalleBloqueado: false })), true));
    for (const col of ["observacion_detalle", "autorreflexiones", "dialogos", "acuerdos", "seguimientos"]) res.push(await subirColeccion(col, vals(col), true));
    for (const o of obs) if (o.detalleBloqueado) { try { await S.store.set("observaciones", o.id, { detalleBloqueado: true }); } catch {} }
    await audit("migración desde modo de prueba", "sistema", "import", { resumen: res.map(r => `${r.col}:${r.ok}/${r.total}`).join(" ") });
    S.ui.resMig = res.filter(r => r.total);
    toast(res.some(r => r.err) ? "Migración terminada con avisos. Revisa la tabla." : "Datos de prueba subidos a la nube.", res.some(r => r.err));
    render();
  }
});
function panelAccesos() {
  if (S.store.mode !== "firebase" || !isAdmin()) return "";
  const sol = L("solicitudes").slice().sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  const cuentas = L("usuarios").slice().sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  const maestros = adminEmails();
  return `<div class="card" ${sol.length ? 'style="border:2px solid var(--guinda)"' : ""}><div class="card-h"><h2>Solicitudes de acceso · ${sol.length}</h2></div>
    <p class="muted">Personas que crearon su cuenta y esperan autorización. Nadie entra al sistema hasta que lo apruebes.</p>
    ${sol.length ? `<div class="tw"><table><thead><tr><th>Correo</th><th>Fecha</th><th></th></tr></thead><tbody>${sol.map(x => `<tr><td><b>${esc(x.email)}</b></td><td>${fdt(x.fecha)}</td>
      <td class="num"><button class="btn sm ok" data-act="aprobarSol" data-id="${esc(x.id)}">Aprobar</button> <button class="btn sm warn" data-act="rechazarSol" data-id="${esc(x.id)}">Rechazar</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No hay solicitudes pendientes.</div>`}</div>
  <div class="card"><div class="card-h"><h2>Cuentas con acceso · ${cuentas.length}</h2></div>
    <p class="muted">Aquí cambias los roles de una cuenta o suspendes su acceso. Las cuentas marcadas como “maestra” se definen en <code>js/config.js</code> y siempre entran.</p>
    <div class="tw"><table><thead><tr><th>Correo</th><th>Persona</th><th>Roles</th><th>Estado</th><th></th></tr></thead><tbody>
    ${cuentas.map(c => { const m = maestros.includes(c.email); return `<tr><td><b>${esc(c.email)}</b>${m ? " " + chip("Cuenta maestra", "r") : ""}</td><td>${c.personaId ? esc(pname(c.personaId)) : `<span style="color:var(--ambar)">Sin vincular</span>`}</td>
      <td>${(c.roles || []).map(r => chip(ROLES[r] || r, r === "admin" ? "r" : "m")).join(" ") || "—"}</td><td>${c.activo === false ? chip("Suspendida", "r") : chip("Activa", "g")}</td>
      <td class="num"><button class="btn sm" data-act="editCuenta" data-id="${c.id}">Editar</button>${c.id === S.user.uid || m ? "" : ` <button class="btn sm ${c.activo === false ? "" : "warn"}" data-act="suspCuenta" data-id="${c.id}">${c.activo === false ? "Reactivar" : "Suspender"}</button>`}</td></tr>`; }).join("") || `<tr><td colspan="5" class="empty">Sin cuentas.</td></tr>`}
    </tbody></table></div></div>`;
}
const personasOpts = sel => L("personas").slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => opt(p.id, p.nombre, sel)).join("");
const rolesChecks = cur => `<div class="checks">${Object.entries(ROLES).map(([k, v]) => `<label><input type="checkbox" name="roles[]" value="${k}" ${cur.includes(k) ? "checked" : ""}> ${v}</label>`).join("")}</div>`;
Object.assign(ACT, {
  aprobarSol(el) {
    const s = L("solicitudes").find(x => x.id === el.dataset.id); if (!s) return;
    const guess = L("personas").find(p => (p.email || "").toLowerCase() === s.email);
    const f = modal({ title: "Aprobar acceso · " + s.email, body: `
      <div class="f"><label>¿Quién es esta persona?</label><select name="personaId" id="ap" required><option value="">— Elige —</option>${personasOpts(guess?.id)}</select></div>
      <div class="f"><label>Roles</label><div id="ar">${rolesChecks(guess?.roles || [])}</div><span class="hint">Marca solo lo que necesita. “Administrador técnico” permite aprobar a otras personas.</span></div>`,
      submit: "Aprobar acceso",
      onSubmit: async o => {
        if (!o.personaId) { toast("Elige a la persona.", true); return false; }
        if (!o.roles?.length) { toast("Marca al menos un rol.", true); return false; }
        await save("personas", o.personaId, { email: s.email, roles: o.roles }, "roles");
        await S.store.set("invitaciones", s.email, { personaId: o.personaId, roles: o.roles, actualizado: nowISO(), aprobadoPor: S.user.email }, false);
        await S.store.del("solicitudes", s.id);
        await audit("aprobación de acceso", "usuarios", s.email, { personaId: o.personaId, roles: o.roles });
        toast(`Acceso aprobado. ${pname(o.personaId)} ya puede pulsar “Reintentar”.`);
      }
    });
    f.querySelector("#ap").addEventListener("change", e => { const p = P(e.target.value); f.querySelector("#ar").innerHTML = rolesChecks(p?.roles || []); });
  },
  rechazarSol(el) {
    modal({ title: "Rechazar solicitud", body: `<p>La persona <b>${esc(el.dataset.id)}</b> no podrá entrar. Si vuelve a intentarlo, aparecerá otra solicitud.</p>`, submit: "Rechazar",
      onSubmit: async () => { await S.store.del("solicitudes", el.dataset.id); await audit("rechazo de acceso", "usuarios", el.dataset.id, {}); toast("Solicitud rechazada."); } });
  },
  editCuenta(el) {
    const c = L("usuarios").find(x => x.id === el.dataset.id); if (!c) return;
    modal({ title: "Cuenta · " + c.email, body: `
      <div class="f"><label>Persona vinculada</label><select name="personaId"><option value="">— Sin vincular —</option>${personasOpts(c.personaId)}</select></div>
      <div class="f"><label>Roles</label>${rolesChecks(c.roles || [])}</div>
      ${adminEmails().includes(c.email) ? `<p class="note">Es una cuenta maestra: siempre conserva “Administrador técnico” mientras esté en <code>superAdminEmail</code>.</p>` : ""}`,
      onSubmit: async o => {
        await S.store.set("usuarios", c.id, { personaId: o.personaId, roles: o.roles || [] });
        if (o.personaId) await save("personas", o.personaId, { email: c.email, roles: o.roles || [] }, "roles");
        await S.store.set("invitaciones", c.email, { personaId: o.personaId, roles: o.roles || [], actualizado: nowISO() }, false);
        await audit("cambio de roles", "usuarios", c.email, { personaId: o.personaId, roles: o.roles });
        toast(c.id === S.user.uid ? "Cuenta actualizada. Cierra sesión y vuelve a entrar para ver tus nuevos permisos." : "Cuenta actualizada. Los cambios aplican en su próximo inicio de sesión.");
      } });
  },
  suspCuenta(el) {
    const c = L("usuarios").find(x => x.id === el.dataset.id); if (!c) return;
    const sus = c.activo !== false;
    modal({ title: (sus ? "Suspender " : "Reactivar ") + c.email, body: sus ? `<p>Ya no podrá entrar al sistema. Sus planeaciones, observaciones y demás registros se conservan.</p>` : `<p>Podrá volver a entrar con los roles que tenía.</p>`,
      submit: sus ? "Suspender acceso" : "Reactivar",
      onSubmit: async () => { await S.store.set("usuarios", c.id, { activo: !sus }); await audit(sus ? "suspensión de acceso" : "reactivación de acceso", "usuarios", c.email, {}); toast(sus ? "Acceso suspendido." : "Acceso reactivado."); } });
  }
});
function adminUsuarios() {
  const fb = S.store.mode === "firebase";
  const users = L("usuarios"), inv = Object.fromEntries(L("invitaciones").map(i => [i.id, i]));
  const q = norm(S.route.q.b || "");
  const ps = L("personas").filter(p => !q || norm(p.nombre).includes(q)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  return `${panelNube()}${panelAccesos()}<div class="card"><div class="card-h"><h2>Personas del plantel y sus correos</h2><input type="text" placeholder="Buscar persona…" value="${esc(S.route.q.b || "")}" data-filter="b" style="max-width:240px"></div>
  <p class="muted">${fb ? "También puedes autorizar por adelantado: captura el correo de una persona y sus roles; cuando cree su cuenta entrará directo. Una persona puede tener varios roles sin duplicar su identidad." : "En modo local los roles se guardan en la ficha de la persona y se aplican al entrar como ella."}</p>
  <div class="tw"><table><thead><tr><th>Persona</th><th>Correo</th><th>Roles en el sistema</th><th>Estado</th><th></th></tr></thead><tbody>
  ${!ps.length ? `<tr><td colspan="5" class="empty">${L("personas").length ? "Sin resultados para la búsqueda." : "Aún no hay personas: carga el catálogo inicial con el botón de arriba."}</td></tr>` : ""}
  ${ps.map(p => { const em = (p.email || "").toLowerCase(); const u = users.find(x => x.email === em && em); const iv = inv[em];
    const rs = (u?.roles || iv?.roles || p.roles || []);
    return `<tr><td><b>${esc(p.nombre)}</b><span class="sub">${esc((p.funciones || []).join(" · "))}</span></td><td>${esc(em || "—")}</td><td>${rs.map(r => chip(ROLES[r] || r, r === "admin" ? "r" : "m")).join(" ")}</td>
    <td>${fb ? (u ? chip("Cuenta activa", "g") : iv ? chip("Invitación lista", "b") : chip("Sin habilitar", "")) : chip("Local", "")}</td><td class="num"><button class="btn sm" data-act="editUsuario" data-id="${p.id}">Editar</button></td></tr>`; }).join("")}
  </tbody></table></div></div>`;
}
ACT.editUsuario = el => {
  const p = P(el.dataset.id); const fb = S.store.mode === "firebase"; const em = (p.email || "").toLowerCase();
  const u = L("usuarios").find(x => x.email === em && em); const iv = L("invitaciones").find(i => i.id === em);
  const cur = u?.roles || iv?.roles || p.roles || [];
  modal({ title: "Usuario · " + p.nombre, body: `
    <div class="f"><label>Correo con el que entrará</label><input type="email" name="email" value="${esc(p.email || "")}" ${fb ? "required" : ""}><span class="hint">Debe coincidir exactamente con la cuenta que cree.</span></div>
    <div class="f"><label>Roles</label><div class="checks">${Object.entries(ROLES).map(([k, v]) => `<label><input type="checkbox" name="roles[]" value="${k}" ${cur.includes(k) ? "checked" : ""}> ${v}</label>`).join("")}</div>
    <span class="hint">“Administrador técnico” no da acceso pedagógico. Vinculadora: observación deshabilitada en esta versión.</span></div>`,
    onSubmit: async o => {
      const email = (o.email || "").toLowerCase();
      await save("personas", p.id, { email, roles: o.roles }, "roles");
      if (fb && email) {
        await S.store.set("invitaciones", email, { personaId: p.id, roles: o.roles, actualizado: nowISO() }, false);
        const uu = L("usuarios").find(x => x.email === email); if (uu) await S.store.set("usuarios", uu.id, { roles: o.roles, personaId: p.id });
        await audit("roles", "usuarios", email, { roles: o.roles });
      }
      toast("Usuario actualizado.");
    }
  });
};
function adminDatos() {
  const local = S.store.mode === "local";
  return `${panelNube()}<div class="card"><h2>Respaldo</h2><p class="muted">Descarga una copia en formato JSON de la información que tu rol puede consultar. Se recomienda un respaldo semanal y al cierre de cada parcial.</p>
    <div class="row"><button class="btn pri" data-act="exportJSON">Descargar respaldo (.json)</button>${local ? `<label class="btn">Restaurar respaldo<input type="file" accept=".json" hidden data-chg="importJSON"></label><button class="btn warn" data-act="resetLocal">Reiniciar datos de prueba</button>` : ""}</div>
    ${!local && isStaff() ? `<hr><h3>Migrar datos de prueba a la nube</h3><p class="muted">Si capturaste información en modo local, restaura aquí ese respaldo para subirlo a Firestore (no borra lo existente).</p><label class="btn">Subir respaldo local a la nube<input type="file" accept=".json" hidden data-chg="importJSONcloud"></label>` : ""}</div>`;
}
function adminConexion() {
  const sup = adminEmails().join(", ") || "TU_CORREO@ejemplo.com";
  return `<div class="card"><h2>Conexión</h2>
  <p>Modo actual: <b>${S.store.mode === "firebase" ? "Firebase (nube, tiempo real)" : "Local (solo este navegador)"}</b></p>
  ${S.store.mode === "firebase" ? `<p>Proyecto: <code>${esc(CFG.firebaseConfig.projectId)}</code> · Administrador: <code>${esc(sup)}</code></p>` : `<p class="note info">Para trabajar en equipo y en tiempo real configura Firebase siguiendo la <a href="guia-instalacion.html" target="_blank">guía de instalación</a>.</p>`}
  ${Object.keys(S.errores).length ? `<p class="note err">Colecciones sin permiso de lectura para tu rol: ${Object.keys(S.errores).map(esc).join(", ")}. Es normal si tu rol no las requiere.</p>` : ""}
  <p class="muted">Las reglas de seguridad están en el archivo <code>firestore.rules</code> incluido en el paquete. Antes de publicarlas, reemplaza el correo del administrador.</p></div>`;
}
Object.assign(ACT, {
  exportJSON() {
    const data = S.store.mode === "local" ? S.store.exportAll() : Object.fromEntries(Object.entries(S.d).map(([k, v]) => [k, Object.fromEntries(v.map(x => [x.id, x]))]));
    const blob = new Blob([JSON.stringify({ exportado: nowISO(), modo: S.store.mode, data }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `SIAP_respaldo_${today()}.json`; a.click();
    audit("respaldo", "sistema", "export", {});
  },
  async importJSON(el) {
    const f = el.files[0]; if (!f) return; const j = JSON.parse(await f.text());
    if (!confirm("Esto reemplaza los datos locales actuales por el respaldo. ¿Continuar?")) return;
    S.store.importAll(j.data || j); toast("Respaldo restaurado.");
  },
  async importJSONcloud(el) {
    const f = el.files[0]; if (!f) return; const j = JSON.parse(await f.text()); const d = j.data || j; const ops = [];
    Object.entries(d).forEach(([col, m]) => { if (col.startsWith("_") || ["usuarios", "invitaciones"].includes(col)) return; Object.values(m || {}).forEach(x => ops.push([col, x.id, x])); });
    if (!confirm(`Se subirán ${ops.length} registros a la nube. ¿Continuar?`)) return;
    await S.store.batch(ops); await audit("importación", "sistema", "import", { registros: ops.length }); toast("Datos subidos.");
  },
  resetLocal() { if (confirm("¿Borrar todo lo capturado en este navegador y volver a los datos iniciales?")) { S.store.reset(); toast("Datos reiniciados."); } }
});

/* ======================= VISTA: AYUDA / INCONSISTENCIAS ======================= */
VIEWS.ayuda = {
  title: "Ayuda e inconsistencias detectadas",
  render() {
    const rev = L("personas").filter(p => p.revisar);
    const asg = L("asignaciones").filter(a => a.revision);
    const items = [
      ["Persona ausente en la lista de docentes", "César Augusto Milla Torres imparte Inglés I, III y V (10 asignaciones) en la plantilla y en los horarios, pero no aparece en LISTA DE DOCENTES 2026_2027.", "Se agregó como docente frente a grupo. Confirmar y actualizar la lista oficial."],
      ["Docente distinto entre plantilla y horario", "102 · Ciencias Sociales I (plantilla: Angélica Cervantes, V.R. 2 h) y 302 · Pensamiento Matemático III (plantilla: Imelda Vargas, V.R. 4 h). El horario de agosto muestra a Samanta Alejandra Jardón Fuentes.", "Se tomó el horario como vigente, se conservó el dato de la plantilla en el historial y las asignaciones quedan en “Requiere revisión” hasta que la Subdirección confirme."],
      ["Mismo nombre escrito de varias formas", "“Paulina Verdeja Montes de Oca” (plantilla) = “Eugenia Paulina Verdeja Montes de Oca” (lista); “Zurisaday García Quintana” (lista) = “Maetzin Zurisadai García Quintana” (horario).", "Se unificó cada caso en una sola persona; los alias quedan registrados para reconocer archivos y horarios."],
      ["Número de docentes de apoyo a Subdirección", "El documento integral v1.2 menciona tres; la especificación V1.0 y la lista de docentes muestran cuatro (Angélica Cervantes, Sandivel Borja, Marco Eric Miraflores y Emmanuel Toledano, este último de tiempo completo sin grupo).", "Se configuraron los cuatro con el rol “apoyo”; los roles son editables."],
      ["Orden del flujo", "La esquematización v0.1 pone Observación antes de Concreción; la especificación V1.0 pone Concreción antes; el documento v1.2 dice que son registros independientes.", "Se implementaron como registros independientes ligados a la misma sesión; la interfaz sugiere el orden de la especificación V1.0."],
      ["Escala del instrumento vs. “sin semáforos”", "El instrumento usa Pleno / En proceso / Requiere apoyo, y el documento v1.2 prohíbe semáforos de desempeño individual.", "La escala se registra por criterio con su nota cualitativa; el sistema nunca calcula un puntaje global, promedio ni ranking."],
      ["Fechas de parciales", "Ningún archivo contiene las fechas de los tres parciales.", "Se cargaron fechas PROVISIONALES (24 ago–2 oct, 5 oct–20 nov, 23 nov–22 ene). La Subdirectora debe autorizar las reales en Estructura → Calendario."],
      ["Nomenclatura de archivos", "El PDF de número de materia usa N.P_ABREV_NOMBRE_GRUPO (ej. 9_SUB III DSCE_SANDIVEL_501); la esquematización usa DSCE_SANDIVEL_502 (sin número).", "El lector acepta ambos formatos; la nomenclatura es una ayuda y toda asociación se valida contra la asignación académica."],
      ["Actividades del horario que no están en la plantilla", "Taller de Matemáticas, Taller de Informática, Taller de Metodología, Tutoría grupal y Orientación aparecen en los horarios pero no en la plantilla.", "Se clasificaron como actividades operativas (no requieren planeación ni se monitorean como UAC)."],
      ["Orientación del grupo 101", "El horario no indica qué orientadora atiende el lunes 13:10.", "La celda quedó sin persona asignada; complétala en Horarios."],
      ["Celdas de horario ambiguas", "En las hojas por grupo hay celdas vacías que no indican si la clase dura una o dos horas (p. ej. 301 jueves y 302 miércoles).", "Se cotejaron las horas con el total semanal de cada materia y con las hojas individuales de cada docente; los 6 grupos cuadran a 40 h sin choques. Conviene una revisión visual en Horarios."],
      ["Almacenamiento de archivos gratis", "Firebase Storage ya no se puede activar en el plan gratuito sin tarjeta.", "Los Word/PDF se guardan dentro de Firestore en partes de ~900 KB (máx. 5 MB por archivo, configurable), o como enlace a Drive/Classroom."],
      ["Taxonomía de Bloom y PAEC", "Están en la descripción del proyecto, pero no en los documentos de requisitos.", "Se agregaron: análisis de verbos de Bloom en la planeación y en la observación (descriptivo, sin calificar) y un módulo de Proyectos Aula-Escuela-Comunidad con matriz de articulación horizontal y vertical."]
    ];
    return `<div class="card"><h2>Cómo está organizado el sistema</h2>
      <div class="flow"><span class="done">Planeación</span><span class="done">Sesión</span><span class="done">Concreción áulica</span><span class="now">Observación</span><span>Autorreflexión</span><span>Diálogo reflexivo</span><span>Acuerdos</span><span>Seguimiento</span><span>Vo.Bo.</span></div>
      <p class="muted">El sistema documenta y acompaña la práctica docente. No asigna calificaciones, rankings ni sanciones automáticas. El docente completa su autorreflexión antes de ver la valoración de quien observa.</p></div>
    <div class="card"><h2 style="margin-bottom:10px">Inconsistencias encontradas en los archivos y cómo se resolvieron</h2>
      <div class="tw"><table><thead><tr><th>Tema</th><th>Lo que se encontró</th><th>Decisión aplicada</th></tr></thead><tbody>${items.map(i => `<tr><td><b>${esc(i[0])}</b></td><td>${esc(i[1])}</td><td>${esc(i[2])}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="grid g2"><div class="card"><h3 style="margin-bottom:8px">Personas por confirmar</h3>${rev.map(p => `<p><b>${esc(p.nombre)}</b><br><small>${esc(p.revisar)}</small></p>`).join("") || `<div class="empty">Ninguna</div>`}</div>
    <div class="card"><h3 style="margin-bottom:8px">Asignaciones con nota de revisión</h3>${asg.map(a => `<p><b>${esc(alabel(a))}</b> · ${esc(pname(a.docenteId))}<br><small>${esc(a.revision)}</small></p>`).join("") || `<div class="empty">Ninguna</div>`}</div></div>`;
  }
};

boot();
