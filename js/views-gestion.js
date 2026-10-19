/* Proyectos Aula-Escuela-Comunidad (PAEC), reportes institucionales y auditoría */
import {
  S, CFG, VIEWS, ACT, esc, $, L, P, pname, UC, A, alabel, afull, opt, chip, chipEstado, modal, save, toast, isStaff, isSub, isDoc,
  isOri, isVinc, isAdmin, me, today, nowISO, fdate, fdt, parcialHoy, short, newId, audit, byId, alertas, norm, roles
} from "./core.js";
import { setQ, dropQ } from "./app.js";

/* ======================= PAEC ======================= */
const puedePAEC = p => isStaff() || isVinc() || (p && p.responsableId === me());
const CURR = ["Fundamental", "Laboral", "Ampliado"];

VIEWS.paec = {
  title: "Proyectos Aula-Escuela-Comunidad (PAEC)",
  render(r) {
    if (r.q.id) return detallePAEC(byId("paec", r.q.id));
    const ps = L("paec").slice().sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
    return `<div class="card"><div class="card-h"><h2>Proyectos transversales · ${ps.length}</h2>${isStaff() || isVinc() ? `<button class="btn pri" data-act="editPAEC">+ Nuevo proyecto</button>` : ""}</div>
      <p class="muted">Coordina proyectos que articulan aprendizajes de varias UAC en torno a una problemática de la comunidad. La matriz muestra la articulación <b>horizontal</b> (distintos currículos en un mismo semestre) y <b>vertical</b> (continuidad entre semestres).</p>
      ${ps.length ? `<div class="grid g3">${ps.map(p => { const asg = (p.asignaciones || []).map(A).filter(Boolean); const sems = [...new Set(asg.map(a => a.semestre))].sort();
        return `<div class="card flat" style="cursor:pointer" onclick="SIAP.go('/paec?id=${p.id}')"><div class="row">${chipEstado(p.estado)}<span class="sp"></span><small class="muted">${esc(p.periodo || "")}</small></div>
          <h3 style="margin:8px 0 4px">${esc(p.nombre)}</h3><p class="muted" style="font-size:.84rem">${esc(short(p.problematica, 140))}</p>
          <div class="row" style="font-size:.78rem">${chip(asg.length + " UAC", "m")}${chip((p.grupos || []).length + " grupos", "b")}${chip("Semestres " + (sems.join(", ") || "—"), "d")}</div></div>`; }).join("")}</div>`
      : `<div class="empty">Aún no hay proyectos. ${isStaff() || isVinc() ? "Crea el primero con “Nuevo proyecto”." : ""}</div>`}</div>`;
  }
};

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
const TIPOS = [["planeaciones", "Planeaciones"], ["acompanamiento", "Acompañamiento"], ["retro", "Retroalimentación"], ["acuerdos", "Acuerdos"], ["alertas", "Incidencias y alertas"], ["historico", "Histórico"], ["paec", "Articulación PAEC"]];
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
  if (tipo === "paec") {
    const cols = ["Proyecto", "Estado", "Grupos", "Semestres", "UAC articuladas", "Currículos", "Avances"];
    const rows = L("paec").map(p => { const as = (p.asignaciones || []).map(A).filter(Boolean); return [p.nombre, p.estado, (p.grupos || []).join(", "), [...new Set(as.map(a => a.semestre))].sort().join(", "), as.map(a => alabel(a)).join(", "), [...new Set(as.map(a => UC(a.unidadId)?.curriculum))].join(", "), L("paec_avances").filter(x => x.paecId === p.id).length]; });
    return { cols, rows };
  }
  return { cols: [], rows: [] };
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
      <select data-filter="doc"><option value="">Todas las personas</option>${docs.map(p => opt(p.id, p.nombre, q.doc)).join("")}</select></div>`}
      ${nota ? `<p class="note info">${esc(nota)}</p>` : ""}
      <div class="tw"><table><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="empty">Sin datos (esto no significa incumplimiento: puede no haber registros aún).</td></tr>`}</tbody></table></div>
      <p class="faint" style="font-size:.75rem;margin-top:8px">Los reportes no generan rankings ni calificaciones del desempeño docente.</p></div>`;
  }
};
let xlsxP = null;
ACT.xlsx = async el => {
  const tipo = el.dataset.tipo; const { cols, rows } = datosReporte(tipo, S.route.q);
  xlsxP = xlsxP || new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  await xlsxP;
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
