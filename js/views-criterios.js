/* Criterios de evaluación por grado, parcial y docente (consulta para orientación y Subdirección).
   Se toman de la tabla de evaluación continua de cada planeación (producto, aspectos, instrumento, ponderación).
   Es información descriptiva: no se califica ni se compara a docentes. */
import {
  S, VIEWS, ACT, esc, L, pname, alabel, afull, opt, chip, isStaff, isOri, today, parcialHoy, periodoActual,
  gradosOri, gradoDeGrupo
} from "./core.js";
import { camposPlan } from "./views-plan.js";

const GRADO = { 1: "Primer año", 2: "Segundo año", 3: "Tercer año" };
const parciales = () => (periodoActual()?.parciales || [{ n: 1 }, { n: 2 }, { n: 3 }]).map(p => p.n);
const pct = v => { const m = String(v || "").match(/(\d+(?:[.,]\d+)?)\s*%/); return m ? parseFloat(m[1].replace(",", ".")) : null; };

/* grados que puede consultar quien está en sesión */
function gradosVisibles() {
  if (isStaff()) return [1, 2, 3];
  return isOri() ? gradosOri() : [];
}

/* planeación vigente de una asignación en un parcial */
const planDe = (asgId, parcial) => L("planeaciones").filter(p => p.asignacionId === asgId && p.parcial == parcial && p.estado !== "Sustituida")
  .sort((a, b) => (b.version || 1) - (a.version || 1))[0] || null;

/* filas de consulta: una entrada por asignación × parcial, con sus criterios */
function datos(q) {
  const gv = gradosVisibles();
  const grados = q.grado ? gv.filter(g => g == q.grado) : gv;
  const pars = q.parcial === "todos" ? parciales() : [+(q.parcial || parcialHoy())];
  let asg = L("asignaciones").filter(a => a.estado !== "Baja" && grados.includes(gradoDeGrupo(a.grupo)));
  if (q.grupo) asg = asg.filter(a => a.grupo === q.grupo);
  if (q.docente) asg = asg.filter(a => a.docenteId === q.docente);
  const out = [];
  for (const a of asg) for (const n of pars) {
    const pl = planDe(a.id, n);
    const ev = pl ? (camposPlan(pl).evaluacion || []) : [];
    const ps = ev.map(e => pct(e.ponderacion));
    const total = ev.length && ps.every(x => x != null) ? Math.round(ps.reduce((s, x) => s + x, 0) * 10) / 10 : null;
    out.push({ a, parcial: n, pl, ev, total, grado: gradoDeGrupo(a.grupo) });
  }
  return out.sort((x, y) => x.grado - y.grado || String(x.a.grupo).localeCompare(String(y.a.grupo)) || alabel(x.a).localeCompare(alabel(y.a)) || x.parcial - y.parcial);
}

