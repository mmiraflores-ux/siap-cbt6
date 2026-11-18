/* =============================================================
   Formato PAEC institucional (CBT No. 6 · ciclo 2026-2027)
   - Integra el documento PAEC_CBT6_2026_2027_REV
   - Llena "El abordaje de las UAC" y el "Plan operativo del PEC"
     SOLO con lo que viene en las planeaciones (tabla Transversalidad
     curricular, progresión y estrategias de la UAC).
   - Lo que no está en las planeaciones NO se inventa: se marca como
     faltante y se solicita al docente en la Retroalimentación de
     Subdirección (colección retro_planeacion).
   ============================================================= */
import { S, L, VIEWS, ACT, A, UC, P, pname, esc, chip, opt, short, today, nowISO, fdate, me, isStaff, isVinc, save, newId, toast, modal, notify, audit, byId, CFG } from "./core.js";
import { camposPlan } from "./views-plan.js";
import { planVigente } from "./tablero.js";

const n = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();

/* ---------- contenido tomado del documento PAEC (sin agregar nada) ---------- */
export const PAEC_DOC = {
  formato: "PAEC-2026-2027",
  nombre: "Feria de Pabellones Digitales a través de Redes Sociales",
  proyectoGeneral: "PROYECTA-T: De la Emoción al Emprendimiento Digital",
  periodo: "Ciclo escolar 2026-2027",
  cct: "15ECT0151O",
  problematica: "El Bienestar Emocional Afectivo, seguido de Responsabilidad Social; Cuidado Físico Corporal funciona como pilar transversal de apoyo contra la persistencia de conductas violentas y relaciones tóxicas, derivadas de la falta de regulación emocional, las cuales limitan el bienestar personal y el desarrollo de un proyecto de vida con impacto social positivo. Los altos niveles de estrés y desorientación en el ingreso al nivel medio superior (1.º año); visibilizarían de patrones de violencia o codependencia en el noviazgo y relaciones de pares (2.º año); y una marcada incertidumbre sobre el futuro profesional con falta de visión vocacional estructurada (3.er año).",
  proposito: "Formar técnicos en informática con sentido humano y social mediante el desarrollo de proyectos transversales que articulen la salud socioemocional, la conciencia comunitaria y la innovación tecnológica, alineados a la Nueva Escuela Mexicana para transformar el entorno de Cacalomacán y construir proyectos de vida sólidos.",
  objetivoGeneral: "Desarrollar e implementar el proyecto transversal \"PROYECTA-T: De la Emoción al Emprendimiento Digital\" durante el ciclo escolar 2026–2027 con la participación coordinada de los 23 docentes del plantel, integrando las habilidades socioemocionales de cada grado con las competencias de la carrera de Técnico en Informática, culminando en mayo de 2027 con el lanzamiento de la Feria Digital PyME.",
  porGrado: {
    1: { semestre: 1, ambito: "Inteligencia emocional y autoconocimiento (Identificación, expresión y autorregulación emocional para el clima escolar)", proyecto: "La eliminación de la violencia a través de las habilidades socioemocionales del estudiantado", objetivo: "Diseñar plataformas y herramientas digitales interactivas para el autoconocimiento, la autorregulación y el manejo del estrés, articulando el Módulo I de Informática con los recursos sociocognitivos de salud mental.", diseno: "Inteligencia Socioemocional: desarrolla competencias de autoconocimiento, autorregulación y gestión del estrés. Se vincula con el Módulo I de Informática para crear herramientas digitales interactivas orientadas a la salud mental y el bienestar personal." },
    2: { semestre: 3, ambito: "Práctica y colaboración ciudadana, Educación para la salud/afectividad", proyecto: "Conexiones que suman: el camino a vivir una amistad o noviazgo sin violencia", objetivo: "Desarrollar aplicaciones web y directorios comunitarios orientados a la prevención de la violencia en el noviazgo y la promoción de relaciones de amistad sanas, mapeando redes de apoyo locales en Cacalomacán.", diseno: "Relación con los Demás: promueve la convivencia armónica, la prevención de la violencia en el noviazgo y el fortalecimiento de la amistad. Se articula con los Módulos II y III (Desarrollo Web y Móvil) para maquetar aplicaciones y directorios de red de apoyo comunitario." },
    3: { semestre: 5, ambito: "Autoconocimiento, intereses, habilidades, valores y expectativas", proyecto: "Mi proyecto de vida: construyo mi futuro y transformo mi comunidad", objetivo: "Estructurar e integrar plataformas de comercio electrónico (E-Commerce) funcionales para PyMEs locales y proyectos de emprendimiento escolar, consolidando la elección vocacional y la inserción laboral o universitaria de los egresados.", diseno: "Proyecto de Vida y Elección Vocacional: fomenta la toma de decisiones profesionales, la orientación vocacional y la visión de futuro. Se integra con el Módulo IV (Soluciones de Comercio Electrónico y Gestión de Proyectos) mediante la creación de PyMEs digitales con tiendas en línea (E-Commerce) completamente funcionales." }
  },
  etapas: ["Investigación y recolección de datos", "Difusión y concientización", "Desarrollo e implementación", "Monitoreo y evaluación"],
  // Plan operativo del PEC: cada bloque de semestre trae su etapa
  etapaPorSemestre: { 1: "Etapa 1. Investigación y recolección de datos", 3: "Etapa 2. Desarrollo e implementación", 5: "Etapa 3. Monitoreo y evaluación" },
  inconsistencias: [
    "Nombre del proyecto: la portada dice “Feria de Pabellones Digitales a través de Redes Sociales”, la pág. 17 “Feria Digital de pabellones en Redes Sociales” y el objetivo general “PROYECTA-T: De la Emoción al Emprendimiento Digital … Feria Digital PyME”.",
    "Número de docentes: la pág. 18 habla de 27 docentes y el objetivo general de 23.",
    "Etapas: en “Actividades” hay 4 etapas (Investigación; Difusión y concientización; Desarrollo e implementación; Monitoreo y evaluación), pero el Plan operativo usa 3 y las numera distinto (Etapa 2 = Desarrollo e implementación; Etapa 3 = Monitoreo y evaluación). No aparece “Difusión y concientización”.",
    "Las cuatro etapas de “Actividades” no tienen descripción.",
    "La portada tiene fecha “Septiembre de 2027” para el ciclo 2026-2027.",
    "Los indicadores del plantel (aprobación, aprovechamiento, deserción) citan metas del ciclo 2025-2026.",
    "Primer año se vincula con el “Módulo I de Informática”, que corresponde a 2.º semestre; en 1.º semestre el currículum laboral solo tiene Perspectivas Académico Laborales.",
    "La nota del Diseño general dice que el ejemplo tiene dos columnas de semestre, pero la tabla tiene tres (1.º, 3.º y 5.º)."
  ]
};

