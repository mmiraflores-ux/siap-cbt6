/* Cronograma de observación de clase: lectura del documento (Excel) y vinculación con el catálogo.
   Funciones puras (sin dependencias) para poder resolverlas contra los datos vigentes del sistema.
   Nunca se inventa una vinculación: si algo no coincide, la fila queda marcada para revisión. */

export const normTxt = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9: -]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "a", "para", "con", "su", "p", "i", "ii", "iii", "iv", "v", "vi"]);
const toks = s => normTxt(s).split(" ").filter(t => t.length > 1 && !STOP.has(t));
const DIAS_N = ["lunes", "martes", "miercoles", "jueves", "viernes"];

export function diaIdx(txt) { const t = normTxt(txt); return DIAS_N.findIndex(d => t.includes(d)); }

/* "7:00-8:40" → bloques del horario cubiertos por ese rango */
export function bloquesDe(horario, BLOQUES) {
  const m = String(horario || "").match(/(\d{1,2}):(\d{2})\s*[-–a]+\s*(\d{1,2}):(\d{2})/);
  if (!m) return [];
  const pad = (h, mi) => `${String(+h).padStart(2, "0")}:${mi}`;
  const ini = pad(m[1], m[2]), fin = pad(m[3], m[4]);
  return BLOQUES.map((b, i) => [b, i]).filter(([b]) => b[0] >= ini && b[1] <= fin).map(([, i]) => i);
}

/* Persona por nombre: coincidencia de palabras (nombre completo y alias), sin importar acentos ni orden */
export function buscarPersona(nombre, personas, filtro = () => true) {
  const t = toks(nombre); if (!t.length) return { persona: null, ambigua: false };
  const cand = personas.filter(filtro).map(p => {
    const pt = new Set(toks(`${p.nombre} ${p.nombreN || ""}`));
    const hit = t.filter(x => pt.has(x)).length;
    return { p, hit, extra: pt.size - hit };
  }).filter(c => c.hit >= Math.min(2, t.length)).sort((a, b) => b.hit - a.hit || a.extra - b.extra);
  if (!cand.length) return { persona: null, ambigua: false };
  const amb = cand.length > 1 && cand[1].hit === cand[0].hit && cand[1].extra === cand[0].extra;
  return { persona: amb ? null : cand[0].p, ambigua: amb, opciones: amb ? cand.filter(c => c.hit === cand[0].hit).map(c => c.p) : [] };
}

const simUAC = (txt, a, unidades) => {
  const u = unidades.find(x => x.id === a.unidadId);
  const t = toks(txt), pt = new Set(toks(`${u?.nombre || ""} ${a.nombreFuente || ""} ${u?.abrev || ""}`));
  return t.length ? t.filter(x => pt.has(x)).length / t.length : 0;
};

/* Texto libre de la columna "Orientadora": "Viviana Rebollar Ruiz  Viernes 7:00-8:40  grupo 301" */
export function leerOrientadora(txt) {
  const s = String(txt || "").replace(/\s+/g, " ").trim(); if (!s) return null;
  const dm = s.match(/\b(lunes|martes|mi[eé]rcoles|jueves|viernes)\b/i);
  const hm = s.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/);
  const gm = s.match(/grupo\s*(\d{3})/i) || s.match(/\b([1-6]0\d)\b/);
  const nombre = s.split(/\b(lunes|martes|mi[eé]rcoles|jueves|viernes|grupo)\b/i)[0].trim();
  return { nombre, dia: dm ? dm[1] : "", horario: hm ? hm[0].replace(/\s/g, "") : "", grupo: gm ? gm[1] : "" };
}

/* Resuelve una fila (docente, grupo, día, horario, UAC, observador) contra el catálogo vigente.
   D = { personas, asignaciones, horarios, unidades, BLOQUES, ciclo, periodo } */
/* Nombres escritos distinto en el documento que la Subdirección confirmó como la misma persona del catálogo */
export const EQUIVALENCIAS = [
  { texto: "Samantha Jardon Flores", personaId: "p-samanta-alejandra-jardon-fuentes", confirmado: "Subdirección, 12-nov-2026" }
];

