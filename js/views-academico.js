/* Estructura académica (catálogos versionados) y horarios */
import {
  S, VIEWS, ACT, esc, L, P, pname, UC, A, alabel, afull, opt, chip, chipEstado, modal, save, toast, isStaff, isSub, me, norm,
  periodoActual, fdate, today, nowISO, BLOQUES, DIAS, conflictosHorario, horarioPersona, short, audit, newId, isDoc
} from "./core.js";
import { setQ } from "./app.js";

const tabsHtml = (cur, list, base) => `<div class="tabs">${list.map(([k, t]) => `<button class="${cur === k ? "on" : ""}" onclick="SIAP.go('/${base}?tab=${k}')">${t}</button>`).join("")}</div>`;
const docentes = () => L("personas").filter(p => (p.roles || []).some(r => ["docente", "apoyo"].includes(r)) || L("asignaciones").some(a => a.docenteId === p.id)).sort((a, b) => a.nombre.localeCompare(b.nombre));

/* ======================= ESTRUCTURA ======================= */
VIEWS.estructura = {
  title: "Estructura académica y catálogos",
  render(r) {
    const tab = r.q.tab || "asignaciones";
    const T = [["asignaciones", "Asignaciones"], ["unidades", "Unidades curriculares"], ["grupos", "Grupos"], ["personas", "Personas"], ["calendario", "Calendario"], ["modulos", "Mapa modular"], ["actividades", "Actividades operativas"]];
    const f = { asignaciones: tAsignaciones, unidades: tUnidades, grupos: tGrupos, personas: tPersonas, calendario: tCalendario, modulos: tModulos, actividades: tActividades }[tab] || tAsignaciones;
    return tabsHtml(tab, T, "estructura") + f(r);
  }
};

