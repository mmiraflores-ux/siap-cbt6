/* Evidencias fotográficas de la observación de clase: máximo 3 imágenes por observación.
   Cada imagen se sube en cuanto se elige y muestra su estado: cargando, cargada (✓) o error (✗, con reintento).
   El recuadro se actualiza solo, sin volver a dibujar el formulario (no se pierde lo que se está escribiendo). */
import { S, CFG, ACT, esc, L, toast, save, audit, isStaff, me, newId, nowISO, fdate, byId } from "./core.js";

export const MAX_FOTOS = 3;
const pend = {};                 // obsId → [{ tmp, file, nombre, estado: "cargando"|"error", msg, url }]
const miniaturas = new Map();    // archivoId → objectURL (o "" si falló)

const fotosDe = obsId => L("evidencias").filter(e => e.refCol === "observaciones" && e.refId === obsId && e.tipo === "imagen")
  .sort((a, b) => (a.creado || "").localeCompare(b.creado || ""));
const enCurso = obsId => (pend[obsId] || []).filter(p => p.estado === "cargando").length;
const ocupados = obsId => fotosDe(obsId).length + enCurso(obsId);
const puedeQuitar = (e, ob) => !ob.detalleBloqueado && (isStaff() || e.creadoPor === me());

/* ---------- HTML ---------- */
export function fotosObsHtml(ob, editable) {
  return `<div class="fotos-obs" id="fotos-${esc(ob.id)}" data-obs="${esc(ob.id)}" data-edit="${editable ? 1 : 0}">${interior(ob, editable)}</div>`;
}
function interior(ob, editable) {
  const ok = fotosDe(ob.id), pp = pend[ob.id] || [];
  const n = ok.length + pp.filter(p => p.estado === "cargando").length;
  if (!editable && !ok.length) return "";
  const tarjeta = (img, icono, estado, texto, acciones = "") => `<figure class="foto ${estado}">
      <div class="foto-img">${img}<span class="foto-ico" aria-hidden="true">${icono}</span></div>
      <figcaption><span class="foto-est">${texto}</span>${acciones}</figcaption></figure>`;
  const listas = ok.map(e => tarjeta(
    `<img data-thumb="${esc(e.archivoId)}" alt="${esc(e.nombre || "Evidencia")}" ${miniaturas.get(e.archivoId) ? `src="${miniaturas.get(e.archivoId)}"` : ""}>`,
    "✓", "ok", `Cargada · ${esc(fdate(e.creado))}`,
    `<span class="foto-acc"><button type="button" class="btn sm" data-act="descargar" data-file="${esc(e.archivoId)}" data-name="${esc(e.nombre)}">Ver</button>${editable && puedeQuitar(e, ob) ? `<button type="button" class="btn sm" data-act="quitarFotoObs" data-id="${esc(e.id)}" data-obs="${esc(ob.id)}">Quitar</button>` : ""}</span>`));
  const subiendo = pp.map(p => p.estado === "cargando"
    ? tarjeta(`<img src="${p.url}" alt="">`, `<span class="spin"></span>`, "cargando", "Cargando…")
    : tarjeta(p.url ? `<img src="${p.url}" alt="">` : `<div class="foto-vacia"></div>`, "✕", "error", `No se cargó: ${esc(p.msg || "error")}`,
      `<span class="foto-acc">${p.file ? `<button type="button" class="btn sm" data-act="reintentarFotoObs" data-obs="${esc(ob.id)}" data-tmp="${p.tmp}">Reintentar</button>` : ""}<button type="button" class="btn sm" data-act="descartarFotoObs" data-obs="${esc(ob.id)}" data-tmp="${p.tmp}">Descartar</button></span>`));
  const lleno = n >= MAX_FOTOS;
  return `<div class="row" style="justify-content:space-between;align-items:center;margin:12px 0 6px"><h3 style="margin:0">Evidencias fotográficas <span class="faint" style="font-weight:400">${ok.length}/${MAX_FOTOS}</span></h3>
    ${editable ? (lleno ? `<span class="faint" style="font-size:.82rem">Límite de ${MAX_FOTOS} imágenes alcanzado</span>`
      : `<label class="btn sm">+ Agregar imagen<input type="file" accept="image/*" ${MAX_FOTOS - n > 1 ? "multiple" : ""} hidden data-chg="subirFotoObs" data-obs="${esc(ob.id)}"></label>`) : ""}</div>
    ${listas.length || subiendo.length ? `<div class="fotos-grid">${listas.join("")}${subiendo.join("")}</div>`
      : `<p class="faint" style="font-size:.82rem;margin:0">Sin imágenes. Puedes agregar hasta ${MAX_FOTOS}; cada una se carga al elegirla.</p>`}
    <div class="sr-only" aria-live="polite">${pp.map(p => p.estado === "cargando" ? `Cargando ${esc(p.nombre)}` : `Error al cargar ${esc(p.nombre)}`).join(". ")}</div>`;
}

/* repinta solo el recuadro de fotos y carga las miniaturas que falten */
export function pintarFotos(obsId) {
  const box = document.getElementById("fotos-" + obsId); if (!box) return;
  const ob = byId("observaciones", obsId); if (!ob) return;
  box.innerHTML = interior(ob, box.dataset.edit === "1");
  cargarMiniaturas(box);
}
export function cargarMiniaturas(root = document) {
  root.querySelectorAll("img[data-thumb]:not([src])").forEach(async img => {
    const id = img.dataset.thumb;
    if (miniaturas.has(id)) { if (miniaturas.get(id)) img.src = miniaturas.get(id); return; }
    miniaturas.set(id, "");
    try { const blob = await S.store.getFile(id); if (blob) { const u = URL.createObjectURL(blob); miniaturas.set(id, u); document.querySelectorAll(`img[data-thumb="${CSS.escape(id)}"]`).forEach(i => i.src = u); } }
    catch (e) { console.warn("miniatura", e); }
  });
}

