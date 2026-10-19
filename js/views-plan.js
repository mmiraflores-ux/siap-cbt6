/* Planeaciones (carga individual y masiva), sesiones, concreción áulica y evidencias */
import {
  S, CFG, VIEWS, ACT, esc, $, $$, L, P, pname, UC, A, alabel, afull, opt, chip, chipEstado, modal, closeModal, save, toast, isStaff, isDoc,
  isOri, canObserve, me, norm, today, nowISO, fdate, fdt, parcialHoy, parcialDe, short, newId, audit, notify, BLOQUES, DIAS, byId
} from "./core.js";
import { setQ, dropQ } from "./app.js";

const BL = () => window.BLOOM;

/* ---------------- utilidades de archivo ---------------- */
let mammothP = null;
const loadScript = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar " + src)); document.head.appendChild(s); });
async function extraerTexto(file, buf) {
  const n = file.name.toLowerCase();
  if (n.endsWith(".docx")) {
    try { mammothP = mammothP || loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"); await mammothP;
      const r = await window.mammoth.extractRawText({ arrayBuffer: buf.slice(0) }); return r.value || ""; } catch (e) { console.warn(e); return ""; }
  }
  return "";
}
/* Solo se muestra lo que realmente aparece en el documento (detección por encabezados) */
function extraerSecciones(txt) {
  const out = {}; if (!txt) return out;
  const lines = txt.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const keys = { progresion: /progresi[oó]n/i, proposito: /prop[oó]sito|meta de aprendizaje|aprendizaje (esperado|de trayectoria)/i, contenidos: /contenido|tema|categor[ií]a/i, estrategias: /estrategia|actividades? (de|did)/i, instrumentos: /instrumento|r[uú]brica|lista de cotejo|evaluaci[oó]n/i };
  Object.entries(keys).forEach(([k, re]) => {
    const i = lines.findIndex(l => re.test(l) && l.length < 120);
    if (i >= 0) { const seg = lines.slice(i + 1, i + 4).join(" "); if (seg.length > 10) out[k] = short(seg, 420); }
  });
  return out;
}
export async function guardarArchivo(file, meta) {
  const max = (CFG.maxArchivoMB || 5) * 1024 * 1024;
  if (file.size > max) throw new Error(`“${file.name}” pesa ${(file.size / 1048576).toFixed(1)} MB; el máximo es ${CFG.maxArchivoMB} MB. Guarda un enlace de Drive/Classroom en su lugar.`);
  const buf = await file.arrayBuffer();
  const id = await S.store.putFile({ nombre: file.name, tipo: file.type || "application/octet-stream", tamano: file.size, subidoPor: me() || "", fecha: nowISO(), ...meta }, buf);
  return { id, buf };
}
ACT.descargar = async el => {
  toast("Preparando archivo…");
  const blob = await S.store.getFile(el.dataset.file); if (!blob) return toast("No se encontró el archivo.", true);
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = el.dataset.name || "archivo"; a.click();
};

