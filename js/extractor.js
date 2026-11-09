/* =============================================================
   Lector de planeaciones (Word .docx, Excel .xlsx y PDF)
   Identifica los apartados por su NOMBRE dentro del documento,
   sin importar si el dato está a la derecha, debajo o en párrafo.
   Solo devuelve lo que realmente aparece en el archivo.
   ============================================================= */
import { leerPlantillaPdf } from "./lector-pdf.js";

const LIBS = {
  jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"
};
const cargas = {};
function lib(url, global) {
  if (window[global]) return Promise.resolve(window[global]);
  return cargas[url] = cargas[url] || new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = url;
    s.onload = () => res(window[global]);
    s.onerror = () => { delete cargas[url]; rej(new Error("No se pudo cargar el lector de documentos. Revisa tu conexión a internet.")); };
    document.head.appendChild(s);
  });
}

const n = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const limpiaPref = t => t.replace(/^[\d.)\-•·*\s]+/, "");

/* ---------- apartados que se buscan (sinónimos acordados con Subdirección) ---------- */
export const CAMPOS = [
  { k: "progresion", t: "Progresión / aprendizaje de trayectoria / propósito formativo",
    re: /^(progresion(es)?\b|aprendizajes? de (la )?trayectoria|proposito formativo|propositos formativos)/ },
  { k: "proposito", t: "Propósito / meta de aprendizaje",
    re: /^(metas? (de )?aprendizaje|metas? educativas?|propositos?( (de|del) (la |el )?(sesion|aprendizaje|secuencia|parcial|clase|bloque|submodulo|modulo|curso))?$|objetivos?( (de|del) (la |el )?(aprendizaje|sesion|clase|secuencia|parcial))?$|aprendizajes? esperados?)/ },
  { k: "contenidos", t: "Temas / contenidos",
    re: /^(temas?\s*(\/|y|o|-|,)?\s*contenidos?|contenidos?\s*(\/|y|o|-|,)?\s*temas?|contenidos?( (formativos?|especificos?|centrales?|tematicos?|conceptuales?|a desarrollar))?$|temas?( (centrales?|generales?|a desarrollar|y subtemas))?$|temario)/ },
  { k: "estrategias", t: "Metodologías activas / estrategias didácticas",
    re: /^(metodologias? activas?|metodologias?( de (ensenanza|aprendizaje))?$|estrategias? (didacticas?|de ensenanza|de aprendizaje|metodologicas?)|estrategias? utilizadas|tecnicas? didacticas?)/ },
  { k: "instrumentos", t: "Instrumentos de evaluación",
    re: /^(instrumentos?( (de|para la) evaluacion)?$|tecnicas? e instrumentos|evaluacion( (formativa|sumativa|diagnostica))?$|instrumentos? de evaluacion)/ }
];
const TRANSV = /^transversalidad/;
const DATOS = [["asignatura", /^(asignatura ?\/? ?submodulo|asignatura|submodulo|uac|unidad de aprendizaje curricular)$/], ["docente", /^(nombre del o la docente|nombre del docente|docente)$/], ["grupo", /^grupo$/], ["semestre", /^semestre$/]];
const PARCIAL_RE = /^(primer|segundo|tercer)o? parcial$/;
const NUMP = { primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3 };
const OTROS = /^(actividades?|apertura|inicio|desarrollo|cierre|recursos?|materiales?|productos?( esperados?)?|evidencias?|bibliografia|referencias|fecha|docente|nombre|grupo|semestre|sesion(es)?|duracion|tiempo|competencias?|habilidades|campo|uac|asignatura|submodulo|modulo|parcial|plantel|ciclo|categorias?|subcategorias?|ambitos?|recursos sociocognitivos|areas? de conocimiento|observaciones|firma|vo\.? ?bo|elaboro|reviso|ponderacion|criterios?( de evaluacion)?|valor|puntaje|horas|no\.?|num|numero de horas|periodo de (ejecucion|aplicacion)|recursos materiales|grado|carrera|ciclo escolar|horas ?\/ ?semana)\b/;

function etiqueta(txt) {
  const raw = String(txt || "").trim(); if (!raw) return null;
  const i = raw.indexOf(":");
  if (i > 0 && i < 70) {
    const antes = limpiaPref(n(raw.slice(0, i)));
    for (const c of CAMPOS) if (c.re.test(antes)) return { k: c.k, resto: raw.slice(i + 1).trim() };
    for (const [k, re] of DATOS) if (re.test(antes)) return { k, resto: raw.slice(i + 1).trim() };
    if (TRANSV.test(antes)) return { k: "transversalidad", resto: raw.slice(i + 1).trim() };
  }
  const t = limpiaPref(n(raw)).replace(/[:.]+$/, "").trim();
  if (t.length > 75) return null;           // un valor largo nunca se confunde con un encabezado
  for (const c of CAMPOS) if (c.re.test(t)) return { k: c.k, resto: "" };
  if (TRANSV.test(t)) return { k: "transversalidad", resto: "" };
  for (const [k, re] of DATOS) if (re.test(t)) return { k, resto: "" };
  if (t.length < 80 && OTROS.test(t)) return { k: "_otro", resto: "" };
  return null;
}

/* ---------- lector propio de Word (.docx = ZIP con XML) ---------- */
const hijos = el => {                         // hijos directos, desenvolviendo controles de contenido
  const out = [];
  for (const ch of el.children) {
    if (ch.localName === "sdt") { const c = [...ch.children].find(x => x.localName === "sdtContent"); if (c) out.push(...hijos(c)); }
    else if (ch.localName === "customXml" || ch.localName === "smartTag") out.push(...hijos(ch));
    else out.push(ch);
  }
  return out;
};
function textoP(p) {
  let out = "";
  const walk = el => {
    for (const ch of el.children) {
      const ln = ch.localName;
      if (ln === "t") out += ch.textContent;
      else if (ln === "tab") out += " ";
      else if (ln === "br" || ln === "cr") out += "\n";
      else if (ln === "delText" || ln === "instrText" || ln === "rPr" || ln === "pPr") continue;
      else if (ln === "p") { out += "\n"; walk(ch); out += "\n"; }
      else walk(ch);
    }
  };
  walk(p);
  return out.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}