export function resolverFila(f, D) {
  const notas = [];
  const grupo = String(f.grupo || "").replace(/\D/g, "");
  const dia = diaIdx(f.dia);
  const bloques = bloquesDe(f.horario, D.BLOQUES);
  const eq = EQUIVALENCIAS.find(e => normTxt(e.texto) === normTxt(f.docente));
  const pEq = eq && D.personas.find(p => p.id === eq.personaId);
  const doc = pEq ? { persona: pEq } : f.docente ? buscarPersona(f.docente, D.personas) : { persona: null };
  const obs = buscarPersona(f.observador, D.personas);
  if (f.docente && !doc.persona) notas.push(doc.ambigua ? `Docente ambiguo: “${f.docente}”.` : `No se encontró al docente “${f.docente}” en el catálogo.`);
  if (!obs.persona) notas.push(obs.ambigua ? `Observador ambiguo: “${f.observador}”.` : `No se encontró a “${f.observador}” en el catálogo.`);
  if (dia < 0) notas.push(`Día no reconocido: “${f.dia}”.`);
  if (!bloques.length) notas.push(`Horario no reconocido: “${f.horario}”.`);

  const hor = D.horarios.filter(h => h.grupo === grupo).sort((a, b) => (b.periodo === D.periodo) - (a.periodo === D.periodo) || (b.ciclo === D.ciclo) - (a.ciclo === D.ciclo))[0];
  const celdas = hor && dia >= 0 ? bloques.map(b => hor.celdas?.[`${dia}-${b}`]).filter(Boolean) : [];
  const enHorario = [...new Set(celdas.map(c => c.asignacionId).filter(Boolean))];
  const docHorario = [...new Set(celdas.map(c => c.docenteId).filter(Boolean))];
  let asignacionId = "", via = "";
  let docenteId = doc.persona?.id || (!f.docente && docHorario.length === 1 ? docHorario[0] : "");
  // nombre escrito distinto (p. ej. “Samantha Jardon Flores”): se acepta quien da la clase en ese horario si comparte apellido
  if (!docenteId && f.docente && docHorario.length === 1) {
    const ph = D.personas.find(p => p.id === docHorario[0]);
    const t = toks(f.docente), pt = new Set(toks(ph?.nombre));
    if (ph && t.slice(1).some(x => pt.has(x))) {
      docenteId = ph.id; notas.splice(notas.findIndex(n => n.includes(f.docente)), 1);
      notas.push(`El documento dice “${f.docente}”; se vinculó por horario con “${ph.nombre}”. Verifica que sea la misma persona.`);
    }
  }
  if (!f.docente && docenteId) via = "horario";

  const asgDe = id => D.asignaciones.find(a => a.id === id);
  // 1) el horario del grupo en ese día y hora, con el mismo docente
  const hOk = enHorario.map(asgDe).filter(a => a && (!docenteId || a.docenteId === docenteId));
  if (hOk.length === 1) { asignacionId = hOk[0].id; via = "horario"; }
  // 1b) actividad operativa del horario (tutoría, talleres) impartida por ese docente
  if (!asignacionId) {
    const ops = celdas.filter(c => c.actividadId && (!docenteId || c.docenteId === docenteId));
    const ids = [...new Set(ops.map(c => `${c.actividadId}|${c.docenteId}`))];
    if (ids.length === 1) {
      const [actId, dId] = ids[0].split("|");
      asignacionId = `op~${actId}~${grupo}~${dId}`; docenteId = docenteId || dId; via = "horario (actividad operativa)";
      const act = (D.actividades || []).find(x => x.id === actId);
      notas.push(`Es una actividad operativa (${act?.nombre || ops[0].texto}), no una UAC curricular: no tiene planeación asociada.`);
      if (f.uac && act && toks(f.uac).filter(x => toks(act.nombre).includes(x)).length === 0) notas.push(`El documento indica “${f.uac}”, pero el horario registra “${act.nombre}” en ese bloque.`);
    }
  }
  // 2) asignaciones del docente en el grupo, elegida por nombre de la UAC
  if (!asignacionId && docenteId) {
    const cand = D.asignaciones.filter(a => a.docenteId === docenteId && a.grupo === grupo && a.estado !== "Baja")
      .map(a => ({ a, s: simUAC(f.uac, a, D.unidades) })).sort((x, y) => y.s - x.s);
    if (cand.length === 1 || (cand.length > 1 && cand[0].s >= 0.5 && cand[0].s > cand[1].s)) { asignacionId = cand[0].a.id; via = "asignación del docente"; }
    else if (cand.length > 1) notas.push(`El docente tiene ${cand.length} asignaciones en ${grupo}; elige cuál corresponde.`);
    else notas.push(`No hay asignación de ${f.docente || "este docente"} en el grupo ${grupo}.`);
    if (asignacionId && hor && enHorario.length && !enHorario.includes(asignacionId)) {
      const otro = celdas[0];
      notas.push(`En el horario del grupo, ${f.dia.trim()} ${f.horario} corresponde a ${otro?.texto || "otra clase"}${otro?.docenteTexto ? ` (${otro.docenteTexto})` : ""}. Verifica el día y la hora.`);
    } else if (asignacionId && hor && dia >= 0 && bloques.length && !celdas.length) notas.push(`El horario del grupo no tiene clase registrada ${f.dia.trim()} ${f.horario}.`);
  }
  if (!asignacionId && !docenteId && enHorario.length > 1) notas.push("En ese horario hay más de una clase; elige la asignación.");
  const a = asgDe(asignacionId) || (asignacionId.startsWith("op~") ? { id: asignacionId, docenteId } : null);
  if (a && !a.id.startsWith("op~") && f.uac && simUAC(f.uac, a, D.unidades) < 0.34) {
    const u = D.unidades.find(x => x.id === a.unidadId);
    const otra = D.asignaciones.filter(x => x.docenteId === a.docenteId && x.id !== a.id).map(x => ({ x, s: simUAC(f.uac, x, D.unidades) })).sort((p, q) => q.s - p.s)[0];
    notas.push(`El documento indica “${f.uac}”, pero ${f.dia.trim()} ${f.horario} en ${grupo} es ${u?.nombre || a.nombreFuente}.` + (otra && otra.s >= 0.6 ? ` Esa UAC la imparte en el grupo ${otra.x.grupo}; verifica el grupo.` : ""));
  }
  if (a && obs.persona && obs.persona.id === a.docenteId) notas.push("La persona observadora es la misma que la observada (no se permite autoobservación).");
  return { grupo, dia, bloques, docenteId: a?.docenteId || docenteId, observadorId: obs.persona?.id || "", asignacionId, via, notas };
}