/* -------- interpretar nomenclatura: N.P_ABREV_NOMBRE_GRUPO o ABREV_NOMBRE_GRUPO -------- */
export function interpretarNombre(fname) {
  const base = fname.replace(/\.[^.]+$/, "").replace(/\s+/g, " ").trim();
  const t = base.split(/_+/).map(x => x.trim()).filter(Boolean);
  const r = { base, np: null, abrev: "", nombre: "", grupo: null, notas: [] };
  if (t.length && /^\d{3}$/.test(t[t.length - 1])) r.grupo = t.pop(); else { const m = base.match(/(\d{3})(?!.*\d{3})/); if (m) { r.grupo = m[1]; r.notas.push("Grupo detectado dentro del nombre"); } }
  if (t.length && /^\d{1,2}$/.test(t[0])) r.np = +t.shift();
  if (t.length >= 2) { r.nombre = t.pop(); r.abrev = t.join(" "); } else if (t.length === 1) r.abrev = t[0];
  return r;
}
export function resolverAsignacion(it, parcial) {
  const out = { asignacionId: "", estado: "No resuelto", motivos: [] };
  const g = L("grupos").find(x => x.id === it.grupo);
  if (!g) { out.motivos.push(it.grupo ? `Grupo ${it.grupo} no existe en el catálogo` : "No se encontró el grupo en el nombre"); return out; }
  const uds = L("unidades").filter(u => u.semestre === g.semestre);
  const ab = norm(it.abrev).replace(/[.\s]/g, "");
  const byAb = ab ? uds.filter(u => { const ua = norm(u.abrev).replace(/[.\s]/g, ""); return ua === ab || ua.endsWith(ab) || (ab.length >= 2 && ua.startsWith(ab)) || (u.aliasHorario || []).some(a => norm(a).replace(/[.\s]/g, "") === ab); }) : [];
  const byNp = it.np ? uds.filter(u => u.np === it.np) : [];
  let u = null;
  if (byNp.length && byAb.length) { u = byNp.find(x => byAb.includes(x)); if (!u) { out.motivos.push(`El N.P. ${it.np} (${byNp[0].abrev}) no coincide con la abreviatura “${it.abrev}”`); u = byAb.length === 1 ? byAb[0] : byNp[0]; out.conflicto = true; } }
  else if (byAb.length === 1) u = byAb[0];
  else if (byAb.length > 1) { u = byAb.find(x => L("asignaciones").some(a => a.grupo === g.id && a.unidadId === x.id)); out.motivos.push("Abreviatura ambigua"); out.conflicto = true; }
  else if (byNp.length) { u = byNp[0]; if (it.abrev) out.motivos.push(`Abreviatura “${it.abrev}” no reconocida; se usó el N.P.`); }
  if (!u) { out.motivos.push("No se identificó la unidad curricular"); return out; }
  const a = L("asignaciones").find(x => x.grupo === g.id && x.unidadId === u.id && x.estado !== "Cerrada");
  if (!a) { out.motivos.push(`No hay asignación de ${u.abrev} en ${g.id}`); return out; }
  out.asignacionId = a.id;
  const p = P(a.docenteId); const nm = norm(it.nombre);
  const nameOk = nm && p && ((p.alias || []).includes(nm) || norm(p.nombre).split(" ").includes(nm) || norm(p.nombre).replace(/\s/g, "").includes(nm.replace(/\s/g, "")));
  if (!nm) out.motivos.push("El nombre del archivo no incluye docente");
  else if (!nameOk) out.motivos.push(`“${it.nombre}” no corresponde a ${p?.nombre || "la persona asignada"}`);
  out.estado = nameOk && !out.conflicto ? "Identificado" : "Requiere revisión";
  const prev = L("planeaciones").filter(x => x.asignacionId === a.id && x.parcial == parcial && x.estado !== "Sustituida");
  if (prev.length) out.motivos.push(`Ya existe planeación (v${Math.max(...prev.map(x => x.version || 1))}); se guardará como nueva versión`);
  return out;
}

async function registrarPlaneacion({ asignacionId, parcial, file, enlace, estadoAsociacion, interpretacion, motivos }) {
  const a = A(asignacionId);
  let archivoId = "", texto = "", nombre = file?.name || "";
  if (file) { const r = await guardarArchivo(file, { docenteId: a?.docenteId || "" }); archivoId = r.id; texto = await extraerTexto(file, r.buf); }
  const bloom = texto ? BL().analizar(texto) : null;
  const prev = a ? L("planeaciones").filter(x => x.asignacionId === a.id && x.parcial == parcial && x.estado !== "Sustituida") : [];
  const version = prev.length ? Math.max(...prev.map(x => x.version || 1)) + 1 : 1;
  for (const p of prev) await save("planeaciones", p.id, { estado: "Sustituida", sustituidaPor: version }, "nueva versión");
  const id = newId("pl-");
  await save("planeaciones", id, {
    ciclo: CFG.institucion.cicloActual, periodo: CFG.institucion.periodoActual, parcial: +parcial,
    asignacionId: a?.id || "", docenteId: a?.docenteId || "", grupo: a?.grupo || interpretacion?.grupo || "", unidadId: a?.unidadId || "",
    archivoNombre: nombre, archivoId, enlace: enlace || "", estadoAsociacion, estado: "Cargada", version,
    interpretacion: interpretacion || null, motivos: motivos || [], texto: texto.slice(0, 40000), extraido: extraerSecciones(texto),
    bloom: bloom ? { conteo: bloom.conteo, verbos: bloom.verbos, predominante: bloom.predominante, maxNivel: bloom.maxNivel, total: bloom.total } : null,
    cargadoPor: me() || S.user.uid, fechaCarga: nowISO(), validadoPor: estadoAsociacion === "Identificado" ? me() : ""
  }, "carga de planeación");
  if (a && a.docenteId !== me()) notify(a.docenteId, "Planeación", `Se registró tu planeación de ${alabel(a)} · parcial ${parcial} (v${version}).`, "#/planeaciones?id=" + id, id);
  return id;
}