VIEWS.criterios = {
  title: "Criterios de evaluación",
  render(r) {
    const q = r.q; const gv = gradosVisibles();
    if (!gv.length) return `<div class="card"><p class="muted">${isOri() ? "Tu ficha aún no tiene grado asignado. Solicita a la Subdirección que lo capture en Estructura académica → Personas (“Grado(s) que orienta”)." : "Esta consulta es para orientación y Subdirección."}</p></div>`;
    const filas = datos(q);
    const todasAsg = L("asignaciones").filter(a => a.estado !== "Baja" && gv.includes(gradoDeGrupo(a.grupo)) && (!q.grado || gradoDeGrupo(a.grupo) == q.grado));
    const grupos = [...new Set(todasAsg.map(a => a.grupo))].sort();
    const docentes = [...new Set(todasAsg.map(a => a.docenteId))].map(id => [id, pname(id)]).sort((a, b) => a[1].localeCompare(b[1]));
    const conCrit = filas.filter(f => f.ev.length).length, sinPlan = filas.filter(f => !f.pl).length, sinTabla = filas.filter(f => f.pl && !f.ev.length).length;
    const verPar = q.parcial === "todos";
    const titulo = gv.length === 1 ? `${GRADO[gv[0]]} (${gv[0]}°)` : q.grado ? `${GRADO[q.grado]} (${q.grado}°)` : "Todos los grados";
    const porGrupo = {}; filas.forEach(f => (porGrupo[f.a.grupo] = porGrupo[f.a.grupo] || []).push(f));
    const k = (n, t, f) => `<button class="kpi-mini ${q.cest === f ? "on" : ""}" onclick="SIAP.setQ('cest','${q.cest === f ? "" : f}')"><b>${n}</b><span>${t}</span></button>`;
    const visibles = f => !q.cest || (q.cest === "con" ? f.ev.length : q.cest === "sinplan" ? !f.pl : f.pl && !f.ev.length);

    return `<div class="card"><div class="card-h"><h2>Criterios de evaluación · ${esc(titulo)}</h2><button class="btn" data-act="xlsxCriterios">Descargar Excel</button></div>
      <p class="muted">Lo que cada docente evaluará en el parcial, tomado de la tabla de evaluación continua de su planeación: producto o actividad, aspectos a evaluar, instrumento y ponderación. Si una planeación no trae esa tabla o aún no se entrega, se indica; no se completa con supuestos.</p>
      <div class="kpi-row">${k(conCrit, "Con criterios identificados", "con")}${k(sinTabla, "Planeación sin tabla de evaluación", "sintabla")}${k(sinPlan, "Sin planeación del parcial", "sinplan")}</div>
      <div class="filters">
        ${gv.length > 1 ? `<select data-filter="grado"><option value="">Todos los grados</option>${gv.map(g => opt(g, `${GRADO[g]} (${g}°)`, q.grado)).join("")}</select>` : ""}
        <select data-filter="parcial">${parciales().map(n => opt(n, `Parcial ${n}`, q.parcial || parcialHoy())).join("")}${opt("todos", "Todos los parciales", q.parcial)}</select>
        <select data-filter="grupo"><option value="">Todos los grupos</option>${grupos.map(g => opt(g, g, q.grupo)).join("")}</select>
        <select data-filter="docente"><option value="">Todos los docentes</option>${docentes.map(([id, n]) => opt(id, n, q.docente)).join("")}</select></div>
    </div>
    ${Object.keys(porGrupo).length ? Object.entries(porGrupo).map(([g, fs]) => { const vis = fs.filter(visibles); if (!vis.length) return "";
      return `<div class="card"><div class="card-h"><h2>Grupo ${esc(g)} <span class="faint" style="font-weight:400;font-size:.9rem">· ${gradoDeGrupo(g)}° grado</span></h2></div>
      <div class="tw"><table class="crit"><thead><tr><th>Unidad curricular</th><th>Docente</th>${verPar ? "<th>Parcial</th>" : ""}<th>Producto / actividad</th><th>Aspectos que se evalúan</th><th>Instrumento</th><th class="num">Ponderación</th></tr></thead><tbody>
      ${vis.map(f => {
        const cab = `<td rowspan="${Math.max(1, f.ev.length) + (f.total != null && f.total !== 100 ? 1 : 0)}"><b>${esc(alabel(f.a))}</b><span class="sub">${esc(afull(f.a))}</span>${f.pl ? `<a class="sub" href="#/planeaciones?id=${f.pl.id}">Ver planeación (v${f.pl.version || 1})</a>` : ""}</td>
          <td rowspan="${Math.max(1, f.ev.length) + (f.total != null && f.total !== 100 ? 1 : 0)}">${esc(pname(f.a.docenteId))}</td>${verPar ? `<td rowspan="${Math.max(1, f.ev.length) + (f.total != null && f.total !== 100 ? 1 : 0)}">${f.parcial}</td>` : ""}`;
        if (!f.ev.length) return `<tr>${cab}<td colspan="4">${f.pl ? chip("No se identificó la tabla de evaluación en la planeación", "a") : chip(`Sin planeación del parcial ${f.parcial}`, "")}</td></tr>`;
        return f.ev.map((e, i) => `<tr>${i ? "" : cab}<td>${esc(e.producto || "—")}</td><td>${esc(e.aspectos || "—")}</td><td>${esc(e.instrumento || "—")}</td><td class="num">${esc(e.ponderacion || "—")}</td></tr>`).join("")
          + (f.total != null && f.total !== 100 ? `<tr><td colspan="4" class="faint" style="font-size:.8rem">Las ponderaciones del documento suman ${f.total}%.</td></tr>` : "");
      }).join("")}</tbody></table></div></div>`; }).join("")
      : `<div class="card"><div class="empty">No hay asignaciones con estos filtros.</div></div>`}`;
  }
};

ACT.xlsxCriterios = async () => {
  const q = S.route?.q || {};
  if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const rows = [["Grado", "Grupo", "Unidad curricular", "Docente", "Parcial", "Producto / actividad", "Aspectos que se evalúan", "Instrumento", "Ponderación", "Observación"]];
  for (const f of datos(q)) {
    const base = [f.grado, f.a.grupo, afull(f.a), pname(f.a.docenteId), f.parcial];
    if (!f.ev.length) rows.push([...base, "", "", "", "", f.pl ? "La planeación no trae tabla de evaluación identificable" : "Sin planeación del parcial"]);
    else f.ev.forEach(e => rows.push([...base, e.producto || "", e.aspectos || "", e.instrumento || "", e.ponderacion || "", ""]));
  }
  const ws = window.XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [6, 7, 38, 28, 7, 34, 50, 26, 11, 34].map(w => ({ wch: w }));
  const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, "Criterios");
  window.XLSX.writeFile(wb, `Criterios_evaluacion_${q.parcial === "todos" ? "todos" : "P" + (q.parcial || parcialHoy())}_${today()}.xlsx`);
};