/* ---------- compresión: lado mayor 1600 px, JPEG ---------- */
async function comprimir(file) {
  const bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("el archivo no es una imagen válida")); i.src = URL.createObjectURL(file); });
  const k = Math.min(1, 1600 / Math.max(bmp.naturalWidth, bmp.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.naturalWidth * k); c.height = Math.round(bmp.naturalHeight * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(res => c.toBlob(res, "image/jpeg", 0.82));
  if (!blob) throw new Error("no se pudo procesar la imagen");
  return blob.size < file.size || !/^image\/(jpe?g|png|webp)$/.test(file.type) ? blob : file;
}

async function subir(ob, p) {
  p.estado = "cargando"; p.msg = ""; pintarFotos(ob.id);
  try {
    if (!/^image\//.test(p.file.type || "") && !/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(p.file.name)) throw new Error("solo se aceptan imágenes");
    const blob = await comprimir(p.file);
    const max = (CFG.maxArchivoMB || 5) * 1048576;
    if (blob.size > max) throw new Error(`pesa ${(blob.size / 1048576).toFixed(1)} MB (máximo ${CFG.maxArchivoMB || 5} MB)`);
    if (fotosDe(ob.id).length >= MAX_FOTOS) throw new Error(`ya hay ${MAX_FOTOS} imágenes`);
    const nombre = p.nombre.replace(/\.[^.]+$/, "") + (blob.type === "image/jpeg" ? ".jpg" : "");
    const buf = await blob.arrayBuffer();
    const archivoId = await S.store.putFile({ nombre, tipo: blob.type || p.file.type, tamano: blob.size, subidoPor: me() || "", fecha: nowISO(), docenteId: ob.docenteId }, buf);
    miniaturas.set(archivoId, URL.createObjectURL(blob));
    await save("evidencias", newId("ev-"), { refCol: "observaciones", refId: ob.id, docenteId: ob.docenteId, observadorId: ob.observadorId, archivoId, nombre, tipo: "imagen", url: "", descripcion: "Evidencia fotográfica de la sesión" }, "evidencia fotográfica");
    pend[ob.id] = (pend[ob.id] || []).filter(x => x !== p);
    toast(`Imagen “${short(nombre)}” cargada.`);
  } catch (e) {
    console.error(e);
    p.estado = "error"; p.msg = String(e?.message || e).replace(/^FirebaseError:\s*/, "").slice(0, 120);
    if (/imagen v[aá]lida|solo se aceptan/.test(p.msg)) { p.url = ""; p.file = null; }   // reintentar no serviría: solo se puede descartar
    toast(`No se pudo cargar “${short(p.nombre)}”: ${p.msg}`, true);
  }
  pintarFotos(ob.id);
}
const short = s => s.length > 28 ? s.slice(0, 26) + "…" : s;

ACT.subirFotoObs = async el => {
  const ob = byId("observaciones", el.dataset.obs); const files = [...(el.files || [])]; el.value = "";
  if (!ob || !files.length) return;
  const libres = MAX_FOTOS - ocupados(ob.id);
  if (libres <= 0) { toast(`Solo se permiten ${MAX_FOTOS} imágenes por observación.`, true); return; }
  if (files.length > libres) toast(`Solo se permiten ${MAX_FOTOS} imágenes: se cargarán ${libres} y se omitieron ${files.length - libres}.`, true);
  const nuevos = files.slice(0, libres).map(file => ({ tmp: newId("t"), file, nombre: file.name || "imagen", estado: "cargando", url: /^image\//.test(file.type) ? URL.createObjectURL(file) : "" }));
  pend[ob.id] = [...(pend[ob.id] || []).filter(p => p.estado !== "error"), ...nuevos];
  pintarFotos(ob.id);
  for (const p of nuevos) await subir(ob, p);   // una por una: cada parte pesa hasta ~900 KB
};
ACT.reintentarFotoObs = el => {
  const ob = byId("observaciones", el.dataset.obs); const p = (pend[el.dataset.obs] || []).find(x => x.tmp === el.dataset.tmp);
  if (!ob || !p) return;
  if (fotosDe(ob.id).length + enCurso(ob.id) >= MAX_FOTOS) { toast(`Ya hay ${MAX_FOTOS} imágenes; quita una para reintentar.`, true); return; }
  return subir(ob, p);
};
ACT.descartarFotoObs = el => { pend[el.dataset.obs] = (pend[el.dataset.obs] || []).filter(x => x.tmp !== el.dataset.tmp); pintarFotos(el.dataset.obs); };
ACT.quitarFotoObs = async el => {
  const e = byId("evidencias", el.dataset.id), ob = byId("observaciones", el.dataset.obs);
  if (!e || !ob || !puedeQuitar(e, ob)) return;
  if (!confirm(`¿Quitar la imagen “${e.nombre}” de la evidencia?`)) return;
  try { await S.store.del("evidencias", e.id); await audit("quitar evidencia fotográfica", "evidencias", e.id, { observacionId: ob.id, nombre: e.nombre, archivoId: e.archivoId }); toast("Imagen quitada."); }
  catch (er) { toast("No se pudo quitar la imagen: " + (er?.message || er), true); }
  pintarFotos(ob.id);
};

