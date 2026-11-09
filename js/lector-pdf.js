/* =============================================================
   Lectura por posición de planeaciones en PDF
   (plantilla institucional “Planeación Didáctica Integral” y similares)
   Recibe los textos del PDF con su posición y reconstruye columnas:
   cada encabezado conoce su rango horizontal y se lee lo que está
   debajo hasta el siguiente apartado, aunque cambie de página.
   Módulo puro: no usa el navegador (se puede probar aparte).
   ============================================================= */
export const n = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const PAG = 2000;                       // separación vertical entre páginas para el eje global

/* Encabezados de la plantilla (texto completo del encabezado, aunque venga partido en líneas) */
export const HDR = {
  progresion: /^(propositos? formativos?( no\.? ?\d+)?|progresion(es)?( de aprendizaje)?( no\.? ?\d+)?|aprendizajes? de (la )?trayectoria)$/,
  contenidosF: /^contenidos? formativos?$/,
  temas: /^temas? ?(\/|y)? ?contenidos?$/,
  estrategias: /^(metodologias? activas? ?\/? ?estrategias? didacticas?( utilizadas)?|estrategias? didacticas?( utilizadas)?|metodologias? activas?)$/,
  meta: /^metas? (educativas?|de aprendizaje)$/,
  proposito: /^proposito( de (la sesion|aprendizaje|la secuencia))?$/,
  instrEval: /^instrumentos? de evaluacion$/,
  ponderacion: /^ponderacion$/,
  producto: /^(actividades ?\/? ?)?productos? de aprendizaje$/,
  aspectos: /^descripcion de los aspectos que se evaluaran$/,
  asignatura: /^asignatura ?\/? ?submodulo:?$/,
  docente: /^nombre del o la docente:?$/,
  grupo: /^grupo:?$/,
  semestre: /^semestre:?$/,
  criterios: /^(criterios?|indicador(es)?( observables?)?|aspectos?( a evaluar)?|rasgos?)$/,
  otros: /^(carrera:?|grado:?|ciclo escolar:?|horas ?\/? ?semana:?|numero de horas|periodo de ejecucion|recursos materiales, didacticos y digitales de apoyo|fecha|inicio|desarrollo|cierre|si|no)$/
};
const STOP = /^(periodo de( aplicacion:?)?$|actividades de ensenanza|evaluacion continua|(primer|segundo|tercer)o? parcial$|secuencia didactica|transversalidad curricular$|elaboro:?$|reviso:?$|autorizo:?$|anexos\.?$|diagnostico (del|de la|institucional)|datos generales$|total:?$|instrumentos de evaluacion:|categoria pmc|meta institucional)/;
const PARCIAL = /^(primer|segundo|tercer)o? parcial$/;
const NUM_PARCIAL = { primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3 };
const INST = [
  ["Lista de cotejo", /listas? de cotejo/], ["Rúbrica", /rubricas?/], ["Guía de observación", /guias? de observacion/],
  ["Escala estimativa o de valoración", /escalas? (estimativas?|de valoracion|de likert|likert|de rango|de apreciacion)/],
  ["Registro anecdótico", /registros? anecdoticos?/], ["Portafolio de evidencias", /portafolios?( de evidencias?)?/],
  ["Cuestionario o examen", /cuestionarios?|examen(es)?|pruebas? (objetivas?|escritas?)/], ["Diario o bitácora", /diarios? de (clase|campo|aprendizaje)|bitacoras?/]
];
export const tipoInst = t => (INST.find(([, re]) => re.test(n(t))) || [])[0] || "";

/* ---------- preparación ---------- */
function preparar(raw) {
  const its = raw.filter(i => String(i.s).trim()).map(i => ({ ...i, s: String(i.s).replace(/\s+/g, " ").trim(), gy: (i.p - 1) * PAG + i.y, x1: i.x + i.w, cx: i.x + i.w / 2 }));
  // encabezados/pies repetidos en varias páginas
  const cuenta = {}; its.forEach(i => { const k = n(i.s) + "@" + Math.round(i.y / 4); cuenta[k] = (cuenta[k] || new Set()).add(i.p); });
  const paginas = new Set(its.map(i => i.p)).size;
  return its.filter(i => !(paginas >= 3 && cuenta[n(i.s) + "@" + Math.round(i.y / 4)].size >= Math.max(3, paginas * 0.5)))
    .sort((a, b) => a.gy - b.gy || a.x - b.x);
}
const mismaLinea = (a, b) => a.p === b.p && Math.abs(a.y - b.y) < 2.2;