function tAsignaciones(r) {
  const q = r.q; let arr = L("asignaciones").slice();
  if (q.grupo) arr = arr.filter(a => a.grupo === q.grupo);
  if (q.doc) arr = arr.filter(a => a.docenteId === q.doc);
  if (q.cur) arr = arr.filter(a => UC(a.unidadId)?.curriculum === q.cur);
  if (q.f === "rev") arr = arr.filter(a => a.estado === "Requiere revisión" || a.revision);
  if (!isStaff() && isDoc() && !q.doc && !q.grupo) arr = arr.filter(a => a.docenteId === me());
  arr.sort((a, b) => a.grupo.localeCompare(b.grupo) || (UC(a.unidadId)?.np || 0) - (UC(b.unidadId)?.np || 0));
  const grupos = L("grupos").map(g => g.id).sort();
  return `<div class="card"><div class="card-h"><h2>Asignaciones académicas · ${arr.length}</h2>${isStaff() ? `<button class="btn pri" data-act="nuevaAsg">+ Nueva asignación</button>` : ""}</div>
  <p class="muted">Relación docente – grupo – unidad curricular del ciclo. Los cambios no modifican planeaciones ni observaciones ya registradas; se conserva la versión anterior.</p>
  <div class="filters"><select data-filter="grupo"><option value="">Todos los grupos</option>${grupos.map(g => opt(g, "Grupo " + g, q.grupo)).join("")}</select>
  <select data-filter="doc"><option value="">Todas las personas</option>${docentes().map(p => opt(p.id, p.nombre, q.doc)).join("")}</select>
  <select data-filter="cur"><option value="">Todo el currículum</option>${["Fundamental", "Laboral", "Ampliado"].map(c => opt(c, "Currículum " + c, q.cur)).join("")}</select>
  <select data-filter="f"><option value="">Todos los estados</option>${opt("rev", "Con nota de revisión", q.f)}</select></div>
  <div class="tw"><table><thead><tr><th>ID</th><th>Grupo</th><th>Unidad curricular</th><th>Currículum</th><th>Docente</th><th class="num">H/sem</th><th>Estado</th><th></th></tr></thead><tbody>
  ${arr.map(a => { const u = UC(a.unidadId); return `<tr><td><small>${a.id}</small></td><td>${a.grupo}</td><td><b>${esc(u?.abrev)}</b><span class="sub">${esc(short(u?.nombre || a.nombreFuente, 90))}</span>${a.revision ? `<span class="sub" style="color:var(--ambar)">⚠ ${esc(a.revision)}</span>` : ""}</td>
  <td>${esc(u?.curriculum || "")}<span class="sub">${esc(u?.modelo || "")} · ${esc(u?.tipo || "")}</span></td><td>${esc(pname(a.docenteId))}<span class="sub">${esc(a.nombramiento || "")}</span></td><td class="num">${a.horasSemana ?? "—"}</td>
  <td>${chipEstado(a.estado)}</td><td class="num">${isStaff() ? `<button class="btn sm" data-act="editAsg" data-id="${a.id}">Editar</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="8" class="empty">Sin resultados</td></tr>`}
  </tbody></table></div></div>`;
}
ACT.editAsg = el => {
  const a = A(el.dataset.id), u = UC(a.unidadId);
  modal({ title: `Asignación ${a.id} · ${alabel(a)}`, body: `
    <p class="muted">${esc(u?.nombre)}</p>
    ${a.revision ? `<p class="note">${esc(a.revision)}</p>` : ""}
    <div class="grid g2"><div class="f"><label>Docente responsable</label><select name="docenteId">${L("personas").sort((x, y) => x.nombre.localeCompare(y.nombre)).map(p => opt(p.id, p.nombre, a.docenteId)).join("")}</select></div>
    <div class="f"><label>Estado</label><select name="estado">${["Vigente", "Requiere revisión", "Propuesta", "Cerrada"].map(e => opt(e, e, a.estado)).join("")}</select></div>
    <div class="f"><label>Horas por semana</label><input type="number" name="horasSemana" value="${a.horasSemana ?? ""}" min="0"></div>
    <div class="f"><label>Vigente desde</label><input type="date" name="vigenteDesde" value="${today()}"></div></div>
    <div class="f"><label>Motivo del cambio (queda en historial)</label><input type="text" name="motivo" placeholder="Ej. confirmación de Subdirección, cambio de horario…"></div>
    <label class="checks"><label><input type="checkbox" name="limpiar" ${a.estado === "Requiere revisión" ? "checked" : ""}> Marcar la discrepancia como resuelta</label></label>
    ${(a.historial || []).length ? `<h3 style="margin:12px 0 6px">Historial</h3><div class="tl">${a.historial.map(h => `<div class="it">${esc(h.fecha ? fdate(h.fecha) : h.fuente || "")} · ${esc(pname(h.docenteId))} ${h.motivo || h.nota ? "· " + esc(h.motivo || h.nota) : ""}</div>`).join("")}</div>` : ""}`,
    onSubmit: async o => {
      const hist = [...(a.historial || [])];
      if (o.docenteId !== a.docenteId || +o.horasSemana !== +a.horasSemana) hist.push({ fecha: today(), docenteId: a.docenteId, horas: a.horasSemana, motivo: o.motivo || "", por: me(), hasta: o.vigenteDesde });
      const d = { docenteId: o.docenteId, estado: o.limpiar && o.estado === "Requiere revisión" ? "Vigente" : o.estado, horasSemana: +o.horasSemana || a.horasSemana, historial: hist };
      if (o.limpiar) { d.revision = ""; d.revisionResuelta = (a.revision || "") + ` · Resuelto ${today()} por ${pname(me())}`; }
      await save("asignaciones", a.id, d, "cambio de asignación"); toast("Asignación actualizada.");
    }
  });
};
ACT.nuevaAsg = () => {
  const grupos = L("grupos").sort((a, b) => a.id.localeCompare(b.id));
  modal({ title: "Nueva asignación académica", body: `
    <div class="f"><label>Grupo</label><select name="grupo" required id="ng">${grupos.map(g => opt(g.id, `${g.id} · ${g.semestre}.º semestre`)).join("")}</select></div>
    <div class="f"><label>Unidad curricular</label><select name="unidadId" required>${L("unidades").sort((a, b) => a.semestre - b.semestre || a.np - b.np).map(u => opt(u.id, `S${u.semestre} · ${u.np}. ${u.abrev} — ${short(u.nombre, 60)}`)).join("")}</select><span class="hint">Elige una unidad del semestre del grupo.</span></div>
    <div class="f"><label>Docente</label><select name="docenteId" required>${docentes().map(p => opt(p.id, p.nombre)).join("")}</select></div>
    <div class="f"><label>Horas por semana</label><input type="number" name="horasSemana" min="0"></div>`,
    onSubmit: async o => {
      const g = L("grupos").find(x => x.id === o.grupo), u = UC(o.unidadId);
      if (u && g && u.semestre !== g.semestre) { toast(`La unidad es de ${u.semestre}.º semestre y el grupo de ${g.semestre}.º.`, true); return false; }
      if (L("asignaciones").some(a => a.grupo === o.grupo && a.unidadId === o.unidadId && a.estado !== "Cerrada")) { toast("Ya existe una asignación vigente para esa unidad y grupo.", true); return false; }
      const n = L("asignaciones").length + 1; const id = "ASG-" + String(n).padStart(4, "0") + "-" + newId().slice(-3);
      await save("asignaciones", id, { ciclo: g.ciclo, periodo: g.periodo, semestre: g.semestre, grado: g.grado, grupo: g.id, unidadId: o.unidadId, docenteId: o.docenteId, horasSemana: +o.horasSemana || u?.horasSemana, estado: "Vigente", fuente: "Captura en sistema", historial: [] });
      toast("Asignación creada.");
    }
  });
};

function tUnidades(r) {
  const sem = r.q.sem || "";
  const arr = L("unidades").filter(u => !sem || u.semestre == sem).sort((a, b) => a.semestre - b.semestre || a.np - b.np);
  return `<div class="card"><div class="card-h"><h2>Catálogo curricular · ${arr.length}</h2>${isStaff() ? `<button class="btn pri" data-act="editUC">+ Nueva unidad</button>` : ""}</div>
  <p class="muted">Nombre oficial, número progresivo (N.P.), abreviatura y alias de horario se mantienen separados. Los nombres son datos, no código: se editan sin programar. Fuente: <i>Número de materia 2026-2027</i>.</p>
  <div class="filters"><select data-filter="sem"><option value="">Todos los semestres</option>${[1, 2, 3, 4, 5, 6].map(s => opt(s, s + ".º semestre", sem)).join("")}</select></div>
  <div class="tw"><table><thead><tr><th>Sem</th><th class="num">N.P.</th><th>Abrev.</th><th>Nombre oficial</th><th>Tipo</th><th>Currículum / componente</th><th>Modelo</th><th class="num">H</th><th>Alias en horario</th><th></th></tr></thead><tbody>
  ${arr.map(u => `<tr><td>${u.semestre}</td><td class="num">${u.np}</td><td><b>${esc(u.abrev)}</b></td><td>${esc(u.nombre)}</td><td>${esc(u.tipo)}</td><td>${esc(u.curriculum)}<span class="sub">${esc(u.componente)}</span></td><td>${chip(u.modelo, u.modelo === "NEM" ? "m" : "b")}</td><td class="num">${u.horasSemana}</td><td>${(u.aliasHorario || []).map(x => chip(x)).join(" ")}</td><td>${isStaff() ? `<button class="btn sm" data-act="editUC" data-id="${u.id}">Editar</button>` : ""}</td></tr>`).join("")}
  </tbody></table></div></div>`;
}
ACT.editUC = el => {
  const u = el.dataset.id ? UC(el.dataset.id) : { semestre: 1, np: "", tipo: "UAC", curriculum: "Fundamental", modelo: "MCCEMS", aliasHorario: [] };
  modal({ title: u.id ? "Editar unidad curricular" : "Nueva unidad curricular", body: `
    <div class="grid g3"><div class="f"><label>Semestre</label><select name="semestre">${[1, 2, 3, 4, 5, 6].map(s => opt(s, s, u.semestre)).join("")}</select></div>
    <div class="f"><label>N.P.</label><input type="number" name="np" value="${u.np}" required></div>
    <div class="f"><label>Abreviatura</label><input type="text" name="abrev" value="${esc(u.abrev || "")}" required></div></div>
    <div class="f"><label>Nombre oficial</label><textarea name="nombre" required>${esc(u.nombre || "")}</textarea></div>
    <div class="grid g3"><div class="f"><label>Tipo</label><select name="tipo">${["UAC", "Módulo", "Submódulo", "Taller"].map(t => opt(t, t, u.tipo)).join("")}</select></div>
    <div class="f"><label>Currículum</label><select name="curriculum">${["Fundamental", "Laboral", "Ampliado"].map(t => opt(t, t, u.curriculum)).join("")}</select></div>
    <div class="f"><label>Modelo educativo</label><select name="modelo">${["MCCEMS", "NEM"].map(t => opt(t, t, u.modelo)).join("")}</select></div></div>
    <div class="grid g2"><div class="f"><label>Componente / área / recurso</label><input type="text" name="componente" value="${esc(u.componente || "")}"></div>
    <div class="f"><label>Horas por semana</label><input type="number" name="horasSemana" value="${u.horasSemana || ""}"></div></div>
    <div class="f"><label>Alias en horarios (separados por coma)</label><input type="text" name="alias" value="${esc((u.aliasHorario || []).join(", "))}"><span class="hint">Un alias no sustituye el nombre oficial.</span></div>`,
    onSubmit: async o => {
      const id = u.id || `uc-s${o.semestre}-${String(o.np).padStart(2, "0")}-${newId().slice(-3)}`;
      await save("unidades", id, { semestre: +o.semestre, np: +o.np, abrev: o.abrev, nombre: o.nombre, tipo: o.tipo, curriculum: o.curriculum, modelo: o.modelo, componente: o.componente, horasSemana: +o.horasSemana || 0, aliasHorario: o.alias.split(",").map(x => x.trim()).filter(Boolean), version: u.version || "2026-2027", activo: true }, "cambio curricular");
      toast("Catálogo actualizado.");
    }
  });
};

function tGrupos() {
  const gs = L("grupos").sort((a, b) => a.id.localeCompare(b.id));
  return `<div class="card"><div class="card-h"><h2>Grupos</h2>${isStaff() ? `<button class="btn pri" data-act="nuevoGrupo">+ Nuevo grupo</button>` : ""}</div>
  <p class="muted">Periodo A/Primero: semestres 1, 3 y 5 · Periodo B/Segundo: semestres 2, 4 y 6. El modelo educativo se registra aparte (1.º y 2.º grado MCCEMS; 3.º grado NEM).</p>
  <div class="tw"><table><thead><tr><th>Grupo</th><th>Ciclo</th><th>Periodo</th><th>Semestre</th><th>Grado</th><th>Modelo</th><th>Carrera</th><th class="num">Asignaciones</th></tr></thead><tbody>
  ${gs.map(g => `<tr><td><b>${g.id}</b></td><td>${g.ciclo}</td><td>${g.periodo}</td><td>${g.semestre}.º</td><td>${g.grado}.º</td><td>${chip(g.modelo, g.modelo === "NEM" ? "m" : "b")}</td><td>${esc(g.carrera)}</td><td class="num">${L("asignaciones").filter(a => a.grupo === g.id).length}</td></tr>`).join("")}</tbody></table></div></div>`;
}
ACT.nuevoGrupo = () => modal({ title: "Nuevo grupo", body: `
  <div class="grid g3"><div class="f"><label>Clave</label><input type="text" name="id" placeholder="201" required></div>
  <div class="f"><label>Semestre</label><select name="semestre">${[1, 2, 3, 4, 5, 6].map(s => opt(s, s)).join("")}</select></div>
  <div class="f"><label>Modelo</label><select name="modelo">${opt("MCCEMS", "MCCEMS")}${opt("NEM", "NEM")}</select></div></div>
  <div class="grid g2"><div class="f"><label>Ciclo</label><input type="text" name="ciclo" value="2026-2027"></div><div class="f"><label>Turno</label><input type="text" name="turno" value="Discontinuo"></div></div>`,
  onSubmit: async o => {
    const s = +o.semestre; await save("grupos", o.id, { clave: o.id, ciclo: o.ciclo, periodo: s % 2 ? "A" : "B", semestre: s, grado: Math.ceil(s / 2), carrera: "Técnico en Informática", turno: o.turno, modelo: o.modelo });
    toast("Grupo creado.");
  }
});

function tPersonas(r) {
  const q = norm(r.q.b || "");
  const ps = L("personas").filter(p => !q || norm(p.nombre).includes(q)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  return `<div class="card"><div class="card-h"><h2>Personas · ${ps.length}</h2><input type="text" placeholder="Buscar…" value="${esc(r.q.b || "")}" data-filter="b" style="max-width:220px">${isStaff() ? `<button class="btn pri" data-act="editPersona">+ Persona</button>` : ""}</div>
  <p class="muted">Una persona es una sola identidad aunque tenga varias funciones. Los <b>alias</b> sirven para reconocer su nombre en archivos de planeación y horarios.</p>
  <div class="tw"><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Funciones</th><th>Alias</th><th class="num">Asignaciones</th><th></th></tr></thead><tbody>
  ${ps.map(p => `<tr><td><b>${esc(p.nombre)}</b>${p.revisar ? `<span class="sub" style="color:var(--ambar)">⚠ ${esc(p.revisar)}</span>` : ""}</td><td>${esc(p.nomenclatura || "")}</td><td>${(p.funciones || []).map(f => chip(f)).join(" ")}</td><td>${(p.alias || []).map(a => `<code>${esc(a)}</code>`).join(" ")}</td><td class="num">${L("asignaciones").filter(a => a.docenteId === p.id).length}</td><td>${isStaff() ? `<button class="btn sm" data-act="editPersona" data-id="${p.id}">Editar</button>` : ""}</td></tr>`).join("")}
  </tbody></table></div></div>`;
}
ACT.editPersona = el => {
  const p = el.dataset.id ? P(el.dataset.id) : { nombre: "", alias: [], funciones: ["DOCENTE"], nomenclatura: "DFG", roles: ["docente"] };
  modal({ title: p.id ? "Editar persona" : "Nueva persona", body: `
    <div class="f"><label>Nombre completo</label><input type="text" name="nombre" value="${esc(p.nombre)}" required></div>
    <div class="grid g2"><div class="f"><label>Tipo</label><select name="nomenclatura">${[["DFG", "Docente frente a grupo"], ["DTC", "Docente tiempo completo"], ["ORI", "Orientadora"], ["DIR", "Directivo"]].map(([k, v]) => opt(k, v, p.nomenclatura)).join("")}</select></div>
    <div class="f"><label>Funciones (separadas por coma)</label><input type="text" name="funciones" value="${esc((p.funciones || []).join(", "))}"></div></div>
    <div class="f"><label>Alias para archivos y horarios (separados por coma)</label><input type="text" name="alias" value="${esc((p.alias || []).join(", "))}"><span class="hint">Ej. SANDIVEL, SANDY</span></div>
    ${p.revisar ? `<label class="checks"><label><input type="checkbox" name="confirmado"> Datos confirmados (quitar aviso de revisión)</label></label>` : ""}`,
    onSubmit: async o => {
      const id = p.id || "p-" + norm(o.nombre).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const d = { nombre: o.nombre, nombreN: norm(o.nombre), nomenclatura: o.nomenclatura, funciones: o.funciones.split(",").map(x => x.trim()).filter(Boolean), alias: o.alias.split(",").map(x => norm(x)).filter(Boolean), activo: true };
      if (!p.id) d.roles = ["docente"];
      if (o.confirmado) d.revisar = "";
      await save("personas", id, d); toast("Persona guardada.");
    }
  });
};

function tCalendario() {
  const c = periodoActual();
  if (!c) return `<div class="card empty">No hay calendario configurado.</div>`;
  const prop = c.propuesta;
  return `<div class="card"><div class="card-h"><h2>${esc(c.nombre)}</h2>${c.porConfirmar ? chip("Provisional", "a") : chip("Autorizado", "g")}</div>
  ${c.porConfirmar ? `<p class="note">${esc(c.nota || "Fechas por confirmar.")}</p>` : ""}
  <div class="tw"><table><thead><tr><th>Parcial</th><th>Inicio</th><th>Fin</th></tr></thead><tbody>${(c.parciales || []).map(p => `<tr><td><b>Parcial ${p.n}</b></td><td>${fdate(p.inicio)}</td><td>${fdate(p.fin)}</td></tr>`).join("")}</tbody></table></div>
  <p class="muted" style="margin-top:10px">El equipo de apoyo captura los cambios; la Subdirectora los autoriza. Se registra el valor anterior, el nuevo, la fecha y la persona responsable. No se imponen plazos obligatorios de carga.</p>
  <div class="row">${isStaff() ? `<button class="btn" data-act="propCal">${isSub() ? "Modificar fechas" : "Proponer cambio de fechas"}</button>` : ""}</div>
  ${prop ? `<div class="note info"><b>Propuesta pendiente</b> de ${esc(pname(prop.por))} (${fdate(prop.fecha)}): ${prop.parciales.map(p => `P${p.n}: ${fdate(p.inicio)}–${fdate(p.fin)}`).join(" · ")}<br>${esc(prop.motivo || "")}
    ${isSub() ? `<div class="row" style="margin-top:8px"><button class="btn ok sm" data-act="autCal">Autorizar</button><button class="btn sm warn" data-act="recCal">Rechazar</button></div>` : `<br><small>Esperando autorización de la Subdirectora.</small>`}</div>` : ""}
  ${(c.historial || []).length ? `<h3 style="margin:14px 0 6px">Historial de cambios</h3><div class="tl">${c.historial.map(h => `<div class="it">${fdate(h.fecha)} · ${esc(pname(h.autorizo))}: ${h.anterior.map(p => `P${p.n} ${p.inicio}→${p.fin}`).join(", ")}</div>`).join("")}</div>` : ""}</div>`;
}
ACT.propCal = () => {
  const c = periodoActual();
  modal({ title: isSub() ? "Autorizar fechas de parciales" : "Proponer fechas de parciales", body: `
    ${(c.parciales || []).map(p => `<div class="grid g2"><div class="f"><label>Parcial ${p.n} · inicio</label><input type="date" name="i${p.n}" value="${p.inicio}" required></div><div class="f"><label>Parcial ${p.n} · fin</label><input type="date" name="f${p.n}" value="${p.fin}" required></div></div>`).join("")}
    <div class="f"><label>Motivo</label><input type="text" name="motivo"></div>`,
    onSubmit: async o => {
      const ps = [1, 2, 3].map(n => ({ n, inicio: o["i" + n], fin: o["f" + n] }));
      if (ps.some(p => p.inicio > p.fin) || ps[0].fin >= ps[1].inicio || ps[1].fin >= ps[2].inicio) { toast("Revisa que las fechas no se traslapen.", true); return false; }
      if (isSub()) await save("calendario", c.id, { parciales: ps, porConfirmar: false, propuesta: null, historial: [...(c.historial || []), { fecha: today(), anterior: c.parciales, autorizo: me(), motivo: o.motivo }] }, "autorización de calendario");
      else await save("calendario", c.id, { propuesta: { parciales: ps, por: me(), fecha: today(), motivo: o.motivo } }, "propuesta de calendario");
      toast(isSub() ? "Calendario autorizado." : "Propuesta enviada a la Subdirectora.");
    }
  });
};
ACT.autCal = async () => { const c = periodoActual(); await save("calendario", c.id, { parciales: c.propuesta.parciales, porConfirmar: false, propuesta: null, historial: [...(c.historial || []), { fecha: today(), anterior: c.parciales, autorizo: me(), motivo: c.propuesta.motivo }] }, "autorización de calendario"); toast("Calendario autorizado."); };
ACT.recCal = async () => { const c = periodoActual(); await save("calendario", c.id, { propuesta: null }, "rechazo de propuesta"); toast("Propuesta rechazada."); };

function tModulos() {
  return `<div class="card"><h2 style="margin-bottom:6px">Estructura modular · Técnico en Informática</h2><p class="muted">Conservada como estructura curricular versionada. Los submódulos del periodo actual (Módulos II y IV) están ligados al catálogo; los demás se conservan como referencia.</p>
  <div class="grid g3">${L("modulos").sort((a, b) => a.semestre - b.semestre).map(m => `<div class="card flat"><div class="row">${chip(m.semestre + ".º semestre", "m")}<span class="sp"></span><b>${m.horas} h</b></div><h3 style="margin:8px 0">${esc(m.nombre)}</h3>${m.submodulos.map((s, i) => `<div style="font-size:.84rem;padding:3px 0;border-top:1px solid var(--line)">Submódulo ${["I", "II", "III", "IV", "V"][i]}. ${esc(s)}</div>`).join("")}</div>`).join("")}</div></div>`;
}
function tActividades() {
  return `<div class="card"><h2 style="margin-bottom:6px">Actividades operativas del horario</h2><p class="muted">Etiquetas del horario que no son unidades curriculares: no requieren planeación ni se monitorean como UAC (regla R-010).</p>
  <div class="tw"><table><thead><tr><th>Actividad</th><th>Tipo</th><th>Alias</th><th>Nota</th></tr></thead><tbody>${L("actividades").map(a => `<tr><td><b>${esc(a.nombre)}</b></td><td>${esc(a.tipo)}</td><td>${(a.alias || []).map(x => chip(x)).join(" ")}</td><td>${esc(a.nota || "")}</td></tr>`).join("")}</tbody></table></div></div>`;
}

/* ======================= HORARIOS ======================= */
VIEWS.horarios = {
  title: "Horarios",
  render(r) {
    const tab = r.q.tab || (isStaff() || !me() ? "grupo" : "mio");
    const T = [["grupo", "Por grupo"], ["docente", "Por persona"], ...(me() ? [["mio", "Mi horario"]] : []), ["conflictos", "Conflictos"]];
    let body = "";
    if (tab === "grupo") {
      const g = r.q.g || "101"; const h = L("horarios").find(x => x.grupo === g);
      body = `<div class="card"><div class="card-h"><h2>Grupo ${g}</h2><select data-filter="g" style="width:auto">${L("grupos").map(x => x.id).sort().map(x => opt(x, "Grupo " + x, g)).join("")}</select>
        ${h ? chip(`Versión ${h.version || 1} · vigente desde ${fdate(h.vigenteDesde)}`) : ""}</div>
        ${leyenda()}${h ? grid(c => h.celdas?.[c], isStaff() ? `data-act="editCelda" data-h="${h.id}"` : "") : `<div class="empty">Sin horario para este grupo. ${isStaff() ? `<button class="btn sm" data-act="crearHorario" data-g="${g}">Crear</button>` : ""}</div>`}
        ${h?.fuente ? `<p class="faint" style="font-size:.75rem">Fuente: ${esc(h.fuente)}. Los bloques marcados con ⚑ fueron inferidos y deben verificarse.</p>` : ""}</div>`;
    } else if (tab === "docente" || tab === "mio") {
      const pid = tab === "mio" ? me() : (r.q.p || L("asignaciones")[0]?.docenteId);
      const hp = horarioPersona(pid); const m = {}; hp.forEach(x => (m[`${x.dia}-${x.b}`] = m[`${x.dia}-${x.b}`] || []).push(x));
      body = `<div class="card"><div class="card-h"><h2>${esc(pname(pid))}</h2>${tab === "docente" ? `<select data-filter="p" style="width:auto">${docentes().map(p => opt(p.id, p.nombre, pid)).join("")}</select>` : ""}${chip(hp.length + " horas/semana en grupos")}</div>
        ${leyenda()}${grid(k => { const xs = m[k]; if (!xs) return null; const c = { ...xs[0].c, grupo: xs.map(x => x.grupo).join(" / ") }; if (xs.length > 1) c.discrepancia = "Conflicto: dos grupos a la misma hora"; return c; }, "", true)}
        <p class="faint" style="font-size:.75rem">Se construye a partir de los horarios de grupo. Actividades individuales de apoyo a Subdirección (p. ej. “Taller de Informática” de apoyo) no se muestran aquí.</p></div>`;
    } else {
      const cf = conflictosHorario();
      body = `<div class="card"><h2 style="margin-bottom:8px">Posibles conflictos</h2><p class="muted">El sistema alerta pero no corrige automáticamente.</p>
        ${cf.length ? `<div class="tw"><table><thead><tr><th>Persona</th><th>Día y hora</th><th>Grupos</th></tr></thead><tbody>${cf.map(c => { const [d, b] = c.k.split("-").map(Number); return `<tr><td>${esc(pname(c.docenteId))}</td><td>${DIAS[d]} ${BLOQUES[b][0]}–${BLOQUES[b][1]}</td><td>${c.grupos.join(", ")}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty">No se detectaron conflictos.</div>`}</div>`;
    }
    return tabsHtml(tab, T, "horarios") + body;
  }
};
const leyenda = () => `<div class="row" style="margin-bottom:10px;font-size:.78rem">${chip("Curricular", "b")} ${chip("Operativo", "d")} <span class="chip" style="box-shadow:inset 0 0 0 2px var(--rojo)">Discrepancia</span></div>`;
function grid(cellFn, attrs, showGroup = false) {
  let h = `<div class="tw" style="border:none"><div class="sched"><div></div>${DIAS.map(d => `<div class="h">${d}</div>`).join("")}`;
  BLOQUES.forEach((bl, b) => {
    if (b === 4) h += `<div class="rec">Receso 10:20 – 10:40</div>`;
    h += `<div class="t">${bl[0]}<br>${bl[1]}</div>`;
    for (let d = 0; d < 5; d++) {
      const k = `${d}-${b}`, c = cellFn(k);
      const cls = !c ? "" : c.tipo === "Operativo" ? "op" : "cur";
      const title = c ? (c.tipo === "Curricular" && c.asignacionId ? afull(c.asignacionId) : c.texto) : "";
      h += `<div class="c ${cls} ${c?.discrepancia ? "warn" : ""} ${attrs ? "edit" : ""}" ${attrs ? attrs + ` data-k="${k}"` : ""} title="${esc(title)}${c?.discrepancia ? " · " + esc(c.discrepancia) : ""}">
        ${c ? `<b>${esc(c.tipo === "Curricular" && c.asignacionId ? (UC(A(c.asignacionId)?.unidadId)?.abrev || c.texto) : c.texto)}</b>${showGroup ? esc(c.grupo || "") + "<br>" : ""}${esc(c.docenteId ? pname(c.docenteId).split(" ").slice(0, 2).join(" ") : (c.docenteTexto || ""))}${c.inferido ? " ⚑" : ""}` : ""}</div>`;
    }
  });
  return h + `</div></div>`;
}
ACT.editCelda = el => {
  const h = L("horarios").find(x => x.id === el.dataset.h), k = el.dataset.k, c = h.celdas?.[k] || {};
  const [d, b] = k.split("-").map(Number);
  const asg = L("asignaciones").filter(a => a.grupo === h.grupo);
  modal({ title: `Grupo ${h.grupo} · ${DIAS[d]} ${BLOQUES[b][0]}–${BLOQUES[b][1]}`, body: `
    <div class="f"><label>Tipo de bloque</label><select name="tipo" id="tb">${["Curricular", "Operativo", "Vacío"].map(t => opt(t, t, c.tipo || "Vacío")).join("")}</select><span class="hint">Un bloque tiene un solo destino: curricular u operativo (R-009).</span></div>
    <div class="f"><label>Asignación (si es curricular)</label><select name="asignacionId"><option value="">—</option>${asg.map(a => opt(a.id, `${alabel(a)} · ${pname(a.docenteId)}`, c.asignacionId)).join("")}</select></div>
    <div class="grid g2"><div class="f"><label>Actividad operativa</label><select name="actividadId"><option value="">—</option>${L("actividades").map(a => opt(a.id, a.nombre, c.actividadId)).join("")}</select></div>
    <div class="f"><label>Persona (operativo)</label><select name="docenteId"><option value="">—</option>${L("personas").sort((x, y) => x.nombre.localeCompare(y.nombre)).map(p => opt(p.id, p.nombre, c.docenteId)).join("")}</select></div></div>
    <div class="f"><label>Motivo del cambio</label><input type="text" name="motivo"></div>`,
    onSubmit: async o => {
      const celdas = { ...(h.celdas || {}) }; const antes = celdas[k] || null;
      if (o.tipo === "Vacío") delete celdas[k];
      else if (o.tipo === "Curricular") { const a = A(o.asignacionId); if (!a) { toast("Elige la asignación.", true); return false; } celdas[k] = { tipo: "Curricular", asignacionId: a.id, docenteId: a.docenteId, texto: UC(a.unidadId)?.abrev || "" }; }
      else { const ac = L("actividades").find(x => x.id === o.actividadId); celdas[k] = { tipo: "Operativo", actividadId: o.actividadId, docenteId: o.docenteId || null, texto: ac?.nombre || "Actividad" }; }
      await S.store.set("horarios", h.id, { celdas, version: (h.version || 1) + 1, actualizado: nowISO(), actualizadoPor: me() }, true);
      await audit("cambio de horario", "horarios", h.id, { bloque: k, antes, despues: celdas[k] || null, motivo: o.motivo });
      toast("Horario actualizado (versión anterior en auditoría).");
    }
  });
};
ACT.crearHorario = async el => { const g = el.dataset.g; await save("horarios", `2026-2027-A-${g}`, { grupo: g, ciclo: "2026-2027", periodo: "A", celdas: {}, version: 1, vigenteDesde: today() }); };
