/* Tablero interactivo de Subdirección y cálculos compartidos con reportes y planeaciones */
import { S, L, P, pname, UC, A, alabel, afull, opt, chip, esc, parcialHoy, today, fdate, short, me, isStaff } from "./core.js";
import { apiladas, barras, segmentada } from "./graficas.js";
import { camposPlan } from "./views-plan.js";

export const ESTADOS_INSTR = [
  { key: "Incluye instrumento", label: "Incluye instrumento", color: "--o1" },
  { key: "Desarrollo parcial", label: "Desarrollo parcial", color: "--o2" },
  { key: "Solo mencionado", label: "Solo mencionado", color: "--o3" },
  { key: "No identificado", label: "No identificado", color: "--o4" },
  { key: "Sin analizar", label: "Sin analizar", color: "--vacio" }
];
const NIVELES = ["Recordar", "Comprender", "Aplicar", "Analizar", "Evaluar", "Crear"];

/* ---------- filtros comunes ---------- */
export function asignacionesFiltradas(q = {}) {
  return L("asignaciones").filter(a => a.estado !== "Cerrada" && (!q.grupo || a.grupo === q.grupo) && (!q.cur || UC(a.unidadId)?.curriculum === q.cur) && (!q.doc || a.docenteId === q.doc));
}
export const planVigente = (asgId, parcial) => L("planeaciones").filter(p => p.asignacionId === asgId && p.parcial == parcial && p.estado !== "Sustituida").sort((a, b) => (b.version || 1) - (a.version || 1))[0];

/* Materias (asignaciones) sin planeación registrada en el parcial */
export function pendientes(parcial, q = {}) {
  const porGrupo = {};
  asignacionesFiltradas(q).filter(a => !planVigente(a.id, parcial)).forEach(a => (porGrupo[a.grupo] = porGrupo[a.grupo] || []).push(a));
  Object.values(porGrupo).forEach(arr => arr.sort((x, y) => (UC(x.unidadId)?.np || 0) - (UC(y.unidadId)?.np || 0)));
  return porGrupo;
}
export function listaPendientes(parcial, q = {}, { abierto = false, soloGrupo = "" } = {}) {
  const pg = pendientes(parcial, soloGrupo ? { ...q, grupo: soloGrupo } : q);
  const grupos = Object.keys(pg).sort(); const total = grupos.reduce((a, g) => a + pg[g].length, 0);
  if (!total) return `<div class="note ok">Todas las materias${soloGrupo ? " del grupo " + esc(soloGrupo) : ""} tienen planeación registrada en el parcial ${parcial}.</div>`;
  return `<p class="muted" style="font-size:.84rem;margin-bottom:8px"><b>${total}</b> materias sin planeación registrada en el parcial ${parcial}. “Sin registro” significa que no hay archivo en el sistema; no implica incumplimiento.</p>
    <div class="pend-grupos">${grupos.map(g => `<details ${abierto || soloGrupo ? "open" : ""}><summary>Grupo ${esc(g)} ${chip(pg[g].length + " pendientes", "a")}</summary><ul style="margin:8px 0 2px;padding-left:18px">
      ${pg[g].map(a => { const u = UC(a.unidadId); return `<li><b>${esc(u?.abrev || "")}</b> — ${esc(short(u?.nombre || a.nombreFuente, 70))}<br><small class="muted">${esc(pname(a.docenteId))} · ${esc(u?.curriculum || "")}</small></li>`; }).join("")}</ul></details>`).join("")}</div>`;
}

/* Estado de instrumentos de cada planeación vigente del parcial */
export function conteoInstrumentos(parcial, q = {}) {
  const c = Object.fromEntries(ESTADOS_INSTR.map(e => [e.key, 0]));
  asignacionesFiltradas(q).forEach(a => { const p = planVigente(a.id, parcial); if (!p) return; const e = camposPlan(p).estadoInstr || "Sin analizar"; c[c[e] !== undefined ? e : "Sin analizar"]++; });
  return c;
}
export function conteoBloom(parcial, q = {}) {
  const c = [0, 0, 0, 0, 0, 0];
  asignacionesFiltradas(q).forEach(a => { const p = planVigente(a.id, parcial); const n = p?.bloom?.predominante; if (n) c[n - 1]++; });
  return c;
}