/* Une en una “línea” los textos de la misma altura (opcionalmente dentro de un rango x) */
function lineas(its) {
  const out = [];
  its.slice().sort((a, b) => a.gy - b.gy || a.x - b.x).forEach(i => {
    const l = out[out.length - 1];
    if (l && l.p === i.p && Math.abs(l.y - i.y) < 2.2) { l.items.push(i); l.x0 = Math.min(l.x0, i.x); l.x1 = Math.max(l.x1, i.x1); }
    else out.push({ p: i.p, y: i.y, gy: i.gy, x0: i.x, x1: i.x1, items: [i] });
  });
  out.forEach(l => { l.items.sort((a, b) => a.x - b.x); l.txt = l.items.map(i => i.s).join(" ").replace(/\s+/g, " ").trim(); });
  return out;
}
/* Agrupa líneas consecutivas en entradas (celdas) según el espacio vertical */
function entradas(ls, salto = 13.6) {
  const out = [];
  ls.forEach(l => {
    const e = out[out.length - 1];
    if (e && (l.gy - e.gyFin) <= salto && l.p === e.pFin) { e.txt += (/-$/.test(e.txt) ? "" : " ") + l.txt; e.gyFin = l.gy; e.lineas.push(l); }
    else if (e && l.p !== e.pFin && l.gy - e.gyFin < PAG && e.cortePagina !== false && (l.gy - (l.p - 1) * PAG) < 120 && /[,;a-z]$/.test(e.txt)) { e.txt += " " + l.txt; e.gyFin = l.gy; e.pFin = l.p; e.lineas.push(l); }   // celda que continúa en la página siguiente
    else out.push({ txt: l.txt, gyIni: l.gy, gyFin: l.gy, pFin: l.p, lineas: [l] });
  });
  return out.map(e => { let t = e.txt.replace(/\s+/g, " ").replace(/- (?=[a-záéíóúñ])/g, "").trim(); const m = t.match(/^(.{6,}) \1$/); if (m) t = m[1]; return { ...e, txt: t }; });
}

/* ---------- encabezados partidos en varias líneas ---------- */
function encabezados(its) {
  const out = [], fondo = {}, tope = {};
  its.forEach(i => { fondo[i.p] = Math.max(fondo[i.p] || 0, i.y); tope[i.p] = Math.min(tope[i.p] ?? 9999, i.y); });
  for (let i = 0; i < its.length; i++) {
    const a = its[i];
    let grupo = [a], txt = a.s, x0 = a.x, x1 = a.x1, y0 = a.y, y1 = a.y, best = null;
    const prueba = () => { const t = n(txt).replace(/\s*:\s*$/, ":"); for (const [k, re] of Object.entries(HDR)) if (re.test(t) || re.test(t.replace(/:$/, ""))) return k; return null; };
    const extiendeLinea = () => {                      // texto siguiente en la misma línea, pegado
      for (let guard = 0; guard < 4; guard++) {
        const sig = its.find(b => !grupo.includes(b) && b.p === a.p && Math.abs(b.y - y1) < 2.2 && b.x >= x1 - 2 && b.x - x1 < 16);
        if (!sig) return; grupo.push(sig); txt += " " + sig.s; x1 = Math.max(x1, sig.x1);
      }
    };
    extiendeLinea(); let k = prueba(); if (k) best = { k, txt, x0, x1, y0, y1, grupo: [...grupo], pFin: a.p, gyFin: a.gy };
    for (let paso = 0; paso < 6; paso++) {             // líneas apiladas debajo, centradas
      const c = (x0 + x1) / 2;
      const pAct = grupo[grupo.length - 1].p;
      const cerca = b => !grupo.includes(b) && Math.abs(b.cx - c) < 45 && !(b.x > x1 + 30 || b.x1 < x0 - 30);
      let deb = its.filter(b => cerca(b) && b.p === pAct && b.y > y1 + 4 && b.y <= y1 + 16.5);
      if (!deb.length && y1 > (fondo[pAct] || 9999) - 45)                 // el encabezado sigue en la página siguiente
        deb = its.filter(b => cerca(b) && b.p === pAct + 1 && b.y < (tope[pAct + 1] || 0) + 14);
      if (!deb.length) break;
      deb.sort((p, q) => p.x - q.x);
      const lineaY = deb[0].y; deb.filter(b => Math.abs(b.y - lineaY) < 2.2).forEach(b => { grupo.push(b); txt += " " + b.s; x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x1); });
      y1 = lineaY;
      k = prueba(); if (k) { const ult = grupo[grupo.length - 1]; best = { k, txt, x0, x1, y0, y1, grupo: [...grupo], pFin: ult.p, gyFin: ult.gy }; }
      if (n(txt).length > 80) break;
    }
    if (best) out.push({ ...best, p: a.p, gy0: a.gy, gy1: best.gyFin });
  }
  // quitar duplicados contenidos en otro encabezado más completo
  return out.filter((h, i) => !out.some((o, j) => j !== i && o.p === h.p && o.grupo.length > h.grupo.length && h.grupo.every(g => o.grupo.includes(g))))
    .filter((h, i, arr) => arr.findIndex(o => o.p === h.p && o.gy0 === h.gy0 && o.x0 === h.x0) === i);
}