function textoCelda(tc) {
  const out = [];
  hijos(tc).forEach(ch => {
    if (ch.localName === "p") { const t = textoP(ch); if (t) out.push(t); }
    else if (ch.localName === "tbl") matrizDocx(ch).forEach(row => { const l = distintas(row).map(x => x.txt.replace(/\n/g, " ")).filter(Boolean).join(" | "); if (l) out.push(l); });
  });
  return out.join("\n");
}
const val = (el, ...ruta) => { let x = el; for (const r of ruta) { x = x && [...x.children].find(c => c.localName === r); } return x; };
const attr = (el, name) => el ? (el.getAttribute("w:" + name) ?? el.getAttributeNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", name)) : null;
function matrizDocx(tbl) {
  const M = [];
  hijos(tbl).filter(x => x.localName === "tr").forEach((tr, r) => {
    M[r] = []; let c = +(attr(val(tr, "trPr", "gridBefore"), "val") || 0);
    hijos(tr).filter(x => x.localName === "tc").forEach(tc => {
      const span = Math.max(1, +(attr(val(tc, "tcPr", "gridSpan"), "val") || 1));
      const vm = val(tc, "tcPr", "vMerge"); const vmv = vm ? (attr(vm, "val") || "continue") : null;
      const cell = vmv === "continue" && M[r - 1]?.[c] ? M[r - 1][c] : { txt: textoCelda(tc) };
      for (let j = 0; j < span; j++) M[r][c + j] = cell;
      c += span;
    });
  });
  return M;
}
const distintas = row => (row || []).filter((x, i, a) => x && a.indexOf(x) === i);
const columnas = row => { const out = []; (row || []).forEach((x, i) => { if (x && (i === 0 || row[i - 1] !== x)) out.push([i, x]); }); return out; };

/* ---------- acumulador de hallazgos ---------- */
function acumulador() {
  const v = {}, vistos = {};
  const push = (k, txt) => {
    const t = String(txt || "").split("\n").map(s => s.trim()).filter(Boolean).join("\n").trim();
    if (t.length < 3 || etiqueta(t)?.resto === "") return;
    const key = n(t); vistos[k] = vistos[k] || new Set();
    if ([...vistos[k]].some(x => x.includes(key) || key.includes(x))) return;
    vistos[k].add(key); (v[k] = v[k] || []).push(t);
  };
  return { v, push };
}

function desdeMatriz(M, push) {
  for (let r = 0; r < M.length; r++) {
    const row = M[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell || (c > 0 && row[c - 1] === cell) || (r > 0 && M[r - 1]?.[c] === cell)) continue;
      const e = etiqueta(cell.txt);
      if (!e || e.k === "_otro" || e.k === "transversalidad") continue;
      if (e.resto) { push(e.k, e.resto); continue; }
      let der = null;                                  // 1) dato a la derecha
      for (let j = c + 1; j < row.length; j++) { const x = row[j]; if (!x || x === cell || !x.txt.trim()) continue; der = x; break; }
      const ed = der && etiqueta(der.txt);
      if (der && (!ed || (ed.resto && (ed.k === e.k || ed.k === "_otro")))) { push(e.k, der.txt); continue; }
      for (let i = r + 1, k = 0; i < M.length && k < 10; i++) {   // 2) dato debajo (encabezado de columna)
        const x = M[i]?.[c]; if (!x || x === cell || M[i - 1]?.[c] === x) continue;
        const ex = etiqueta(x.txt); if (ex && !ex.resto) break;
        if (x.txt.trim()) { push(e.k, x.txt); k++; }
      }
    }
  }
}

function desdeLineas(items, push) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].tabla) continue;
    const e = etiqueta(items[i].txt);
    if (!e || e.k === "_otro" || e.k === "transversalidad") continue;
    if (e.resto) push(e.k, e.resto);
    const vals = [];
    for (let j = i + 1; j < items.length && vals.length < 8; j++) {
      if (items[j].tabla || etiqueta(items[j].txt)) break;
      vals.push(items[j].txt);
    }
    if (vals.length) push(e.k, vals.join("\n"));
  }
}

/* ---------- Transversalidad curricular ---------- */
function tablaATransv(M, hdrRow, desde, hasta = M.length) {
  const cols = columnas(M[hdrRow]); const headers = cols.map(([, x]) => x.txt || "—");
  const filas = [];
  for (let i = desde; i < hasta; i++) {
    const d = distintas(M[i]); if (!d.length) continue;
    if (d.length === 1 && cols.length > 1 && etiqueta(d[0].txt)) break;         // otra sección de la tabla
    const celdas = cols.map(([c]) => M[i]?.[c]?.txt || "");
    if (celdas.every(x => !x.trim())) continue;
    filas.push({ celdas });
  }
  return filas.length ? { headers, filas } : null;
}
function transversalidad(items, matrices) {
  for (const M of matrices) {
    for (let r = 0; r < M.length; r++) {
      const row = M[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c]; if (!cell || (c > 0 && row[c - 1] === cell)) continue;
        const e = etiqueta(cell.txt); if (!e || e.k !== "transversalidad") continue;
        if (e.resto) return { headers: ["Transversalidad"], filas: [], texto: e.resto };
        const d = distintas(row);
        if (d.length === 1) { const t = tablaATransv(M, r + 1, r + 2); if (t) return t; continue; }   // título de sección
        const der = columnas(row).find(([j, x]) => j > c && x.txt.trim());
        if (der && !etiqueta(der[1].txt) && r + 1 < M.length && distintas(M[r + 1]).length <= 2) return { headers: ["Transversalidad"], filas: [], texto: der[1].txt };
        const t = tablaATransv(M, r, r + 1); if (t) return t;                  // encabezado de columnas
      }
    }
  }
  for (let i = 0; i < items.length; i++) {                                    // título en párrafo + tabla después
    if (items[i].tabla) continue;
    const e = etiqueta(items[i].txt); if (!e || e.k !== "transversalidad") continue;
    for (let j = i + 1; j < Math.min(items.length, i + 4); j++) {
      if (items[j].tabla) { const M = items[j].M; const first = distintas(M[0]).length === 1 ? 1 : 0; const t = tablaATransv(M, first, first + 1); if (t) return t; break; }
    }
    const vals = [];
    for (let j = i + 1; j < items.length && vals.length < 10; j++) { if (items[j].tabla || etiqueta(items[j].txt)) break; vals.push(items[j].txt); }
    if (e.resto) vals.unshift(e.resto);
    if (vals.length) return { headers: ["Transversalidad"], filas: [], texto: vals.join("\n") };
  }
  return null;
}

