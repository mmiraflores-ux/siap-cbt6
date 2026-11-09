/* Proyectos Aula-Escuela-Comunidad (PAEC), reportes institucionales y auditoría */
import {
  S, CFG, VIEWS, ACT, esc, $, L, P, pname, UC, A, alabel, afull, opt, chip, chipEstado, modal, save, toast, isStaff, isSub, isDoc,
  isOri, isVinc, isAdmin, me, today, nowISO, fdate, fdt, parcialHoy, short, newId, audit, byId, alertas, norm, roles
} from "./core.js";
import { setQ, dropQ } from "./app.js";
import { camposPlan } from "./views-plan.js";
import { apiladas, barras, segmentada } from "./graficas.js";
import { ESTADOS_INSTR, planVigente } from "./tablero.js";

/* ======================= PAEC ======================= */
const puedePAEC = p => isStaff() || isVinc() || (p && p.responsableId === me());
const CURR = ["Fundamental", "Laboral", "Ampliado"];

VIEWS.paec = {
  title: "Proyectos Aula-Escuela-Comunidad (PAEC)",
  render(r) {
    if (r.q.id) return detallePAEC(byId("paec", r.q.id));
    const tab = r.q.tab || "proyectos";
    const tabs = `<div class="tabs"><button class="${tab === "proyectos" ? "on" : ""}" onclick="SIAP.go('/paec')">Proyectos</button><button class="${tab === "transversalidad" ? "on" : ""}" onclick="SIAP.go('/paec?tab=transversalidad')">Transversalidad planeada</button></div>`;
    if (tab === "transversalidad") return tabs + vistaTransversalidad(r.q);
    const ps = L("paec").slice().sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
    return tabs + `<div class="card"><div class="card-h"><h2>Proyectos transversales · ${ps.length}</h2>${isStaff() || isVinc() ? `<button class="btn pri" data-act="editPAEC">+ Nuevo proyecto</button>` : ""}</div>
      <p class="muted">Coordina proyectos que articulan aprendizajes de varias UAC en torno a una problemática de la comunidad. La matriz muestra la articulación <b>horizontal</b> (distintos currículos en un mismo semestre) y <b>vertical</b> (continuidad entre semestres).</p>
      ${ps.length ? `<div class="grid g3">${ps.map(p => { const asg = (p.asignaciones || []).map(A).filter(Boolean); const sems = [...new Set(asg.map(a => a.semestre))].sort();
        return `<div class="card flat" style="cursor:pointer" onclick="SIAP.go('/paec?id=${p.id}')"><div class="row">${chipEstado(p.estado)}<span class="sp"></span><small class="muted">${esc(p.periodo || "")}</small></div>
          <h3 style="margin:8px 0 4px">${esc(p.nombre)}</h3><p class="muted" style="font-size:.84rem">${esc(short(p.problematica, 140))}</p>
          <div class="row" style="font-size:.78rem">${chip(asg.length + " UAC", "m")}${chip((p.grupos || []).length + " grupos", "b")}${chip("Semestres " + (sems.join(", ") || "—"), "d")}</div></div>`; }).join("")}</div>`
      : `<div class="empty">Aún no hay proyectos. ${isStaff() || isVinc() ? "Crea el primero con “Nuevo proyecto”." : ""}</div>`}</div>`;
  }
};