/* ---------- límites de columna a partir de la fila de encabezados ---------- */
function rangoColumna(its, H) {
  const cruza = H.pFin && H.pFin !== H.p;              // encabezado que continúa en la página siguiente
  const enBanda = b => cruza ? ((b.p === H.p && b.y >= H.y0 - 6) || (b.p === H.pFin && b.y <= H.y1 + 6)) : (b.p === H.p && b.y >= H.y0 - 6 && b.y <= H.y1 + 6);
  const banda = its.filter(b => enBanda(b) && !H.grupo.includes(b) && !(b.x < H.x1 - 1 && b.x1 > H.x0 + 1));
  const pB = H.pFin || H.p;
  const bajo = its.filter(b => b.p === pB && b.y > H.y1 + 6 && b.y <= H.y1 + 15 && HDR.otros.test(n(b.s)) && !(b.x < H.x1 - 1 && b.x1 > H.x0 + 1));
  banda.push(...bajo);
  const izq = banda.filter(b => b.x1 <= H.x0 + 1).reduce((m, b) => Math.max(m, b.x1), -Infinity);
  const der = banda.filter(b => b.x >= H.x1 - 1).reduce((m, b) => Math.min(m, b.x), Infinity);
  return { L: izq === -Infinity ? 0 : (izq + H.x0) / 2, R: der === Infinity ? 99999 : (H.x1 + der) / 2 };
}
/* Ajusta los límites buscando el espacio en blanco vertical real entre columnas */
function refinar(its, H, L, R, gyIni, gyFin) {
  const zona = its.filter(b => b.gy > gyIni && b.gy < gyFin && !H.grupo.includes(b));
  const hueco = (a, b, objetivo) => {
    if (!(b > a)) return null;
    const iv = zona.filter(i => i.x1 > a && i.x < b).map(i => [Math.max(a, i.x), Math.min(b, i.x1)]).sort((p, q) => p[0] - q[0]);
    const gaps = []; let cur = a;
    iv.forEach(([s0, e]) => { if (s0 > cur + 2.5) gaps.push([cur, s0]); cur = Math.max(cur, e); });
    if (b > cur + 2.5) gaps.push([cur, b]);
    if (!gaps.length) return null;
    gaps.sort((g1, g2) => Math.abs((g1[0] + g1[1]) / 2 - objetivo) - Math.abs((g2[0] + g2[1]) / 2 - objetivo));
    return (gaps[0][0] + gaps[0][1]) / 2;
  };
  const anchoPag = Math.max(...its.map(i => i.x1)) + 20;
  const l2 = hueco(Math.max(0, (L || 0) - 40), H.x0 + 8, H.x0);
  const r2 = hueco(H.x1 - 8, Math.min(R, anchoPag) + 40, H.x1);
  return { L: l2 ?? L, R: r2 ?? R };
}
function finDeSeccion(its, desde, hasta = Infinity) {
  const s = its.find(b => b.gy > desde && b.gy < hasta && STOP.test(n(b.s)));
  return s ? s.gy - 1 : Math.min(hasta, desde + 1600);
}
const RUIDO = /^[-\d\s]*(primera|segunda|tercera|evaluaci.n|parcial)[-\d\s]*$/;
function columna(its, H, hasta) {
  const fin = Math.min(hasta ?? Infinity, finDeSeccion(its, H.gy1 + 2));
  const r0 = rangoColumna(its, H); const { L, R } = refinar(its, H, r0.L, r0.R, H.gy1 + 2, fin);
  const vals = its.filter(b => b.gy > H.gy1 + 2 && b.gy < fin && b.cx >= L && b.cx <= R && !H.grupo.includes(b) && !RUIDO.test(n(b.s)));
  return { L, R, fin, lineas: lineas(vals) };
}
/* valor a la derecha de una etiqueta (Datos generales, Meta educativa) */
function fila(its, H, todos) {
  const der = todos.filter(o => o !== H && o.p === H.p && o.x0 > H.x1 && o.gy1 >= H.gy0 - 10 && o.gy0 <= H.gy1 + 10).reduce((m, o) => Math.min(m, o.x0), Infinity);
  const vals = its.filter(b => b.p === H.p && b.x > H.x1 + 2 && b.x1 < der + 2 && b.y >= H.y0 - 10.5 && b.y <= H.y1 + 10.5 && !H.grupo.includes(b));
  return lineas(vals).map(l => l.txt).join(" ").replace(/\s+/g, " ").trim();
}

