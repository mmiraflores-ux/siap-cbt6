/* Programación institucional de observaciones de clase (cronograma por día y horario).
   Cada fila del documento se vincula con su asignación (o actividad operativa) según el horario del grupo;
   desde ahí se programa la observación con la fecha concreta. Lo que no coincide queda marcado para revisión. */
import {
  S, CFG, ACT, esc, $, L, P, pname, A, alabel, afull, opt, chip, chipEstado, modal, save, toast, isStaff, canObserve,
  me, today, nowISO, fdate, parcialDe, short, audit, byId, BLOQUES, DIAS
} from "./core.js";
import { crearSesion } from "./views-plan.js";
import { crearObservacion } from "./views-obs.js";
import { resolverFila, leerCronograma, CRONOGRAMA_DOC } from "./cronograma-obs.js";

const ciclo = () => CFG.institucion.cicloActual, periodo = () => CFG.institucion.periodoActual;
const filas = () => L("cronograma_obs").filter(c => !c.retirada && (!c.ciclo || c.ciclo === ciclo()) && (!c.periodo || c.periodo === periodo()));
const obsDe = c => L("observaciones").filter(o => o.cronogramaId === c.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
const activa = c => obsDe(c).find(o => o.estado !== "Cancelada");
const horarioTxt = c => c.bloques?.length ? `${BLOQUES[c.bloques[0]][0]}–${BLOQUES[c.bloques[c.bloques.length - 1]][1]}` : c.horario;
const listo = c => !!(c.asignacionId && c.observadorId && c.docenteId && c.observadorId !== c.docenteId && c.dia >= 0 && c.bloques?.length);
const puedeProgramar = c => isStaff() && listo(c) && c.docenteId !== me();   // solo Subdirección programa
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/* siguiente fecha (desde hoy) que cae en ese día de la semana (0 = lunes) */
function proximaFecha(dia, desde = today()) {
  const d = new Date(desde + "T12:00:00");
  for (let i = 0; i < 7; i++) { if ((d.getDay() + 6) % 7 === dia) return iso(d); d.setDate(d.getDate() + 1); }
  return desde;
}
const lunesDe = f => { const d = new Date(f + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const masDias = (f, n) => { const d = new Date(f + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
function planSugerida(asgId, fecha) {
  const pa = parcialDe(fecha);
  return L("planeaciones").filter(p => p.asignacionId === asgId && p.estado !== "Sustituida")
    .sort((x, y) => (y.parcial == pa) - (x.parcial == pa) || (y.version || 1) - (x.version || 1))[0] || null;
}
const datosCatalogo = () => ({ personas: L("personas"), asignaciones: L("asignaciones"), horarios: L("horarios"), unidades: L("unidades"), actividades: L("actividades"), BLOQUES, ciclo: ciclo(), periodo: periodo() });

function estadoFila(c) {
  const o = activa(c);
  if (o) return { k: "prog", html: `<a href="#/obs/${o.id}">${chipEstado(o.estado)}</a><span class="sub">${fdate(o.fecha)}</span>` };
  if (!listo(c)) return { k: "rev", html: chip("Requiere revisión", "r") };
  return { k: "pend", html: chip("Por programar", "a") };
}

/* ======================= VISTA ======================= */
export function vistaCronograma(q) {
  const todas = filas();
  const staff = isStaff();
  if (!todas.length) return `<div class="card"><div class="card-h"><h2>Programación de observaciones</h2></div>
    ${staff ? `<p class="muted">Aún no se ha cargado el cronograma de observación de clase de este periodo.</p>
      <div class="row"><button class="btn pri" data-act="cargarCronoDoc">Cargar cronograma del documento (${CRONOGRAMA_DOC.filas.length - 1} docentes)</button>
      <label class="btn">Importar otro Excel<input type="file" accept=".xlsx,.xls" hidden data-chg="importarCrono"></label></div>
      <p class="hint" style="margin-top:8px">Se vincula cada fila con la asignación del docente según el horario del grupo. Las filas que no coincidan quedarán marcadas para revisión; no se inventan vinculaciones.</p>`
      : `<div class="empty">La Subdirección aún no publica el cronograma de observaciones.</div>`}</div>`;

  let arr = staff ? todas : todas.filter(c => c.docenteId === me() || c.observadorId === me());
  const obsPersonas = [...new Set(todas.map(c => c.observadorId).filter(Boolean))].map(P).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const est = c => estadoFila(c).k;
  const cnt = k => arr.filter(c => est(c) === k).length;
  if (q.cobs) arr = arr.filter(c => c.observadorId === q.cobs);
  if (q.cdia !== undefined && q.cdia !== "") arr = arr.filter(c => c.dia == q.cdia);
  if (q.cest) arr = arr.filter(c => est(c) === q.cest);
  arr.sort((a, b) => a.dia - b.dia || (a.bloques?.[0] ?? 9) - (b.bloques?.[0] ?? 9) || String(a.grupo).localeCompare(String(b.grupo)));
  const base = staff ? todas : todas.filter(c => c.docenteId === me() || c.observadorId === me());
  const k = (n, t, f) => `<button class="kpi-mini ${q.cest === f ? "on" : ""}" onclick="SIAP.setQ('cest','${q.cest === f ? "" : f}')"><b>${n}</b><span>${t}</span></button>`;
  const fuente = todas[0]?.fuente || "";

  return `<div class="card"><div class="card-h"><h2>Programación de observaciones · ${base.length}</h2>
    ${staff ? `<div class="row"><button class="btn pri" data-act="programarSemanaCrono">Programar una semana</button>
      <button class="btn" data-act="revincularCrono" title="Vuelve a buscar asignaciones y personas con el catálogo vigente">Volver a vincular</button>
      <label class="btn">Actualizar desde Excel<input type="file" accept=".xlsx,.xls" hidden data-chg="importarCrono"></label></div>` : ""}</div>
    <p class="muted">Cronograma ${esc(ciclo())} · periodo ${esc(periodo())}${fuente ? ` · fuente: ${esc(fuente)}` : ""}. Cada fila indica el día y horario de la clase; al programarla se elige la fecha y se crea la observación vinculada a la asignación correspondiente.</p>
    <div class="kpi-row">${k(base.filter(c => est(c) === "pend").length, "Por programar", "pend")}${k(base.filter(c => est(c) === "prog").length, "Programadas o en curso", "prog")}${k(base.filter(c => est(c) === "rev").length, "Requieren revisión", "rev")}</div>
    <div class="filters">
      ${staff ? `<select data-filter="cobs"><option value="">Todas las personas que observan</option>${obsPersonas.map(p => opt(p.id, p.nombre, q.cobs)).join("")}</select>` : ""}
      <select data-filter="cdia"><option value="">Todos los días</option>${DIAS.map((d, i) => opt(i, d, q.cdia)).join("")}</select>
      <select data-filter="cest"><option value="">Todos los estados</option>${opt("pend", `Por programar (${cnt("pend")})`, q.cest)}${opt("prog", `Programadas (${cnt("prog")})`, q.cest)}${opt("rev", `Requieren revisión (${cnt("rev")})`, q.cest)}</select></div>
    ${arr.length ? `<div class="tw"><table class="crono"><thead><tr><th>N/P</th><th>Día y horario</th><th>Docente</th><th>Asignación</th><th>Observa</th><th>Estado</th><th></th></tr></thead><tbody>
    ${arr.map(c => { const e = estadoFila(c), a = A(c.asignacionId);
      return `<tr><td>${esc(c.np)}</td><td><b>${esc(DIAS[c.dia] || c.diaTxt || "—")}</b><span class="sub">${esc(horarioTxt(c))} · ${esc(c.grupo)}</span></td>
      <td>${esc(c.docenteId ? pname(c.docenteId) : c.docente || "—")}</td>
      <td>${a ? `<b>${esc(alabel(a))}</b><span class="sub">${esc(short(afull(a), 60))}</span>` : `<span class="faint">Sin vincular</span>`}
        ${(c.notas || []).length ? `<details class="crono-notas"><summary>${c.notas.length === 1 ? "1 nota" : c.notas.length + " notas"}</summary>${c.notas.map(n => `<p>${esc(n)}</p>`).join("")}</details>` : ""}</td>
      <td>${esc(c.observadorId ? pname(c.observadorId) : c.observador || "—")}${c.rol === "Orientación" ? `<span class="sub">${chip("Orientación", "b")}</span>` : ""}</td>
      <td>${e.html}</td>
      <td class="num nowrap">${puedeProgramar(c) ? `<button class="btn sm ${e.k === "prog" ? "" : "pri"}" data-act="programarCrono" data-id="${c.id}">${e.k === "prog" ? "Otra fecha" : "Programar"}</button>` : ""}${staff ? ` <button class="btn sm" data-act="vincularCrono" data-id="${c.id}">Vincular</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div>` : `<div class="empty">No hay filas con estos filtros.</div>`}</div>`;
}

/* ======================= CARGA E IMPORTACIÓN ======================= */
async function guardarCronograma(matriz, fuente) {
  const leidas = leerCronograma(matriz);
  if (!leidas.length) { toast("El archivo no tiene filas de cronograma.", true); return; }
  const D = datosCatalogo();
  const previas = L("cronograma_obs").filter(c => c.ciclo === ciclo() && c.periodo === periodo());
  const ids = new Set();
  const ops = leidas.map(f => {
    const id = `co-${ciclo()}-${periodo()}-${String(f.np).replace(/[^\w-]/g, "") || ids.size}`;
    ids.add(id);
    const prev = byId("cronograma_obs", id);
    const r = resolverFila(f, D);
    const vinc = prev?.manual ? { asignacionId: prev.asignacionId, docenteId: prev.docenteId, observadorId: prev.observadorId, notas: prev.notas, manual: true, via: prev.via }
      : { asignacionId: r.asignacionId, docenteId: r.docenteId, observadorId: r.observadorId, notas: r.notas, manual: false, via: r.via };
    return [id, { np: String(f.np), rol: f.rol, docente: f.docente || f.docenteRef || "", grupo: r.grupo, diaTxt: f.dia, dia: r.dia, horario: f.horario, bloques: r.bloques,
      uac: f.uac, observador: f.observador, ...vinc, fuente, ciclo: ciclo(), periodo: periodo(), retirada: false }];
  });
  // filas que ya no vienen en el documento: se retiran (se conservan si tienen observaciones vinculadas)
  previas.filter(c => !ids.has(c.id) && !c.retirada).forEach(c => ops.push([c.id, { retirada: true }]));
  for (const [id, data] of ops) await save("cronograma_obs", id, data, byId("cronograma_obs", id) ? "actualización de cronograma" : "alta");
  const rev = ops.filter(([, d]) => d.np && !(d.asignacionId && d.observadorId && d.dia >= 0 && d.bloques?.length)).length;
  await audit("carga de cronograma de observación", "cronograma_obs", `${ciclo()}-${periodo()}`, { fuente, filas: leidas.length, revision: rev });
  toast(`Cronograma cargado: ${leidas.length} filas${rev ? `, ${rev} requieren revisión` : ", todas vinculadas"}.`);
}
let ocupado = false;   // evita cargas duplicadas por doble clic mientras se guarda
async function unaVez(fn) { if (ocupado) return; ocupado = true; try { await fn(); } finally { ocupado = false; } }
ACT.cargarCronoDoc = () => isStaff() && unaVez(() => guardarCronograma(CRONOGRAMA_DOC.filas, CRONOGRAMA_DOC.fuente));
ACT.importarCrono = async el => {
  const file = el.files?.[0]; if (!file || !isStaff()) return;
  try {
    if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const m = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    await unaVez(() => guardarCronograma(m, file.name));
  } catch (e) { console.error(e); toast("No se pudo leer el Excel: " + (e.message || e), true); }
  el.value = "";
};
ACT.revincularCrono = async () => {
  if (!isStaff()) return;
  const D = datosCatalogo(); let n = 0;
  for (const c of filas().filter(c => !c.manual)) {
    const r = resolverFila({ np: c.np, docente: c.rol === "Orientación" ? "" : c.docente, grupo: c.grupo, dia: c.diaTxt, horario: c.horario, uac: c.uac, observador: c.observador }, D);
    await save("cronograma_obs", c.id, { asignacionId: r.asignacionId, docenteId: r.docenteId, observadorId: r.observadorId, notas: r.notas, via: r.via, dia: r.dia, bloques: r.bloques }, "revinculación de cronograma"); n++;
  }
  toast(`Se revisaron ${n} filas con el catálogo vigente.`);
};

/* ======================= VINCULACIÓN MANUAL ======================= */
ACT.vincularCrono = el => {
  if (!isStaff()) return;
  const c = byId("cronograma_obs", el.dataset.id);
  const asg = L("asignaciones").filter(a => a.grupo === c.grupo).sort((a, b) => alabel(a).localeCompare(alabel(b)));
  const hor = L("horarios").find(h => h.grupo === c.grupo && h.periodo === periodo()) || L("horarios").find(h => h.grupo === c.grupo);
  const ops = [...new Map(Object.values(hor?.celdas || {}).filter(x => x.actividadId && x.docenteId).map(x => [`op~${x.actividadId}~${c.grupo}~${x.docenteId}`, x])).keys()];
  const obsP = L("personas").filter(p => (p.roles || []).some(r => ["subdirectora", "apoyo", "orientadora"].includes(r))).sort((a, b) => a.nombre.localeCompare(b.nombre));
  modal({ title: `Vincular fila ${c.np} del cronograma`, wide: true, submit: "Guardar vinculación", body: `
    <p class="note info">Documento: <b>${esc(c.docente || "—")}</b> · grupo ${esc(c.grupo)} · ${esc(c.diaTxt)} ${esc(c.horario)} · ${esc(c.uac || "—")} · observa ${esc(c.observador)}</p>
    ${(c.notas || []).length ? `<ul class="muted" style="font-size:.85rem">${c.notas.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    <div class="f"><label>Asignación o actividad del grupo ${esc(c.grupo)}</label><select name="asignacionId" required><option value="">— Elige —</option>
      <optgroup label="Unidades curriculares">${asg.map(a => opt(a.id, `${alabel(a)} — ${short(afull(a), 60)} · ${pname(a.docenteId)}`, c.asignacionId)).join("")}</optgroup>
      ${ops.length ? `<optgroup label="Actividades operativas del horario">${ops.map(id => opt(id, `${alabel(id)} · ${pname(A(id).docenteId)}`, c.asignacionId)).join("")}</optgroup>` : ""}</select></div>
    <div class="grid g2"><div class="f"><label>Persona que observa</label><select name="observadorId" required><option value="">— Elige —</option>${obsP.map(p => opt(p.id, p.nombre, c.observadorId)).join("")}</select></div>
    <div class="f"><label>Día</label><select name="dia">${DIAS.map((d, i) => opt(i, d, c.dia)).join("")}</select></div></div>
    <div class="f"><label>Bloques</label><div class="checks">${BLOQUES.map((b, i) => `<label><input type="checkbox" name="bloques[]" value="${i}" ${(c.bloques || []).includes(i) ? "checked" : ""}> ${b[0]}–${b[1]}</label>`).join("")}</div></div>`,
    onSubmit: async o => {
      const a = A(o.asignacionId);
      if (a.docenteId === o.observadorId) { toast("La persona observadora no puede ser la misma que la observada.", true); return false; }
      const bl = (o.bloques || []).map(Number);
      if (!bl.length) { toast("Marca al menos un bloque.", true); return false; }
      await save("cronograma_obs", c.id, { asignacionId: a.id, docenteId: a.docenteId, observadorId: o.observadorId, dia: +o.dia, bloques: bl, manual: true, via: "manual",
        notas: [`Vinculada manualmente por ${pname(me())} el ${fdate(today())}.`] }, "vinculación manual de cronograma");
      toast("Vinculación guardada.");
    }
  });
};

/* ======================= PROGRAMAR ======================= */
ACT.programarCrono = el => {
  const c = byId("cronograma_obs", el.dataset.id);
  if (!puedeProgramar(c)) { toast("Esta fila aún no se puede programar.", true); return; }
  const a = A(c.asignacionId);
  const fecha0 = proximaFecha(c.dia);
  const insts = L("instrumentos").filter(i => i.estado === "Publicado");
  const obsP = L("personas").filter(p => (p.roles || []).some(r => ["subdirectora", "apoyo", "orientadora"].includes(r))).sort((x, y) => x.nombre.localeCompare(y.nombre));
  const f = modal({ title: "Programar observación del cronograma", wide: true, submit: "Programar", body: `
    <p class="note info"><b>${esc(pname(c.docenteId))}</b> · ${esc(alabel(a))} — ${esc(short(afull(a), 70))}<br>${esc(DIAS[c.dia])} ${esc(horarioTxt(c))} · observa <b>${esc(pname(c.observadorId))}</b>${c.rol === "Orientación" ? " (orientación)" : ""}</p>
    ${(c.notas || []).length ? `<details class="crono-notas" open><summary>Notas de la vinculación</summary>${c.notas.map(n => `<p>${esc(n)}</p>`).join("")}</details>` : ""}
    <div class="grid g2"><div class="f"><label>Fecha de la observación</label><input type="date" name="fecha" id="cf" value="${fecha0}" min="${today()}" required><span class="hint" id="cfh"></span></div>
    <div class="f"><label>Persona que observa</label><select name="observadorId" ${isStaff() ? "" : "disabled"}>${obsP.map(p => opt(p.id, p.nombre, c.observadorId)).join("")}</select></div></div>
    <div class="f"><label>Bloque(s)</label><div class="checks">${c.bloques.map(b => `<label><input type="checkbox" name="bloques[]" value="${b}" checked> ${BLOQUES[b][0]}–${BLOQUES[b][1]}</label>`).join("")}</div></div>
    <div class="grid g2">${a.operativa ? `<div class="f"><label>Planeación</label><p class="muted" style="font-size:.85rem">Actividad operativa: no tiene planeación vinculada.</p></div>`
      : `<div class="f"><label>Planeación vinculada</label><select name="planeacionId" id="cp"></select></div>`}
    <div class="f"><label>Instrumento</label><select name="instrumentoId">${insts.map(i => opt(i.id, `${i.nombre} · v${i.version}`, insts[0]?.id)).join("")}</select></div></div>`,
    onSubmit: async o => {
      const obsId = isStaff() ? o.observadorId : c.observadorId;
      if (obsId === c.docenteId) { toast("La persona observadora no puede ser la misma que la observada.", true); return false; }
      if (!(o.bloques || []).length) { toast("Marca al menos un bloque.", true); return false; }
      const dup = L("observaciones").find(x => x.asignacionId === c.asignacionId && x.fecha === o.fecha && x.estado !== "Cancelada");
      if (dup) { toast(`Ya hay una observación de esta clase el ${fdate(o.fecha)}.`, true); return false; }
      await programarFila(c, o.fecha, { observadorId: obsId, bloques: o.bloques, planeacionId: o.planeacionId, instrumentoId: o.instrumentoId });
      toast("Observación programada.");
    }
  });
  const upd = () => {
    const fe = $("#cf", f).value; const d = fe ? (new Date(fe + "T12:00:00").getDay() + 6) % 7 : -1;
    $("#cfh", f).innerHTML = d === c.dia ? `Parcial ${parcialDe(fe) || "—"} · coincide con el día del cronograma.` : `<span style="color:var(--rojo)">Esa fecha es ${DIAS[d] || "fin de semana"}; el cronograma indica ${DIAS[c.dia]}.</span>`;
    if (!a.operativa) {
      const pls = L("planeaciones").filter(p => p.asignacionId === a.id).sort((x, y) => (x.estado === "Sustituida") - (y.estado === "Sustituida") || (y.parcial == parcialDe(fe)) - (x.parcial == parcialDe(fe)) || (y.version || 1) - (x.version || 1));
      $("#cp", f).innerHTML = `<option value="">— Sin planeación vinculada —</option>` + pls.map(p => opt(p.id, `Parcial ${p.parcial} · v${p.version || 1}${p.estado === "Sustituida" ? " (anterior)" : ""} · ${p.archivoNombre || "enlace"}`, planSugerida(a.id, fe)?.id)).join("");
    }
  };
  $("#cf", f).addEventListener("change", upd); upd();
};

async function programarFila(c, fecha, o = {}) {
  const pl = o.planeacionId !== undefined ? o.planeacionId : (A(c.asignacionId).operativa ? "" : planSugerida(c.asignacionId, fecha)?.id || "");
  const sesId = await crearSesion({ asignacionId: c.asignacionId, fecha, bloques: o.bloques || c.bloques, planeacionId: pl || "" });
  await save("sesiones", sesId, { estado: "Programada" }, "programación de sesión");
  const a = A(c.asignacionId);
  return crearObservacion({ id: sesId, asignacionId: a.id, docenteId: a.docenteId, fecha, planeacionId: pl || "" },
    { observadorId: o.observadorId || c.observadorId, instrumentoId: o.instrumentoId, planeacionId: pl || "", cronogramaId: c.id });
}

ACT.programarSemanaCrono = () => {
  if (!isStaff()) return;
  const lun0 = lunesDe(proximaFecha(0, masDias(today(), 1)));
  const pend = () => filas().filter(c => listo(c) && !activa(c));
  const f = modal({ title: "Programar una semana del cronograma", submit: "Programar", body: `
    <p class="muted">Se programará cada fila <b>por programar</b> en el día que indica el cronograma dentro de la semana elegida. Las filas que ya tienen observación o requieren revisión no se tocan.</p>
    <div class="f"><label>Semana que inicia el lunes</label><input type="date" name="lunes" id="sl" value="${lun0}" required><span class="hint" id="slh"></span></div>
    <div id="slp" class="muted" style="font-size:.85rem"></div>`,
    onSubmit: async o => {
      const lun = lunesDe(o.lunes); const arr = pend();
      if (!arr.length) { toast("No hay filas por programar.", true); return false; }
      let n = 0;
      for (const c of arr) {
        const fe = masDias(lun, c.dia);
        if (fe < today()) continue;
        if (L("observaciones").some(x => x.asignacionId === c.asignacionId && x.fecha === fe && x.estado !== "Cancelada")) continue;
        await programarFila(c, fe); n++;
      }
      toast(`Se programaron ${n} observaciones para la semana del ${fdate(lun)}.`);
    }
  });
  const upd = () => {
    const lun = lunesDe($("#sl", f).value || lun0); const arr = pend();
    const pasadas = arr.filter(c => masDias(lun, c.dia) < today()).length;
    $("#slh", f).textContent = `Del ${fdate(lun)} al ${fdate(masDias(lun, 4))} · parcial ${parcialDe(lun) || parcialDe(masDias(lun, 4)) || "—"}`;
    $("#slp", f).innerHTML = `${arr.length - pasadas} observaciones por programar${pasadas ? ` (${pasadas} se omiten porque su día ya pasó)` : ""}. ${DIAS.map((d, i) => `${d}: ${arr.filter(c => c.dia === i).length}`).join(" · ")}`;
  };
  $("#sl", f).addEventListener("change", upd); upd();
};