/* Lee la hoja del documento (filas con encabezados N/P, Profesores, Grupo, Día, Horario, UAC/Materia, Observador, Orientadora).
   rows = matriz de celdas (arrays). Devuelve filas planas; la columna de orientadora genera una fila adicional. */
export function leerCronograma(rows) {
  const H = rows.findIndex(r => r.some(c => /profesor/i.test(String(c || ""))) && r.some(c => /observador/i.test(String(c || ""))));
  if (H < 0) throw new Error("No se encontró el encabezado (Profesores · Grupo · Día · Horario · UAC · Observador).");
  const hdr = rows[H].map(c => normTxt(c));
  const col = re => hdr.findIndex(h => re.test(h));
  const C = { np: col(/^n ?p|^no\b|^num/), doc: col(/profesor|docente/), grupo: col(/grupo/), dia: col(/^dia/), hor: col(/horario|hora/), uac: col(/uac|materia/), obs: col(/observador/), ori: col(/orientador/) };
  const out = [];
  for (const r of rows.slice(H + 1)) {
    const v = i => i >= 0 ? String(r[i] ?? "").replace(/\s+/g, " ").trim() : "";
    if (!v(C.doc) && !v(C.grupo)) continue;
    const base = { np: v(C.np), docente: v(C.doc), grupo: v(C.grupo), dia: v(C.dia), horario: v(C.hor), uac: v(C.uac), observador: v(C.obs), rol: "Observación" };
    out.push(base);
    const o = leerOrientadora(v(C.ori));
    if (o && o.nombre) out.push({ np: base.np + "-O", docente: "", docenteRef: base.docente, grupo: o.grupo || base.grupo, dia: o.dia || base.dia, horario: o.horario || base.horario, uac: "", observador: o.nombre, rol: "Orientación" });
  }
  return out;
}