/* ---------- tabla de evaluación continua ---------- */
function evaluacion(its, hdrs, Hi) {
  const banda = hdrs.filter(h => h.p === Hi.p && Math.abs(h.gy0 - Hi.gy0) < 22);
  const col = k => banda.find(h => h.k === k);
  const Hp = col("producto"), Ha = col("aspectos"), Hw = col("ponderacion");
  const fin = (() => { const s = its.find(b => b.gy > Hi.gy1 + 2 && (/^total:?$/.test(n(b.s)) || PARCIAL.test(n(b.s)) || /^transversalidad curricular|^elaboro/.test(n(b.s)))); return s ? s.gy - 3 : Hi.gy1 + 900; })();
  const lee = H => H ? (() => { const r0 = rangoColumna(its, H); const { L, R } = refinar(its, H, r0.L, r0.R, H.gy1 + 2, fin); return lineas(its.filter(b => b.gy > H.gy1 + 2 && b.gy < fin && b.cx >= L && b.cx <= R && !RUIDO.test(n(b.s)))); })() : [];
  const inst = [];                                   // una fila por cada instrumento nombrado
  lee(Hi).forEach(l => { const prev = inst[inst.length - 1]; const tipo = tipoInst(l.txt);
    if (prev && (!tipo || !prev.tipo) && l.gy - prev.gyFin < 12.5 && l.p === prev.p) { prev.txt += " " + l.txt; prev.gyFin = l.gy; prev.tipo = prev.tipo || tipo; }
    else inst.push({ txt: l.txt, gyIni: l.gy, gyFin: l.gy, p: l.p, tipo }); });
  if (!inst.length) return [];
  const filas = inst.map(e => ({ instrumento: e.txt, gy: (e.gyIni + e.gyFin) / 2, producto: [], aspectos: [], ponderacion: [] }));
  const asigna = (ls, k) => ls.forEach(l => { let m = filas[0]; filas.forEach(f => { if (Math.abs(f.gy - l.gy) < Math.abs(m.gy - l.gy)) m = f; }); if (Math.abs(m.gy - l.gy) < 40) m[k].push(l.txt); });
  asigna(lee(Hp), "producto"); asigna(lee(Ha), "aspectos"); asigna(lee(Hw), "ponderacion");
  return filas.map(f => ({ producto: f.producto.join(" "), aspectos: f.aspectos.join(" "), instrumento: f.instrumento, ponderacion: f.ponderacion.join(" "), tipo: tipoInst(f.instrumento) }));
}