/* ---------- Instrumentos de evaluación ---------- */
const INST = [
  ["Lista de cotejo", /listas? de cotejo/], ["Rúbrica", /rubricas?/], ["Guía de observación", /guias? de observacion/],
  ["Escala estimativa o de valoración", /escalas? (estimativas?|de valoracion|de likert|likert|de rango|de apreciacion)/],
  ["Registro anecdótico", /registros? anecdoticos?/], ["Portafolio de evidencias", /portafolios?( de evidencias)?/],
  ["Cuestionario o examen", /cuestionarios?|examen(es)?|pruebas? (objetivas?|escritas?)/], ["Diario o bitácora", /diarios? de (clase|campo|aprendizaje)|bitacoras?/]
];
const HDR_CRIT = /(criterios?|indicador(es)?|aspectos?( a evaluar)?|rasgos?|elementos?|caracteristicas?|reactivos?)\b/;
const HDR_NIV = /(\bsi\b|\bno\b|cumple|no cumple|excelente|muy bien|bueno|suficiente|insuficiente|satisfactorio|deficiente|regular|nivel|puntaje|puntos|ponderacion|valor|logrado|en proceso|competente|destacado|\b[1-5]\b)/;
const tipoInst = t => (INST.find(([, re]) => re.test(t)) || [])[0];

function instrumentos(items, matrices, lineasTodas) {
  const menciones = []; const total = lineasTodas.length || 1;
  lineasTodas.forEach((l, i) => {
    const t = n(l);
    INST.forEach(([tipo, re]) => { if (re.test(t) && !menciones.some(m => m.tipo === tipo && m.contexto === l)) menciones.push({ tipo, contexto: l.length > 180 ? l.slice(0, 177) + "…" : l, alFinal: i / total > 0.7 }); });
  });
  const anexos = [];
  const tablas = items.filter(x => x.tabla);
  const fuentes = tablas.length ? tablas.map(x => ({ M: x.M, previo: x.previo })) : matrices.map(M => ({ M, previo: "" }));
  fuentes.forEach(({ M, previo }) => {
    if (!M.length) return;
    let h = 0; let titulo = "";
    if (distintas(M[0]).length === 1) { titulo = M[0][0]?.txt || ""; h = 1; }
    const hdr = n(distintas(M[h]).map(x => x.txt).join(" | "));
    const cab = n(titulo + " " + previo);
    const ultima = (previo || "").split("\n").filter(Boolean).pop() || "";
    const tituloLinea = ultima.length < 140 && !etiqueta(ultima) ? ultima : "";      // título inmediato, no una oración con etiqueta
    if (TRANSV.test(n(titulo)) || CAMPOS.some(c => c.re.test(n(titulo)))) return;   // tablas de la planeación, no instrumentos
    const nombrado = tipoInst(n(titulo)) || tipoInst(n(tituloLinea));
    const conCriterios = HDR_CRIT.test(hdr) && (HDR_NIV.test(hdr) || columnas(M[h]).length >= 3);
    if (!nombrado && !conCriterios) return;
    if (!conCriterios && M.length < 3) return;
    let tipo = nombrado || tipoInst(hdr);
    if (!tipo) tipo = /cumple|\bsi\b/.test(hdr) ? "Lista de cotejo" : /(excelente|bueno|suficiente|insuficiente|nivel|destacado|competente)/.test(hdr) ? "Rúbrica" : "Instrumento con criterios";
    const criterios = [];
    for (let i = h + 1; i < M.length && criterios.length < 8; i++) {
      const x = columnas(M[i])[0]?.[1]; const t = (x?.txt || "").split("\n")[0].trim();
      if (t && t.length > 2 && !/^total|^puntaje|^calificacion/i.test(n(t))) criterios.push(t.length > 80 ? t.slice(0, 77) + "…" : t);
    }
    const tituloFinal = (titulo || (nombrado ? tituloLinea : "") || "").trim();
    const m = n(tituloFinal).match(/(para (evaluar|valorar|calificar|revisar)|de evaluacion (de|del|para))\s+(.+)$/);
    anexos.push({ tipo, titulo: tituloFinal.slice(0, 160), evalua: m ? tituloFinal.slice(tituloFinal.length - m[4].length).trim().slice(0, 160) : "", criterios, filas: Math.max(0, M.length - h - 1) });
  });
  const tipos = [...new Set([...anexos.map(a => a.tipo), ...menciones.map(m => m.tipo)])];
  const estado = anexos.length ? "Incluye instrumento" : menciones.length ? "Solo mencionado" : "No identificado";
  return { estado, tipos, anexos, menciones: menciones.slice(0, 12) };
}
export function resumenInstrumentos(ins) {
  if (!ins) return "";
  if (ins.estado === "No identificado") return "No se identificaron instrumentos de evaluación en el documento.";
  const out = [ins.estado === "Incluye instrumento" ? "El documento incluye instrumento(s) de evaluación desarrollado(s):" : "El documento menciona instrumento(s), pero no incluye su desarrollo (criterios o niveles):"];
  ins.anexos.forEach(a => out.push(`• ${a.tipo}${a.titulo ? " — " + a.titulo : ""}${a.criterios.length ? `. Criterios: ${a.criterios.join("; ")}` : ""}`));
  const solo = ins.menciones.filter(m => !ins.anexos.some(a => a.tipo === m.tipo));
  if (solo.length) out.push((ins.anexos.length ? "También se mencionan: " : "Mencionados: ") + [...new Set(solo.map(m => m.tipo))].join(", "));
  return out.join("\n");
}