/* ======================= VISTA PLANEACIONES ======================= */
VIEWS.planeaciones = {
  title: "Planeaciones didácticas",
  render(r) {
    const q = r.q; let arr = L("planeaciones").filter(p => q.vers ? true : p.estado !== "Sustituida");
    if (!isStaff() && !isOri()) arr = arr.filter(p => p.docenteId === me());
    if (q.parcial) arr = arr.filter(p => p.parcial == q.parcial);
    if (q.grupo) arr = arr.filter(p => p.grupo === q.grupo);
    if (q.doc) arr = arr.filter(p => p.docenteId === q.doc);
    if (q.asoc === "pend") arr = arr.filter(p => p.estadoAsociacion !== "Identificado");
    arr.sort((a, b) => (b.fechaCarga || "").localeCompare(a.fechaCarga || ""));
    setTimeout(() => {
      if (q.carga && isStaff() && !$("#ov")) { dropQ("carga"); ACT.cargaMasiva(); }
      if (q.id && !$("#ov")) { const id = q.id; dropQ("id"); ACT.verPlan({ dataset: { id } }); }
    }, 0);
    const docs = [...new Set(L("planeaciones").map(p => p.docenteId).filter(Boolean))].map(P).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const BN = BL().NIVELES;
    return `<div class="card"><div class="card-h"><h2>Planeaciones · ${arr.length}</h2>
      ${isStaff() ? `<button class="btn pri" data-act="cargaMasiva">⇪ Carga masiva</button>` : ""}${isDoc() ? `<button class="btn" data-act="subirPlan">+ Subir mi planeación</button>` : ""}</div>
      <p class="muted">Se conserva el archivo original y cada nueva carga crea una versión. El nombre del archivo es solo una ayuda: la asociación se valida contra la asignación académica.</p>
      <div class="filters"><select data-filter="parcial"><option value="">Todos los parciales</option>${[1, 2, 3].map(n => opt(n, "Parcial " + n, q.parcial)).join("")}</select>
      <select data-filter="grupo"><option value="">Todos los grupos</option>${L("grupos").map(g => g.id).sort().map(g => opt(g, "Grupo " + g, q.grupo)).join("")}</select>
      ${isStaff() || isOri() ? `<select data-filter="doc"><option value="">Todas las personas</option>${docs.map(p => opt(p.id, p.nombre, q.doc)).join("")}</select>` : ""}
      <select data-filter="asoc"><option value="">Toda asociación</option>${opt("pend", "Por revisar / no resueltas", q.asoc)}</select>
      <label class="checks"><label><input type="checkbox" ${q.vers ? "checked" : ""} onchange="SIAP_setQ('vers', this.checked?'1':'')"> Ver versiones anteriores</label></label></div>
      <div class="tw"><table><thead><tr><th>Asignación</th><th>Docente</th><th class="num">Parcial</th><th class="num">Ver.</th><th>Archivo</th><th>Asociación</th><th>Bloom predominante</th><th></th></tr></thead><tbody>
      ${arr.map(p => `<tr><td><b>${esc(p.asignacionId ? alabel(p.asignacionId) : (p.interpretacion?.base || "Sin asociar"))}</b><span class="sub">${esc(short(p.asignacionId ? afull(p.asignacionId) : (p.motivos || []).join("; "), 70))}</span></td>
      <td>${esc(pname(p.docenteId))}</td><td class="num">${p.parcial}</td><td class="num">${p.version || 1}${p.estado === "Sustituida" ? " " + chip("anterior") : ""}</td>
      <td>${p.archivoId ? `<button class="btn sm ghost" data-act="descargar" data-file="${p.archivoId}" data-name="${esc(p.archivoNombre)}">⬇ ${esc(short(p.archivoNombre, 28))}</button>` : p.enlace ? `<a href="${esc(p.enlace)}" target="_blank" rel="noopener">Enlace ↗</a>` : "—"}</td>
      <td>${chipEstado(p.estadoAsociacion)}</td><td>${p.bloom?.predominante ? chip(BN[p.bloom.predominante - 1].nombre, "m") : `<span class="faint">—</span>`}</td>
      <td class="num"><button class="btn sm" data-act="verPlan" data-id="${p.id}">Ver</button></td></tr>`).join("") || `<tr><td colspan="8" class="empty">No hay planeaciones con estos filtros.</td></tr>`}
      </tbody></table></div></div>`;
  }
};
window.SIAP_setQ = (k, v) => setQ(k, v);

/* -------- carga individual (docente o apoyo) -------- */
ACT.subirPlan = el => {
  const mine = isStaff() ? L("asignaciones") : L("asignaciones").filter(a => a.docenteId === me());
  modal({ title: "Registrar planeación", body: `
    <div class="f"><label>Asignación</label><select name="asignacionId" required>${mine.sort((a, b) => a.grupo.localeCompare(b.grupo)).map(a => opt(a.id, `${alabel(a)} — ${short(afull(a), 60)}${isStaff() ? " · " + pname(a.docenteId) : ""}`, el.dataset?.asg)).join("")}</select></div>
    <div class="f"><label>Parcial</label><select name="parcial">${[1, 2, 3].map(n => opt(n, "Parcial " + n, el.dataset?.parcial || parcialHoy())).join("")}</select><span class="hint">El parcial se elige aquí; no se deduce del nombre del archivo.</span></div>
    <div class="f"><label>Archivo (Word, Excel o PDF · máx. ${CFG.maxArchivoMB} MB)</label><input type="file" name="file" id="pf" accept=".doc,.docx,.xls,.xlsx,.pdf"></div>
    <div class="f"><label>…o enlace (Drive / Classroom)</label><input type="url" name="enlace" placeholder="https://"></div>`,
    onSubmit: async (o, f) => {
      const file = $("#pf", f).files[0];
      if (!file && !o.enlace) { toast("Adjunta el archivo o pega un enlace.", true); return false; }
      const id = await registrarPlaneacion({ asignacionId: o.asignacionId, parcial: o.parcial, file, enlace: o.enlace, estadoAsociacion: "Identificado", interpretacion: file ? interpretarNombre(file.name) : null, motivos: ["Asociación seleccionada manualmente al cargar"] });
      toast("Planeación registrada."); setTimeout(() => ACT.verPlan({ dataset: { id } }), 300);
    }
  });
};

