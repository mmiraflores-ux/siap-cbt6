/* =============================================================
   Lector de planeaciones (Word .docx, Excel .xlsx y PDF)
   Identifica los apartados por su NOMBRE dentro del documento,
   sin importar si el dato está a la derecha, debajo o en párrafo.
   Solo devuelve lo que realmente aparece en el archivo.
   ============================================================= */
const LIBS = {
  jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
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
    re: /^(metas? (de )?aprendizaje|propositos?( (de|del) (la |el )?(sesion|aprendizaje|secuencia|parcial|clase|bloque|submodulo|modulo|curso))?$|objetivos?( (de|del) (la |el )?(aprendizaje|sesion|clase|secuencia|parcial))?$|aprendizajes? esperados?)/ },
  { k: "contenidos", t: "Temas / contenidos",
    re: /^(temas?\s*(\/|y|o|-|,)?\s*contenidos?|contenidos?\s*(\/|y|o|-|,)?\s*temas?|contenidos?( (formativos?|especificos?|centrales?|tematicos?|conceptuales?|a desarrollar))?$|temas?( (centrales?|generales?|a desarrollar|y subtemas))?$|temario)/ },
  { k: "estrategias", t: "Metodologías activas / estrategias didácticas",
    re: /^(metodologias? activas?|metodologias?( de (ensenanza|aprendizaje))?$|estrategias? (didacticas?|de ensenanza|de aprendizaje|metodologicas?)|estrategias? utilizadas|tecnicas? didacticas?)/ },
  { k: "instrumentos", t: "Instrumentos de evaluación",
    re: /^(instrumentos?( (de|para la) evaluacion)?$|tecnicas? e instrumentos|evaluacion( (formativa|sumativa|diagnostica))?$|instrumentos? de evaluacion)/ }
];
const TRANSV = /^transversalidad/;
const OTROS = /^(actividades?|apertura|inicio|desarrollo|cierre|recursos?|materiales?|productos?( esperados?)?|evidencias?|bibliografia|referencias|fecha|docente|nombre|grupo|semestre|sesion(es)?|duracion|tiempo|competencias?|habilidades|campo|uac|asignatura|submodulo|modulo|parcial|plantel|ciclo|categorias?|subcategorias?|ambitos?|recursos sociocognitivos|areas? de conocimiento|observaciones|firma|vo\.? ?bo|elaboro|reviso|ponderacion|criterios?( de evaluacion)?|valor|puntaje|horas|no\.?|num)\b/;

function etiqueta(txt) {
  const raw = String(txt || "").trim(); if (!raw) return null;
  const i = raw.indexOf(":");
  if (i > 0 && i < 70) {
    const antes = limpiaPref(n(raw.slice(0, i)));
    for (const c of CAMPOS) if (c.re.test(antes)) return { k: c.k, resto: raw.slice(i + 1).trim() };
    if (TRANSV.test(antes)) return { k: "transversalidad", resto: raw.slice(i + 1).trim() };
  }
  const t = limpiaPref(n(raw)).replace(/[:.]+$/, "").trim();
  if (t.length > 75) return null;           // un valor largo nunca se confunde con un encabezado
  for (const c of CAMPOS) if (c.re.test(t)) return { k: c.k, resto: "" };
  if (TRANSV.test(t)) return { k: "transversalidad", resto: "" };
  if (t.length < 40 && OTROS.test(t)) return { k: "_otro", resto: "" };
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
  const items = [], lineas = []; let previo = "";
  hijos(body).forEach(el => {
    if (el.localName === "tbl") {
      const M = matrizDocx(el); items.push({ tabla: true, M, previo }); previo = "";
      M.forEach(row => { const l = distintas(row).map(x => x.txt.replace(/\n/g, " ")).filter(Boolean).join(" | "); if (l) lineas.push(l); });
    } else if (el.localName === "p") {
      textoP(el).split("\n").filter(Boolean).forEach(l => { items.push({ txt: l }); lineas.push(l); previo = (previo + "\n" + l).slice(-300); });
    }
  });
  const matrices = [...doc.getElementsByTagName("*")].filter(e => e.localName === "tbl").map(matrizDocx);
  return { items, matrices, texto: lineas.join("\n") };
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
  const lineas = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 40); p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const filas = new Map();
    tc.items.forEach(it => { if (!it.str.trim()) return; const y = Math.round(it.transform[5] / 3); (filas.get(y) || filas.set(y, []).get(y)).push(it); });
    [...filas.keys()].sort((a, b) => b - a).forEach(y => lineas.push(filas.get(y).sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(" ").replace(/\s+/g, " ").trim()));
  }
  return { items: lineas.map(txt => ({ txt })), matrices: [], texto: lineas.join("\n") };
}

/* ---------- punto de entrada ---------- */
export async function analizarPlaneacion(nombre, buf) {
  const ext = String(nombre || "").toLowerCase().split(".").pop();
  let L;
  if (ext === "docx") L = await leerDocx(buf);
  else if (ext === "xlsx" || ext === "xls") L = await leerXlsx(buf);
  else if (ext === "pdf") L = await leerPdf(buf);
  else return { formato: ext, soportado: false, campos: {}, texto: "", transversalidad: null, instrumentos: null };
  const { v, push } = acumulador();
  L.matrices.forEach(M => desdeMatriz(M, push));
  desdeLineas(L.items, push);
  const campos = {};
  Object.entries(v).forEach(([k, arr]) => { if (k !== "instrumentos") campos[k] = arr.join("\n\n").slice(0, 2500); });
  const lineasTodas = L.texto.split("\n").filter(Boolean);
  const ins = instrumentos(L.items, L.matrices, lineasTodas);
  const declarado = (v.instrumentos || []).join("\n");
  campos.instrumentos = [resumenInstrumentos(ins), declarado ? "Indicado en la planeación:\n" + declarado : ""].filter(Boolean).join("\n\n").slice(0, 2500);
  if (ins.estado === "No identificado" && declarado) ins.estado = "Solo mencionado";
  return { formato: ext, soportado: true, campos, texto: L.texto.slice(0, 40000), transversalidad: transversalidad(L.items, L.matrices), instrumentos: ins };
}