function tablaTransv(t) {
  if (!t.rows.length) return `<div class="empty">Ninguna planeación vigente incluye actividades en la tabla “Transversalidad curricular”${isStaff() ? ". Si ya cargaste planeaciones, usa “Analizar de nuevo” en Planeaciones." : "."}</div>`;
  return `<div class="tw"><table><thead><tr>${t.cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map((c, i) => `<td>${i === 1 ? `<b>${esc(String(c).split(" — ")[0])}</b><span class="sub">${esc(short(String(c).split(" — ")[1] || "", 70))}</span>` : esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function vistaTransversalidad(q) {
  const t = transversalidadPlaneada(q);
  const porGrupo = {}; t.rows.forEach(r => { porGrupo[r[0]] = porGrupo[r[0]] || new Set(); porGrupo[r[0]].add(r[1]); });
  return `<div class="card"><div class="card-h"><h2>Transversalidad planeada · ${t.rows.length} actividades</h2><a class="btn" href="#/reportes?tipo=transversalidad">Ver reporte / exportar</a></div>
    <p class="muted">Actividades que cada docente declaró en la tabla <b>“Transversalidad curricular”</b> de su planeación vigente. Sirve para identificar coincidencias entre UAC de un mismo grupo (articulación horizontal) y entre semestres (vertical), y convertirlas en proyectos PAEC.</p>
    <div class="filters"><select data-filter="parcial"><option value="">Todos los parciales</option>${[1, 2, 3].map(n => opt(n, "Parcial " + n, q.parcial)).join("")}</select>
    <select data-filter="grupo"><option value="">Todos los grupos</option>${L("grupos").map(g => g.id).sort().map(g => opt(g, "Grupo " + g, q.grupo)).join("")}</select></div>
    ${Object.keys(porGrupo).length ? `<div class="row" style="margin-bottom:10px">${Object.entries(porGrupo).sort().map(([g, s]) => chip(`Grupo ${g}: ${s.size} UAC con actividades transversales`, s.size > 1 ? "g" : "")).join(" ")}</div>` : ""}
    ${tablaTransv(t)}</div>`;
}
function matriz(p) {
  const asg = (p.asignaciones || []).map(A).filter(Boolean);
  const sems = [...new Set([...(p.grupos || []).map(g => L("grupos").find(x => x.id === g)?.semestre), ...asg.map(a => a.semestre)].filter(Boolean))].sort();
  if (!sems.length) return `<div class="empty">Selecciona grupos y UAC participantes para construir la matriz.</div>`;
  let h = `<div class="tw" style="border:none"><div class="mx" style="grid-template-columns:110px repeat(${CURR.length},minmax(150px,1fr));min-width:560px"><div></div>${CURR.map(c => `<div class="hd">Currículum ${c}</div>`).join("")}`;
  sems.forEach(s => {
    h += `<div class="hd" style="display:flex;align-items:center">${s}.º semestre</div>`;
    CURR.forEach(c => { const xs = asg.filter(a => a.semestre === s && UC(a.unidadId)?.curriculum === c);
      h += `<div class="cl">${xs.map(a => `<span class="chip ${c === "Laboral" ? "m" : c === "Ampliado" ? "d" : "b"}" title="${esc(afull(a))} · ${esc(pname(a.docenteId))}">${esc(UC(a.unidadId)?.abrev)} · ${a.grupo}</span>`).join("") || `<span class="faint">—</span>`}</div>`; });
  });
  h += `</div></div>`;
  // indicadores descriptivos de articulación
  const horiz = sems.map(s => { const cs = new Set(asg.filter(a => a.semestre === s).map(a => UC(a.unidadId)?.curriculum)); return `${s}.º: ${cs.size} currículo(s), ${asg.filter(a => a.semestre === s).length} UAC`; });
  const comp = {}; asg.forEach(a => { const u = UC(a.unidadId); const k = u?.componente || "—"; (comp[k] = comp[k] || new Set()).add(a.semestre); });
  const vert = Object.entries(comp).filter(([, v]) => v.size > 1).map(([k, v]) => `${k} (${[...v].sort().join("→")})`);
  h += `<div class="grid g2" style="margin-top:12px"><div class="note info"><b>Articulación horizontal</b><br>${horiz.map(esc).join("<br>")}</div>
    <div class="note ${vert.length ? "ok" : ""}"><b>Articulación vertical</b><br>${vert.length ? vert.map(esc).join("<br>") : "Sin componentes que se repitan entre semestres. Considera integrar UAC del mismo campo en otros semestres."}</div></div>`;
  return h;
}

function detallePAEC(p) {
  if (!p) return `<div class="card empty">Proyecto no encontrado. <a href="#/paec">Volver</a></div>`;
  const av = L("paec_avances").filter(x => x.paecId === p.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const participa = (p.asignaciones || []).some(id => A(id)?.docenteId === me());
  return `<div class="row" style="margin-bottom:10px"><a class="btn sm" href="#/paec">← Proyectos</a><span class="sp"></span>${puedePAEC(p) ? `<button class="btn sm" data-act="editPAEC" data-id="${p.id}">Editar</button>` : ""}<button class="btn sm" onclick="window.print()">Imprimir / PDF</button></div>
  <div class="card"><div class="print-h"><b>${esc(CFG.institucion.nombre)}</b> · Proyecto Aula-Escuela-Comunidad</div>
    <div class="card-h"><h2>${esc(p.nombre)}</h2>${chipEstado(p.estado)}</div>
    <div class="grid g2"><div><small class="muted">Problemática / necesidad de la comunidad</small><p>${esc(p.problematica || "—")}</p><small class="muted">Propósito</small><p>${esc(p.proposito || "—")}</p></div>
    <div><small class="muted">Responsable</small><p>${esc(pname(p.responsableId))}${p.vinculacionId ? ` · Vinculación: ${esc(pname(p.vinculacionId))}` : ""}</p><small class="muted">Periodo · parciales</small><p>${esc(p.periodo || "")} · ${(p.parciales || []).map(n => "P" + n).join(", ") || "—"}</p>
    <small class="muted">Productos esperados</small><p>${esc(p.productos || "—")}</p></div></div></div>
  <div class="card"><h3 style="margin-bottom:10px">Matriz de articulación</h3>${matriz(p)}</div>
  <div class="card"><h3 style="margin-bottom:6px">Lo que los docentes planearon para este proyecto</h3><p class="muted" style="font-size:.85rem">Actividades de la tabla “Transversalidad curricular” en las planeaciones vigentes de las UAC participantes.</p>
    ${tablaTransv(transversalidadPlaneada({ asig: p.asignaciones || [] }))}</div>
  <div class="card"><div class="card-h"><h3>Bitácora de avances</h3>${puedePAEC(p) || participa ? `<button class="btn sm pri" data-act="avancePAEC" data-id="${p.id}">+ Registrar avance</button>` : ""}</div>
    ${av.length ? `<div class="tl">${av.map(a => `<div class="it"><b>${fdate(a.fecha)}</b> · ${esc(pname(a.personaId))}${a.asignacionId ? " · " + esc(alabel(a.asignacionId)) : ""} ${a.parcial ? chip("P" + a.parcial) : ""}<br>${esc(a.texto)}${a.enlace ? ` · <a href="${esc(a.enlace)}" target="_blank" rel="noopener">evidencia ↗</a>` : ""}</div>`).join("")}</div>` : `<div class="empty">Sin avances registrados.</div>`}</div>`;
}
ACT.editPAEC = el => {
  const p = el.dataset.id ? byId("paec", el.dataset.id) : { estado: "Planeación", grupos: [], asignaciones: [], parciales: [parcialHoy()], periodo: `${CFG.institucion.cicloActual} ${CFG.institucion.periodoActual}` };
  const grupos = L("grupos").map(g => g.id).sort();
  const f = modal({ title: p.id ? "Editar proyecto PAEC" : "Nuevo proyecto PAEC", wide: true, body: `
    <div class="f"><label>Nombre del proyecto</label><input type="text" name="nombre" value="${esc(p.nombre || "")}" required></div>
    <div class="grid g2"><div class="f"><label>Problemática o necesidad de la comunidad</label><textarea name="problematica">${esc(p.problematica || "")}</textarea></div>
    <div class="f"><label>Propósito</label><textarea name="proposito">${esc(p.proposito || "")}</textarea></div></div>
    <div class="grid g3"><div class="f"><label>Responsable</label><select name="responsableId">${L("personas").slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(x => opt(x.id, x.nombre, p.responsableId || me())).join("")}</select></div>
    <div class="f"><label>Vinculación (opcional)</label><select name="vinculacionId"><option value="">—</option>${L("personas").filter(x => (x.roles || []).includes("vinculadora") || (x.funciones || []).some(f => /VINCUL/i.test(f))).map(x => opt(x.id, x.nombre, p.vinculacionId)).join("")}</select></div>
    <div class="f"><label>Estado</label><select name="estado">${["Planeación", "En desarrollo", "Concluido"].map(x => opt(x, x, p.estado)).join("")}</select></div></div>
    <div class="grid g2"><div class="f"><label>Grupos participantes</label><div class="checks" id="pg">${grupos.map(g => `<label><input type="checkbox" name="grupos[]" value="${g}" ${(p.grupos || []).includes(g) ? "checked" : ""}> ${g}</label>`).join("")}</div></div>
    <div class="f"><label>Parciales</label><div class="checks">${[1, 2, 3].map(n => `<label><input type="checkbox" name="parciales[]" value="${n}" ${(p.parciales || []).map(Number).includes(n) ? "checked" : ""}> Parcial ${n}</label>`).join("")}</div></div></div>
    <div class="f"><label>UAC / submódulos que se articulan</label><div id="pu" class="checks" style="max-height:230px;overflow:auto"></div></div>
    <div class="f"><label>Productos esperados</label><textarea name="productos">${esc(p.productos || "")}</textarea></div>`,
    onSubmit: async o => {
      const id = p.id || newId("pa-");
      await save("paec", id, { nombre: o.nombre, problematica: o.problematica, proposito: o.proposito, responsableId: o.responsableId, vinculacionId: o.vinculacionId, estado: o.estado, grupos: o.grupos, parciales: (o.parciales || []).map(Number), asignaciones: o.asignaciones || [], productos: o.productos, periodo: p.periodo }, "proyecto PAEC");
      toast("Proyecto guardado."); if (!p.id) setTimeout(() => SIAP.go("/paec?id=" + id), 200);
    }
  });
  const upd = () => {
    const gs = [...f.querySelectorAll("#pg input:checked")].map(x => x.value);
    const sel = new Set([...f.querySelectorAll("#pu input:checked")].map(x => x.value).concat(p.asignaciones || []));
    f.querySelector("#pu").innerHTML = gs.length ? gs.map(g => `<div style="width:100%"><small class="muted"><b>Grupo ${g}</b></small><div class="checks">${L("asignaciones").filter(a => a.grupo === g).map(a => `<label title="${esc(afull(a))}"><input type="checkbox" name="asignaciones[]" value="${a.id}" ${sel.has(a.id) ? "checked" : ""}> ${esc(UC(a.unidadId)?.abrev)} <small class="faint">${esc(UC(a.unidadId)?.curriculum?.[0] || "")}</small></label>`).join("")}</div></div>`).join("") : `<span class="hint">Selecciona primero los grupos.</span>`;
  };
  f.querySelector("#pg").addEventListener("change", upd); upd();
};
ACT.avancePAEC = el => {
  const p = byId("paec", el.dataset.id);
  const mine = (p.asignaciones || []).map(A).filter(a => a && (isStaff() || a.docenteId === me()));
  modal({ title: "Registrar avance · " + p.nombre, body: `
    <div class="grid g3"><div class="f"><label>Fecha</label><input type="date" name="fecha" value="${today()}"></div><div class="f"><label>Parcial</label><select name="parcial">${[1, 2, 3].map(n => opt(n, n, parcialHoy())).join("")}</select></div>
    <div class="f"><label>UAC (opcional)</label><select name="asignacionId"><option value="">—</option>${mine.map(a => opt(a.id, alabel(a))).join("")}</select></div></div>
    <div class="f"><label>Avance, producto o actividad realizada</label><textarea name="texto" required></textarea></div><div class="f"><label>Enlace de evidencia (opcional)</label><input type="url" name="enlace"></div>`,
    onSubmit: async o => { await save("paec_avances", newId("pv-"), { paecId: p.id, personaId: me(), fecha: o.fecha, parcial: +o.parcial, asignacionId: o.asignacionId, texto: o.texto, enlace: o.enlace }, "avance PAEC"); toast("Avance registrado."); }
  });
};

/* ======================= REPORTES ======================= */
/* Actividades transversales declaradas en las planeaciones vigentes (tabla “Transversalidad curricular”) */
export function transversalidadPlaneada(q = {}) {
  const pls = L("planeaciones").filter(p => p.estado !== "Sustituida" && p.transversalidad && p.asignacionId)
    .filter(p => (!q.parcial || p.parcial == q.parcial) && (!q.grupo || p.grupo === q.grupo) && (!q.doc || p.docenteId === q.doc) && (!q.asig || (q.asig || []).includes(p.asignacionId)))
    .sort((a, b) => (a.grupo || "").localeCompare(b.grupo || "") || (a.parcial - b.parcial));
  // Cada docente nombra distinto las columnas: se agrupan por significado
  const rol = h => { const t = n2(h); return /\b(uac|asignaturas?|submodulos?|modulos?|materias?|vincula|disciplinas?|campos?|areas?)\b/.test(t) ? "vinculo"
    : /\b(actividad(es)?|accion(es)?|estrategias?|descripcion|transversalidad)\b/.test(t) ? "actividad" : /\b(productos?|evidencias?|entregables?)\b/.test(t) ? "producto" : "otro"; };
  const cols = ["Grupo", "Unidad curricular", "Docente", "Parcial", "Se vincula con", "Actividad planeada", "Producto", "Otros datos"];
  const rows = [];
  pls.forEach(p => {
    const base = [p.grupo, `${UC(p.unidadId)?.abrev || ""} — ${afull(p.asignacionId)}`, pname(p.docenteId), p.parcial];
    const t = p.transversalidad;
    if (!t.filas?.length) { rows.push([...base, "", t.texto || "", "", ""]); return; }
    const roles = t.headers.map(rol);
    t.filas.forEach(f => {
      const v = { vinculo: [], actividad: [], producto: [], otro: [] };
      f.celdas.forEach((c, i) => { if (!String(c).trim()) return; const r = roles[i] || "otro"; v[r].push(r === "otro" ? `${t.headers[i]}: ${c}` : c); });
      rows.push([...base, v.vinculo.join("; "), v.actividad.join("; "), v.producto.join("; "), v.otro.join(" · ")]);
    });
  });
  return { cols, rows, planeaciones: pls.length };
}
const n2 = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const TIPOS = [["planeaciones", "Planeaciones"], ["instrumentos", "Instrumentos de evaluación"], ["transversalidad", "Transversalidad (PAEC)"], ["acompanamiento", "Acompañamiento"], ["retro", "Retroalimentación"], ["acuerdos", "Acuerdos"], ["alertas", "Incidencias y alertas"], ["historico", "Histórico"], ["paec", "Articulación PAEC"]];
function datosReporte(tipo, q) {
  const fGrupo = x => !q.grupo || x.grupo === q.grupo || A(x.asignacionId)?.grupo === q.grupo;
  const fDoc = x => !q.doc || x.docenteId === q.doc;
  const fPar = x => !q.parcial || x.parcial == q.parcial;
  if (tipo === "planeaciones") {
    const cols = ["Grupo", "Unidad curricular", "Docente", "Parcial 1", "Parcial 2", "Parcial 3"];
    const rows = L("asignaciones").filter(fGrupo).filter(fDoc).sort((a, b) => a.grupo.localeCompare(b.grupo) || (UC(a.unidadId)?.np - UC(b.unidadId)?.np)).map(a => [a.grupo, `${UC(a.unidadId)?.abrev} — ${afull(a)}`, pname(a.docenteId),
      ...[1, 2, 3].map(n => { const p = L("planeaciones").filter(x => x.asignacionId === a.id && x.parcial == n && x.estado !== "Sustituida").sort((x, y) => (y.version || 1) - (x.version || 1))[0]; return p ? `${p.estadoAsociacion} · v${p.version || 1}` : "Sin registro"; })]);
    return { cols, rows, nota: "“Sin registro” significa que no hay archivo cargado en el sistema; no implica incumplimiento." };
  }
  if (tipo === "acompanamiento") {
    const cols = ["Fecha", "Parcial", "Grupo", "Unidad curricular", "Docente", "Observa", "Instrumento", "Estado"];
    const rows = L("observaciones").filter(fGrupo).filter(fDoc).filter(fPar).filter(o => !q.estado || o.estado === q.estado).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
      .map(o => [fdate(o.fecha), o.parcial || "", A(o.asignacionId)?.grupo || "", alabel(o.asignacionId), pname(o.docenteId), pname(o.observadorId), "v" + (o.instrumentoVersion || 1), o.estado]);
    return { cols, rows };
  }
  if (tipo === "retro") {
    const cols = ["Fecha sesión", "Asignación", "Docente", "Autorreflexión", "Diálogo", "Conclusiones compartidas", "Vo.Bo."];
    const rows = L("observaciones").filter(fGrupo).filter(fDoc).filter(fPar).filter(o => o.estado !== "Cancelada").map(o => { const ar = byId("autorreflexiones", o.id), dl = byId("dialogos", o.id), vb = (o.vobos || []).slice(-1)[0];
      return [fdate(o.fecha), alabel(o.asignacionId), pname(o.docenteId), ar?.enviada ? "Enviada " + fdate(ar.fechaEnvio) : "Pendiente", dl ? fdate(dl.fecha) : "Pendiente", short(dl?.conclusiones || "", 160), vb ? `${vb.resultado} (${fdate(vb.fecha)})` : (o.estado === "Pendiente Vo.Bo." ? "Pendiente" : "—")]; });
    return { cols, rows };
  }
  if (tipo === "acuerdos") {
    const cols = ["Acción", "Docente", "Responsable", "Compromiso", "Estado", "Último seguimiento"];
    const rows = L("acuerdos").filter(fDoc).filter(fGrupo).filter(a => !q.estado || a.estado === q.estado).map(a => { const s = L("seguimientos").filter(x => x.acuerdoId === a.id).sort((x, y) => (y.fecha || "").localeCompare(x.fecha || ""))[0];
      return [a.accion, pname(a.docenteId), pname(a.responsableId), fdate(a.fechaCompromiso), a.estado, s ? `${fdate(s.fecha)} · ${s.resultado}: ${short(s.observaciones, 80)}` : "—"]; });
    return { cols, rows };
  }
  if (tipo === "alertas") return { cols: ["Categoría", "Descripción"], rows: alertas().map(a => [a.cat, a.txt]) };
  if (tipo === "historico") {
    const cols = ["Fecha", "Persona", "Acción", "Colección", "Registro"];
    const rows = L("auditoria").slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, 500).map(a => [fdt(a.ts), a.nombre || pname(a.personaId), a.accion, a.col, a.docId]);
    return { cols, rows, nota: "Últimos 500 movimientos auditados del ciclo." };
  }
  if (tipo === "instrumentos") {
    const cols = ["Grupo", "Unidad curricular", "Docente", "Parcial", "¿Tiene instrumento?", "Instrumentos que usa", "Productos que evalúa", "Instrumentos desarrollados (criterios)"];
    const rows = L("planeaciones").filter(p => p.estado !== "Sustituida" && p.asignacionId).filter(fGrupo).filter(fDoc).filter(fPar)
      .filter(p => !q.estado || (camposPlan(p).estadoInstr || "Sin analizar") === q.estado).filter(p => !q.tipoI || (camposPlan(p).anexos || []).some(a => a.tipo === q.tipoI))
      .sort((a, b) => (a.grupo || "").localeCompare(b.grupo || "") || a.parcial - b.parcial).map(p => {
        const c = camposPlan(p); const ev = c.evaluacion || [];
        return [p.grupo, alabel(p.asignacionId), pname(p.docenteId), p.parcial, c.estadoInstr || "Sin analizar", (c.tiposInstr || []).join(", "),
          ev.map(e => `${e.producto || "—"} (${e.instrumento}${e.ponderacion ? ", " + e.ponderacion : ""})`).join("; "),
          (c.anexos || []).map(a => `${a.tipo}${a.titulo && a.titulo !== a.tipo ? " — " + a.titulo : ""}${a.fuente === "imagen" ? " (imagen)" : ""}${a.criterios?.length ? ": " + a.criterios.length + " criterios" : ""}`).join(" | ")];
      });
    return { cols, rows, nota: "“Incluye instrumento”: los instrumentos que usa el parcial vienen desarrollados (criterios o niveles) en el documento. “Desarrollo parcial”: solo algunos. “Solo mencionado”: se nombran pero no se incluyen. Es información descriptiva, no una calificación." };
  }
  if (tipo === "transversalidad") {
    const t = transversalidadPlaneada(q);
    return { cols: t.cols, rows: t.rows, nota: `${t.planeaciones} planeaciones vigentes incluyen la tabla “Transversalidad curricular”. Cada fila es una actividad que el docente planea realizar.` };
  }
  if (tipo === "paec") {
    const cols = ["Proyecto", "Estado", "Grupos", "Semestres", "UAC articuladas", "Currículos", "Avances"];
    const rows = L("paec").map(p => { const as = (p.asignaciones || []).map(A).filter(Boolean); return [p.nombre, p.estado, (p.grupos || []).join(", "), [...new Set(as.map(a => a.semestre))].sort().join(", "), as.map(a => alabel(a)).join(", "), [...new Set(as.map(a => UC(a.unidadId)?.curriculum))].join(", "), L("paec_avances").filter(x => x.paecId === p.id).length]; });
    return { cols, rows };
  }
  return { cols: [], rows: [] };
}
/* ---------- gráficas de cada reporte (cuentan registros; no comparan docentes) ---------- */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function porMes(arr, fecha) {
  const c = {}; arr.forEach(x => { const f = fecha(x); if (f && /^\d{4}-\d{2}/.test(f)) { const k = f.slice(0, 7); c[k] = (c[k] || 0) + 1; } });
  return Object.keys(c).sort().slice(-10).map(k => ({ label: `${MESES[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}`, value: c[k] }));
}
const COLS4 = ["--s1", "--s2", "--s3", "--s4"];
function graficasReporte(tipo, q) {
  const qs = extra => "/reportes?" + new URLSearchParams(Object.fromEntries(Object.entries({ tipo, parcial: q.parcial || "", grupo: q.grupo || "", doc: q.doc || "", ...extra }).filter(([, v]) => v !== "" && v != null))).toString();
  const fGrupo = x => !q.grupo || x.grupo === q.grupo || A(x.asignacionId)?.grupo === q.grupo;
  const fDoc = x => !q.doc || x.docenteId === q.doc;
  const fPar = x => !q.parcial || x.parcial == q.parcial;
  const grupos = L("grupos").map(g => g.id).sort().filter(g => !q.grupo || g === q.grupo);
  const g = [];
  if (tipo === "planeaciones") {
    const pars = q.parcial ? [+q.parcial] : [1, 2, 3];
    const asg = L("asignaciones").filter(a => a.estado !== "Cerrada").filter(fGrupo).filter(fDoc);
    const est = a => pars.map(n => planVigente(a.id, n)).map(p => !p ? "sin" : p.estadoAsociacion === "Identificado" ? "ok" : "rev");
    const series = [{ key: "ok", label: "Identificada", color: "--s1" }, { key: "rev", label: "Por revisar asociación", color: "--s4" }, { key: "sin", label: "Sin registro", color: "--vacio" }];
    g.push(`<div class="wide">${apiladas({ titulo: `Planeaciones por grupo · ${q.parcial ? "parcial " + q.parcial : "los tres parciales"}`, nota: "Clic en un grupo para filtrar", unidad: "", series,
      filas: grupos.map(gr => { const segs = { ok: 0, rev: 0, sin: 0 }; asg.filter(a => a.grupo === gr).forEach(a => est(a).forEach(e => segs[e]++)); return { label: "Grupo " + gr, segs, href: qs({ grupo: gr }) }; }).filter(f => f.segs.ok + f.segs.rev + f.segs.sin) })}</div>`);
    g.push(barras({ titulo: "Materias con planeación por parcial", color: "--s1", filas: [1, 2, 3].map(n => ({ label: "Parcial " + n, value: asg.filter(a => planVigente(a.id, n)).length, tip: `Parcial ${n}: ${asg.filter(a => planVigente(a.id, n)).length} de ${asg.length} materias`, href: qs({ parcial: n }) })) }));
    const cur = ["Fundamental", "Laboral", "Ampliado"];
    g.push(apiladas({ titulo: "Cobertura por currículum", series: series.filter(s => s.key !== "rev").map(s => s.key === "ok" ? { ...s, label: "Con planeación" } : s),
      filas: cur.map(c => { const del = asg.filter(a => UC(a.unidadId)?.curriculum === c); let con = 0, sin = 0; del.forEach(a => est(a).forEach(e => e === "sin" ? sin++ : con++)); return { label: c, segs: { ok: con, sin } }; }).filter(f => f.segs.ok + f.segs.sin) }));
  }
  if (tipo === "instrumentos") {
    const pls = L("planeaciones").filter(p => p.estado !== "Sustituida" && p.asignacionId).filter(fGrupo).filter(fDoc).filter(fPar);
    const c = Object.fromEntries(ESTADOS_INSTR.map(e => [e.key, 0])); pls.forEach(p => { const e = camposPlan(p).estadoInstr || "Sin analizar"; c[c[e] !== undefined ? e : "Sin analizar"]++; });
    g.push(segmentada({ titulo: "¿Las planeaciones incluyen sus instrumentos?", nota: "clic para filtrar", unidad: " planeaciones",
      segs: ESTADOS_INSTR.map(e => ({ label: e.label, value: c[e.key], color: e.color, href: qs({ estado: q.estado === e.key ? "" : e.key }) })) }));
    const tipos = {}; pls.forEach(p => (camposPlan(p).anexos || []).forEach(a => { tipos[a.tipo] = (tipos[a.tipo] || 0) + 1; }));
    const tt = Object.entries(tipos).sort((a, b) => b[1] - a[1]).slice(0, 8);
    g.push(barras({ titulo: "Tipos de instrumento desarrollados", nota: "rúbricas, listas de cotejo, etc. encontradas en los documentos", color: "--s3", vacio: "Aún no se identifican instrumentos desarrollados.",
      filas: tt.map(([t, v]) => ({ label: t.replace("Escala estimativa o de valoración", "Escala estimativa"), value: v, tip: `${t}: ${v}`, href: qs({ tipoI: q.tipoI === t ? "" : t }) })) }));
    g.push(`<div class="wide">${apiladas({ titulo: "Instrumentos por grupo", unidad: " planeaciones", series: ESTADOS_INSTR.map(e => ({ key: e.key, label: e.label, color: e.color })),
      filas: grupos.map(gr => { const segs = {}; pls.filter(p => p.grupo === gr).forEach(p => { const e = camposPlan(p).estadoInstr || "Sin analizar"; segs[e] = (segs[e] || 0) + 1; }); return { label: "Grupo " + gr, segs, href: qs({ grupo: gr }) }; }).filter(f => Object.keys(f.segs).length) })}</div>`);
  }
  if (tipo === "transversalidad") {
    const t = transversalidadPlaneada(q);
    g.push(barras({ titulo: "Actividades transversales por grupo", color: "--s3", filas: grupos.map(gr => ({ label: gr, value: t.rows.filter(r => r[0] === gr).length, href: qs({ grupo: gr }), tip: `Grupo ${gr}: ${t.rows.filter(r => r[0] === gr).length} actividades` })), vacio: "Ninguna planeación incluye la tabla de transversalidad." }));
    g.push(barras({ titulo: "UAC que declaran transversalidad", color: "--s1", filas: grupos.map(gr => ({ label: gr, value: new Set(t.rows.filter(r => r[0] === gr).map(r => r[1])).size, href: qs({ grupo: gr }) })), vacio: "Sin datos." }));
  }
  if (tipo === "acompanamiento" || tipo === "retro") {
    const obs = L("observaciones").filter(fGrupo).filter(fDoc).filter(fPar).filter(o => o.estado !== "Cancelada");
    if (tipo === "acompanamiento") {
      const EST = ["Programada", "En captura", "Registrada", "En diálogo", "Pendiente Vo.Bo.", "Con Vo.Bo."];
      g.push(barras({ titulo: "Observaciones por etapa", color: "--s1", filas: EST.map(e => ({ label: e, value: obs.filter(o => o.estado === e).length, href: qs({ estado: q.estado === e ? "" : e }) })), vacio: "Aún no hay observaciones." }));
      g.push(barras({ titulo: "Observaciones por mes", color: "--s2", filas: porMes(obs, o => o.fecha), vacio: "Sin fechas registradas." }));
    } else {
      const ar = obs.filter(o => o.estado !== "Programada" && o.estado !== "En captura");
      const env = ar.filter(o => byId("autorreflexiones", o.id)?.enviada).length, dl = ar.filter(o => byId("dialogos", o.id)).length, vb = ar.filter(o => o.estado === "Con Vo.Bo.").length;
      g.push(segmentada({ titulo: "Autorreflexión docente", unidad: " observaciones", segs: [{ label: "Enviada", value: env, color: "--s1" }, { label: "Pendiente", value: ar.length - env, color: "--vacio" }] }));
      g.push(segmentada({ titulo: "Diálogo de retroalimentación", unidad: " observaciones", segs: [{ label: "Con Vo.Bo.", value: vb, color: "--s3" }, { label: "Diálogo realizado", value: Math.max(0, dl - vb), color: "--s1" }, { label: "Pendiente", value: Math.max(0, ar.length - Math.max(dl, vb)), color: "--vacio" }] }));
    }
  }
  if (tipo === "acuerdos") {
    const ac = L("acuerdos").filter(fDoc).filter(fGrupo);
    const EA = ["Pendiente", "En proceso", "Cumplido", "Cancelado"];
    g.push(segmentada({ titulo: "Acuerdos por estado", nota: "clic para filtrar", segs: EA.map((e, i) => ({ label: e, value: ac.filter(a => a.estado === e).length, color: COLS4[i], href: qs({ estado: q.estado === e ? "" : e }) })), vacio: "Aún no hay acuerdos." }));
    const venc = ac.filter(a => ["Pendiente", "En proceso"].includes(a.estado) && a.fechaCompromiso && a.fechaCompromiso < today()).length;
    g.push(barras({ titulo: "Fechas compromiso por mes", nota: venc ? `${venc} abiertos con fecha vencida` : "", color: "--s2", filas: porMes(ac, a => a.fechaCompromiso), vacio: "Sin fechas compromiso." }));
  }
  if (tipo === "alertas") {
    const c = {}; alertas().forEach(a => c[a.cat] = (c[a.cat] || 0) + 1);
    g.push(`<div class="wide">${barras({ titulo: "Incidencias por categoría", color: "--s2", filas: Object.entries(c).map(([k, v]) => ({ label: k, value: v })), vacio: "Sin incidencias." })}</div>`);
  }
  if (tipo === "historico") {
    const au = L("auditoria");
    g.push(barras({ titulo: "Movimientos por mes", color: "--s1", filas: porMes(au, a => a.ts), vacio: "Sin movimientos." }));
    const c = {}; au.forEach(a => c[a.accion] = (c[a.accion] || 0) + 1);
    g.push(barras({ titulo: "Tipos de movimiento más frecuentes", color: "--s3", filas: Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => ({ label: short(k, 22), value: v, tip: `${k}: ${v}` })) }));
  }
  if (tipo === "paec") {
    const ps = L("paec"); const est = [...new Set(ps.map(p => p.estado))];
    g.push(segmentada({ titulo: "Proyectos por estado", segs: est.map((e, i) => ({ label: e || "—", value: ps.filter(p => p.estado === e).length, color: COLS4[i % 4] })), vacio: "Aún no hay proyectos PAEC." }));
    g.push(barras({ titulo: "UAC articuladas por proyecto", color: "--s3", filas: ps.map(p => ({ label: short(p.nombre, 18), value: (p.asignaciones || []).length, tip: `${p.nombre}: ${(p.asignaciones || []).length} UAC`, href: "/paec?id=" + p.id })), vacio: "Sin proyectos." }));
  }
  return g.length ? `<div class="g-grid" style="margin-bottom:14px">${g.join("")}</div>` : "";
}
VIEWS.reportes = {
  title: "Reportes institucionales",
  render(r) {
    const q = r.q, tipo = q.tipo || "planeaciones";
    const { cols, rows, nota } = datosReporte(tipo, q);
    const docs = [...new Set(L("asignaciones").map(a => a.docenteId))].map(P).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre));
    return `<div class="tabs no-print">${TIPOS.map(([k, t]) => `<button class="${tipo === k ? "on" : ""}" onclick="SIAP.go('/reportes?tipo=${k}')">${t}</button>`).join("")}</div>
    <div class="card"><div class="print-h"><b>${esc(CFG.institucion.nombre)}</b> · Reporte de ${esc(TIPOS.find(t => t[0] === tipo)[1])} · Generado ${fdt(nowISO())} por ${esc(S.user.nombre || "")}</div>
      <div class="card-h"><h2>${esc(TIPOS.find(t => t[0] === tipo)[1])} · ${rows.length} registros</h2><button class="btn" data-act="xlsx" data-tipo="${tipo}">⬇ Excel</button><button class="btn" onclick="window.print()">⎙ PDF</button></div>
      ${["alertas", "historico", "paec"].includes(tipo) ? "" : `<div class="filters"><select data-filter="parcial"><option value="">Todos los parciales</option>${[1, 2, 3].map(n => opt(n, "Parcial " + n, q.parcial)).join("")}</select>
      <select data-filter="grupo"><option value="">Todos los grupos</option>${L("grupos").map(g => g.id).sort().map(g => opt(g, "Grupo " + g, q.grupo)).join("")}</select>
      <select data-filter="doc"><option value="">Todas las personas</option>${docs.map(p => opt(p.id, p.nombre, q.doc)).join("")}</select>
      ${tipo === "instrumentos" ? `<select data-filter="estado" aria-label="Estado de instrumentos"><option value="">Todos los estados</option>${ESTADOS_INSTR.map(e => opt(e.key, e.label, q.estado)).join("")}</select>` : ""}
      ${tipo === "acuerdos" ? `<select data-filter="estado" aria-label="Estado"><option value="">Todos los estados</option>${["Pendiente", "En proceso", "Cumplido", "Cancelado"].map(e => opt(e, e, q.estado)).join("")}</select>` : ""}
      ${q.tipoI ? `<button class="btn sm" data-act="quitarTipoI">Tipo: ${esc(q.tipoI)} ✕</button>` : ""}</div>`}
      ${graficasReporte(tipo, q)}
      ${nota ? `<p class="note info">${esc(nota)}</p>` : ""}
      <div class="tw"><table><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="empty">Sin datos (esto no significa incumplimiento: puede no haber registros aún).</td></tr>`}</tbody></table></div>
      <p class="faint" style="font-size:.75rem;margin-top:8px">Los reportes no generan rankings ni calificaciones del desempeño docente.</p></div>`;
  }
};
ACT.quitarTipoI = () => dropQ("tipoI");
let xlsxP = null;
ACT.xlsx = async el => {
  const tipo = el.dataset.tipo; const { cols, rows } = datosReporte(tipo, S.route.q);
  if (!window.XLSX) xlsxP = xlsxP || new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  if (!window.XLSX) await xlsxP;
  const ws = window.XLSX.utils.aoa_to_sheet([[`${CFG.institucion.nombre} · Reporte ${tipo} · ${today()}`], [], cols, ...rows]);
  ws["!cols"] = cols.map(() => ({ wch: 28 }));
  const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  window.XLSX.writeFile(wb, `SIAP_${tipo}_${today()}.xlsx`);
  audit("exportación", "reportes", tipo, { registros: rows.length });
};

/* ======================= AUDITORÍA ======================= */
VIEWS.auditoria = {
  title: "Auditoría y trazabilidad",
  render(r) {
    const q = norm(r.q.b || "");
    const arr = L("auditoria").slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).filter(a => !q || norm(`${a.nombre} ${a.accion} ${a.col} ${a.docId}`).includes(q)).slice(0, 400);
    return `<div class="card"><div class="card-h"><h2>Bitácora de cambios</h2><input type="text" placeholder="Buscar…" value="${esc(r.q.b || "")}" data-filter="b" style="max-width:240px"></div>
      <p class="muted">Registra altas, modificaciones, autorizaciones, cierres, reaperturas y exportaciones. No se puede editar ni borrar desde el sistema.</p>
      <div class="tw"><table><thead><tr><th>Fecha</th><th>Persona</th><th>Acción</th><th>Registro</th><th>Cambios</th></tr></thead><tbody>
      ${arr.map(a => `<tr><td>${fdt(a.ts)}</td><td>${esc(a.nombre || pname(a.personaId))}</td><td>${chip(a.accion)}</td><td>${esc(a.col)}<span class="sub">${esc(a.docId)}</span></td>
      <td><small>${esc(short(Object.entries(a.detalle || {}).map(([k, v]) => v && typeof v === "object" && "despues" in v ? `${k}: ${short(JSON.stringify(v.antes), 30)} → ${short(JSON.stringify(v.despues), 30)}` : `${k}: ${short(JSON.stringify(v), 40)}`).join(" · "), 220))}</small></td></tr>`).join("") || `<tr><td colspan="5" class="empty">Sin movimientos.</td></tr>`}</tbody></table></div></div>`;
  }
};