/* ---------- tablero ---------- */
export function panelStaff() {
  const q = S.route.q, pa = +(q.parcial || parcialHoy()), por = q.por || "grupo";
  const asg = asignacionesFiltradas(q);
  const conPlan = asg.filter(a => planVigente(a.id, pa));
  const obs = L("observaciones").filter(o => (!q.grupo || A(o.asignacionId)?.grupo === q.grupo) && (!q.cur || UC(A(o.asignacionId)?.unidadId)?.curriculum === q.cur));
  const obsP = obs.filter(o => o.parcial == pa);
  const ac = L("acuerdos").filter(a => (!q.grupo || A(a.asignacionId)?.grupo === q.grupo));
  const qs = (extra = {}) => new URLSearchParams(Object.fromEntries(Object.entries({ parcial: pa, grupo: q.grupo || "", ...extra }).filter(([, v]) => v !== "" && v != null))).toString();
  const k = (n, l, s, link) => `<div class="kpi ${link ? "link" : ""}" ${link ? `onclick="go('${link}')" tabindex="0" role="link"` : ""}><div class="n">${n}</div><div class="l">${l}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;

  // 1. Cobertura de planeaciones (por grupo / currículum / semestre)
  const claveDe = a => por === "cur" ? (UC(a.unidadId)?.curriculum || "—") : por === "sem" ? `${a.semestre}.º semestre` : a.grupo;
  const cats = [...new Set(asg.map(claveDe))].sort();
  const sel = S.ui.grupoSel && por === "grupo" ? S.ui.grupoSel : "";
  const filasCob = cats.map(c => { const del = asg.filter(a => claveDe(a) === c); const con = del.filter(a => planVigente(a.id, pa)).length;
    return { label: por === "grupo" ? "Grupo " + c : c, segs: { con, sin: del.length - con }, valorTexto: `${con}/${del.length}`, act: por === "grupo" ? "verPendGrupo" : "", data: { g: c }, activo: sel === c }; });
  const cobertura = apiladas({ titulo: `Planeaciones registradas · parcial ${pa}`, nota: por === "grupo" ? "Clic en un grupo para ver qué materias faltan" : "",
    filas: filasCob, series: [{ key: "con", label: "Con planeación", color: "--s1" }, { key: "sin", label: "Sin registro", color: "--vacio" }], unidad: " materias" });

  // 2. Instrumentos
  const ci = conteoInstrumentos(pa, q);
  const instr = segmentada({ titulo: `Instrumentos de evaluación · parcial ${pa}`, nota: "planeaciones registradas", unidad: "",
    segs: ESTADOS_INSTR.map(e => ({ label: e.label, value: ci[e.key], color: e.color, href: `/reportes?tipo=instrumentos&${qs({ estado: e.key })}` })) });

  // 3. Bloom
  const cb = conteoBloom(pa, q);
  const bloom = barras({ titulo: "Nivel cognitivo predominante (Bloom)", nota: "verbos detectados en las planeaciones del parcial",
    filas: NIVELES.map((l, i) => ({ label: l, value: cb[i], href: `/planeaciones?${qs({ bloom: i + 1 })}`, tip: `${l}: ${cb[i]} planeaciones` })) });

  // 4. Observaciones
  const EST = ["Programada", "En captura", "Registrada", "En diálogo", "Pendiente Vo.Bo.", "Con Vo.Bo."];
  const bo = barras({ titulo: `Observaciones del parcial ${pa} por etapa`, color: "--s1",
    filas: EST.map(e => ({ label: e, value: obsP.filter(o => o.estado === e).length, href: `/observaciones?parcial=${pa}&estado=${encodeURIComponent(e)}` })), vacio: "Aún no hay observaciones en este parcial." });

  // 5. Acuerdos
  const EA = [["Pendiente", "--s1"], ["En proceso", "--s2"], ["Cumplido", "--s3"], ["Cancelado", "--s4"]];
  const ba = segmentada({ titulo: "Acuerdos de mejora", segs: EA.map(([e, c]) => ({ label: e, value: ac.filter(a => a.estado === e).length, color: c, href: `/acuerdos?estado=${encodeURIComponent(e)}` })), vacio: "Aún no hay acuerdos registrados." });

  // 6. Transversalidad
  const gruposT = [...new Set(asg.map(a => a.grupo))].sort();
  const bt = barras({ titulo: `UAC con actividades transversales · parcial ${pa}`, nota: "según la tabla “Transversalidad curricular”", color: "--s3",
    filas: gruposT.map(g => ({ label: "Grupo " + g, value: asg.filter(a => a.grupo === g && planVigente(a.id, pa)?.transversalidad).length, href: `/paec?tab=transversalidad&parcial=${pa}&grupo=${g}` })), vacio: "Ninguna planeación del parcial incluye la tabla de transversalidad." });

  const grupos = L("grupos").map(g => g.id).sort();
  return `<div class="filters no-print" style="align-items:center"><b style="font-size:.85rem">Filtrar:</b>
    <select data-filter="parcial" aria-label="Parcial">${[1, 2, 3].map(n => opt(n, `Parcial ${n}`, pa)).join("")}</select>
    <select data-filter="grupo" aria-label="Grupo"><option value="">Todos los grupos</option>${grupos.map(g => opt(g, "Grupo " + g, q.grupo)).join("")}</select>
    <select data-filter="cur" aria-label="Currículum"><option value="">Todo el currículum</option>${["Fundamental", "Laboral", "Ampliado"].map(c => opt(c, "Currículum " + c, q.cur)).join("")}</select>
    <span class="sp"></span><a class="btn" href="#/planeaciones?carga=1">Carga masiva</a><a class="btn pri" href="#/observaciones?nueva=1">Programar observación</a></div>
  <div class="grid g5" style="margin-bottom:16px">
    ${k(`${conPlan.length}<span class="faint" style="font-size:1rem"> / ${asg.length}</span>`, "Materias con planeación", `Parcial ${pa}`, `/planeaciones?parcial=${pa}`)}
    ${k(asg.length - conPlan.length, "Materias sin registro", "Ver la lista abajo", "")}
    ${k(obsP.length, "Observaciones del parcial", `${obsP.filter(o => o.estado === "Programada").length} programadas`, `/observaciones?parcial=${pa}`)}
    ${k(obs.filter(o => o.estado === "Registrada" && !o.autorreflexionCompleta).length, "Esperan autorreflexión", "", "/observaciones?estado=Registrada")}
    ${k(ac.filter(a => ["Pendiente", "En proceso"].includes(a.estado)).length, "Acuerdos abiertos", `${ac.filter(a => a.estado === "Cumplido").length} cumplidos`, "/acuerdos")}
  </div>
  <div class="g-grid">
    <div class="wide">${cobertura.replace('<div class="g-h">', `<div class="g-h"><div class="tabs" style="margin:0;border:none">${[["grupo", "Por grupo"], ["cur", "Por currículum"], ["sem", "Por semestre"]].map(([v, t]) => `<button class="${por === v ? "on" : ""}" data-act="porCob" data-v="${v}">${t}</button>`).join("")}</div>`)}</div>
    <div class="wide g-card" id="pendientes"><div class="g-h"><h3>Materias sin planeación en el sistema${sel ? " · Grupo " + esc(sel) : ""}</h3>${sel ? `<button class="btn sm" data-act="verPendGrupo" data-g="">Ver todos los grupos</button>` : ""}<a class="btn sm" href="#/planeaciones?pend=1&parcial=${pa}">Abrir en Planeaciones</a></div>${listaPendientes(pa, q, { soloGrupo: sel })}</div>
    ${instr}${bloom}${bo}${ba}<div class="wide">${bt}</div>
  </div>
  <p class="faint" style="font-size:.75rem">Las gráficas cuentan registros del sistema por grupo, currículum o etapa; no comparan ni califican a docentes.</p>`;
}