/* ---------- identificar UAC del catálogo dentro de un texto ---------- */
const VACIAS = new Set("de del la las los el y e en con para por a al su sus una un uno lo que o u i ii iii iv v vi temas selectos".split(" "));
const raiz = w => w.slice(0, 5);
function claves(u) {
  const base = n(String(u.nombre || "").split(/[.:]/)[0]).split(" ").filter(w => w.length >= 4 && !VACIAS.has(w)).map(raiz);
  return [...new Set(base)];
}
export function uacEnTexto(texto, semestre) {
  const t = n(texto); if (!t) return [];
  const pal = new Set(t.split(" ").filter(w => w.length >= 4).map(raiz));
  const ab = ` ${t} `;
  return L("unidades").filter(u => u.semestre === semestre && u.activo !== false).map(u => {
    const ks = claves(u), hit = ks.filter(k => pal.has(k)).length;
    const abrev = n(u.abrev).replace(/\b(i|ii|iii|iv|v|sub)\b/g, "").trim();
    const porAbrev = abrev.length >= 3 && ab.includes(` ${abrev} `);
    return { u, ok: porAbrev || (ks.length && hit >= Math.min(2, ks.length)), score: hit + (porAbrev ? 3 : 0) };
  }).filter(x => x.ok).sort((a, b) => b.score - a.score).map(x => x.u);
}

/* ---------- columnas de la tabla de transversalidad ---------- */
const rolCol = h => { const t = n(h);
  return /\b(uac|asignaturas?|submodulos?|modulos?|materias?|disciplinas?|campos?|areas?)\b/.test(t) ? "vinculo"
    : /\b(actividad(es)?|accion(es)?|estrategias?|como se dara|descripcion)\b/.test(t) ? "actividad"
    : /\b(productos?|evidencias?|entregables?)\b/.test(t) ? "producto"
    : /\b(temas?|objetivos?|propositos?|metas?)\b/.test(t) ? "tema" : /\b(semanas?|fechas?|periodo|cuando)\b/.test(t) ? "semana" : "otro"; };
const ETAPA_TXT = [[/etapa\s*1\b|investigacion y recoleccion/, 1], [/etapa\s*2\b|difusion|concientizacion/, 2], [/etapa\s*3\b|desarrollo e implementacion/, 3], [/etapa\s*4\b|monitoreo|evaluacion del proyecto/, 4]];