/* ---------- tabla de transversalidad ---------- */
const PAL_ENC = /(asignatura|submodulo|proyecto|prioritari|vinculad|institucional|tema|objetivo|proposito|meta|vinculacion|actividad|estrategia|etc|producto|aprendizaje|evidencia|comun|\(|\?|¿|\/|,|y\/o)/;
function transversalidad(its, Ht) {
  const fin = (() => { const s = its.find(b => b.gy > Ht.gy1 + 2 && /^(elaboro|revis|autoriz|anexos|nombre y firma)/.test(n(b.s))); return s ? s.gy - 1 : Ht.gy1 + 1200; })();
  const zona = its.filter(b => b.gy > Ht.gy1 + 1 && b.gy < fin);
  const ls = lineas(zona);
  const enc = []; let iVal = 0;
  for (; iVal < ls.length && iVal < 8; iVal++) { const l = ls[iVal]; if (l.items.every(i => PAL_ENC.test(n(i.s)) || n(i.s).length < 4)) enc.push(...l.items); else break; }
  if (!enc.length) return null;
  // columnas: agrupar encabezados que se traslapan horizontalmente
  const cols = [];
  enc.slice().sort((a, b) => a.x - b.x).forEach(i => { const c = cols.find(c => i.x < c.x1 + 6 && i.x1 > c.x0 - 6); if (c) { c.x0 = Math.min(c.x0, i.x); c.x1 = Math.max(c.x1, i.x1); c.items.push(i); } else cols.push({ x0: i.x, x1: i.x1, items: [i] }); });
  cols.sort((a, b) => a.x0 - b.x0);
  const headers = cols.map(c => lineas(c.items).map(l => l.txt).join(" ").replace(/\s+/g, " ").trim());
  const lim = cols.map((c, i) => ({ L: i === 0 ? 0 : (cols[i - 1].x1 + c.x0) / 2, R: i === cols.length - 1 ? 99999 : (c.x1 + cols[i + 1].x0) / 2 }));
  const vals = zona.filter(b => !enc.includes(b));
  const enCol = (b, i) => b.cx >= lim[i].L && b.cx < lim[i].R;
  // filas: según las entradas de la primera columna
  const primeras = entradas(lineas(vals.filter(b => enCol(b, 0))), 12.5);
  if (!primeras.length) return { headers, filas: [] };
  const cortes = primeras.map((e, i) => i === 0 ? -Infinity : (primeras[i - 1].gyFin + e.gyIni) / 2);
  const filas = primeras.map((e, r) => ({ celdas: cols.map((c, ci) => {
    const lo = cortes[r], hi = r + 1 < cortes.length ? cortes[r + 1] : Infinity;
    return lineas(vals.filter(b => enCol(b, ci) && b.gy >= lo && b.gy < hi)).map(l => l.txt).join(" ").replace(/\s+/g, " ").replace(/- (?=[a-záéíóúñ])/g, "").trim();
  }) })).filter(f => f.celdas.some(Boolean));
  return { headers, filas };
}

/* ---------- instrumentos desarrollados (anexos) ---------- */
function anexos(its, hdrs) {
  const ls = lineas(its);
  const INI = /^(\d+[.)]?\s*)?(instrumento\s*\d*[.:]?\s*)?(listas? de cotejo|rubricas?( analiticas?| holisticas?)?|guias? de observacion|escalas? (estimativas?|de valoracion|de likert|likert|de rango|de apreciacion)|registros? anecdoticos?|portafolios?( de evidencias?)?|cuestionarios?|examen(es)?|diarios? de (clase|campo|aprendizaje)|bitacoras?)\b/;
  const titulos = ls.filter(l => { const t = n(l.txt);
    return INI.test(t) && t.length >= 18 && t.length < 160 && !/%/.test(t) && (l.txt === l.txt.toUpperCase() || /\bpara\b|\bde (la|el|los|las)\b|:/.test(t)); });
  return titulos.map((T, i) => {
    const hasta = i + 1 < titulos.length ? titulos[i + 1].gy - 1 : T.gy + 1400;
    const Hc = hdrs.find(h => h.k === "criterios" && h.gy0 > T.gy && h.gy0 < hasta);
    let criterios = [];
    if (Hc) {
      const fin = Math.min(hasta, finDeSeccion(its, Hc.gy1 + 2, hasta));
      const r0 = rangoColumna(its, Hc); const { L, R } = refinar(its, Hc, r0.L, r0.R, Hc.gy1 + 2, fin);
      criterios = entradas(lineas(its.filter(b => b.gy > Hc.gy1 + 2 && b.gy < fin && b.cx >= L && b.cx <= R)), 14.2)
        .map(e => e.txt.replace(/^\d+[.)]?\s*/, "").trim()).filter(t => t.length > 3 && !/^\(?\d\)?$/.test(t) && !/^(total|retroalimentacion|calificacion)/.test(n(t))).slice(0, 12);
    }
    const t = T.txt.replace(/^\d+[.)]\s*/, "").trim();
    const m = t.match(/\bpara\s+(?:evaluar\s+|valorar\s+|calificar\s+|revisar\s+)?(.+)$/i);
    return { tipo: tipoInst(t), titulo: t.slice(0, 160), evalua: m ? m[1].replace(/^(el|la|los|las)\s+/i, "").slice(0, 160) : "", criterios, filas: criterios.length, gy: T.gy };
  });
}