/* ---------- lectura por formato ---------- */
async function leerDocx(buf) {
  const JSZip = await lib(LIBS.jszip, "JSZip");
  let zip; try { zip = await JSZip.loadAsync(buf); } catch { throw new Error("El archivo no es un documento de Word (.docx) válido."); }
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("El archivo no es un documento de Word (.docx) válido.");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const body = [...doc.getElementsByTagName("*")].find(e => e.localName === "body");
  if (!body) throw new Error("No se pudo leer el contenido del documento.");
  const items = [], lineas = [], segmentos = []; let previo = "", parcial = 0;
  const esParcial = t => { const m = n(t).match(PARCIAL_RE); return m ? NUMP[m[1]] : 0; };
  // imágenes: r:embed → word/media/…
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string") || "";
  const rels = {}; new DOMParser().parseFromString(relsXml, "application/xml").querySelectorAll("Relationship").forEach(r => rels[r.getAttribute("Id")] = r.getAttribute("Target"));
  const imagenesDe = el => [...el.getElementsByTagName("*")].filter(e => e.localName === "blip").map(b => rels[b.getAttribute("r:embed") || b.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed")]).filter(t => t && /\.(png|jpe?g|gif|bmp|webp)$/i.test(t)).map(t => "word/" + t.replace(/^\/?word\//, ""));
  let seccion = null;                                       // todo lo que sigue al título “Instrumentos de evaluación”
  hijos(body).forEach(el => {
    if (seccion) {
      if (el.localName === "tbl") seccion.push({ tipo: "tabla", M: matrizDocx(el), imagenes: imagenesDe(el) });
      else if (el.localName === "p") { textoP(el).split("\n").filter(Boolean).forEach(txt => seccion.push({ tipo: "texto", txt })); imagenesDe(el).forEach(path => seccion.push({ tipo: "imagen", path })); }
    } else if (el.localName === "p" && HEAD_INSTR.test(n(textoP(el)))) seccion = [];
    if (el.localName === "tbl") {
      const M = matrizDocx(el); items.push({ tabla: true, M, previo, parcial }); previo = "";
      let ini = 0;                                          // partir la tabla donde empieza otro parcial
      M.forEach((row, r) => { const np = distintas(row).map(x => esParcial(x.txt.split("\n")[0])).find(Boolean); if (np) { if (r > ini) segmentos.push({ M: M.slice(ini, r), parcial }); parcial = np; ini = r; } });
      segmentos.push({ M: M.slice(ini), parcial });
      M.forEach(row => { const l = distintas(row).map(x => x.txt.replace(/\n/g, " ")).filter(Boolean).join(" | "); if (l) lineas.push(l); });
    } else if (el.localName === "p") {
      textoP(el).split("\n").filter(Boolean).forEach(l => { const np = esParcial(l); if (np) parcial = np; items.push({ txt: l, parcial }); lineas.push(l); previo = (previo + "\n" + l).slice(-300); });
    }
  });
  const matrices = [...doc.getElementsByTagName("*")].filter(e => e.localName === "tbl").map(matrizDocx);
  const imagen = async path => { const f = zip.file(path); if (!f) return null; const ext = path.split(".").pop().toLowerCase(); return new Blob([await f.async("arraybuffer")], { type: "image/" + (ext === "jpg" ? "jpeg" : ext) }); };
  return { items, matrices, segmentos, texto: lineas.join("\n"), seccion, imagen };
}
async function leerXlsx(buf) {
  const X = await lib(LIBS.xlsx, "XLSX");
  const wb = X.read(buf, { type: "array" });
  const matrices = [], lineas = [];
  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const rows = X.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
    const M = rows.map(r => r.map(v => ({ txt: String(v ?? "").trim() })));
    (ws["!merges"] || []).forEach(({ s, e }) => { const top = M[s.r]?.[s.c]; if (!top) return; for (let r = s.r; r <= e.r; r++) for (let c = s.c; c <= e.c; c++) { M[r] = M[r] || []; M[r][c] = top; } });
    M.forEach(row => row.forEach((x, i) => { if (x && !x.txt) row[i] = null; }));
    matrices.push(M); rows.forEach(r => { const l = r.filter(Boolean).join(" | ").trim(); if (l) lineas.push(l); });
  });
  return { items: matrices.map(M => ({ tabla: true, M, previo: "" })), matrices, texto: lineas.join("\n") };
}
async function leerPdf(buf) {
  const pdfjs = await lib(LIBS.pdf, "pdfjsLib");
  pdfjs.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const raw = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 60); p++) {
    const pg = await pdf.getPage(p); const alto = pg.getViewport({ scale: 1 }).height;
    (await pg.getTextContent()).items.forEach(it => { if (it.str && it.str.trim()) raw.push({ p, x: it.transform[4], y: alto - it.transform[5], w: it.width, h: it.height, s: it.str }); });
  }
  if (!raw.length) throw new Error("El PDF no contiene texto (puede ser una imagen escaneada). Sube la versión en Word o captura los campos a mano.");
  const plantilla = leerPlantillaPdf(raw);
  // imágenes que aparecen después del título “Instrumentos de evaluación”
  let seccion = null;
  const H = plantilla.instrHead;
  if (H) {
    // si los instrumentos tienen títulos reconocibles se usan esos; si no, el texto que sigue al título es el instrumento
    seccion = (plantilla.anexosTrasInstr || []).length ? [] : (plantilla.textoTrasInstr || []).map(txt => ({ tipo: "texto", txt }));
    const OPS = pdfjs.OPS;
    for (let p = H.p; p <= Math.min(pdf.numPages, 60); p++) {
      const pg = await pdf.getPage(p); const alto = pg.getViewport({ scale: 1 }).height;
      let ol; try { ol = await pg.getOperatorList(); } catch (e) { console.warn("No se pudieron localizar imágenes en el PDF", e); break; }
      let ctm = [1, 0, 0, 1, 0, 0]; const pila = [];
      const mul = (m, t) => [m[0] * t[0] + m[2] * t[1], m[1] * t[0] + m[3] * t[1], m[0] * t[2] + m[2] * t[3], m[1] * t[2] + m[3] * t[3], m[0] * t[4] + m[2] * t[5] + m[4], m[1] * t[4] + m[3] * t[5] + m[5]];
      ol.fnArray.forEach((fn, i) => {
        if (fn === OPS.save) pila.push(ctm.slice()); else if (fn === OPS.restore) ctm = pila.pop() || ctm;
        else if (fn === OPS.transform) ctm = mul(ctm, ol.argsArray[i]);
        else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintJpegXObject) {
          const w = Math.abs(ctm[0]) || Math.abs(ctm[2]), h = Math.abs(ctm[3]) || Math.abs(ctm[1]);
          const top = alto - (ctm[5] + Math.max(0, ctm[3])); const caja = { x: ctm[4], y: top, w, h };
          if (w < 120 || h < 80) return;                     // logotipos y adornos
          if (p === H.p && top < H.y) return;
          seccion.push({ tipo: "imagen", pagina: p, caja });
        }
      });
    }
  }
  const imagen = async a => {                              // recorta la imagen de la página para leerla
    if (!a.pagina) return null;
    const pg = await pdf.getPage(a.pagina); const esc = 2.2; const vp = pg.getViewport({ scale: esc });
    const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
    const c2 = document.createElement("canvas"); c2.width = Math.max(1, a.caja.w * esc); c2.height = Math.max(1, a.caja.h * esc);
    c2.getContext("2d").drawImage(cv, a.caja.x * esc, a.caja.y * esc, a.caja.w * esc, a.caja.h * esc, 0, 0, c2.width, c2.height);
    return c2;
  };
  const lineas = plantilla.texto.split("\n").filter(Boolean);
  let parcial = 0;
  const items = lineas.map(txt => { const m = n(txt).match(/^(primer|segundo|tercer)o? parcial\b/); if (m) parcial = NUMP[m[1]]; return { txt, parcial }; });
  return { items, matrices: [], texto: plantilla.texto, plantilla, seccion, imagen };
}