/* respuestas de los docentes a lo solicitado (clave → texto) */
function respuestas() {
  const r = {};
  L("retro_planeacion").filter(x => x.origen === "PAEC").forEach(x => Object.entries(x.respuestas || {}).forEach(([k, v]) => { if (String(v || "").trim()) r[k] = { v: String(v).trim(), por: x.docenteId, fecha: x.respondido }; }));
  return r;
}
const hash = t => { let h = 5381; for (const ch of n(t)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h.toString(36); };
/* clave estable de una actividad: grupo | UAC | parcial | actividad */
const kDecl = d => `${d.grupo}|${d.ucId || hash(d.vinculoTxt)}|${d.parcial}${d.actividad ? "|" + hash(d.actividad) : ""}`;

/* ---------- arma el formato a partir de las planeaciones ---------- */
export function formatoPAEC(q = {}) {
  const sems = [1, 3, 5];
  const grupos = L("grupos").filter(g => sems.includes(g.semestre));
  const semDe = g => grupos.find(x => x.id === g)?.semestre;
  const pls = L("planeaciones").filter(p => p.estado !== "Sustituida" && p.asignacionId && semDe(p.grupo) && (!q.parcial || p.parcial == q.parcial))
    .filter(p => planVigente(p.asignacionId, p.parcial)?.id === p.id);
  const resp = respuestas();
  const decl = new Map();
  pls.forEach(p => {
    const t = p.transversalidad; if (!t) return;
    const roles = (t.headers || []).map(rolCol), sem = semDe(p.grupo);
    const filas = t.filas?.length ? t.filas : t.texto ? [{ celdas: [t.texto] }] : [];
    filas.forEach(f => {
      const v = { vinculo: [], actividad: [], producto: [], tema: [], semana: [], otro: [] };
      (f.celdas || []).forEach((c, i) => { if (String(c || "").trim()) v[roles[i] || (t.filas?.length ? "otro" : "actividad")].push(String(c).trim()); });
      const vinculoTxt = v.vinculo.join(" ");
      let ucs = vinculoTxt ? uacEnTexto(vinculoTxt, sem) : [UC(p.unidadId)].filter(Boolean);
      const sinIdent = vinculoTxt && !ucs.length;
      if (sinIdent) ucs = [null];
      const actividad = v.actividad.join(" "), producto = v.producto.join(" "), tema = v.tema.join(" ");
      const et = ETAPA_TXT.find(([re]) => re.test(n([actividad, tema, v.otro.join(" ")].join(" "))));
      ucs.forEach(u => {
        const asg = u ? L("asignaciones").find(a => a.grupo === p.grupo && a.unidadId === u.id && a.estado !== "Cerrada") : null;
        const d = { grupo: p.grupo, semestre: sem, parcial: +p.parcial, ucId: u?.id || "", asgId: asg?.id || "", docenteId: asg?.docenteId || "", vinculoTxt: sinIdent ? vinculoTxt : "",
          actividad, producto, tema, semana: v.semana.join(" "), etapaNum: et ? et[1] : null, declaradaPor: [p.docenteId], planes: [p.id] };
        const k = kDecl(d);
        const prev = decl.get(k);
        if (prev) { if (!prev.declaradaPor.includes(p.docenteId)) prev.declaradaPor.push(p.docenteId); prev.planes.push(p.id); }
        else decl.set(k, d);
      });
    });
  });
  // UAC de 1.º, 3.º y 5.º sin actividad transversal identificada
  const conAct = new Set([...decl.values()].map(d => d.asgId).filter(Boolean));
  const sinAct = L("asignaciones").filter(a => a.estado !== "Cerrada" && semDe(a.grupo) && !conAct.has(a.id) && (!q.grupo || a.grupo === q.grupo)).map(a => {
    const conPlan = [1, 2, 3].filter(p => planVigente(a.id, p)).length;
    return { a, conPlan, respuesta: resp[`${a.grupo}|${a.unidadId}|0|actividad`]?.v || "" };
  });
  // lo que el docente respondió para una UAC sin tabla de transversalidad entra al formato como actividad
  sinAct.filter(s => s.respuesta).forEach(s => decl.set("r" + s.a.id, { grupo: s.a.grupo, semestre: semDe(s.a.grupo), parcial: 0, ucId: s.a.unidadId, asgId: s.a.id, docenteId: s.a.docenteId, vinculoTxt: "",
    actividad: "", producto: "", tema: "", semana: "", etapaNum: null, declaradaPor: [s.a.docenteId], planes: [] }));
  // completar cada actividad con lo que dice la planeación de la propia UAC
  const filas = [...decl.values()].filter(d => !q.grupo || d.grupo === q.grupo).map(d => {
    const kb = kDecl(d);
    const propia = d.asgId ? (d.parcial ? planVigente(d.asgId, d.parcial) : [1, 2, 3].map(x => planVigente(d.asgId, x)).find(Boolean)) : null;
    const c = propia ? camposPlan(propia) : {};
    const val = (campo, deDoc) => {
      if (String(deDoc || "").trim()) return { v: String(deDoc).trim(), fuente: "planeacion" };
      const r = resp[`${kb}|${campo}`]; if (r) return { v: r.v, fuente: "docente", fecha: r.fecha };
      return { v: "", fuente: "" };
    };
    const etapa = d.etapaNum ? { v: `Etapa ${d.etapaNum}. ${PAEC_DOC.etapas[d.etapaNum - 1]}`, fuente: "planeacion" }
      : val("etapa", "").v ? val("etapa", "") : { v: PAEC_DOC.etapaPorSemestre[d.semestre] || "", fuente: "paec" };
    const f = { ...d, clave: kb, etapa,
      actividad: val("actividad", d.actividad), producto: val("producto", d.producto),
      progresion: val("progresion", c.progresion), didactica: val("didactica", c.estrategias),
      semana: val("semana", d.semana), sinPlanPropia: !!d.asgId && !propia };
    f.faltan = [];
    if (!d.ucId) f.faltan.push({ campo: "uac", etiqueta: "UAC o submódulo con el que se vincula", nota: `La planeación menciona “${short(d.vinculoTxt, 90)}”, que no coincide con el catálogo de ${d.semestre}.º semestre.` });
    else if (!d.asgId) f.faltan.push({ campo: "participante", etiqueta: "Docente que participa", nota: `${UC(d.ucId)?.abrev} no tiene docente asignado en el grupo ${d.grupo}.` });
    if (!f.actividad.v) f.faltan.push({ campo: "actividad", etiqueta: "Actividad ligada a la etapa del proyecto" });
    if (d.ucId && !f.progresion.v) f.faltan.push({ campo: "progresion", etiqueta: "Progresión de aprendizaje", nota: f.sinPlanPropia ? `No hay planeación de ${UC(d.ucId)?.abrev} · ${d.grupo} en el parcial ${d.parcial}.` : "La planeación no indica la progresión." });
    if (d.ucId && !f.didactica.v) f.faltan.push({ campo: "didactica", etiqueta: "Didáctica para el trabajo (cómo se desarrolla en la planeación)", nota: f.sinPlanPropia ? `No hay planeación de ${UC(d.ucId)?.abrev} · ${d.grupo} en el parcial ${d.parcial}.` : "La planeación no indica estrategias o metodologías." });
    if (!f.semana.v) f.faltan.push({ campo: "semana", etiqueta: "Semana en que se realiza la actividad", nota: "Las planeaciones solo traen el periodo del parcial, no la semana de la actividad." });
    f.paraDocente = d.docenteId || d.declaradaPor[0];
    return f;
  }).sort((a, b) => a.semestre - b.semestre || a.grupo.localeCompare(b.grupo) || a.parcial - b.parcial || (UC(a.ucId)?.np || 99) - (UC(b.ucId)?.np || 99));

  return { filas, sinAct, planeaciones: pls.length, grupos };
}

/* ---------- vista ---------- */
const celda = (x, clave, campo) => x.v
  ? `${esc(x.v)}${x.fuente === "docente" ? ` ${chip("respuesta del docente", "g")}` : x.fuente === "paec" ? ` <small class="faint">(según el PAEC)</small>` : ""}`
  : `<span class="falta">Falta · ${solicitado(clave, campo) ? "solicitado al docente" : "por solicitar"}</span>`;
function solicitado(clave, campo) {
  return L("retro_planeacion").some(r => r.origen === "PAEC" && r.estado !== "Atendida" && (r.campos || []).some(c => c.clave === `${clave}|${campo}`));
}
export function paecFormato() { return L("paec").find(p => p.formato === PAEC_DOC.formato); }

export function vistaFormato(q) {
  const p = paecFormato();
  const puede = isStaff() || isVinc();
  if (!p) return `<div class="card"><div class="card-h"><h2>Formato PAEC 2026-2027</h2></div>
    <p>Aún no se integra el PAEC institucional <b>“${esc(PAEC_DOC.nombre)}”</b>. Al integrarlo, el sistema llena “El abordaje de las UAC” y el “Plan operativo” con las actividades de la tabla <b>Transversalidad curricular</b> de cada planeación.</p>
    ${puede ? `<button class="btn pri" data-act="integrarPAEC">Integrar PAEC institucional 2026-2027</button>` : `<div class="note">Solo Subdirección o Vinculación pueden integrarlo.</div>`}</div>`;
  const F = formatoPAEC(q);
  const vista = q.v || "abordaje";
  const faltantes = F.filas.reduce((a, f) => a + f.faltan.length, 0);
  const porSolicitar = F.filas.reduce((a, f) => a + f.faltan.filter(x => !solicitado(f.clave, x.campo)).length, 0);
  const tabs = [["abordaje", "El abordaje de las UAC"], ["operativo", "Plan operativo del PEC"], ["faltantes", `Información faltante (${faltantes})`], ["documento", "Datos del PAEC"]];
  const encabezado = `<div class="card no-print"><div class="card-h"><div><h2>${esc(p.nombre)}</h2><small class="muted">${esc(p.proyectoGeneral || "")} · ${esc(p.periodo || "")}</small></div>
      <div class="row"><button class="btn" data-act="xlsxPAEC">⬇ Excel</button><button class="btn" onclick="window.print()">Imprimir / PDF</button></div></div>
    <div class="filters"><select data-filter="parcial" aria-label="Parcial"><option value="">Todos los parciales</option>${[1, 2, 3].map(x => opt(x, "Parcial " + x, q.parcial)).join("")}</select>
      <select data-filter="grupo" aria-label="Grupo"><option value="">Todos los grupos</option>${F.grupos.map(g => opt(g.id, "Grupo " + g.id, q.grupo)).join("")}</select>
      <span class="sp"></span>${puede && porSolicitar ? `<button class="btn pri" data-act="solicitarFaltantes">Solicitar a docentes lo que falta (${porSolicitar})</button>` : ""}</div>
    <div class="grid g4" style="margin-top:10px">
      <div class="kpi"><div class="n">${F.filas.length}</div><div class="l">Actividades transversales</div><div class="s">de ${F.planeaciones} planeaciones vigentes</div></div>
      <div class="kpi"><div class="n">${new Set(F.filas.map(f => f.asgId).filter(Boolean)).size}</div><div class="l">UAC por grupo participando</div></div>
      <div class="kpi"><div class="n">${faltantes}</div><div class="l">Datos faltantes</div><div class="s">${faltantes - porSolicitar} ya solicitados</div></div>
      <div class="kpi"><div class="n">${F.sinAct.length}</div><div class="l">UAC sin actividad identificada</div></div></div>
    <div class="tabs" style="margin-top:12px">${tabs.map(([k, t]) => `<button class="${vista === k ? "on" : ""}" data-act="vistaPAEC" data-v="${k}">${esc(t)}</button>`).join("")}</div>
    <p class="faint" style="font-size:.78rem;margin:0">Solo se usa lo que dicen las planeaciones. Lo que no aparece se marca como “Falta” y se pide al docente en su Retroalimentación de Subdirección; nunca se completa con supuestos.</p></div>`;
  const cuerpo = vista === "operativo" ? tablaOperativo(F) : vista === "faltantes" ? tablaFaltantes(F, puede) : vista === "documento" ? datosDoc(p) : tablaAbordaje(F);
  return encabezado + cuerpo;
}

function tablaAbordaje(F) {
  const CURR = [["Fundamental", "Currículum Fundamental"], ["Laboral", "Currículum Laboral (Carrera Técnica)"], ["Ampliado", "Currículum Ampliado"]];
  // una fila por UAC (agrupa grupos y parciales)
  const porUac = {};
  F.filas.forEach(f => { const k = f.ucId || "?" + n(f.vinculoTxt).slice(0, 30); (porUac[k] = porUac[k] || []).push(f); });
  let h = `<div class="card fmt-paec"><div class="fmt-tit">El abordaje de las UAC para el desarrollo del PAEC quedó como sigue:</div><div class="tw"><table class="fmt"><thead>
    <tr><th rowspan="2">Currículum</th><th rowspan="2">Recursos / áreas / ámbitos / módulos</th><th rowspan="2" colspan="2">UAC / submódulos</th><th colspan="3">Progresiones de aprendizaje</th><th rowspan="2">Etapa del proyecto</th></tr>
    <tr><th>Sem. 1°</th><th>Sem. 3°</th><th>Sem. 5°</th></tr></thead><tbody>`;
  let alguna = false;
  CURR.forEach(([cur, tit]) => {
    const items = Object.values(porUac).filter(fs => (UC(fs[0].ucId)?.curriculum || "Sin identificar") === cur)
      .sort((a, b) => a[0].semestre - b[0].semestre || (UC(a[0].ucId)?.np || 0) - (UC(b[0].ucId)?.np || 0));
    if (!items.length) { h += `<tr><td class="cur">${esc(tit)}</td><td colspan="7" class="faint">Sin actividades transversales identificadas en las planeaciones.</td></tr>`; return; }
    alguna = true;
    items.forEach((fs, i) => {
      const u = UC(fs[0].ucId), sem = fs[0].semestre;
      const ambito = cur === "Ampliado" ? `Ámbitos socioemocionales: ${PAEC_DOC.porGrado[{ 1: 1, 3: 2, 5: 3 }[sem]]?.ambito || ""}` : (u?.componente || "");
      const prog = s => { if (s !== sem) return ""; const xs = fs.map(f => f.progresion.v ? `${f.progresion.v}` : "").filter(Boolean);
        const uniq = [...new Set(xs)]; return uniq.length ? uniq.map(esc).join("<hr>") : `<span class="falta">Falta</span>`; };
      const etapas = [...new Set(fs.map(f => f.etapa.v))].filter(Boolean);
      const gruposDoc = [...new Set(fs.map(f => `${f.grupo}: ${f.docenteId ? pname(f.docenteId) : "sin docente asignado"}`))];
      h += `<tr>${i === 0 ? `<td class="cur" rowspan="${items.length}">${esc(tit)}</td>` : ""}<td>${esc(ambito)}</td>
        <td><b>${esc(u?.abrev || "No identificada")}</b><span class="sub">${esc(u ? short(u.nombre, 90) : fs[0].vinculoTxt)}</span></td>
        <td><small>${gruposDoc.map(esc).join("<br>")}</small></td>
        <td class="pr">${prog(1)}</td><td class="pr">${prog(3)}</td><td class="pr">${prog(5)}</td><td>${etapas.map(esc).join("<br>")}</td></tr>`;
    });
  });
  h += `</tbody></table></div>${alguna ? "" : `<div class="empty">Ninguna planeación de 1.º, 3.º o 5.º semestre trae la tabla “Transversalidad curricular”.</div>`}</div>`;
  return h;
}

function tablaOperativo(F) {
  const tit = { 1: "1° Semestre", 3: "“3°” semestre", 5: "“5°” semestre" };
  let h = `<div class="card fmt-paec"><div class="fmt-tit">PLAN OPERATIVO DEL PEC</div><div class="tw"><table class="fmt"><thead><tr><th>Etapa del proyecto</th><th>Actividad ligada a la etapa del proyecto</th><th>UAC</th><th>Progresión</th><th>Didáctica para el trabajo<br><small>(se vincula y desarrolla en la planeación didáctica del docente)</small></th><th>Semana</th><th>Participante</th></tr></thead><tbody>`;
  [1, 3, 5].forEach(s => {
    const fs = F.filas.filter(f => f.semestre === s);
    h += `<tr class="sem"><td colspan="7">${tit[s]}</td></tr>`;
    if (!fs.length) { h += `<tr><td>${esc(PAEC_DOC.etapaPorSemestre[s])}</td><td colspan="6" class="faint">Sin actividades transversales en las planeaciones de ${s}.º semestre.</td></tr>`; return; }
    fs.forEach(f => {
      const u = UC(f.ucId);
      h += `<tr><td>${celda(f.etapa, f.clave, "etapa")}</td>
        <td>${celda(f.actividad, f.clave, "actividad")}${f.producto.v ? `<span class="sub">Producto: ${esc(f.producto.v)}</span>` : ""}${f.tema ? `<span class="sub">Propósito: ${esc(short(f.tema, 160))}</span>` : ""}</td>
        <td><b>${esc(u?.abrev || "—")}</b> · ${esc(f.grupo)}<span class="sub">${f.parcial ? "Parcial " + f.parcial : "Dato del docente"}</span>${f.vinculoTxt ? `<span class="sub falta">${esc(short(f.vinculoTxt, 80))}</span>` : ""}</td>
        <td class="pr">${celda(f.progresion, f.clave, "progresion")}</td><td class="pr">${celda(f.didactica, f.clave, "didactica")}</td>
        <td>${celda(f.semana, f.clave, "semana")}</td>
        <td>${f.docenteId ? esc(pname(f.docenteId)) : `<span class="falta">Falta</span>`}<span class="sub">Grupo ${esc(f.grupo)}${f.declaradaPor.some(x => x !== f.docenteId) ? ` · declarada en la planeación de ${esc(f.declaradaPor.filter(x => x !== f.docenteId).map(pname).join(", "))}` : ""}</span></td></tr>`;
    });
  });
  return h + `</tbody></table></div></div>`;
}

function tablaFaltantes(F, puede) {
  const porDoc = {};
  F.filas.forEach(f => f.faltan.forEach(x => { (porDoc[f.paraDocente || "?"] = porDoc[f.paraDocente || "?"] || []).push({ f, x }); }));
  const solicitudes = L("retro_planeacion").filter(r => r.origen === "PAEC").sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
  let h = `<div class="card"><div class="card-h"><h3>Datos que no vienen en las planeaciones</h3></div>
    <p class="muted">Se agrupan por el docente que debe completarlos (el titular de la UAC; si no hay titular, quien declaró la actividad).</p>`;
  const docs = Object.keys(porDoc).sort((a, b) => pname(a).localeCompare(pname(b)));
  h += docs.length ? docs.map(d => { const xs = porDoc[d]; const pend = xs.filter(({ f, x }) => !solicitado(f.clave, x.campo)).length;
    return `<details class="pend-doc"><summary><b>${esc(pname(d))}</b> ${chip(xs.length + " datos", "a")} ${pend ? chip(pend + " por solicitar", "r") : chip("todo solicitado", "g")}
      ${puede && pend ? `<button class="btn sm" data-act="solicitarFaltantes" data-doc="${esc(d)}">Solicitar</button>` : ""}</summary>
      <ul>${xs.map(({ f, x }) => `<li><b>${esc(x.etiqueta)}</b> — ${esc(UC(f.ucId)?.abrev || "UAC no identificada")} · ${esc(f.grupo)} ${f.parcial ? " · parcial " + f.parcial : ""}${f.actividad.v ? ` · “${esc(short(f.actividad.v, 70))}”` : ""}${x.nota ? `<br><small class="muted">${esc(x.nota)}</small>` : ""} ${solicitado(f.clave, x.campo) ? chip("solicitado", "b") : ""}</li>`).join("")}</ul></details>`; }).join("")
    : `<div class="note ok">No hay datos faltantes en las actividades identificadas.</div>`;
  h += `</div><div class="card"><div class="card-h"><h3>UAC sin actividad transversal identificada · ${F.sinAct.length}</h3>${puede && F.sinAct.some(s => s.conPlan) ? `<button class="btn sm" data-act="solicitarSinAct">Preguntar a sus docentes</button>` : ""}</div>
    <p class="muted">Su planeación no trae la tabla “Transversalidad curricular” o no se les nombra en la de otra UAC del grupo.</p>
    <div class="tw"><table><thead><tr><th>Grupo</th><th>UAC</th><th>Docente</th><th>Planeaciones</th><th>Respuesta</th></tr></thead><tbody>
    ${F.sinAct.sort((a, b) => a.a.grupo.localeCompare(b.a.grupo)).map(s => `<tr><td>${esc(s.a.grupo)}</td><td>${esc(UC(s.a.unidadId)?.abrev || "")}</td><td>${esc(pname(s.a.docenteId))}</td><td>${s.conPlan ? s.conPlan + " parcial(es)" : chip("sin planeación", "a")}</td><td>${s.respuesta ? esc(s.respuesta) : solicitadoSinAct(s.a) ? chip("solicitado", "b") : "—"}</td></tr>`).join("")}</tbody></table></div></div>`;
  if (solicitudes.length) h += `<div class="card"><div class="card-h"><h3>Solicitudes enviadas · ${solicitudes.length}</h3></div><div class="tw"><table><thead><tr><th>Fecha</th><th>Docente</th><th>Datos</th><th>Estado</th></tr></thead><tbody>
    ${solicitudes.map(r => `<tr><td>${fdate(r.creado)}</td><td>${esc(pname(r.docenteId))}</td><td>${(r.campos || []).length} · <small class="muted">${esc(short((r.campos || []).map(c => c.etiqueta).join(", "), 90))}</small></td><td>${chip(r.estado, r.estado === "Respondida" ? "g" : r.estado === "Atendida" ? "" : "a")}${r.estado === "Respondida" && isStaff() ? ` <button class="btn sm" data-act="atenderRetro" data-id="${r.id}">Marcar atendida</button>` : ""}</td></tr>`).join("")}</tbody></table></div></div>`;
  return h;
}
const solicitadoSinAct = a => L("retro_planeacion").some(r => r.origen === "PAEC" && (r.campos || []).some(c => c.clave.startsWith(`${a.grupo}|${a.unidadId}|`) && c.clave.endsWith("|actividad")));

function datosDoc(p) {
  const g = PAEC_DOC.porGrado;
  return `<div class="card"><h3>Problemática</h3><p>${esc(p.problematica)}</p><h3>Propósito educativo</h3><p>${esc(p.proposito)}</p><h3>Objetivo general</h3><p>${esc(PAEC_DOC.objetivoGeneral)}</p>
    <div class="tw"><table><thead><tr><th>Grado</th><th>Ámbito socioemocional</th><th>Proyecto transversal</th><th>Objetivo específico</th></tr></thead><tbody>
    ${[1, 2, 3].map(k => `<tr><td>${k}.º año<span class="sub">${g[k].semestre}.º semestre</span></td><td>${esc(g[k].ambito)}</td><td>“${esc(g[k].proyecto)}”</td><td>${esc(g[k].objetivo)}</td></tr>`).join("")}</tbody></table></div>
    <h3 style="margin-top:14px">Etapas</h3><p>${PAEC_DOC.etapas.map((e, i) => `Etapa ${i + 1}. ${esc(e)}`).join(" · ")}</p></div>
    <div class="card"><h3>Inconsistencias detectadas en el documento PAEC</h3><p class="muted">No se corrigieron en el formato: requieren decisión del colegiado.</p><ol>${PAEC_DOC.inconsistencias.map(x => `<li>${esc(x)}</li>`).join("")}</ol></div>`;
}

/* ---------- acciones ---------- */
ACT.vistaPAEC = el => window.SIAP.setQ("v", el.dataset.v);
ACT.integrarPAEC = async () => {
  if (paecFormato()) return toast("El PAEC institucional ya está integrado.");
  const grupos = L("grupos").filter(g => [1, 3, 5].includes(g.semestre)).map(g => g.id);
  const asig = L("asignaciones").filter(a => grupos.includes(a.grupo) && a.estado !== "Cerrada").map(a => a.id);
  const id = "paec-cbt6-2026-2027";
  await save("paec", id, { formato: PAEC_DOC.formato, nombre: PAEC_DOC.nombre, proyectoGeneral: PAEC_DOC.proyectoGeneral, problematica: PAEC_DOC.problematica, proposito: PAEC_DOC.proposito,
    objetivoGeneral: PAEC_DOC.objetivoGeneral, estado: "En desarrollo", grupos, asignaciones: asig, parciales: [1, 2, 3], periodo: PAEC_DOC.periodo, responsableId: me() || "", productos: "Feria Digital PyME (mayo de 2027)" }, "integración PAEC");
  toast("PAEC institucional integrado.");
};
/* una solicitud por docente con todos sus datos faltantes */
async function enviarSolicitudes(items, mensaje) {
  const porDoc = {};
  items.forEach(it => (porDoc[it.docenteId] = porDoc[it.docenteId] || []).push(it));
  let n0 = 0;
  for (const [doc, cs] of Object.entries(porDoc)) {
    if (!doc || doc === "undefined") continue;
    const id = newId("rp-");
    await save("retro_planeacion", id, { origen: "PAEC", paecId: paecFormato()?.id || "", docenteId: doc, campos: cs.map(({ docenteId, ...c }) => c), mensaje, estado: "Pendiente", respuestas: {} }, "solicitud de información PAEC");
    await notify(doc, "retro", `Subdirección solicita ${cs.length} dato(s) para el PAEC institucional.`, "#/planeaciones?retro=1");
    n0++;
  }
  return n0;
}
ACT.solicitarFaltantes = async el => {
  const F = formatoPAEC({});
  const items = [];
  F.filas.forEach(f => f.faltan.forEach(x => { if (solicitado(f.clave, x.campo)) return; if (el.dataset.doc && f.paraDocente !== el.dataset.doc) return;
    items.push({ docenteId: f.paraDocente, clave: `${f.clave}|${x.campo}`, etiqueta: x.etiqueta, nota: x.nota || "", uac: UC(f.ucId)?.abrev || f.vinculoTxt || "", grupo: f.grupo, parcial: f.parcial, actividad: f.actividad.v || "" }); }));
  if (!items.length) return toast("No hay datos por solicitar.");
  const docs = new Set(items.map(i => i.docenteId)).size;
  modal({ title: "Solicitar información para el PAEC", submit: `Enviar a ${docs} docente(s)`, body: `<p>Se pedirán <b>${items.length}</b> dato(s) que no vienen en las planeaciones. Cada docente los verá en <b>Planeaciones → Retroalimentación de Subdirección</b> y recibirá una notificación.</p>
    <label>Mensaje para los docentes<textarea name="mensaje" rows="4">Para integrar el formato del PAEC institucional “${esc(PAEC_DOC.nombre)}”, le solicito completar los datos que no aparecen en su planeación didáctica. Gracias.</textarea></label>`,
    onSubmit: async o => { const k = await enviarSolicitudes(items, o.mensaje); toast(`Solicitud enviada a ${k} docente(s).`); } });
};
ACT.solicitarSinAct = async () => {
  const F = formatoPAEC({});
  const items = F.sinAct.filter(s => s.conPlan && !solicitadoSinAct(s.a) && !s.respuesta).map(s => ({ docenteId: s.a.docenteId, clave: `${s.a.grupo}|${s.a.unidadId}|0|actividad`, etiqueta: "Actividad transversal de su UAC para el PAEC (etapa, semana y producto)", nota: "Su planeación no trae la tabla “Transversalidad curricular”.", uac: UC(s.a.unidadId)?.abrev || "", grupo: s.a.grupo, parcial: 0, actividad: "" }));
  if (!items.length) return toast("No hay docentes por consultar.");
  modal({ title: "Preguntar por actividades transversales", submit: "Enviar", body: `<p>Se preguntará a <b>${new Set(items.map(i => i.docenteId)).size}</b> docente(s) si su UAC participa en el PAEC y con qué actividad.</p><label>Mensaje<textarea name="mensaje" rows="3">Su planeación no incluye la tabla “Transversalidad curricular”. Indique, por favor, la actividad con la que su UAC participa en el PAEC institucional (etapa, semana y producto).</textarea></label>`,
    onSubmit: async o => { const k = await enviarSolicitudes(items, o.mensaje); toast(`Solicitud enviada a ${k} docente(s).`); } });
};
ACT.atenderRetro = async el => { await save("retro_planeacion", el.dataset.id, { estado: "Atendida", atendido: nowISO(), atendidoPor: me() || "" }, "retroalimentación atendida"); toast("Marcada como atendida."); };

/* ---------- Retroalimentación de Subdirección (lado docente y detalle) ---------- */
export function retroSubdireccion(docId, { asgId = "" } = {}) {
  const rs = L("retro_planeacion").filter(r => (!docId || r.docenteId === docId) && (!asgId || r.asignacionId === asgId || (r.campos || []).some(c => A(asgId) && c.grupo === A(asgId).grupo && c.uac === UC(A(asgId).unidadId)?.abrev)))
    .sort((a, b) => (a.estado === "Pendiente" ? 0 : 1) - (b.estado === "Pendiente" ? 0 : 1) || (b.creado || "").localeCompare(a.creado || ""));
  if (!rs.length) return "";
  const yo = me();
  return `<div class="card" id="retroSub"><div class="card-h"><h3>Retroalimentación de Subdirección</h3>${chip(rs.filter(r => r.estado === "Pendiente").length + " pendientes", "a")}</div>
    ${rs.map(r => `<div class="card flat retro-item"><div class="row"><b>${r.origen === "PAEC" ? "Información para el PAEC institucional" : "Comentario sobre la planeación"}</b><span class="sp"></span>${chip(r.estado, r.estado === "Pendiente" ? "a" : r.estado === "Respondida" ? "g" : "")}<small class="muted">${fdate(r.creado)} · ${esc(pname(r.creadoPor))}</small></div>
      ${r.mensaje ? `<p style="margin:6px 0">${esc(r.mensaje)}</p>` : ""}
      ${(r.campos || []).length ? `<div data-retro="${r.id}" class="retro-form">${r.campos.map((c, i) => `<label>${esc(c.etiqueta)} <small class="muted">· ${esc(c.uac)} · ${esc(c.grupo)}${c.parcial ? " · parcial " + c.parcial : ""}${c.actividad ? ` · “${esc(short(c.actividad, 60))}”` : ""}</small>
        ${c.nota ? `<small class="faint" style="display:block">${esc(c.nota)}</small>` : ""}
        <textarea rows="2" name="c${i}" ${r.docenteId === yo && r.estado !== "Atendida" ? "" : "disabled"}>${esc((r.respuestas || {})[c.clave] || "")}</textarea></label>`).join("")}
        ${r.docenteId === yo && r.estado !== "Atendida" ? `<button type="button" class="btn pri sm" data-act="responderRetro" data-id="${r.id}">${r.estado === "Respondida" ? "Actualizar respuesta" : "Enviar respuesta"}</button>` : ""}</div>` : ""}
      ${r.estado === "Respondida" && isStaff() ? `<button class="btn sm" data-act="atenderRetro" data-id="${r.id}">Marcar atendida</button>` : ""}</div>`).join("")}</div>`;
}
ACT.responderRetro = async el => {
  const r = byId("retro_planeacion", el.dataset.id); if (!r) return;
  const f = el.closest(".retro-form"); const respuestas = { ...(r.respuestas || {}) };
  (r.campos || []).forEach((c, i) => { const v = f.querySelector(`[name=c${i}]`)?.value.trim(); if (v) respuestas[c.clave] = v; else delete respuestas[c.clave]; });
  if (!Object.keys(respuestas).length) return toast("Escribe al menos una respuesta.", true);
  await S.store.set("retro_planeacion", r.id, { respuestas, estado: "Respondida", respondido: nowISO(), respondidoPor: me() || "" });
  await audit("respuesta a retroalimentación", "retro_planeacion", r.id, { datos: Object.keys(respuestas).length });
  if (r.creadoPor) await notify(r.creadoPor, "retro", `${pname(me())} respondió la solicitud de información del PAEC.`, "#/paec?tab=formato&v=faltantes");
  toast("Respuesta enviada a Subdirección.");
};
/* comentario libre de Subdirección sobre una planeación */
ACT.retroPlan = el => {
  const p = byId("planeaciones", el.dataset.id); if (!p) return;
  modal({ title: "Retroalimentación de Subdirección", submit: "Enviar al docente", body: `<p class="muted">${esc(UC(p.unidadId)?.abrev || "")} · ${esc(p.grupo)} · parcial ${p.parcial} · ${esc(pname(p.docenteId))}</p>
    <label>Comentario o solicitud<textarea name="mensaje" rows="4" required></textarea></label>
    <label><input type="checkbox" name="pide"> Pedir respuesta del docente</label>`,
    onSubmit: async o => { const id = newId("rp-");
      await save("retro_planeacion", id, { origen: "Planeación", planeacionId: p.id, asignacionId: p.asignacionId, docenteId: p.docenteId, mensaje: o.mensaje, estado: o.pide ? "Pendiente" : "Atendida",
        campos: o.pide ? [{ clave: `${p.id}|respuesta`, etiqueta: "Respuesta del docente", uac: UC(p.unidadId)?.abrev || "", grupo: p.grupo, parcial: p.parcial }] : [], respuestas: {} }, "retroalimentación de planeación");
      await notify(p.docenteId, "retro", "Subdirección dejó retroalimentación sobre tu planeación.", "#/planeaciones?retro=1");
      toast("Retroalimentación enviada."); } });
};

/* ---------- Excel con los dos recuadros ---------- */
ACT.xlsxPAEC = async () => {
  if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const F = formatoPAEC(S.route.q), v = x => x.v || (x.fuente === "" ? "FALTA" : "");
  const ab = [["Currículum", "Recursos / áreas / ámbitos / módulos", "UAC / submódulo", "Grupos y docentes", "Progresión Sem. 1°", "Progresión Sem. 3°", "Progresión Sem. 5°", "Etapa del proyecto"]];
  F.filas.forEach(f => { const u = UC(f.ucId); const pr = s => f.semestre === s ? v(f.progresion) : "";
    ab.push([u?.curriculum || "Sin identificar", u?.curriculum === "Ampliado" ? "Ámbitos socioemocionales" : u?.componente || "", u ? `${u.abrev} — ${u.nombre}` : f.vinculoTxt, `${f.grupo}: ${pname(f.docenteId)}`, pr(1), pr(3), pr(5), f.etapa.v]); });
  const op = [["Semestre", "Etapa del proyecto", "Actividad ligada a la etapa", "Producto", "UAC", "Grupo", "Parcial", "Progresión", "Didáctica para el trabajo", "Semana", "Participante"]];
  F.filas.forEach(f => op.push([`${f.semestre}°`, f.etapa.v, v(f.actividad), f.producto.v, UC(f.ucId)?.abrev || f.vinculoTxt, f.grupo, f.parcial, v(f.progresion), v(f.didactica), v(f.semana), f.docenteId ? pname(f.docenteId) : "FALTA"]));
  const fal = [["Docente", "Dato faltante", "UAC", "Grupo", "Parcial", "Actividad", "Nota", "¿Solicitado?"]];
  F.filas.forEach(f => f.faltan.forEach(x => fal.push([pname(f.paraDocente), x.etiqueta, UC(f.ucId)?.abrev || "", f.grupo, f.parcial, f.actividad.v, x.nota || "", solicitado(f.clave, x.campo) ? "Sí" : "No"])));
  const wb = XLSX.utils.book_new();
  [["Abordaje de las UAC", ab], ["Plan operativo", op], ["Información faltante", fal]].forEach(([nm, rows]) => { const ws = XLSX.utils.aoa_to_sheet([[`${CFG.institucion.nombre} · PAEC ${PAEC_DOC.nombre} · ${today()}`], [], ...rows]); ws["!cols"] = rows[0].map(() => ({ wch: 30 })); XLSX.utils.book_append_sheet(wb, ws, nm); });
  XLSX.writeFile(wb, `PAEC_formato_${today()}.xlsx`);
  audit("exportación", "paec", "formato", { actividades: F.filas.length });
};