/* ---------- lectura completa ---------- */
export function leerPlantillaPdf(raw) {
  const its = preparar(raw);
  const hdrs = encabezados(its);
  // parciales
  const marcas = its.filter(i => PARCIAL.test(n(i.s))).map(i => ({ n: NUM_PARCIAL[n(i.s).split(" ")[0]], gy: i.gy })).sort((a, b) => a.gy - b.gy);
  const parcialDe = gy => { let p = 0; marcas.forEach(m => { if (gy >= m.gy - 30) p = m.n; }); return p; };
  const generales = {}, porParcial = {};
  const add = (p, k, v) => { v = String(v || "").trim(); if (v.length < 2) return; const d = p ? (porParcial[p] = porParcial[p] || {}) : generales; d[k] = d[k] ? (n(d[k]).includes(n(v)) ? d[k] : d[k] + "\n" + v) : v; };
  const vistos = new Set();
  hdrs.forEach(H => {
    const p = parcialDe(H.gy0);
    if (["asignatura", "docente", "grupo", "semestre", "meta"].includes(H.k)) {
      const v = fila(its, H, hdrs); if (!v) return;
      if (H.k === "meta") add(p, "proposito", v); else if (!generales[H.k]) generales[H.k] = v;
      return;
    }
    const mapa = { progresion: "progresion", contenidosF: "contenidos", temas: "contenidos", estrategias: "estrategias", proposito: "proposito" };
    if (mapa[H.k]) {
      const c = columna(its, H);
      const es = entradas(c.lineas).map(e => e.txt).filter(t => t.length > 2);
      const unicos = []; es.forEach(t => { const k = n(t); if (!unicos.some(u => n(u) === k)) unicos.push(t); });
      if (!unicos.length) return;
      const destino = H.k === "temas" ? 0 : p;           // “Temas / Contenidos” es el curso de inducción (general)
      add(destino, mapa[H.k], unicos.join(H.k === "estrategias" ? "; " : "\n"));
    }
    if (H.k === "instrEval" && hdrs.some(o => o.k === "ponderacion" && o.p === H.p && Math.abs(o.gy0 - H.gy0) < 22)) {
      const key = H.p + ":" + Math.round(H.gy0); if (vistos.has(key)) return; vistos.add(key);
      const filas = evaluacion(its, hdrs, H);
      if (filas.length) { const d = p ? (porParcial[p] = porParcial[p] || {}) : generales; d.evaluacion = [...(d.evaluacion || []), ...filas]; }
    }
  });
  // Grupo “1” + semestre “Tercero” → 301
  const SEM = { primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5, sexto: 6 };
  if (generales.semestre) { const s = SEM[n(generales.semestre).split(" ")[0]] || +n(generales.semestre).replace(/\D/g, "") || null; if (s) generales.semestreNum = s; }
  if (generales.grupo) { const g = generales.grupo.replace(/\D/g, ""); generales.grupoNum = g.length === 3 ? g : (g && generales.semestreNum ? String(generales.semestreNum * 100 + +g) : ""); }
  // título “Instrumentos de evaluación” (no el encabezado de la tabla de evaluación continua)
  const instrHead = its.find(i => /^(anexos?:? )?instrumentos? de evaluacion( utilizados)?:?$/.test(n(i.s)) && !hdrs.some(h => h.k === "ponderacion" && h.p === i.p && Math.abs(h.gy0 - i.gy) < 25));
  const textoTrasInstr = instrHead ? lineas(its.filter(i => i.gy > instrHead.gy + 1)).map(l => l.txt) : [];
  const Ht = its.find(i => /^transversalidad curricular$/.test(n(i.s)));
  const tv = Ht ? transversalidad(its, { ...Ht, gy1: Ht.gy }) : null;
  const todos = anexos(its, hdrs);
  return { generales, porParcial, transversalidad: tv && (tv.filas.length ? tv : null), anexos: todos,
    instrHead: instrHead ? { p: instrHead.p, y: instrHead.y, gy: instrHead.gy } : null, textoTrasInstr,
    anexosTrasInstr: instrHead ? todos.filter(a => a.gy > instrHead.gy) : [], parciales: marcas.map(m => m.n), texto: lineas(its).map(l => l.txt).join("\n") };
}
export const _interno = { preparar, encabezados, columna, rangoColumna, refinar, finDeSeccion };