/* -------- carga masiva -------- */
ACT.cargaMasiva = () => {
  S.ui.carga = [];
  modal({ title: "Carga masiva de planeaciones", wide: true, submit: "Confirmar y guardar", body: `
    <div class="grid g2"><div class="f"><label>Parcial de esta carga</label><select name="parcial" id="cp">${[1, 2, 3].map(n => opt(n, "Parcial " + n, parcialHoy())).join("")}</select><span class="hint">Se aplica a todos los archivos; puedes cambiarlo por fila.</span></div>
    <div class="f"><label>Archivos (puedes seleccionar ~72 a la vez)</label><input type="file" id="cf" multiple accept=".doc,.docx,.xls,.xlsx,.pdf"></div></div>
    <p class="hint">Formato esperado: <code>N.P_ABREVIATURA_NOMBRE_GRUPO</code> — ej. <code>9_SUB III DSCE_SANDIVEL_501.docx</code> o <code>7_CS_SAMANTHA_102.docx</code>.</p>
    <div id="cres"></div>
    <label class="checks"><label><input type="checkbox" name="noRes" checked> Guardar también los “No resuelto” en la bandeja de revisión</label></label>`,
    onSubmit: async o => {
      const rows = S.ui.carga; if (!rows.length) { toast("Selecciona archivos.", true); return false; }
      let ok = 0, err = 0;
      for (const [i, r] of rows.entries()) {
        const sel = $(`#ca${i}`)?.value || ""; const parc = $(`#cpr${i}`)?.value || o.parcial; const conf = $(`#cc${i}`)?.checked;
        let est = r.res.estado;
        if (sel && sel !== r.res.asignacionId) est = conf ? "Identificado" : "Requiere revisión";
        else if (sel && conf) est = "Identificado";
        if (!sel) est = "No resuelto";
        if (est === "No resuelto" && !o.noRes) continue;
        try { await registrarPlaneacion({ asignacionId: sel, parcial: parc, file: r.file, estadoAsociacion: est, interpretacion: r.it, motivos: r.res.motivos }); ok++; }
        catch (e) { err++; toast(e.message, true); }
        const st = $("#cstat"); if (st) st.textContent = `Guardando ${i + 1} de ${rows.length}…`;
      }
      await audit("carga masiva", "planeaciones", "lote", { archivos: rows.length, guardados: ok, errores: err, parcial: o.parcial });
      toast(`${ok} planeaciones guardadas${err ? `, ${err} con error` : ""}.`);
    }
  });
  const pintar = () => {
    const parcial = $("#cp").value, rows = S.ui.carga;
    rows.forEach(r => r.res = resolverAsignacion(r.it, parcial));
    const cnt = e => rows.filter(r => r.res.estado === e).length;
    $("#cres").innerHTML = rows.length ? `<div class="row" style="margin:8px 0">${chip(cnt("Identificado") + " identificados", "g")}${chip(cnt("Requiere revisión") + " requieren revisión", "a")}${chip(cnt("No resuelto") + " no resueltos", "r")}<span class="sp"></span><small id="cstat" class="muted"></small></div>
    <div class="tw" style="max-height:46vh"><table><thead><tr><th>Archivo</th><th>Interpretación</th><th>Asignación</th><th>Parcial</th><th>Estado</th><th>Confirmo</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td><b>${esc(short(r.file.name, 40))}</b><span class="sub">${(r.file.size / 1024).toFixed(0)} KB</span></td>
      <td><small>N.P. ${r.it.np ?? "—"} · ${esc(r.it.abrev || "—")} · ${esc(r.it.nombre || "—")} · ${esc(r.it.grupo || "—")}</small></td>
      <td><select id="ca${i}" style="min-width:200px"><option value="">— Sin asociar —</option>${L("asignaciones").filter(a => !r.it.grupo || a.grupo === r.it.grupo || a.id === r.res.asignacionId).sort((a, b) => a.grupo.localeCompare(b.grupo)).map(a => opt(a.id, `${alabel(a)} · ${pname(a.docenteId).split(" ")[0]}`, r.res.asignacionId)).join("")}</select>
      ${r.res.motivos.length ? `<span class="sub" style="color:var(--ambar)">${esc(r.res.motivos.join(" · "))}</span>` : ""}</td>
      <td><select id="cpr${i}" style="width:auto">${[1, 2, 3].map(n => opt(n, "P" + n, parcial)).join("")}</select></td>
      <td>${chipEstado(r.res.estado)}</td><td><input type="checkbox" id="cc${i}" ${r.res.estado === "Identificado" ? "checked" : ""} title="Confirmo la asociación"></td></tr>`).join("")}</tbody></table></div>
    <p class="hint">Las filas “Requiere revisión” solo se guardan como válidas si marcas “Confirmo”. Queda registro de quién cargó y confirmó.</p>` : "";
  };
  $("#cf").addEventListener("change", e => { S.ui.carga = [...e.target.files].map(file => ({ file, it: interpretarNombre(file.name) })); pintar(); });
  $("#cp").addEventListener("change", pintar);
};

/* -------- detalle de planeación -------- */
ACT.verPlan = el => {
  const p = byId("planeaciones", el.dataset.id); if (!p) return;
  const a = A(p.asignacionId), BN = BL().NIVELES, b = p.bloom;
  const own = p.docenteId === me(), edit = isStaff() || own;
  const vers = L("planeaciones").filter(x => x.asignacionId && x.asignacionId === p.asignacionId && x.parcial == p.parcial).sort((x, y) => (y.version || 1) - (x.version || 1));
  const ex = p.extraido || {};
  const campo = (k, t) => `<div class="f"><label>${t} ${ex[k] && !p[k] ? chip("detectado en el documento · verificar", "d") : ""}</label><textarea name="${k}" ${edit ? "" : "readonly"} placeholder="Sin dato identificado en el documento">${esc(p[k] || ex[k] || "")}</textarea></div>`;
  const tot = b?.total || 0;
  modal({ title: `Planeación · ${a ? alabel(a) : "sin asociar"} · P${p.parcial} · v${p.version || 1}`, wide: true, submit: "Guardar cambios", body: `
    <div class="grid g2"><div>
      <p><b>${esc(a ? afull(a) : "Asignación no resuelta")}</b><br><small>${esc(pname(p.docenteId))} · Grupo ${esc(p.grupo || "—")}</small></p>
      <div class="row">${chipEstado(p.estadoAsociacion)} ${chipEstado(p.estado)} ${p.archivoId ? `<button class="btn sm" type="button" data-act="descargar" data-file="${p.archivoId}" data-name="${esc(p.archivoNombre)}">⬇ Original</button>` : ""}${p.enlace ? `<a class="btn sm" href="${esc(p.enlace)}" target="_blank">Abrir enlace ↗</a>` : ""}</div>
      ${(p.motivos || []).length ? `<p class="note">${esc(p.motivos.join(" · "))}</p>` : ""}
      <p class="faint" style="font-size:.78rem">Cargó ${esc(pname(p.cargadoPor))} el ${fdt(p.fechaCarga)}${p.validadoPor ? ` · asociación confirmada por ${esc(pname(p.validadoPor))}` : ""}</p>
      ${isStaff() ? `<div class="f"><label>Asociación académica</label><select name="asignacionId"><option value="">— Sin asociar —</option>${L("asignaciones").sort((x, y) => x.grupo.localeCompare(y.grupo)).map(x => opt(x.id, `${alabel(x)} · ${pname(x.docenteId)}`, p.asignacionId)).join("")}</select></div>
      <div class="grid g2"><div class="f"><label>Estado de asociación</label><select name="estadoAsociacion">${["Identificado", "Requiere revisión", "No resuelto"].map(e => opt(e, e, p.estadoAsociacion)).join("")}</select></div>
      <div class="f"><label>Parcial</label><select name="parcial">${[1, 2, 3].map(n => opt(n, n, p.parcial)).join("")}</select></div></div>` : ""}
    </div><div>
      <h3 style="margin-bottom:6px">Taxonomía de Bloom en el documento</h3>
      ${b && tot ? `<div class="bloom">${BN.map(L2 => `<div class="${b.predominante === L2.n ? "on" : ""}"><b>${b.conteo[L2.n]}</b>${L2.nombre}</div>`).join("")}</div>
        <p style="font-size:.8rem;margin-top:8px">Verbos detectados: ${Object.entries(b.verbos).slice(0, 30).map(([v, n]) => chip(v + " · " + BN[n - 1].nombre.slice(0, 4))).join(" ")}</p>
        <p class="faint" style="font-size:.74rem">Análisis automático y descriptivo para orientar el diálogo; no califica la planeación.</p>`
        : `<p class="muted">${p.archivoNombre?.toLowerCase().endsWith(".docx") ? "No se detectaron verbos." : "El análisis automático está disponible para archivos .docx. Puedes capturar la progresión abajo."}</p>`}
    </div></div><hr>
    <div class="grid g2">${campo("progresion", "Progresión / aprendizaje de trayectoria")}${campo("proposito", "Propósito / meta de aprendizaje")}${campo("contenidos", "Contenidos")}${campo("estrategias", "Estrategias didácticas")}</div>
    ${campo("instrumentos", "Instrumentos de evaluación")}
    ${p.texto ? `<details><summary class="muted" style="cursor:pointer">Ver texto extraído del documento</summary><div class="pre">${esc(p.texto.slice(0, 8000))}${p.texto.length > 8000 ? "\n…" : ""}</div></details>` : ""}
    ${vers.length > 1 ? `<h3 style="margin:12px 0 6px">Versiones</h3><div class="tl">${vers.map(v => `<div class="it">v${v.version || 1} · ${fdt(v.fechaCarga)} · ${esc(v.archivoNombre || v.enlace || "")} ${v.id === p.id ? chip("actual", "m") : ""}</div>`).join("")}</div>` : ""}`,
    onSubmit: edit ? async o => {
      const d = { progresion: o.progresion, proposito: o.proposito, contenidos: o.contenidos, estrategias: o.estrategias, instrumentos: o.instrumentos };
      if (o.progresion && !p.bloomProgresion) { const an = BL().analizar(o.progresion); d.bloomProgresion = an.maxNivel || null; }
      if (isStaff()) {
        const a2 = A(o.asignacionId);
        Object.assign(d, { asignacionId: o.asignacionId, docenteId: a2?.docenteId || "", grupo: a2?.grupo || p.grupo, unidadId: a2?.unidadId || "", estadoAsociacion: o.asignacionId ? o.estadoAsociacion : "No resuelto", parcial: +o.parcial });
        if (o.estadoAsociacion === "Identificado" && p.estadoAsociacion !== "Identificado") { d.validadoPor = me(); d.fechaValidacion = nowISO(); }
      }
      await save("planeaciones", p.id, d, "revisión de planeación"); toast("Planeación actualizada.");
    } : null
  });
};

/* ======================= SESIONES Y CONCRECIÓN ======================= */
VIEWS.sesiones = {
  title: "Sesiones y concreción áulica",
  render(r) {
    const q = r.q; let arr = L("sesiones").slice();
    if (!isStaff() && !isOri()) arr = arr.filter(s => s.docenteId === me());
    if (q.parcial) arr = arr.filter(s => s.parcial == q.parcial);
    if (q.grupo) arr = arr.filter(s => s.grupo === q.grupo);
    if (q.estado) arr = arr.filter(s => s.estado === q.estado);
    arr.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    return `<div class="card"><div class="card-h"><h2>Sesiones · ${arr.length}</h2><button class="btn pri" data-act="nuevaSesion">+ Registrar sesión</button></div>
      <p class="muted">Tres registros independientes por sesión: <b>realización</b> (si se llevó a cabo), <b>concreción áulica</b> (qué ocurrió frente a lo planeado) y <b>observación</b> (acompañamiento formal). Marcar una sesión como realizada no implica que se observó ni que se cumplió íntegramente la planeación.</p>
      <div class="filters"><select data-filter="parcial"><option value="">Todos los parciales</option>${[1, 2, 3].map(n => opt(n, "Parcial " + n, q.parcial)).join("")}</select>
      <select data-filter="grupo"><option value="">Todos los grupos</option>${L("grupos").map(g => g.id).sort().map(g => opt(g, "Grupo " + g, q.grupo)).join("")}</select>
      <select data-filter="estado"><option value="">Todos los estados</option>${["Programada", "Realizada", "Reprogramada", "Cancelada"].map(e => opt(e, e, q.estado)).join("")}</select></div>
      <div class="tw"><table><thead><tr><th>Fecha</th><th>Asignación</th><th>Docente</th><th>Planeación</th><th>Realización</th><th>Concreción</th><th>Observación</th><th></th></tr></thead><tbody>
      ${arr.map(s => { const c = byId("concreciones", s.id); const ob = L("observaciones").filter(o => o.sesionId === s.id); const pl = byId("planeaciones", s.planeacionId);
        return `<tr><td>${fdate(s.fecha)}<span class="sub">${s.bloques?.map(b => BLOQUES[b]?.[0]).join(", ") || ""} · P${s.parcial || "?"}</span></td><td><b>${esc(alabel(s.asignacionId))}</b></td><td>${esc(pname(s.docenteId))}</td>
        <td>${pl ? `<a href="#/planeaciones?id=${pl.id}">v${pl.version || 1}</a>` : `<span class="faint">sin vincular</span>`}</td>
        <td><select data-chg="estadoSesion" data-id="${s.id}" style="width:auto;padding:3px 6px;font-size:.78rem" ${isStaff() || s.docenteId === me() ? "" : "disabled"}>${["Programada", "Realizada", "Reprogramada", "Cancelada"].map(e => opt(e, e, s.estado)).join("")}</select></td>
        <td>${c ? chip(c.relacion?.[0] || "Registrada", "g") : `<span class="faint">—</span>`}</td>
        <td>${ob.length ? ob.map(o => `<a href="#/obs/${o.id}">${chipEstado(o.estado)}</a>`).join(" ") : `<span class="faint">—</span>`}</td>
        <td class="num"><button class="btn sm" data-act="concrecion" data-id="${s.id}">Concreción</button>${canObserve() && s.docenteId !== me() ? ` <button class="btn sm" data-act="programarObs" data-sesion="${s.id}">Observar</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="8" class="empty">Aún no hay sesiones registradas.</td></tr>`}
      </tbody></table></div></div>`;
  }
};
export function formSesion(pre = {}) {
  const asg = (isStaff() || isOri()) ? L("asignaciones") : L("asignaciones").filter(a => a.docenteId === me());
  return `<div class="f"><label>Asignación</label><select name="asignacionId" id="sa" required>${asg.sort((a, b) => a.grupo.localeCompare(b.grupo)).map(a => opt(a.id, `${alabel(a)} — ${short(afull(a), 50)} · ${pname(a.docenteId)}`, pre.asignacionId)).join("")}</select></div>
    <div class="grid g2"><div class="f"><label>Fecha</label><input type="date" name="fecha" id="sf" value="${pre.fecha || today()}" required></div>
    <div class="f"><label>Bloque(s) según horario</label><div id="sb" class="checks"></div></div></div>
    <div class="f"><label>Planeación vinculada</label><select name="planeacionId" id="sp"></select><span class="hint">Se sugiere la versión vigente del parcial de la fecha.</span></div>`;
}
export function wireSesion(f, pre = {}) {
  const upd = () => {
    const a = A($("#sa", f).value), fecha = $("#sf", f).value; if (!a) return;
    const d = (new Date(fecha + "T12:00:00").getDay() + 6) % 7; const h = L("horarios").find(x => x.grupo === a.grupo);
    const bs = h ? Object.entries(h.celdas || {}).filter(([k, c]) => c.asignacionId === a.id && +k.split("-")[0] === d).map(([k]) => +k.split("-")[1]) : [];
    $("#sb", f).innerHTML = bs.length ? bs.map(b => `<label><input type="checkbox" name="bloques[]" value="${b}" checked> ${BLOQUES[b][0]}–${BLOQUES[b][1]}</label>`).join("") : `<span class="hint">${d > 4 ? "Fin de semana" : "Esta asignación no tiene clase ese día en el horario"}. Puedes registrarla de todos modos.</span>`;
    const pa = parcialDe(fecha);
    const pls = L("planeaciones").filter(p => p.asignacionId === a.id).sort((x, y) => (y.parcial == pa) - (x.parcial == pa) || (x.estado === "Sustituida") - (y.estado === "Sustituida") || (y.version || 1) - (x.version || 1));
    $("#sp", f).innerHTML = `<option value="">— Sin planeación vinculada —</option>` + pls.map(p => opt(p.id, `Parcial ${p.parcial} · v${p.version || 1}${p.estado === "Sustituida" ? " (anterior)" : ""} · ${p.archivoNombre || "enlace"}`, pre.planeacionId || pls[0]?.id)).join("");
  };
  $("#sa", f).addEventListener("change", upd); $("#sf", f).addEventListener("change", upd); upd();
}
export async function crearSesion(o) {
  const a = A(o.asignacionId); const pl = byId("planeaciones", o.planeacionId);
  const id = newId("se-");
  await save("sesiones", id, { asignacionId: a.id, docenteId: a.docenteId, grupo: a.grupo, unidadId: a.unidadId, fecha: o.fecha, parcial: parcialDe(o.fecha), bloques: (o.bloques || []).map(Number),
    planeacionId: o.planeacionId || "", planeacionVersion: pl?.version || null, estado: o.fecha > today() ? "Programada" : "Realizada", ciclo: CFG.institucion.cicloActual, periodo: CFG.institucion.periodoActual }, "alta de sesión");
  return id;
}
ACT.nuevaSesion = () => { const f = modal({ title: "Registrar sesión", body: formSesion(), onSubmit: async o => { await crearSesion(o); toast("Sesión registrada."); } }); wireSesion(f); };
ACT.estadoSesion = async el => { await save("sesiones", el.dataset.id, { estado: el.value }, "estado de sesión"); toast("Estado actualizado."); };

ACT.concrecion = el => {
  const s = byId("sesiones", el.dataset.id), c = byId("concreciones", s.id) || {}, pl = byId("planeaciones", s.planeacionId);
  const edit = isStaff() || s.docenteId === me() || isOri();
  const rel = ["Coincidencia con lo planeado", "Ajuste pedagógico", "Condición contextual", "Pendiente de documentar"];
  const ev = L("evidencias").filter(e => e.refCol === "concreciones" && e.refId === s.id);
  modal({ title: `Concreción áulica · ${alabel(s.asignacionId)} · ${fdate(s.fecha)}`, wide: true, body: `
    <div class="grid g2"><div class="card flat"><h3>Lo planeado</h3>${pl ? `<p style="font-size:.85rem"><b>Progresión:</b> ${esc(pl.progresion || pl.extraido?.progresion || "—")}<br><b>Propósito:</b> ${esc(pl.proposito || pl.extraido?.proposito || "—")}<br><b>Estrategias:</b> ${esc(short(pl.estrategias || pl.extraido?.estrategias || "—", 300))}</p><small class="faint">Planeación v${pl.version || 1}. Solo se muestra lo identificado en el documento.</small>` : `<p class="muted">Sesión sin planeación vinculada.</p>`}</div>
    <div><div class="f"><label>Lo que ocurrió en la sesión</label><textarea name="realizado" ${edit ? "" : "readonly"}>${esc(c.realizado || "")}</textarea></div></div></div>
    <div class="grid g2"><div class="f"><label>Ajustes pedagógicos realizados</label><textarea name="ajustes">${esc(c.ajustes || "")}</textarea></div>
    <div class="f"><label>Condiciones contextuales</label><textarea name="contexto" placeholder="Ej. suspensión parcial, falla de equipo, actividad institucional…">${esc(c.contexto || "")}</textarea></div></div>
    <div class="f"><label>Relación entre lo planeado y lo ocurrido</label><div class="checks">${rel.map(x => `<label><input type="checkbox" name="relacion[]" value="${x}" ${(c.relacion || []).includes(x) ? "checked" : ""}> ${x}</label>`).join("")}</div><span class="hint">Una diferencia no es automáticamente un error.</span></div>
    <div class="f"><label>Notas</label><textarea name="notas">${esc(c.notas || "")}</textarea></div>
    ${evidenciaHtml(ev)}${edit ? evidenciaInput() : ""}
    ${c.actualizado ? `<p class="faint" style="font-size:.75rem">Última modificación: ${esc(pname(c.actualizadoPor))} · ${fdt(c.actualizado)}</p>` : ""}`,
    onSubmit: edit ? async (o, f) => {
      await save("concreciones", s.id, { sesionId: s.id, asignacionId: s.asignacionId, docenteId: s.docenteId, realizado: o.realizado, ajustes: o.ajustes, contexto: o.contexto, relacion: o.relacion, notas: o.notas, planeacionId: s.planeacionId || "" }, "concreción áulica");
      await guardarEvidencia(f, o, "concreciones", s.id, s.docenteId);
      toast("Concreción guardada.");
    } : null
  });
};

/* ---------------- evidencias (opcionales) ---------------- */
export const evidenciaInput = () => `<div class="card flat" style="margin-top:8px"><h3 style="margin-bottom:6px">Agregar evidencia (opcional)</h3>
  <div class="grid g3"><div class="f"><label>Archivo</label><input type="file" name="evfile" class="evfile"></div><div class="f"><label>…o enlace</label><input type="url" name="evurl" placeholder="https://"></div><div class="f"><label>Descripción</label><input type="text" name="evdesc"></div></div>
  <span class="hint">Adjuntar evidencia no equivale a demostrar cumplimiento.</span></div>`;
export const evidenciaHtml = ev => ev.length ? `<h3 style="margin:10px 0 6px">Evidencias</h3>${ev.map(e => `<div class="row" style="font-size:.85rem;margin-bottom:4px">${e.archivoId ? `<button type="button" class="btn sm" data-act="descargar" data-file="${e.archivoId}" data-name="${esc(e.nombre)}">⬇ ${esc(short(e.nombre, 30))}</button>` : `<a class="btn sm" href="${esc(e.url)}" target="_blank" rel="noopener">Enlace ↗</a>`} ${esc(e.descripcion || "")} <small class="faint">${esc(pname(e.creadoPor))} · ${fdate(e.creado)}</small></div>`).join("")}` : "";
export async function guardarEvidencia(f, o, refCol, refId, docenteId, observadorId = "") {
  const file = f.querySelector(".evfile")?.files?.[0];
  if (!file && !o.evurl) return;
  let archivoId = "";
  if (file) archivoId = (await guardarArchivo(file, { docenteId })).id;
  await save("evidencias", newId("ev-"), { refCol, refId, docenteId, observadorId, archivoId, nombre: file?.name || "", url: o.evurl || "", descripcion: o.evdesc || "" }, "evidencia");
}
