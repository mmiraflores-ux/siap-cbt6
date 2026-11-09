/* Planeaciones (carga individual y masiva), sesiones, concreción áulica y evidencias */
import {
  S, CFG, VIEWS, ACT, esc, $, $$, L, P, pname, UC, A, alabel, afull, opt, chip, chipEstado, modal, closeModal, save, toast, isStaff, isDoc,
  isOri, canObserve, me, norm, today, nowISO, fdate, fdt, parcialHoy, parcialDe, short, newId, audit, notify, BLOQUES, DIAS, byId
} from "./core.js";
import { setQ, dropQ } from "./app.js";
import { analizarPlaneacion, combinar } from "./extractor.js";

const BL = () => window.BLOOM;

/* ---------------- lectura de planeaciones ---------------- */
/* Analiza el archivo y devuelve los datos que se guardan en la planeación */
async function datosDeAnalisis(nombre, buf, preAnalisis) {
  let an = preAnalisis;
  try { an = an || await analizarPlaneacion(nombre, buf); }
  catch (e) { console.warn(e); return { analisis: { fecha: nowISO(), error: e.message || String(e) } }; }
  const bloom = an.texto ? BL().analizar(an.texto) : null;
  return {
    texto: an.texto || "", generales: an.generales || {}, porParcial: an.porParcial || {}, datosDoc: an.datosDoc || null, parcialesDoc: an.parciales || [],
    transversalidad: an.transversalidad || null, instrumentosEval: an.instrumentos || null, extraido: {},
    bloom: bloom ? { conteo: bloom.conteo, verbos: bloom.verbos, predominante: bloom.predominante, maxNivel: bloom.maxNivel, total: bloom.total } : null,
    analisis: { fecha: nowISO(), formato: an.formato, soportado: an.soportado, version: 3, error: "" }
  };
}
/* Campos que el sistema muestra para la planeación, según su parcial */
export function camposPlan(p) {
  if (!p) return {};
  if (p.analisis?.version === 3) {
    const c = combinar({ generales: p.generales, porParcial: p.porParcial, instrumentos: p.instrumentosEval }, +p.parcial);
    return { ...c, bloomProgresion: c.progresion ? BL().analizar(c.progresion).maxNivel : null };
  }
  const ex = p.extraido || {};                                    // planeaciones leídas con versiones anteriores
  return { ...ex, estadoInstr: p.instrumentosEval?.estado || "", evaluacion: [], anexos: p.instrumentosEval?.anexos || [], tiposInstr: p.instrumentosEval?.tipos || [], bloomProgresion: p.bloomProgresion || null };
}
/* Lo que se muestra: lo corregido a mano o, si no, lo tomado del documento */
export const valorPlan = (p, k) => (p?.[k] || camposPlan(p)[k] || "");
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
const compacta = t => norm(t).replace(/[.\s_-]/g, "");
/* Interpreta el nombre del archivo. Acepta N.P_ABREV_NOMBRE_GRUPO, ABREV_NOMBRE_GRUPO
   y variantes sin grupo o con la abreviatura y el nombre partidos por guiones bajos. */