/* Contenido del documento "Observación de clase.xlsx" (Cronograma de Observación de Clase, periodo A 2026-2027), tal como viene. */
export const CRONOGRAMA_DOC = {
  fuente: "Observación de clase.xlsx",
  filas: [
    ["N/P", "Profesores", "Grupo", "Día", "Horario", "UAC/Materia", "Observador", "Orientadora"],
    [1, "Violeta Vázquez Martínez", "501", "Viernes", "7:00-8:40", "Temas Selectos de Matemáticas II", "Georgina Garces Rodriguez", ""],
    [2, "Griselda López García", "302", "Miercoles", "10:40-12:20", "Desarrolla Software de aplicación utilizando p.e", "Eric Miraflores Rama", ""],
    [3, "Erick Garcia Villegas", "301", "Miercoles", "7:00-8:40", "Desarrolla Software de aplicación utilizando p.e", "Emmanuel Toledano Nieto", ""],
    [5, "Paula Mejia Jasso", "101", "Jueves", "12:20-14:00", "Perspectivas Academico Laborales", "Angelica Cervantes Valle", ""],
    [6, "Nataly Esquivel Mancilla", "302", "Miercoles", "8:40-10:20", "Lengua y Comunicación III", "Angelica Cervantes Valle", ""],
    [7, "Michelle Elizabeth Rodea Martínez", "301", "Miercoles", "8:40-10:20", "Ciencias Naturales, experimentales y tecnologia I", "Georgina Garces Rodriguez", "Viviana Rebollar Ruiz Viernes 7:00-8:40 grupo 301"],
    [8, "Lourdes Irais Mociño Dávila", "102", "Lunes", "10:40-12:20", "Aplica los aprendizajes en una actividad laboral", "Sandivel Borja Jaimes", ""],
    [9, "Ivonne Anaya Villa", "301", "Martes", "13:10-14:00", "Educación Integral en sexualidad y género", "Angelica Cervantes Valle", ""],
    [10, "Angélica Cervantes Valle", "101", "Lunes", "7:00-8:40", "Ciencias Sociales I", "Emmanuel Toledano Nieto", ""],
    [11, "Aura Patricia López Santos", "502", "Martes", "7:50-8:40", "Práctica y colaboración ciudadana", "Emmanuel Toledano Nieto", ""],
    [12, "Diego Molina Morales", "502", "Jueves", "7:00-8:40", "Actividades Artísticas y Culturales", "Georgina Garces Rodriguez", ""],
    [13, "Dinorah Sierra Santos", "501", "Viernes", "10:40-11:30", "Práctica y Colaboración Ciudadana", "Sandivel Borja Jaimes", ""],
    [14, "Yecenia Méndez Gómora", "102", "Martes", "10:40-12:20", "Lengua y Comunicación I", "Angelica Cervantes Valle", ""],
    [15, "Marco Eric Miraflores Rama", "301", "Viernes", "12:20-14:00", "Aplica los aprendizajes en una actividad laboral", "Sandivel Borja Jaimes", ""],
    [16, "Sandivel Borja Jaimes", "502", "Jueves", "12:20-14:00", "Desarrolla Soluciones de Comercio Electrónico", "Eric Miraflores Rama", ""],
    [17, "Evelin Carbajal García", "301", "Martes", "10:40-12:20", "Diseña y Administra Base de Datos Avanzadas", "Eric Miraflores Rama", ""],
    [18, "Aramis Cienfuegos Arellano", "501", "Miercoles", "7:00-8:40", "Sistematiza y Gestiona Proyectos II", "Emmanuel Toledano Nieto", ""],
    [19, "Isaura Jiménez Mejia", "502", "Lunes", "12:20-13:10", "Temas Selectos de Igualdad y Derechos Humanos V", "Eric Miraflores Rama", ""],
    [20, "Maricarmen Palma Sánchez", "302", "Miercoles", "9:30-10:20", "Diseña y Administra Base de Datos Avanzadas", "Sandivel Borja Jaimes", ""],
    [21, "Imelda Vargas Gutierrez", "101", "Jueves", "8:40-10:20", "Pensamiento Matemático III", "Georgina Garces Rodriguez", ""],
    [22, "Roxana Blas Márquez", "502", "Lunes", "8:40-10:20", "Procesos Lógicos en la epistemología cientifica", "Georgina Garces Rodriguez", ""],
    [23, "Samantha Jardon Flores", "102", "Miercoles", "8:40-10:20", "Ciencias Sociales I", "Angelica Cervantes Valle", ""],
    [24, "Maria Elisa Hernandez Rodriguez", "102", "Viernes", "7:00-8:40", "Cultura Digital I", "Sandivel Borja Jaimes", ""],
    [25, "Cesar Arnulfo García Yturbe", "301", "Viernes", "10:40-12:20", "Actividades fisicas y deportivas", "Eric Miraflores Rama", ""],
    [26, "Eugenia Paulina Verdeja  Montes de Oca", "102", "Viernes", "12:20-13:10", "Temas Selectos de Igualdad y Derechos Humanos I", "Angelica Cervantes Valle", "Sofia Kareh Mireles Viernes 12:20-13:10 Grupo 102"],
    [27, "Maetzin Zurisadai Garcia Quintana", "102", "Martes", "12:20-13:10", "Taller Métodos de estudio", "Sandivel Borja Jaimes", "Arlaet Mendez Gomora Martes grupo 101 13:10-14:00"],
    [28, "Jose Alfredo Enguilo Escobar", "102", "Miercoles", "7:00-8:40", "Taller de Informática", "Emmanuel Toledano Nieto", ""]
  ]
};