/* ---------- tabla de evaluación continua en Word/Excel ---------- */
function evaluacionMatriz(M) {
  const out = [];
  for (let r = 0; r < M.length; r++) {
    const cols = columnas(M[r]); const iI = cols.findIndex(([, x]) => /^instrumentos? de evaluacion$/.test(n(x.txt))); const iP = cols.findIndex(([, x]) => /^ponderacion$/.test(n(x.txt)));
    if (iI < 0 || iP < 0) continue;
    const cI = cols[iI][0], cP = cols[iP][0];
    const cProd = cols.find(([, x]) => /productos? de aprendizaje/.test(n(x.txt)))?.[0]; const cAsp = cols.find(([, x]) => /aspectos/.test(n(x.txt)))?.[0];
    for (let i = r + 1; i < M.length; i++) {
      const ins = M[i]?.[cI]?.txt || ""; if (distintas(M[i]).some(x => /^total:?$/.test(n(x.txt)))) break;
      if (!ins.trim() || M[i - 1]?.[cI] === M[i][cI]) continue;
      out.push({ producto: cProd != null ? M[i][cProd]?.txt || "" : "", aspectos: cAsp != null ? M[i][cAsp]?.txt || "" : "", instrumento: ins, ponderacion: M[i][cP]?.txt || "", tipo: tipoInst(n(ins)) || "" });
    }
    break;
  }
  return out;
}