export function interpretarNombre(fname) {
  const base = fname.replace(/\.[^.]+$/, "").replace(/\s+/g, " ").trim();
  let t = base.split(/_+/).map(x => x.trim()).filter(Boolean);
  const r = { base, np: null, abrev: "", nombre: "", grupo: null, notas: [] };
  const ig = t.map((x, i) => /^\d{3}$/.test(x) ? i : -1).filter(i => i >= 0).pop();
  if (ig !== undefined) { r.grupo = t[ig]; t.splice(ig, 1); }
  else { const m = base.match(/(?:^|\D)(\d{3})(?!.*\d{3})(?:\D|$)/); if (m) { r.grupo = m[1]; r.notas.push("Grupo detectado dentro del nombre"); t = t.map(x => x.replace(m[1], "").trim()).filter(Boolean); } }
  if (t.length && /^\d{1,2}$/.test(t[0])) r.np = +t.shift();
  // abreviatura: el tramo inicial más largo que coincide con el catálogo
  const claves = new Set(); L("unidades").forEach(u => { claves.add(compacta(u.abrev)); (u.aliasHorario || []).forEach(x => claves.add(compacta(x))); });
  let k = 0;
  for (let i = Math.min(4, t.length - (t.length > 1 ? 1 : 0)); i >= 1; i--) if (claves.has(compacta(t.slice(0, i).join(" ")))) { k = i; break; }
  if (!k) k = t.length > 1 ? 1 : t.length;
  r.abrev = t.slice(0, k).join(" "); r.nombre = t.slice(k).join(" ");
  return r;
}
const tokensNombre = t => norm(t).split(/[^A-Z]+/).filter(w => w.length >= 3);
function coincideDocente(pid, texto) {
  const p = P(pid); if (!p || !texto) return 0;
  const nom = new Set([...tokensNombre(p.nombre), ...(p.alias || []).flatMap(tokensNombre)]);
  return tokensNombre(texto).filter(w => nom.has(w)).length;
}
export function resolverAsignacion(it, parcial, doc) {
  const out = { asignacionId: "", estado: "No resuelto", motivos: [], candidatos: [] };
  let grupo = it.grupo, grupoDoc = false;
  if (!grupo && doc?.grupoNum && L("grupos").some(x => x.id === doc.grupoNum)) { grupo = doc.grupoNum; grupoDoc = true; out.motivos.push(`Grupo ${grupo} tomado del documento`); }
  const g = grupo ? L("grupos").find(x => x.id === grupo) : null;
  if (grupo && !g) { out.motivos.push(`Grupo ${grupo} no existe en el catálogo`); return out; }
  const uds = L("unidades").filter(u => !g || u.semestre === g.semestre);
  const ab = compacta(it.abrev);
  const byAb = ab ? uds.filter(u => { const ua = compacta(u.abrev); return ua === ab || (u.aliasHorario || []).some(a => compacta(a) === ab) || (ab.length >= 3 && (ua.endsWith(ab) || ua.startsWith(ab))); }) : [];
  const byNp = it.np ? uds.filter(u => u.np === it.np) : [];
  const docAsig = norm(doc?.asignatura || "").slice(0, 38);
  const byDoc = docAsig.length > 12 ? uds.filter(u => norm(u.nombre).startsWith(docAsig) || docAsig.startsWith(norm(u.nombre).slice(0, 38))) : [];
  let us = byNp.length && byAb.length ? byNp.filter(x => byAb.includes(x)) : byAb.length ? byAb : byNp.length ? byNp : byDoc;
  if (byNp.length && byAb.length && !us.length) { out.motivos.push(`El N.P. ${it.np} (${byNp[0].abrev}) no coincide con la abreviatura “${it.abrev}”`); us = byAb; out.conflicto = true; }
  if (!byAb.length && it.abrev && us.length) out.motivos.push(`Abreviatura “${it.abrev}” no reconocida; se usó ${byNp.length ? "el N.P." : "el nombre de la asignatura del documento"}`);
  if (!us.length) { out.motivos.push("No se identificó la unidad curricular"); return out; }
  let cands = L("asignaciones").filter(x => us.some(u => u.id === x.unidadId) && x.estado !== "Cerrada" && (!g || x.grupo === g.id));
  if (!cands.length) { out.motivos.push(`No hay asignación de ${us[0].abrev}${g ? " en " + g.id : ""}`); return out; }
  const pista = [it.nombre, doc?.docente].filter(Boolean).join(" ");
  if (cands.length > 1 && pista) { const mejor = Math.max(...cands.map(c => coincideDocente(c.docenteId, pista))); if (mejor > 0) cands = cands.filter(c => coincideDocente(c.docenteId, pista) === mejor); }
  out.candidatos = cands.map(c => c.id);
  const a = cands[0]; out.asignacionId = a.id;
  if (cands.length > 1) { out.motivos.push(`Varias asignaciones posibles (${cands.map(c => c.grupo).join(", ")}); confirma el grupo`); out.conflicto = true; }
  if (!g) { out.motivos.push(`El nombre del archivo no indica el grupo; se propone ${a.grupo}`); out.conflicto = out.conflicto || cands.length > 1; out.sinGrupo = true; }
  const p = P(a.docenteId);
  const nameOk = !!pista && coincideDocente(a.docenteId, pista) > 0;
  if (!pista) out.motivos.push("El nombre del archivo no incluye docente");
  else if (!nameOk) out.motivos.push(`“${it.nombre || doc?.docente}” no corresponde a ${p?.nombre || "la persona asignada"}`);
  out.estado = nameOk && !out.conflicto && (g || false) ? "Identificado" : "Requiere revisión";
  if (out.sinGrupo && nameOk && cands.length === 1) out.estado = "Requiere revisión";
  const prev = L("planeaciones").filter(x => x.asignacionId === a.id && x.parcial == parcial && x.estado !== "Sustituida");
  if (prev.length) out.motivos.push(`Ya existe planeación (v${Math.max(...prev.map(x => x.version || 1))}); se guardará como nueva versión`);
  return out;
}

async function registrarPlaneacion({ asignacionId, parcial, file, enlace, estadoAsociacion, interpretacion, motivos, an }) {
  const a = A(asignacionId);
  let archivoId = "", nombre = file?.name || "", datos = {};
  if (file) { const r = await guardarArchivo(file, { docenteId: a?.docenteId || "" }); archivoId = r.id; datos = await datosDeAnalisis(file.name, r.buf, an); }
  const prev = a ? L("planeaciones").filter(x => x.asignacionId === a.id && x.parcial == parcial && x.estado !== "Sustituida") : [];
  const version = prev.length ? Math.max(...prev.map(x => x.version || 1)) + 1 : 1;
  for (const p of prev) await save("planeaciones", p.id, { estado: "Sustituida", sustituidaPor: version }, "nueva versión");
  const id = newId("pl-");
  await save("planeaciones", id, {
    ciclo: CFG.institucion.cicloActual, periodo: CFG.institucion.periodoActual, parcial: +parcial,
    asignacionId: a?.id || "", docenteId: a?.docenteId || "", grupo: a?.grupo || interpretacion?.grupo || "", unidadId: a?.unidadId || "",
    archivoNombre: nombre, archivoId, enlace: enlace || "", estadoAsociacion, estado: "Cargada", version,
    interpretacion: interpretacion || null, motivos: motivos || [], texto: "", extraido: {}, transversalidad: null, instrumentosEval: null, bloom: null, ...datos,
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
      ${isStaff() ? `<button class="btn" data-act="reanalizarTodas" title="Vuelve a leer los archivos ya cargados con el lector actual">↻ Analizar de nuevo</button><button class="btn pri" data-act="cargaMasiva">⇪ Carga masiva</button>` : ""}${isDoc() ? `<button class="btn" data-act="subirPlan">+ Subir mi planeación</button>` : ""}</div>
      <p class="muted">Se conserva el archivo original y cada nueva carga crea una versión. El nombre del archivo es solo una ayuda: la asociación se valida contra la asignación académica.</p>
      <div class="filters"><select data-filter="parcial"><option value="">Todos los parciales</option>${[1, 2, 3].map(n => opt(n, "Parcial " + n, q.parcial)).join("")}</select>
      <select data-filter="grupo"><option value="">Todos los grupos</option>${L("grupos").map(g => g.id).sort().map(g => opt(g, "Grupo " + g, q.grupo)).join("")}</select>
      ${isStaff() || isOri() ? `<select data-filter="doc"><option value="">Todas las personas</option>${docs.map(p => opt(p.id, p.nombre, q.doc)).join("")}</select>` : ""}
      <select data-filter="asoc"><option value="">Toda asociación</option>${opt("pend", "Por revisar / no resueltas", q.asoc)}</select>
      <label class="checks"><label><input type="checkbox" ${q.vers ? "checked" : ""} onchange="SIAP_setQ('vers', this.checked?'1':'')"> Ver versiones anteriores</label></label></div>
      <div class="tw"><table><thead><tr><th>Asignación</th><th>Docente</th><th class="num">Parcial</th><th class="num">Ver.</th><th>Archivo</th><th>Asociación</th><th>Bloom predominante</th><th>Instrumentos</th><th>Transversalidad</th><th></th></tr></thead><tbody>
      ${arr.map(p => `<tr><td><b>${esc(p.asignacionId ? alabel(p.asignacionId) : (p.interpretacion?.base || "Sin asociar"))}</b><span class="sub">${esc(short(p.asignacionId ? afull(p.asignacionId) : (p.motivos || []).join("; "), 70))}</span></td>
      <td>${esc(pname(p.docenteId))}</td><td class="num">${p.parcial}</td><td class="num">${p.version || 1}${p.estado === "Sustituida" ? " " + chip("anterior") : ""}</td>
      <td>${p.archivoId ? `<button class="btn sm ghost" data-act="descargar" data-file="${p.archivoId}" data-name="${esc(p.archivoNombre)}">⬇ ${esc(short(p.archivoNombre, 28))}</button>` : p.enlace ? `<a href="${esc(p.enlace)}" target="_blank" rel="noopener">Enlace ↗</a>` : "—"}</td>
      <td>${chipEstado(p.estadoAsociacion)}</td><td>${p.bloom?.predominante ? chip(BN[p.bloom.predominante - 1].nombre, "m") : `<span class="faint">—</span>`}</td>
      <td>${chipInstr(p)}</td><td>${p.transversalidad ? chip((p.transversalidad.filas || []).length ? p.transversalidad.filas.length + " actividad(es)" : "Descrita", "b") : `<span class="faint">—</span>`}</td>
      <td class="num"><button class="btn sm" data-act="verPlan" data-id="${p.id}">Ver</button></td></tr>`).join("") || `<tr><td colspan="10" class="empty">No hay planeaciones con estos filtros.</td></tr>`}
      </tbody></table></div></div>`;
  }
};
window.SIAP_setQ = (k, v) => setQ(k, v);
export const chipInstr = p => { const e = camposPlan(p).estadoInstr; if (!e) return `<span class="faint">—</span>`; return chip(e, e === "Incluye instrumento" ? "g" : e === "Desarrollo parcial" ? "b" : e === "Solo mencionado" ? "a" : ""); };

/* -------- volver a analizar archivos ya cargados -------- */
async function reanalizar(p) {
  if (!p.archivoId) throw new Error("Esta planeación es un enlace; no hay archivo para analizar.");
  const blob = await S.store.getFile(p.archivoId); if (!blob) throw new Error("No se encontró el archivo original.");
  const d = await datosDeAnalisis(p.archivoNombre, await blob.arrayBuffer());
  await S.store.set("planeaciones", p.id, { ...d, actualizado: nowISO(), actualizadoPor: me() || "" });
  return d;
}
ACT.reanalizarUna = async el => {
  const p = byId("planeaciones", el.dataset.id); el.disabled = true; el.textContent = "Analizando…";
  try { const d = await reanalizar(p); toast(d.analisis?.error ? "No se pudo leer: " + d.analisis.error : "Planeación analizada de nuevo.", !!d.analisis?.error); setTimeout(() => ACT.verPlan({ dataset: { id: p.id } }), 300); }
  catch (e) { toast(e.message, true); el.disabled = false; el.textContent = "↻ Analizar de nuevo"; }
};
ACT.usarParaParciales = async el => {
  const p = byId("planeaciones", el.dataset.id);
  const faltan = (p.parcialesDoc || []).filter(n2 => n2 != p.parcial && !L("planeaciones").some(x => x.asignacionId === p.asignacionId && x.parcial == n2 && x.estado !== "Sustituida"));
  if (!faltan.length) return;
  const copia = ["archivoId", "archivoNombre", "enlace", "asignacionId", "docenteId", "grupo", "unidadId", "ciclo", "periodo", "estadoAsociacion", "texto", "generales", "porParcial", "datosDoc", "parcialesDoc", "transversalidad", "instrumentosEval", "bloom", "analisis", "interpretacion"];
  for (const n2 of faltan) {
    const d = Object.fromEntries(copia.filter(k => p[k] !== undefined).map(k => [k, p[k]]));
    await save("planeaciones", newId("pl-"), { ...d, parcial: n2, version: 1, estado: "Cargada", extraido: {}, motivos: [`Mismo documento semestral registrado para el parcial ${p.parcial}`], cargadoPor: me() || "", fechaCarga: nowISO(), validadoPor: p.validadoPor || "" }, "planeación semestral para otro parcial");
  }
  toast(`Registrada también para el parcial ${faltan.join(" y ")}.`); closeModal();
};
ACT.reanalizarTodas = async el => {
  const arr = L("planeaciones").filter(p => p.estado !== "Sustituida" && p.archivoId);
  if (!arr.length) return toast("No hay planeaciones con archivo.", true);
  if (!confirm(`Se volverán a leer ${arr.length} planeaciones con el lector actual. Los campos que alguien corrigió a mano no se modifican. ¿Continuar?`)) return;
  el.disabled = true; let ok = 0, err = 0;
  for (const [i, p] of arr.entries()) { el.textContent = `Analizando ${i + 1} de ${arr.length}…`; try { const d = await reanalizar(p); d.analisis?.error ? err++ : ok++; } catch { err++; } }
  await audit("análisis de planeaciones", "planeaciones", "lote", { analizadas: ok, errores: err });
  el.disabled = false; el.textContent = "↻ Analizar de nuevo";
  toast(`${ok} planeaciones analizadas${err ? `, ${err} no se pudieron leer` : ""}.`, !!err);
};

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
    <p class="hint">El sistema lee cada archivo para identificar asignatura, docente y grupo, además del nombre del archivo (<code>N.P_ABREVIATURA_NOMBRE_GRUPO</code>, p. ej. <code>12_TSIYDH III_Lourdes Mociño_301.pdf</code>). Si el nombre no trae el grupo, se toma el que dice el documento.</p>
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
        try { await registrarPlaneacion({ asignacionId: sel, parcial: parc, file: r.file, estadoAsociacion: est, interpretacion: r.it, motivos: r.res.motivos, an: r.an }); ok++; }
        catch (e) { err++; toast(e.message, true); }
        const st = $("#cstat"); if (st) st.textContent = `Guardando ${i + 1} de ${rows.length}…`;
      }
      await audit("carga masiva", "planeaciones", "lote", { archivos: rows.length, guardados: ok, errores: err, parcial: o.parcial });
      toast(`${ok} planeaciones guardadas${err ? `, ${err} con error` : ""}.`);
    }
  });
  const pintar = () => {
    const parcial = $("#cp").value, rows = S.ui.carga;
    rows.forEach(r => r.res = resolverAsignacion(r.it, parcial, r.an?.datosDoc));
    const cnt = e => rows.filter(r => r.res.estado === e).length;
    $("#cres").innerHTML = rows.length ? `<div class="row" style="margin:8px 0">${chip(cnt("Identificado") + " identificados", "g")}${chip(cnt("Requiere revisión") + " requieren revisión", "a")}${chip(cnt("No resuelto") + " no resueltos", "r")}<span class="sp"></span><small id="cstat" class="muted"></small></div>
    <div class="tw" style="max-height:46vh"><table><thead><tr><th>Archivo</th><th>Interpretación</th><th>Asignación</th><th>Parcial</th><th>Estado</th><th>Confirmo</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td><b>${esc(short(r.file.name, 40))}</b><span class="sub">${(r.file.size / 1024).toFixed(0)} KB</span></td>
      <td><small>Archivo: N.P. ${r.it.np ?? "—"} · ${esc(r.it.abrev || "—")} · ${esc(r.it.nombre || "—")} · ${esc(r.it.grupo || "sin grupo")}</small>${r.an?.datosDoc ? `<span class="sub">Documento: ${esc([short(r.an.datosDoc.asignatura, 40), r.an.datosDoc.docente, r.an.datosDoc.grupo ? "grupo " + r.an.datosDoc.grupo : ""].filter(Boolean).join(" · ") || "sin datos generales")}${(r.an.parciales || []).length > 1 ? " · semestral (P" + r.an.parciales.join(", P") + ")" : ""}</span>` : r.anErr ? `<span class="sub" style="color:var(--rojo)">${esc(r.anErr)}</span>` : ""}</td>
      <td><select id="ca${i}" style="min-width:200px"><option value="">— Sin asociar —</option>${L("asignaciones").filter(a => (r.res.candidatos || []).includes(a.id) || !(r.it.grupo || r.an?.datosDoc?.grupoNum) || a.grupo === (r.it.grupo || r.an?.datosDoc?.grupoNum) || a.id === r.res.asignacionId).sort((a, b) => a.grupo.localeCompare(b.grupo)).map(a => opt(a.id, `${alabel(a)} · ${pname(a.docenteId).split(" ")[0]}`, r.res.asignacionId)).join("")}</select>
      ${r.res.motivos.length ? `<span class="sub" style="color:var(--ambar)">${esc(r.res.motivos.join(" · "))}</span>` : ""}</td>
      <td><select id="cpr${i}" style="width:auto">${[1, 2, 3].map(n => opt(n, "P" + n, parcial)).join("")}</select></td>
      <td>${chipEstado(r.res.estado)}</td><td><input type="checkbox" id="cc${i}" ${r.res.estado === "Identificado" ? "checked" : ""} title="Confirmo la asociación"></td></tr>`).join("")}</tbody></table></div>
    <p class="hint">Las filas “Requiere revisión” solo se guardan como válidas si marcas “Confirmo”. Queda registro de quién cargó y confirmó.</p>` : "";
  };
  $("#cf").addEventListener("change", async e => {
    const lote = Date.now(); S.ui.lote = lote;
    S.ui.carga = [...e.target.files].map(file => ({ file, it: interpretarNombre(file.name) }));
    const btn = $("#ov button[type=submit]"); if (btn) btn.disabled = true;
    for (const [i, r] of S.ui.carga.entries()) {                    // leer cada archivo antes de proponer la asociación
      if (S.ui.lote !== lote) return;
      $("#cres").innerHTML = `<p class="note info">Leyendo archivos ${i + 1} de ${S.ui.carga.length}: ${esc(r.file.name)}…</p>`;
      try { r.an = await analizarPlaneacion(r.file.name, await r.file.arrayBuffer()); } catch (er) { r.anErr = "No se pudo leer: " + er.message; }
    }
    if (btn) btn.disabled = false;
    pintar();
  });
  $("#cp").addEventListener("change", pintar);
};

/* -------- detalle de planeación -------- */
ACT.verPlan = el => {
  const p = byId("planeaciones", el.dataset.id); if (!p) return;
  const a = A(p.asignacionId), BN = BL().NIVELES, b = p.bloom;
  const own = p.docenteId === me(), edit = isStaff() || own;
  const vers = L("planeaciones").filter(x => x.asignacionId && x.asignacionId === p.asignacionId && x.parcial == p.parcial).sort((x, y) => (y.version || 1) - (x.version || 1));
  const ex = camposPlan(p), dd = p.datosDoc;
  const campo = (k, t, alto) => `<div class="f"><label>${t} ${p[k] ? chip("corregido a mano", "b") : ex[k] ? chip("tomado del documento · verificar", "d") : ""}</label><textarea name="${k}" ${edit ? "" : "readonly"} ${alto ? 'style="min-height:130px"' : ""} placeholder="Sin dato identificado en el documento">${esc(p[k] || ex[k] || "")}</textarea></div>`;
  const ie = p.instrumentosEval, tv = p.transversalidad, an = p.analisis || {};
  const avisos = [];                                              // lo que dice el documento frente a la asignación
  if (dd && a) {
    if (dd.grupoNum && dd.grupoNum !== a.grupo) avisos.push(`El documento dice grupo ${dd.grupo}${dd.grupoNum !== dd.grupo ? " (" + dd.grupoNum + ")" : ""}; la asignación es del grupo ${a.grupo}.`);
    const pd = P(a.docenteId); if (dd.docente && pd && !norm(dd.docente).split(" ").filter(w => w.length > 3).some(w => norm(pd.nombre).includes(w))) avisos.push(`El documento indica docente “${dd.docente}”.`);
  }
  const otrosParciales = (p.parcialesDoc || []).filter(n2 => n2 != p.parcial && !L("planeaciones").some(x => x.asignacionId === p.asignacionId && x.parcial == n2 && x.estado !== "Sustituida"));
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
        : `<p class="muted">${p.texto ? "No se detectaron verbos." : "Sin texto analizado. Usa “Analizar de nuevo” o captura la progresión abajo."}</p>`}
    </div></div><hr>
    ${dd && (dd.asignatura || dd.docente || dd.grupo) ? `<p style="font-size:.84rem"><b>Datos del documento:</b> ${[dd.asignatura, dd.docente, dd.grupo ? "Grupo " + dd.grupo : "", dd.semestre ? "Semestre " + dd.semestre : ""].filter(Boolean).map(esc).join(" · ")}</p>` : ""}
    ${avisos.length ? `<p class="note">${avisos.map(esc).join(" ")} Verifica la asociación.</p>` : ""}
    ${(p.parcialesDoc || []).length > 1 ? `<p class="note info">Este documento es semestral: contiene los parciales ${p.parcialesDoc.join(", ")}. Abajo se muestra lo del <b>parcial ${p.parcial}</b>.${otrosParciales.length && edit && p.asignacionId ? ` <button type="button" class="btn sm" data-act="usarParaParciales" data-id="${p.id}">Registrar también para el parcial ${otrosParciales.join(" y ")}</button>` : ""}</p>` : ""}
    ${an.error ? `<p class="note err">No se pudo leer el archivo: ${esc(an.error)}</p>` : p.archivoId && an.version !== 3 ? `<p class="note info">Esta planeación se leyó con el lector anterior. Pulsa <b>“Analizar de nuevo”</b> para identificar progresión, propósito, contenidos, estrategias, transversalidad e instrumentos.</p>` : an.soportado === false ? `<p class="note">El formato .${esc(an.formato)} no se puede leer automáticamente (se aceptan .docx, .xlsx y .pdf). Captura los campos a mano.</p>` : ""}
    ${p.archivoId && edit ? `<div class="row" style="margin-bottom:8px"><button type="button" class="btn sm" data-act="reanalizarUna" data-id="${p.id}">↻ Analizar de nuevo</button>${an.fecha ? `<small class="faint">Último análisis: ${fdt(an.fecha)}</small>` : ""}</div>` : ""}
    <div class="grid g2">${campo("progresion", "Progresión / aprendizaje de trayectoria / propósito formativo")}${campo("proposito", "Propósito / meta de aprendizaje")}${campo("contenidos", "Temas / contenidos")}${campo("estrategias", "Metodologías activas / estrategias didácticas")}</div>
    <div class="card flat" style="margin:4px 0 12px"><div class="card-h" style="margin-bottom:6px"><h3>Instrumentos de evaluación</h3>${chipInstr(p)}</div>
      ${ex.evaluacion?.length ? `<p class="muted" style="font-size:.82rem;margin:0 0 4px">Evaluación continua del parcial ${p.parcial}</p><div class="tw" style="margin-bottom:8px"><table><thead><tr><th>Producto / actividad</th><th>Aspectos que se evalúan</th><th>Instrumento</th><th class="num">Ponderación</th><th>¿Desarrollado?</th></tr></thead><tbody>${ex.evaluacion.map(e => `<tr><td>${esc(e.producto || "—")}</td><td>${esc(e.aspectos || "—")}</td><td>${esc(e.instrumento)}</td><td class="num">${esc(e.ponderacion || "")}</td><td>${e.estadoAnexo === "especifico" ? chip("Sí, en anexo", "g") + `<span class="sub">${esc(short(e.anexo, 60))}</span>` : e.estadoAnexo === "otro" ? chip("Solo se nombra", "a") + `<span class="sub">Hay ${esc(e.tipo.toLowerCase())} en anexo, pero para otro producto</span>` : chip("Solo se nombra", "a")}</td></tr>`).join("")}</tbody></table></div>` : ""}
      ${(ex.anexos || []).length ? `<p class="muted" style="font-size:.82rem;margin:0 0 4px">Instrumentos desarrollados en el documento</p><div class="tw" style="margin-bottom:8px"><table><thead><tr><th>Instrumento</th><th>¿Qué evalúa?</th><th>Criterios identificados</th></tr></thead><tbody>${ex.anexos.map(x => `<tr><td><b>${esc(x.tipo)}</b><span class="sub">${esc(x.titulo || "")}</span></td><td>${esc(x.evalua || "—")}</td><td>${(x.criterios || []).map(esc).join("<br>") || "—"}</td></tr>`).join("")}</tbody></table></div>` : ""}
      ${ie && ie.menciones?.length ? `<details><summary class="muted" style="cursor:pointer;font-size:.85rem">Dónde se mencionan (${ie.menciones.length})</summary>${ie.menciones.map(m => `<p style="font-size:.82rem;margin:4px 0">${chip(m.tipo)} ${esc(m.contexto)}${m.alFinal ? " " + chip("al final del documento", "d") : ""}</p>`).join("")}</details>` : ""}
      ${campo("instrumentos", "Resumen (editable)", true)}</div>
    <div class="card flat" style="margin:0 0 12px"><div class="card-h" style="margin-bottom:6px"><h3>Transversalidad curricular</h3>${tv ? chip("Se enviará a PAEC", "b") : chip("No identificada")}</div>
      ${tv ? (tv.filas?.length ? `<div class="tw"><table><thead><tr>${tv.headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${tv.filas.map(f => `<tr>${f.celdas.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<div class="pre">${esc(tv.texto || "")}</div>`)
        : `<p class="muted" style="font-size:.85rem">No se encontró la tabla “Transversalidad curricular” en el documento.</p>`}
      ${tv ? `<p class="faint" style="font-size:.75rem;margin-top:6px">Consulta todas las actividades transversales en <a href="#/paec?tab=transversalidad">Proyectos PAEC → Transversalidad planeada</a>.</p>` : ""}</div>
    ${p.texto ? `<details><summary class="muted" style="cursor:pointer">Ver texto extraído del documento</summary><div class="pre">${esc(p.texto.slice(0, 8000))}${p.texto.length > 8000 ? "\n…" : ""}</div></details>` : ""}
    ${vers.length > 1 ? `<h3 style="margin:12px 0 6px">Versiones</h3><div class="tl">${vers.map(v => `<div class="it">v${v.version || 1} · ${fdt(v.fechaCarga)} · ${esc(v.archivoNombre || v.enlace || "")} ${v.id === p.id ? chip("actual", "m") : ""}</div>`).join("")}</div>` : ""}`,
    onSubmit: edit ? async o => {
      // Solo se guarda como “corregido a mano” lo que difiere de lo tomado del documento
      const d = {}; ["progresion", "proposito", "contenidos", "estrategias", "instrumentos"].forEach(k => { d[k] = (o[k] || "") === (ex[k] || "") ? "" : (o[k] || ""); });
      if (d.progresion) { const an2 = BL().analizar(d.progresion); d.bloomProgresion = an2.maxNivel || null; }
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
    <div class="grid g2"><div class="card flat"><h3>Lo planeado</h3>${pl ? `<p style="font-size:.85rem"><b>Progresión:</b> ${esc(valorPlan(pl, "progresion") || "—")}<br><b>Propósito:</b> ${esc(short(valorPlan(pl, "proposito") || "—", 400))}<br><b>Estrategias:</b> ${esc(short(valorPlan(pl, "estrategias") || "—", 300))}</p><small class="faint">Planeación v${pl.version || 1}. Solo se muestra lo identificado en el documento.</small>` : `<p class="muted">Sesión sin planeación vinculada.</p>`}</div>
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