/* ---------- Instrumentos de evaluación: clasificación por título o estructura ---------- */
export const HEAD_INSTR = /^(anexos?:? )?instrumentos? de evaluacion( utilizados)?:?$/;
const RUIDO_INSTR = /(subsecretaria|direccion general|direccion de bachillerato|subdireccion regional|supervision escolar|ano del humanismo|gobierno del|estado de mexico|el poder de servir|prolongacion de independencia|correo electronico|cbt no\.? ?6|calacoman)/;
export function clasificarInstrumento(texto) {
  const lineas = String(texto || "").split(/\n+/).map(l => l.replace(/\s+/g, " ").trim()).filter(l => l.length > 2 && !RUIDO_INSTR.test(n(l)));
  const t = n(lineas.join("\n"));
  const reglas = [
    ["Rúbrica", /r\W?[uú]\W?b\W?r\W?i\W?c\W?a|\brubric/], ["Lista de cotejo", /listas? de cotejo|che?c?k\s*-?\s*list|checklist/],
    ["Lista de observación", /listas? de observacion/], ["Guía de observación", /guias? de observacion/],
    ["Escala estimativa o de valoración", /escalas? (estimativas?|de valoracion|de likert|likert|de rango|de apreciacion)/],
    ["Registro anecdótico", /registros? anecdoticos?/], ["Diario o bitácora", /diarios? de (clase|campo|aprendizaje)|bitacoras?/],
    ["Portafolio de evidencias", /portafolios? de evidencias?/], ["Cuestionario o examen", /^(cuestionario|examen)/m]
  ];
  let tipo = "", pos = Infinity, re0 = null;
  reglas.forEach(([k, re]) => { const m = t.match(re); if (m && m.index < pos) { pos = m.index; tipo = k; re0 = re; } });
  if (!tipo) {                                               // por estructura
    if (/\bsi\b[\s|]{0,12}\bno\b/.test(t) || /no cumple|cumple/.test(t)) tipo = "Lista de cotejo";
    else if (/(criterios?|indicador|aspecto)/.test(t) && /(excelente|bien|suficiente|insuficiente|necesita apoyo|sobresaliente|satisfactorio|puntos|\(\d+ ?pts?\))/.test(t)) tipo = "Rúbrica";
  }
  const ETIQ = /^(nombre|grado|grupo|fecha|tema|asignatura|semestre|docente|competencia|alumno|estudiante|plantel|ciclo|parcial|calificacion|puntaje)\b/;
  const etiquetas = l => (n(l).match(/\b(nombre|grado|grupo|fecha|semestre?|docente|alumno|estudiante|calificacion)\b\s*[:=]/g) || []).length;
  // el título es el renglón donde aparece el nombre del instrumento (no el primero que contenga una palabra parecida)
  const idx = re0 ? lineas.findIndex(l => re0.test(n(l))) : -1;
  let titulo = idx >= 0 && lineas[idx].length < 160 && etiquetas(lineas[idx]) < 2 ? lineas[idx]
    : (lineas.find(l => l.length > 10 && l.length < 120 && l === l.toUpperCase() && !ETIQ.test(n(l)) && etiquetas(l) === 0 && !/\bmexico\b/.test(n(l)) && new Set(n(l).split(" ").filter(w => w.length >= 4)).size >= 2) || "");
  titulo = titulo.replace(/^[\W\d]+/, "").replace(/\s*[|]\s*$/, "").trim();
  let evalua = "";
  const m1 = titulo.match(/:\s*(.+)$/), m2 = n(titulo).match(/\b(para evaluar|para valorar|de evaluacion de|de)\s+(.+)$/), m3 = lineas.join(" ").match(/evaluar (?:la|el) (?:actividad|producto|trabajo)?\s*['"“‘]?([^'"”’.]{4,80})/i);
  if (m1 && !ETIQ.test(n(m1[1])) && m1[1].length > 3) evalua = m1[1]; else if (m3) evalua = m3[1]; else if (m2 && tipo) evalua = titulo.slice(titulo.length - m2[2].length);
  if (ETIQ.test(n(evalua)) || etiquetas(evalua)) evalua = "";
  return { tipo, titulo: titulo.slice(0, 160), evalua: evalua.trim().slice(0, 160) };
}
let ocrWorker = null;
/* amplía y pasa a grises: el OCR lee mucho mejor los encabezados pequeños */
async function preparaImagen(img) {
  let src = img, tam = img.size || 0;
  if (img instanceof Blob) src = await createImageBitmap(img);
  const w = src.width, h = src.height, f = Math.min(3, Math.max(1, 2000 / Math.max(1, w)));
  const cv = document.createElement("canvas"); cv.width = Math.round(w * f); cv.height = Math.round(h * f);
  const cx = cv.getContext("2d"); cx.filter = "grayscale(1) contrast(1.15)"; cx.drawImage(src, 0, 0, cv.width, cv.height);
  cv.dataset.tam = tam || img.dataset?.tam || "";
  return cv;
}
export async function textoDeImagen(img) {
  const T = await lib(LIBS.tesseract, "Tesseract");
  if (!ocrWorker) ocrWorker = await T.createWorker("spa");
  const r = await ocrWorker.recognize(await preparaImagen(img));
  return r?.data?.text || "";
}
/* Devuelve la imagen de un instrumento (para verla en pantalla) */
export async function imagenInstrumento(nombre, buf, a) {
  const ext = String(nombre || "").toLowerCase().split(".").pop();
  const L = ext === "docx" ? await leerDocx(buf) : ext === "pdf" ? await leerPdf(buf) : null;
  if (!L?.imagen) return null;
  const img = await (a.path ? L.imagen(a.path) : L.imagen(a)); if (!img) return null;
  if (img instanceof Blob) return img;
  return await new Promise(r => img.toBlob(r, "image/png"));
}
export async function cerrarLectorImagenes() { if (ocrWorker) { try { await ocrWorker.terminate(); } catch {} ocrWorker = null; } }

/* Convierte la sección posterior al título en una lista de instrumentos */
async function instrumentosDeSeccion(bloques, { imagen, ocr }) {
  const out = []; let pend = [];
  const titulo = () => pend.slice().reverse().find(l => l.length > 3 && l.length < 160 && !RUIDO_INSTR.test(n(l))) || "";
  for (const b of bloques) {
    if (b.tipo === "texto") { if (!RUIDO_INSTR.test(n(b.txt))) pend.push(b.txt); continue; }
    if (b.tipo === "tabla") {
      const M = b.M; let h = 0, tit = titulo();
      if (distintas(M[0]).length === 1) { tit = M[0][0]?.txt.split("\n")[0] || tit; h = 1; }
      const textoTabla = M.slice(0, 3).map(r => distintas(r).map(x => x.txt).join(" | ")).join("\n");
      const c = clasificarInstrumento([...pend, textoTabla].join("\n"));
      const crit = []; for (let i = h + 1; i < M.length && crit.length < 12; i++) { const x = columnas(M[i])[0]?.[1]; const v = (x?.txt || "").split("\n")[0].trim(); if (v && !/^(total|puntaje|calificacion)/.test(n(v)) && !crit.includes(v)) crit.push(v.length > 80 ? v.slice(0, 77) + "…" : v); }
      out.push({ fuente: "tabla", tipo: c.tipo || "Instrumento con criterios", titulo: (tit || c.titulo).slice(0, 160), evalua: c.evalua, criterios: crit, filas: crit.length });
      (b.imagenes || []).forEach(path => out.push({ fuente: "imagen", path, tipo: "", titulo: "", evalua: "", criterios: [] }));
      pend = []; continue;
    }
    if (b.tipo === "imagen") { const c = clasificarInstrumento(pend.join("\n")); out.push({ fuente: "imagen", path: b.path, pagina: b.pagina, caja: b.caja, tipo: c.tipo, titulo: c.titulo || titulo(), evalua: c.evalua, criterios: [], seguida: !pend.some(l => l.trim().length > 3) && out.length > 0 && out[out.length - 1].fuente === "imagen" }); pend = []; }
  }
  if (pend.length && pend.join(" ").length > 20) { const c = clasificarInstrumento(pend.join("\n")); out.push({ fuente: "texto", tipo: c.tipo || "Instrumento en texto", titulo: c.titulo || pend[0].slice(0, 160), evalua: c.evalua, criterios: pend.slice(1, 9).map(l => l.slice(0, 80)) }); }
  // leer el texto de cada imagen
  for (const a of out.filter(x => x.fuente === "imagen")) {
    if (!ocr) { a.pendienteOcr = true; if (!a.tipo) a.tipo = "Instrumento en imagen"; continue; }
    try {
      const img = await imagen(a); if (!img) throw new Error("imagen no disponible");
      const txt = await textoDeImagen(img); const c = clasificarInstrumento(txt);
      a.tipo = c.tipo || a.tipo || "Instrumento en imagen"; a.titulo = c.titulo || a.titulo; a.evalua = c.evalua || a.evalua;
      a.textoImagen = txt.replace(/\s+/g, " ").trim().slice(0, 600); a.pendienteOcr = false;
    } catch (e) { a.pendienteOcr = true; a.errorOcr = e.message; if (!a.tipo) a.tipo = "Instrumento en imagen"; }
  }
  // una imagen sin título propia, pegada a la anterior, es la continuación del mismo instrumento
  out.forEach((a, i) => { const prev = out[i - 1];
    if (a.seguida && !a.pendienteOcr && a.tipo === "Instrumento en imagen" && prev && prev.fuente === "imagen" && prev.tipo && prev.tipo !== "Instrumento en imagen") {
      a.tipo = prev.tipo; a.titulo = (prev.titulo || prev.tipo).replace(/ \(continuación\)$/, "") + " (continuación)"; a.evalua = a.evalua || prev.evalua; a.continuacion = true; } });
  return out;
}

/* ---------- ¿el anexo evalúa este producto? ---------- */
const ORGANIZADOR = /\b(mapas?|cuadros?|org|orga|organizadores?|esquemas?|llaves|peine|rueda|diagramas?|lineas? del tiempo|infografias?|mentefactos?|cruci\w*)\b/;
const VACIAS = new Set(["para", "evaluar", "valorar", "lista", "listas", "cotejo", "rubrica", "analitica", "instrumento", "trabajo", "actividad", "actividades", "alumno", "alumnos", "clase", "general", "producto", "productos", "integrador", "integradora", "integracion", "final", "evidencia", "evidencias", "elaboracion"]);
function mismoProducto(producto, anexo) {
  const p = n(producto), a = n(anexo); if (!p || !a) return false;
  if (/organizador/.test(a) && ORGANIZADOR.test(p)) return true;
  const raiz = w => w.slice(0, 6);
  const tp = new Set(p.split(/[^a-zñ]+/).filter(w => w.length >= 4 && !VACIAS.has(w)).map(raiz));
  return a.split(/[^a-zñ]+/).filter(w => w.length >= 4 && !VACIAS.has(w)).some(w => tp.has(raiz(w)));
}

/* ---------- combinación por parcial (lo que ve el sistema) ---------- */
export function combinar(an, parcial) {
  const G = an?.generales || {}, P = (an?.porParcial || {})[parcial] || {};
  const une = (...xs) => xs.filter(x => x && String(x).trim()).join("\n\n");
  const anexos = (an?.instrumentos?.anexos || []).filter(a => a.tipo !== "No es instrumento"), menciones = an?.instrumentos?.menciones || [];
  // cada producto se relaciona con el anexo que realmente lo evalúa (mismo tipo y mismo producto)
  const evaluacion = (P.evaluacion || G.evaluacion || []).map(e => {
    const delTipo = anexos.filter(a => a.tipo && a.tipo === e.tipo);
    const especifico = delTipo.find(a => mismoProducto(e.producto, (a.evalua || "") + " " + (a.titulo || "")));
    return { ...e, anexo: especifico ? (especifico.titulo || especifico.tipo) : "", estadoAnexo: especifico ? "especifico" : delTipo.length ? "otro" : "no" };
  });
  const usados = [...new Set(evaluacion.map(e => e.tipo).filter(Boolean))];
  const tiposMenc = usados.length ? usados : [...new Set(menciones.map(m => m.tipo))];
  let estado;
  if (evaluacion.length) { const k = evaluacion.filter(e => e.estadoAnexo === "especifico").length; estado = k === evaluacion.length ? "Incluye instrumento" : (k || anexos.length) ? "Desarrollo parcial" : "Solo mencionado"; }
  else { const conAnexo = tiposMenc.filter(t => anexos.some(a => a.tipo === t)); estado = !tiposMenc.length ? (anexos.length ? "Incluye instrumento" : "No identificado") : conAnexo.length === tiposMenc.length ? "Incluye instrumento" : conAnexo.length ? "Desarrollo parcial" : "Solo mencionado"; }
  const txt = [];
  const cuenta = {}; anexos.filter(a => !a.continuacion).forEach(a => { cuenta[a.tipo] = (cuenta[a.tipo] || 0) + 1; });
  if (anexos.length) txt.push("Tipos de instrumento en el documento: " + Object.entries(cuenta).map(([t, k]) => `${t} (${k})`).join(", ") + ((an?.instrumentos?.pendientesOcr) ? `. ${an.instrumentos.pendientesOcr} imagen(es) pendiente(s) de leer.` : ""));
  if (evaluacion.length) txt.push(`Evaluación continua${parcial ? " del parcial " + parcial : ""}:\n` + evaluacion.map(e => `• ${e.producto || "Actividad"} — ${e.instrumento}${e.ponderacion ? " (" + e.ponderacion + ")" : ""}${e.aspectos ? ". Evalúa: " + e.aspectos : ""}. ${e.estadoAnexo === "especifico" ? "Desarrollado en anexo: " + e.anexo : "Sin desarrollo en el documento"}.`).join("\n"));
  if (anexos.length) txt.push("Instrumentos desarrollados en el documento:\n" + anexos.map(a => `• ${a.tipo}${a.titulo && n(a.titulo) !== n(a.tipo) ? ": " + a.titulo : ""}${a.fuente === "imagen" ? " (imagen)" : ""}${a.criterios?.length ? ` — ${a.criterios.length} criterios: ${a.criterios.slice(0, 6).join("; ")}${a.criterios.length > 6 ? "…" : ""}` : ""}`).join("\n"));
  if (!evaluacion.length) { const faltan = tiposMenc.filter(t => !anexos.some(a => a.tipo === t)); if (faltan.length) txt.push("Sin desarrollo en el documento (solo se nombran): " + faltan.join(", ")); }
  if (!txt.length && G.instrumentos) txt.push("Indicado en la planeación:\n" + G.instrumentos);
  if (!txt.length) txt.push("No se identificaron instrumentos de evaluación en el documento.");
  return {
    progresion: P.progresion || G.progresion || "",
    proposito: une(G.proposito, P.proposito),
    contenidos: une(P.contenidos, (!P.contenidos || parcial === 1) && G.contenidos ? (P.contenidos ? "Curso de inducción / nivelación: " : "") + G.contenidos : ""),
    estrategias: P.estrategias || G.estrategias || "",
    instrumentos: txt.join("\n\n"), evaluacion, estadoInstr: estado, tiposInstr: tiposMenc, anexos
  };
}

/* ---------- punto de entrada ---------- */
export async function analizarPlaneacion(nombre, buf, opts = {}) {
  const ext = String(nombre || "").toLowerCase().split(".").pop();
  let L;
  if (ext === "docx") L = await leerDocx(buf);
  else if (ext === "xlsx" || ext === "xls") L = await leerXlsx(buf);
  else if (ext === "pdf") L = await leerPdf(buf);
  else return { formato: ext, soportado: false, version: 3, generales: {}, porParcial: {}, texto: "", transversalidad: null, instrumentos: null };
  const acc = { 0: acumulador(), 1: acumulador(), 2: acumulador(), 3: acumulador() };
  (L.segmentos || L.matrices.map(M => ({ M, parcial: 0 }))).forEach(sg => desdeMatriz(sg.M, acc[sg.parcial || 0].push));
  const porGrupo = {}; L.items.forEach(it => (porGrupo[it.parcial || 0] = porGrupo[it.parcial || 0] || []).push(it));
  Object.entries(porGrupo).forEach(([p, arr]) => desdeLineas(arr, acc[p].push));
  const aCampos = v => Object.fromEntries(Object.entries(v).map(([k, arr]) => [k, arr.join(k === "estrategias" ? "; " : "\n\n").slice(0, 2500)]));
  let generales = aCampos(acc[0].v); const porParcial = {};
  [1, 2, 3].forEach(p => { const c = aCampos(acc[p].v); if (Object.keys(c).length) porParcial[p] = c; });
  (L.segmentos || []).forEach(sg => { const ev = evaluacionMatriz(sg.M); if (ev.length) { const d = sg.parcial ? (porParcial[sg.parcial] = porParcial[sg.parcial] || {}) : generales; d.evaluacion = [...(d.evaluacion || []), ...ev]; } });
  const T = L.plantilla;
  if (T && (Object.keys(T.porParcial).length || T.generales.proposito)) {   // PDF de la plantilla: la lectura por posición manda
    generales = { ...T.generales };                     // se descarta la lectura por renglones (mezcla columnas en PDF)
    [1, 2, 3].forEach(p => { delete porParcial[p]; if (T.porParcial[p]) porParcial[p] = { ...T.porParcial[p] }; });
  }
  const lineasTodas = L.texto.split("\n").filter(Boolean);
  const ins = instrumentos(L.items, L.matrices, lineasTodas);
  let anexos;
  if (L.seccion) {                                          // hay título “Instrumentos de evaluación”: todo lo que sigue es instrumento
    anexos = await instrumentosDeSeccion(L.seccion, { imagen: a => (a.path ? L.imagen(a.path) : L.imagen(a)), ocr: !!opts.ocr });
    (T?.anexosTrasInstr || []).slice().reverse().forEach(a => { if (!anexos.some(b => n(b.titulo) === n(a.titulo))) anexos.unshift({ fuente: "texto", ...a }); });
    anexos = anexos.filter(a => !(a.fuente === "texto" && anexos.some(b => b !== a && b.fuente !== "texto" && n(b.titulo) === n(a.titulo))));
  } else {
    const SECC = /^(evaluacion continua|diagnostico|datos generales|transversalidad|secuencia didactica|actividades de ensenanza|primer|segundo|tercer)/;
    anexos = [...(T?.anexos || [])];
    ins.anexos.forEach(a => { if (!SECC.test(n(a.titulo)) && !anexos.some(b => n(b.titulo) === n(a.titulo))) anexos.push(a); });
  }
  // datos generales del documento (sirven para asociar la planeación)
  const SEM = { primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5, sexto: 6 };
  const dd = { asignatura: generales.asignatura || "", docente: generales.docente || "", grupo: generales.grupo || "", semestre: generales.semestre || "" };
  const sem = SEM[n(dd.semestre).split(" ")[0]] || +(n(dd.semestre).match(/\d/) || [0])[0] || null;
  const g = String(dd.grupo).replace(/\D/g, "");
  dd.grupoNum = g.length === 3 ? g : (g && sem ? String(sem * 100 + +g) : "");
  ["asignatura", "docente", "grupo", "semestre", "semestreNum", "grupoNum"].forEach(k => delete generales[k]);
  return { formato: ext, soportado: true, version: 3, texto: L.texto.slice(0, 40000), generales, porParcial, datosDoc: dd,
    parciales: T?.parciales || Object.keys(porParcial).map(Number),
    transversalidad: (T?.transversalidad) || transversalidad(L.items, L.matrices),
    instrumentos: { anexos, menciones: ins.menciones, seccion: !!L.seccion, pendientesOcr: anexos.filter(a => a.pendienteOcr).length } };
}
