/* Observación, autorreflexión, diálogo reflexivo, acuerdos, seguimiento, Vo.Bo. e instrumentos */
import {
  S, CFG, VIEWS, ACT, FORMS, esc, $, L, P, pname, UC, A, alabel, afull, opt, chip, chipEstado, modal, save, toast, isStaff, isSub, isDoc,
  isOri, canObserve, me, today, nowISO, fdate, fdt, parcialHoy, parcialDe, short, newId, audit, notify, byId, ESTADOS_OBS, ROLES
} from "./core.js";
import { setQ, dropQ, go, listaObs } from "./app.js";
import { formSesion, wireSesion, crearSesion, evidenciaInput, evidenciaHtml, guardarEvidencia } from "./views-plan.js";

const BL = () => window.BLOOM;
const observadores = () => L("personas").filter(p => (p.roles || []).some(r => ["subdirectora", "apoyo", "orientadora"].includes(r))).sort((a, b) => a.nombre.localeCompare(b.nombre));
const instVigente = () => L("instrumentos").find(i => i.estado === "Publicado") || L("instrumentos")[0];
const puedeEditarObs = o => o.docenteId !== me() && (o.observadorId === me() || isStaff()) && !o.detalleBloqueado && ["Programada", "En captura"].includes(o.estado);

/* ======================= LISTA ======================= */
VIEWS.observaciones = {
  title: "Observaciones de clase",
  render(r) {
    const q = r.q; let arr = L("observaciones").slice();
    if (!isStaff()) arr = arr.filter(o => o.observadorId === me() || o.docenteId === me());
    if (q.parcial) arr = arr.filter(o => o.parcial == q.parcial);
    if (q.estado) arr = arr.filter(o => o.estado === q.estado);
    if (q.doc) arr = arr.filter(o => o.docenteId === q.doc);
    setTimeout(() => { if (q.nueva && canObserve() && !$("#ov")) { dropQ("nueva"); ACT.programarObs({ dataset: {} }); } }, 0);
    const docs = [...new Set(L("observaciones").map(o => o.docenteId))].map(P).filter(Boolean);
    return `<div class="card"><div class="card-h"><h2>Observaciones · ${arr.length}</h2>${canObserve() ? `<button class="btn pri" data-act="programarObs">+ Programar observación</button>` : ""}</div>
      <div class="flow">${ESTADOS_OBS.map(e => `<span>${e}</span>`).join("")}</div>
      <p class="muted">Cada observación es independiente y se vincula a una sesión y su planeación. No existe máximo de observaciones; los antecedentes contextualizan pero no califican.</p>
      <div class="filters"><select data-filter="parcial"><option value="">Todos los parciales</option>${[1, 2, 3].map(n => opt(n, "Parcial " + n, q.parcial)).join("")}</select>
      <select data-filter="estado"><option value="">Todos los estados</option>${[...ESTADOS_OBS, "Cancelada"].map(e => opt(e, e, q.estado)).join("")}</select>
      ${isStaff() ? `<select data-filter="doc"><option value="">Todas las personas</option>${docs.map(p => opt(p.id, p.nombre, q.doc)).join("")}</select>` : ""}</div>
      ${arr.length ? listaObs(arr) : `<div class="empty">No hay observaciones con estos filtros.</div>`}</div>`;
  }
};

/* -------- programar -------- */
ACT.programarObs = el => {
  const s = el.dataset.sesion ? byId("sesiones", el.dataset.sesion) : null;
  const inst = instVigente();
  const f = modal({ title: "Programar observación", wide: true, submit: "Programar", body: `
    ${s ? `<p class="note info">Sesión: <b>${esc(alabel(s.asignacionId))}</b> · ${fdate(s.fecha)} · ${esc(pname(s.docenteId))}</p><input type="hidden" name="sesionId" value="${s.id}">` : `<p class="muted">Se registrará la sesión a observar vinculada a su planeación.</p>${formSesion()}`}
    <div class="grid g2"><div class="f"><label>Persona que observa</label><select name="observadorId" required>${observadores().map(p => opt(p.id, `${p.nombre} (${(p.roles || []).filter(r => ROLES[r] && r !== "docente").map(r => ROLES[r]).join(", ")})`, me())).join("")}</select><span class="hint">No se permite la autoobservación.</span></div>
    <div class="f"><label>Instrumento</label><select name="instrumentoId">${L("instrumentos").filter(i => i.estado === "Publicado").map(i => opt(i.id, `${i.nombre} · v${i.version}`, inst?.id)).join("")}</select></div></div>
    <div class="f"><label>Continuidad (opcional)</label><select name="anteriorId" id="oa"><option value="">— Observación independiente —</option></select><span class="hint">Enlaza con una observación previa de la misma persona para dar seguimiento.</span></div>`,
    onSubmit: async o => {
      let ses = s;
      if (!ses) { const id = await crearSesion(o); ses = { id, asignacionId: o.asignacionId, docenteId: A(o.asignacionId).docenteId, fecha: o.fecha }; await S.store.set("sesiones", id, { estado: "Programada" }); }
      if (o.observadorId === ses.docenteId) { toast("La persona observadora no puede ser la misma que la observada.", true); return false; }
      const ins = byId("instrumentos", o.instrumentoId) || inst;
      const sObj = byId("sesiones", ses.id) || ses;
      const id = newId("ob-");
      await save("observaciones", id, {
        sesionId: ses.id, asignacionId: ses.asignacionId, docenteId: ses.docenteId, observadorId: o.observadorId, fecha: ses.fecha, parcial: parcialDe(ses.fecha),
        planeacionId: sObj.planeacionId || o.planeacionId || "", instrumentoId: ins.id, instrumentoVersion: ins.version, estado: "Programada",
        autorreflexionCompleta: false, detalleBloqueado: false, anteriorId: o.anteriorId || "", ciclo: CFG.institucion.cicloActual, periodo: CFG.institucion.periodoActual
      }, "programación de observación");
      notify(ses.docenteId, "Observación", `Se programó una sesión de acompañamiento el ${fdate(ses.fecha)} (${alabel(ses.asignacionId)}).`, "#/obs/" + id, id + "p");
      if (o.observadorId !== me()) notify(o.observadorId, "Observación", `Se te asignó observar ${alabel(ses.asignacionId)} el ${fdate(ses.fecha)}.`, "#/obs/" + id, id + "o");
      toast("Observación programada."); setTimeout(() => go("/obs/" + id), 200);
    }
  });
  const updAnt = () => {
    const did = s ? s.docenteId : A($("#sa", f)?.value)?.docenteId;
    $("#oa", f).innerHTML = `<option value="">— Observación independiente —</option>` + L("observaciones").filter(x => x.docenteId === did).map(x => opt(x.id, `${fdate(x.fecha)} · ${alabel(x.asignacionId)} · ${x.estado}`)).join("");
  };
  if (!s) { wireSesion(f); $("#sa", f).addEventListener("change", updAnt); }
  updAnt();
};

/* ======================= DETALLE ======================= */
VIEWS.obs = {
  title: () => "Acompañamiento de sesión",
  render(r) {
    const o = byId("observaciones", r.id);
    if (!o) return `<div class="card empty">No se encontró la observación o no tienes acceso. <a href="#/observaciones">Volver</a></div>`;
    const soyDoc = o.docenteId === me(), soyObs = o.observadorId === me(), staff = isStaff();
    /* El registro detallado se lee documento por documento (no por suscripción) para que las reglas
       de seguridad oculten la valoración al docente observado hasta que envíe su autorreflexión. */
    const verDet = soyDoc ? (o.autorreflexionCompleta && o.detalleBloqueado) : (staff || soyObs);
    S.ui.det = S.ui.det || {};
    const c = S.ui.det[o.id];
    if (verDet && (!c || (c.v !== (o.actualizado || "") && !c.loading))) {
      S.ui.det[o.id] = { v: o.actualizado || "", loading: true, d: c?.d };
      S.store.get("observacion_detalle", o.id).then(d => { S.ui.det[o.id] = { v: o.actualizado || "", d: d || null }; SIAP.render(); })
        .catch(() => { S.ui.det[o.id] = { v: o.actualizado || "", d: null }; SIAP.render(); });
    }
    const det = verDet ? S.ui.det[o.id]?.d : null;
    const cargando = verDet && det === undefined && S.ui.det[o.id]?.loading;
    const ar = byId("autorreflexiones", o.id), dl = byId("dialogos", o.id);
    const ins = byId("instrumentos", o.instrumentoId) || instVigente();
    const crit = det?.criterios || ins.criterios;
    const ses = byId("sesiones", o.sesionId), pl = byId("planeaciones", o.planeacionId || ses?.planeacionId);
    const idx = ESTADOS_OBS.indexOf(o.estado);
    const flow = `<div class="flow">${ESTADOS_OBS.map((e, i) => `<span class="${i < idx ? "done" : i === idx ? "now" : ""}">${e}</span>`).join("")}</div>`;
    const ant = o.anteriorId ? byId("observaciones", o.anteriorId) : null;
    const acs = L("acuerdos").filter(a => a.observacionId === o.id);
    let h = `<div class="row" style="margin-bottom:10px"><a class="btn sm" href="#/observaciones">← Observaciones</a><span class="sp"></span>
      ${(staff || soyObs) && o.estado === "Programada" ? `<button class="btn sm warn" data-act="cancelarObs" data-id="${o.id}">Cancelar</button>` : ""}
      ${isSub() && o.detalleBloqueado ? `<button class="btn sm" data-act="reabrirObs" data-id="${o.id}">Reabrir (autorizado)</button>` : ""}<button class="btn sm" onclick="window.print()">Imprimir / PDF</button></div>
    <div class="card"><div class="print-h"><b>${esc(CFG.institucion.nombre)}</b> · Registro de acompañamiento</div>
      <div class="card-h"><h2>${esc(alabel(o.asignacionId))} · ${fdate(o.fecha)}</h2>${chipEstado(o.estado)}</div>${flow}
      <div class="grid g4" style="font-size:.86rem"><div><small class="muted">Docente</small><br><b>${esc(pname(o.docenteId))}</b></div><div><small class="muted">Observa</small><br><b>${esc(pname(o.observadorId))}</b></div>
      <div><small class="muted">Unidad curricular</small><br>${esc(short(afull(o.asignacionId), 70))}</div><div><small class="muted">Instrumento</small><br>${esc(ins.nombre)} · v${o.instrumentoVersion || ins.version}</div></div>
      ${ant ? `<p class="note info">Continuidad con la observación del ${fdate(ant.fecha)} (<a href="#/obs/${ant.id}">ver</a>). Los antecedentes contextualizan; no sustituyen la evidencia de esta sesión.</p>` : ""}
      ${pl ? `<details style="margin-top:8px"><summary class="muted" style="cursor:pointer">Lo planeado (planeación v${pl.version || 1})</summary><p style="font-size:.85rem"><b>Progresión:</b> ${esc(pl.progresion || pl.extraido?.progresion || "—")}<br><b>Propósito:</b> ${esc(pl.proposito || pl.extraido?.proposito || "—")}<br><b>Estrategias:</b> ${esc(short(pl.estrategias || pl.extraido?.estrategias || "—", 400))}</p></details>` : `<p class="faint" style="font-size:.8rem">Sesión sin planeación vinculada.</p>`}
    </div>`;

    /* --- contexto del docente --- */
    if (soyDoc && ["Programada", "En captura", "Registrada"].includes(o.estado)) {
      h += `<form class="card" data-form="obsContexto" data-id="${o.id}"><h3>Contexto que deseo compartir (opcional)</h3><p class="muted" style="font-size:.84rem">Condiciones del grupo, ajustes previstos o situaciones que conviene considerar.</p>
        <textarea name="contextoDocente">${esc(o.contextoDocente || "")}</textarea><div class="row end" style="margin-top:8px"><button class="btn">Guardar contexto</button></div></form>`;
    } else if (o.contextoDocente) h += `<div class="card"><h3>Contexto aportado por el docente</h3><p>${esc(o.contextoDocente)}</p></div>`;

    /* --- registro del observador --- */
    if (cargando) h += `<div class="card"><p class="muted">Cargando registro de observación…</p></div>`;
    else if (puedeEditarObs(o)) h += formObservacion(o, det, crit, ins, pl);
    else if (verDet && det) h += vistaObservacion(o, det, crit);
    else if (soyDoc && !verDet) h += `<div class="card"><h3>Registro de quien observa</h3><p class="note info">${o.detalleBloqueado ? "Podrás consultar los criterios, notas y valoración de quien te observó <b>después de enviar tu autorreflexión</b>." : "La observación aún está en proceso de registro."}</p></div>`;
    else if (!det && !soyDoc && ["Programada", "En captura"].includes(o.estado)) h += `<div class="card"><p class="muted">Aún no hay registro del observador.</p></div>`;

    /* --- autorreflexión --- */
    if (soyDoc && !ar?.enviada) h += formAutorreflexion(o, ar, ins);
    else if (ar?.enviada && (soyDoc || soyObs || staff)) h += `<div class="card"><div class="card-h"><h3>Autorreflexión del docente</h3>${chip("Enviada " + fdate(ar.fechaEnvio), "g")}</div>${(ins.preguntasAutorreflexion || []).map((q, i) => `<p><b>${esc(q)}</b><br>${esc(ar["q" + (i + 1)] || "—")}</p>`).join("")}</div>`;
    else if ((soyObs || staff) && !soyDoc && o.detalleBloqueado) h += `<div class="card"><h3>Autorreflexión</h3><p class="muted">El docente aún no envía su autorreflexión.</p></div>`;

    /* --- diálogo reflexivo --- */
    if ((soyObs || staff) && !soyDoc && o.autorreflexionCompleta && ["Registrada", "En diálogo"].includes(o.estado)) h += formDialogo(o, dl, ins);
    else if (dl && (soyDoc || soyObs || staff)) h += vistaDialogo(dl, ins);

    /* --- acuerdos --- */
    if (dl || acs.length) {
      h += `<div class="card"><div class="card-h"><h3>Acuerdos de mejora</h3>${(soyObs || staff) && !soyDoc && o.estado !== "Cancelada" ? `<button class="btn sm pri" data-act="nuevoAcuerdo" data-obs="${o.id}">+ Acuerdo</button>` : ""}</div>
      <p class="muted" style="font-size:.84rem">No toda observación debe producir un acuerdo, y no todo acuerdo requiere otra observación.</p>
      ${acs.length ? `<div class="tw"><table><thead><tr><th>Acción</th><th>Responsable</th><th>Compromiso</th><th>Estado</th><th></th></tr></thead><tbody>${acs.map(a => `<tr><td>${esc(a.accion)}${a.evidenciaEsperada ? `<span class="sub">Evidencia esperada: ${esc(a.evidenciaEsperada)}</span>` : ""}</td><td>${esc(pname(a.responsableId))}</td><td>${fdate(a.fechaCompromiso)}</td><td>${chipEstado(a.estado)}</td><td class="num"><button class="btn sm" data-act="verAcuerdo" data-id="${a.id}">Seguimiento</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Sin acuerdos.</div>`}</div>`;
    }

    /* --- Vo.Bo. --- */
    const vobos = o.vobos || [];
    if (o.estado === "Pendiente Vo.Bo." || vobos.length) {
      h += `<div class="card"><h3 style="margin-bottom:8px">Vo.Bo. de la Subdirección</h3>${vobos.map(v => `<p>${chip(v.resultado, v.resultado === "Aprobado" ? "g" : "a")} ${esc(pname(v.por))} · ${fdt(v.fecha)}<br><small>${esc(v.comentario || "")}</small></p>`).join("")}
      ${isSub() && o.estado === "Pendiente Vo.Bo." ? `<form data-form="vobo" data-id="${o.id}"><div class="grid g2"><div class="f"><label>Resultado</label><select name="resultado">${["Aprobado", "Con observaciones", "Requiere ajuste"].map(x => opt(x, x)).join("")}</select></div><div class="f"><label>Comentario</label><input type="text" name="comentario"></div></div><div class="row end"><button class="btn ok">Otorgar Vo.Bo.</button></div></form>` : o.estado === "Pendiente Vo.Bo." ? `<p class="muted">Esperando Vo.Bo.</p>` : ""}</div>`;
    }
    const hist = o.reaperturas || [];
    if (hist.length) h += `<div class="card"><h3 style="margin-bottom:8px">Reaperturas autorizadas</h3><div class="tl">${hist.map(x => `<div class="it">${fdt(x.fecha)} · ${esc(pname(x.por))}: ${esc(x.motivo)}</div>`).join("")}</div></div>`;
    return h;
  }
};

function formObservacion(o, det, crit, ins, pl) {
  det = det || {};
  const verbosPl = pl?.bloom?.verbos ? Object.keys(pl.bloom.verbos) : [];
  const BN = BL().NIVELES;
  const bp = det.bloomPlaneado || pl?.bloomProgresion || pl?.bloom?.maxNivel || "";
  return `<form class="card" data-form="obsDetalle" data-id="${o.id}"><div class="card-h"><h3>Registro de observación</h3>${chip("Borrador visible solo para el equipo", "")}</div>
    <p class="muted" style="font-size:.84rem">Distingue lo observado directamente, la evidencia disponible y tu interpretación pedagógica. Los criterios no aplicables no penalizan.</p>
    ${crit.map(c => { const v = det.respuestas?.[c.id] || {}; return `<div class="crit"><div class="ct"><b>${esc(c.texto)}</b><div class="scale">${ins.escala.map((e, i) => `<input type="radio" name="n_${c.id}" id="${c.id}_${i}" value="${e}" ${v.nivel === e ? "checked" : ""}><label for="${c.id}_${i}">${e}</label>`).join("")}</div></div>
      <textarea name="t_${c.id}" placeholder="Lo observado / evidencia / interpretación" style="min-height:52px">${esc(v.nota || "")}</textarea>
      ${c.bloom ? `<div class="grid g3" style="margin-top:8px"><div class="f"><label>Verbo de la progresión planeada</label><input type="text" name="bloomVerbo" list="vl" value="${esc(det.bloomVerbo || "")}" placeholder="ej. analizar"><datalist id="vl">${verbosPl.map(v => `<option value="${esc(v)}">`).join("")}</datalist></div>
        <div class="f"><label>Nivel cognitivo planeado</label><select name="bloomPlaneado"><option value="">—</option>${BN.map(n => opt(n.n, `${n.n}. ${n.nombre}`, bp)).join("")}</select></div>
        <div class="f"><label>Nivel demandado en la actividad observada</label><select name="bloomObservado"><option value="">—</option>${BN.map(n => opt(n.n, `${n.n}. ${n.nombre}`, det.bloomObservado)).join("")}</select></div></div>
        ${det.bloomPlaneado && det.bloomObservado ? `<p class="note ${BL().congruencia(+det.bloomPlaneado, +det.bloomObservado).chip === "g" ? "ok" : "info"}">${esc(BL().congruencia(+det.bloomPlaneado, +det.bloomObservado).texto)}</p>` : ""}` : ""}</div>`; }).join("")}
    <div class="grid g2"><div class="f"><label>Fortalezas identificadas</label><textarea name="fortalezas">${esc(det.fortalezas || "")}</textarea></div><div class="f"><label>Oportunidades de mejora</label><textarea name="oportunidades">${esc(det.oportunidades || "")}</textarea></div></div>
    <div class="f"><label>Notas generales y evidencia observada</label><textarea name="notas">${esc(det.notas || "")}</textarea></div>
    ${evidenciaHtml(L("evidencias").filter(e => e.refCol === "observaciones" && e.refId === o.id))}${evidenciaInput()}
    <div class="row end" style="margin-top:10px"><button class="btn" value="borrador">Guardar borrador</button><button class="btn pri" value="cerrar">Cerrar registro y enviar a autorreflexión</button></div>
    <p class="faint" style="font-size:.75rem">Al cerrar, el registro queda protegido (solo se modifica con reapertura autorizada) y se notifica al docente para su autorreflexión.</p></form>`;
}
function vistaObservacion(o, det, crit) {
  const cg = det.bloomPlaneado && det.bloomObservado ? BL().congruencia(+det.bloomPlaneado, +det.bloomObservado) : null;
  const BN = BL().NIVELES;
  return `<div class="card"><div class="card-h"><h3>Registro de observación</h3>${o.detalleBloqueado ? chip("Cerrado " + fdate(det.fechaCierre), "g") : chip("En captura", "a")}</div>
    <div class="tw"><table><thead><tr><th>Criterio</th><th>Nivel</th><th>Lo observado</th></tr></thead><tbody>${crit.map(c => { const v = det.respuestas?.[c.id] || {}; return `<tr><td><b>${esc(c.texto)}</b></td><td>${v.nivel ? chip(v.nivel, v.nivel === "No aplica" ? "" : "m") : `<span class="faint">Pendiente</span>`}</td><td>${esc(v.nota || "")}</td></tr>`; }).join("")}</tbody></table></div>
    ${cg ? `<p class="note ${cg.chip === "g" ? "ok" : "info"}"><b>Bloom:</b> verbo “${esc(det.bloomVerbo || "—")}” · planeado ${BN[det.bloomPlaneado - 1].nombre} · observado ${BN[det.bloomObservado - 1].nombre}. ${esc(cg.texto)}</p>` : ""}
    <div class="grid g2" style="margin-top:10px"><div><b>Fortalezas</b><p>${esc(det.fortalezas || "—")}</p></div><div><b>Oportunidades de mejora</b><p>${esc(det.oportunidades || "—")}</p></div></div>
    ${det.notas ? `<p><b>Notas:</b> ${esc(det.notas)}</p>` : ""}${evidenciaHtml(L("evidencias").filter(e => e.refCol === "observaciones" && e.refId === o.id))}
    <p class="faint" style="font-size:.75rem">Resultado descriptivo: el sistema no calcula puntajes, promedios ni rankings.</p></div>`;
}
function formAutorreflexion(o, ar, ins) {
  ar = ar || {};
  return `<form class="card" data-form="autorref" data-id="${o.id}"><div class="card-h"><h3>Mi autorreflexión</h3>${chip("Antes de ver la valoración del observador", "m")}</div>
    <p class="muted" style="font-size:.84rem">Respuestas descriptivas y abiertas. Al enviarla podrás consultar el registro de quien te observó${o.detalleBloqueado ? "" : " (cuando lo cierre)"}.</p>
    ${(ins.preguntasAutorreflexion || []).map((q, i) => `<div class="f"><label>${esc(q)}</label><textarea name="q${i + 1}">${esc(ar["q" + (i + 1)] || "")}</textarea></div>`).join("")}
    <div class="row end"><button class="btn" value="borrador">Guardar borrador</button><button class="btn pri" value="enviar">Enviar autorreflexión</button></div></form>`;
}
function formDialogo(o, dl, ins) {
  dl = dl || {};
  const part = dl.participantes || [o.docenteId, o.observadorId];
  return `<form class="card" data-form="dialogo" data-id="${o.id}"><h3>Diálogo reflexivo post-clase</h3>
    ${(ins.preguntasDialogo || []).map((q, i) => `<div class="f"><label>${esc(q)}</label><textarea name="d${i + 1}">${esc(dl["d" + (i + 1)] || "")}</textarea></div>`).join("")}
    <div class="grid g2"><div class="f"><label>Aportaciones, contexto o aclaraciones del docente</label><textarea name="aportacionesDocente">${esc(dl.aportacionesDocente || "")}</textarea></div>
    <div class="f"><label>Evidencias revisadas</label><textarea name="evidenciasRevisadas">${esc(dl.evidenciasRevisadas || "")}</textarea></div></div>
    <div class="f"><label>Conclusiones compartidas</label><textarea name="conclusiones">${esc(dl.conclusiones || "")}</textarea></div>
    <div class="grid g2"><div class="f"><label>Fecha del diálogo</label><input type="date" name="fecha" value="${dl.fecha || today()}"></div>
    <div class="f"><label>Participantes</label><select name="participantes" multiple size="4">${L("personas").slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => `<option value="${p.id}" ${part.includes(p.id) ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></div></div>
    <div class="row end"><button class="btn" value="guardar">Guardar</button><button class="btn pri" value="concluir">Concluir diálogo y solicitar Vo.Bo.</button></div></form>`;
}
function vistaDialogo(dl, ins) {
  return `<div class="card"><div class="card-h"><h3>Diálogo reflexivo</h3>${chip(fdate(dl.fecha))}</div>
    ${(ins.preguntasDialogo || []).map((q, i) => `<p><b>${esc(q)}</b><br>${esc(dl["d" + (i + 1)] || "—")}</p>`).join("")}
    ${dl.aportacionesDocente ? `<p><b>Aportaciones del docente:</b> ${esc(dl.aportacionesDocente)}</p>` : ""}${dl.evidenciasRevisadas ? `<p><b>Evidencias revisadas:</b> ${esc(dl.evidenciasRevisadas)}</p>` : ""}
    <p><b>Conclusiones compartidas:</b> ${esc(dl.conclusiones || "—")}</p><small class="muted">Participantes: ${(dl.participantes || []).map(pname).map(esc).join(", ")}</small></div>`;
}

/* -------- formularios -------- */
FORMS.obsContexto = async (o, f) => { await save("observaciones", f.dataset.id, { contextoDocente: o.contextoDocente }, "contexto del docente"); toast("Contexto guardado."); };
FORMS.obsDetalle = async (o, f, btn) => {
  const ob = byId("observaciones", f.dataset.id); const ins = byId("instrumentos", ob.instrumentoId) || instVigente();
  const prev = S.ui.det?.[ob.id]?.d || null;
  const crit = prev?.criterios || ins.criterios;
  const respuestas = {}; crit.forEach(c => respuestas[c.id] = { nivel: o["n_" + c.id] || "", nota: o["t_" + c.id] || "" });
  if (btn === "cerrar") {
    const faltan = crit.filter(c => !respuestas[c.id].nivel).length;
    if (faltan && !confirm(`${faltan} criterios quedaron sin nivel (se registrarán como pendientes). ¿Cerrar el registro?`)) return;
  }
  await save("observacion_detalle", ob.id, { observacionId: ob.id, docenteId: ob.docenteId, observadorId: ob.observadorId, criterios: crit, respuestas,
    bloomVerbo: o.bloomVerbo || "", bloomPlaneado: +o.bloomPlaneado || null, bloomObservado: +o.bloomObservado || null,
    fortalezas: o.fortalezas, oportunidades: o.oportunidades, notas: o.notas, ...(btn === "cerrar" ? { fechaCierre: nowISO(), cerradoPor: me() } : {}) }, "registro de observación");
  const nuevo = await S.store.get("observacion_detalle", ob.id).catch(() => null);
  S.ui.det[ob.id] = { v: ob.actualizado || "", d: nuevo };
  await guardarEvidencia(f, o, "observaciones", ob.id, ob.docenteId, ob.observadorId);
  if (btn === "cerrar") {
    await save("observaciones", ob.id, { estado: "Registrada", detalleBloqueado: true, fechaRegistro: nowISO() }, "cierre de registro");
    await S.store.set("sesiones", ob.sesionId, { estado: "Realizada" });
    notify(ob.docenteId, "Autorreflexión", `Tu sesión del ${fdate(ob.fecha)} (${alabel(ob.asignacionId)}) fue registrada. Completa tu autorreflexión.`, "#/obs/" + ob.id, ob.id + "ar");
    toast("Registro cerrado. Se notificó al docente.");
  } else {
    if (ob.estado === "Programada") await save("observaciones", ob.id, { estado: "En captura" }, "inicio de captura");
    toast("Borrador guardado.");
  }
};
FORMS.autorref = async (o, f, btn) => {
  const ob = byId("observaciones", f.dataset.id);
  const enviar = btn === "enviar";
  if (enviar && !o.q1 && !o.q2 && !o.q3 && !o.q4) { toast("Escribe al menos una respuesta.", true); return; }
  await save("autorreflexiones", ob.id, { observacionId: ob.id, docenteId: ob.docenteId, observadorId: ob.observadorId, q1: o.q1, q2: o.q2, q3: o.q3, q4: o.q4, enviada: enviar, ...(enviar ? { fechaEnvio: nowISO() } : {}) }, "autorreflexión");
  if (enviar) {
    await save("observaciones", ob.id, { autorreflexionCompleta: true, autorreflexionFecha: nowISO() }, "autorreflexión enviada");
    notify(ob.observadorId, "Autorreflexión", `${pname(ob.docenteId)} envió su autorreflexión (${alabel(ob.asignacionId)}). Ya pueden realizar el diálogo reflexivo.`, "#/obs/" + ob.id, ob.id + "ar2");
    toast("Autorreflexión enviada.");
  } else toast("Borrador guardado.");
};
FORMS.dialogo = async (o, f, btn) => {
  const ob = byId("observaciones", f.dataset.id);
  const parts = [...f.querySelector("[name=participantes]").selectedOptions].map(x => x.value);
  await save("dialogos", ob.id, { observacionId: ob.id, docenteId: ob.docenteId, observadorId: ob.observadorId, d1: o.d1, d2: o.d2, d3: o.d3, aportacionesDocente: o.aportacionesDocente,
    evidenciasRevisadas: o.evidenciasRevisadas, conclusiones: o.conclusiones, fecha: o.fecha, participantes: parts }, "diálogo reflexivo");
  if (btn === "concluir") {
    if (!o.conclusiones) { toast("Registra las conclusiones compartidas antes de concluir.", true); return; }
    await save("observaciones", ob.id, { estado: "Pendiente Vo.Bo." }, "diálogo concluido");
    L("personas").filter(p => (p.roles || []).includes("subdirectora")).forEach(p => notify(p.id, "Vo.Bo.", `Observación de ${alabel(ob.asignacionId)} (${pname(ob.docenteId)}) lista para Vo.Bo.`, "#/obs/" + ob.id, ob.id + "vb"));
    toast("Diálogo concluido; se solicitó Vo.Bo.");
  } else { if (ob.estado === "Registrada") await save("observaciones", ob.id, { estado: "En diálogo" }, "inicio de diálogo"); toast("Diálogo guardado."); }
};
FORMS.vobo = async (o, f) => {
  const ob = byId("observaciones", f.dataset.id);
  await save("observaciones", ob.id, { estado: "Con Vo.Bo.", vobos: [...(ob.vobos || []), { resultado: o.resultado, comentario: o.comentario, por: me(), fecha: nowISO() }] }, "Vo.Bo.");
  notify(ob.observadorId, "Vo.Bo.", `La Subdirección otorgó Vo.Bo. (${o.resultado}) a la observación de ${alabel(ob.asignacionId)}.`, "#/obs/" + ob.id, ob.id + "vbok");
  toast("Vo.Bo. registrado.");
};
ACT.reabrirObs = el => modal({ title: "Reabrir registro", body: `<p class="muted">La reapertura queda registrada con motivo, responsable y fecha. El registro original se conserva en la auditoría.</p><div class="f"><label>Motivo</label><textarea name="motivo" required></textarea></div>`,
  onSubmit: async o => { const ob = byId("observaciones", el.dataset.id); await save("observaciones", ob.id, { estado: "En captura", detalleBloqueado: false, reaperturas: [...(ob.reaperturas || []), { motivo: o.motivo, por: me(), fecha: nowISO(), estadoAnterior: ob.estado }] }, "reapertura autorizada"); toast("Registro reabierto."); } });
ACT.cancelarObs = el => modal({ title: "Cancelar observación", body: `<div class="f"><label>Motivo (opcional)</label><input type="text" name="motivo"></div>`,
  onSubmit: async o => { await save("observaciones", el.dataset.id, { estado: "Cancelada", motivoCancelacion: o.motivo }, "cancelación"); toast("Observación cancelada."); } });

/* ======================= ACUERDOS ======================= */
ACT.nuevoAcuerdo = el => {
  const ob = byId("observaciones", el.dataset.obs);
  modal({ title: "Nuevo acuerdo de mejora", body: `
    <div class="f"><label>Acción</label><textarea name="accion" required></textarea></div>
    <div class="grid g2"><div class="f"><label>Responsable</label><select name="responsableId">${L("personas").slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => opt(p.id, p.nombre, ob.docenteId)).join("")}</select><span class="hint">Puede ser el docente o una persona que brinda apoyo institucional.</span></div>
    <div class="f"><label>Fecha de compromiso</label><input type="date" name="fechaCompromiso" required></div></div>
    <div class="f"><label>Evidencia esperada (opcional)</label><input type="text" name="evidenciaEsperada"></div>`,
    onSubmit: async o => {
      const id = newId("ac-");
      await save("acuerdos", id, { observacionId: ob.id, dialogoId: ob.id, docenteId: ob.docenteId, observadorId: ob.observadorId, asignacionId: ob.asignacionId, accion: o.accion, responsableId: o.responsableId, fechaCompromiso: o.fechaCompromiso, evidenciaEsperada: o.evidenciaEsperada, estado: "Pendiente" }, "alta de acuerdo");
      notify(o.responsableId, "Acuerdo", `Nuevo acuerdo: “${short(o.accion, 60)}” · compromiso ${fdate(o.fechaCompromiso)}.`, "#/acuerdos?id=" + id, id);
      toast("Acuerdo registrado.");
    }
  });
};
VIEWS.acuerdos = {
  title: "Acuerdos y seguimiento",
  render(r) {
    const q = r.q; let arr = L("acuerdos").slice();
    if (!isStaff()) arr = arr.filter(a => a.docenteId === me() || a.responsableId === me() || a.observadorId === me());
    if (q.estado) arr = arr.filter(a => a.estado === q.estado);
    if (q.venc) arr = arr.filter(a => ["Pendiente", "En proceso"].includes(a.estado) && a.fechaCompromiso < today());
    arr.sort((a, b) => (a.fechaCompromiso || "").localeCompare(b.fechaCompromiso || ""));
    setTimeout(() => { if (q.id && !$("#ov")) { const id = q.id; dropQ("id"); ACT.verAcuerdo({ dataset: { id } }); } }, 0);
    return `<div class="card"><div class="card-h"><h2>Acuerdos · ${arr.length}</h2></div>
      <p class="muted">Estados: Pendiente, En proceso, Cumplido, Cancelado. La fecha de compromiso por sí sola no convierte un acuerdo en incumplido; señala que requiere seguimiento.</p>
      <div class="filters"><select data-filter="estado"><option value="">Todos los estados</option>${["Pendiente", "En proceso", "Cumplido", "Cancelado"].map(e => opt(e, e, q.estado)).join("")}</select>
      <select data-filter="venc"><option value="">Cualquier fecha</option>${opt("1", "Fecha de compromiso pasada", q.venc)}</select></div>
      <div class="tw"><table><thead><tr><th>Acción</th><th>Docente</th><th>Responsable</th><th>Compromiso</th><th>Estado</th><th>Seguimientos</th><th></th></tr></thead><tbody>
      ${arr.map(a => { const sg = L("seguimientos").filter(s => s.acuerdoId === a.id); return `<tr><td>${esc(a.accion)}<span class="sub">${esc(alabel(a.asignacionId))} · <a href="#/obs/${a.observacionId}">observación</a></span></td><td>${esc(pname(a.docenteId))}</td><td>${esc(pname(a.responsableId))}</td>
      <td>${fdate(a.fechaCompromiso)}${["Pendiente", "En proceso"].includes(a.estado) && a.fechaCompromiso < today() ? `<span class="sub" style="color:var(--ambar)">requiere seguimiento</span>` : ""}</td><td>${chipEstado(a.estado)}</td><td class="num">${sg.length}</td><td class="num"><button class="btn sm" data-act="verAcuerdo" data-id="${a.id}">Abrir</button></td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">Sin acuerdos.</td></tr>`}
      </tbody></table></div></div>`;
  }
};
ACT.verAcuerdo = el => {
  const a = byId("acuerdos", el.dataset.id); if (!a) return toast("Acuerdo no disponible.", true);
  const sg = L("seguimientos").filter(s => s.acuerdoId === a.id).sort((x, y) => (y.fecha || "").localeCompare(x.fecha || ""));
  const verifica = isStaff() || a.observadorId === me();
  const puede = verifica || a.responsableId === me() || a.docenteId === me();
  const ev = L("evidencias").filter(e => e.refCol === "acuerdos" && e.refId === a.id);
  modal({ title: "Acuerdo de mejora", wide: true, submit: "Registrar seguimiento", body: `
    <p><b>${esc(a.accion)}</b></p><p class="muted">Responsable: ${esc(pname(a.responsableId))} · Compromiso: ${fdate(a.fechaCompromiso)} · ${chipEstado(a.estado)}${a.evidenciaEsperada ? `<br>Evidencia esperada: ${esc(a.evidenciaEsperada)}` : ""}</p>
    ${sg.length ? `<h3 style="margin:10px 0 6px">Historial de seguimiento</h3><div class="tl">${sg.map(s => `<div class="it"><b>${fdate(s.fecha)}</b> · ${esc(pname(s.creadoPor))} · ${chip(s.resultado || "—")}<br>${esc(s.observaciones || "")}</div>`).join("")}</div>` : `<p class="muted">Sin seguimientos todavía.</p>`}
    ${evidenciaHtml(ev)}
    ${puede ? `<hr><h3 style="margin-bottom:8px">${verifica ? "Registrar seguimiento" : "Registrar avance"}</h3>
    <div class="grid g3"><div class="f"><label>Fecha</label><input type="date" name="fecha" value="${today()}"></div>
    <div class="f"><label>Resultado</label><select name="resultado">${["Avance", "Sin avance", "Cumplido", "Requiere apoyo", "Otro"].map(x => opt(x, x)).join("")}</select></div>
    <div class="f"><label>Nuevo estado del acuerdo</label><select name="estado">${["Pendiente", "En proceso", ...(verifica ? ["Cumplido", "Cancelado"] : [])].map(x => opt(x, x, a.estado)).join("")}</select>${verifica ? "" : `<span class="hint">El equipo de apoyo verifica el cumplimiento.</span>`}</div></div>
    <div class="f"><label>Observaciones</label><textarea name="observaciones" required></textarea></div>
    <div class="f"><label>Motivo de cancelación (opcional)</label><input type="text" name="motivo"></div>${evidenciaInput()}` : ""}`,
    onSubmit: puede ? async (o, f) => {
      await save("seguimientos", newId("sg-"), { acuerdoId: a.id, docenteId: a.docenteId, observadorId: a.observadorId, responsableId: a.responsableId, fecha: o.fecha, resultado: o.resultado, observaciones: o.observaciones }, "seguimiento");
      if (o.estado !== a.estado) await save("acuerdos", a.id, { estado: o.estado, ...(o.estado === "Cancelado" ? { motivoCancelacion: o.motivo } : {}), ...(o.estado === "Cumplido" ? { verificadoPor: me(), fechaCumplido: today() } : {}) }, "cambio de estado de acuerdo");
      await guardarEvidencia(f, o, "acuerdos", a.id, a.docenteId, a.observadorId);
      const otro = verifica ? a.responsableId : a.observadorId;
      notify(otro, "Seguimiento", `Nuevo seguimiento en el acuerdo “${short(a.accion, 50)}”.`, "#/acuerdos?id=" + a.id, a.id + "sg" + Date.now());
      toast("Seguimiento registrado.");
    } : null
  });
};

/* ======================= INSTRUMENTOS ======================= */
VIEWS.instrumentos = {
  title: "Instrumentos de observación",
  render() {
    const ins = L("instrumentos").slice().sort((a, b) => b.version - a.version);
    return `<div class="card"><div class="card-h"><h2>Instrumentos versionados</h2>${isStaff() ? `<button class="btn pri" data-act="nuevaVersion">+ Nueva versión (borrador)</button>` : ""}</div>
      <p class="muted">Los cambios sustantivos generan una nueva versión; cada observación conserva la versión con la que se aplicó. El equipo de apoyo propone y configura; la Subdirectora autoriza la publicación.</p>
      ${ins.map(i => `<div class="card flat"><div class="card-h"><h3>${esc(i.nombre)} · v${i.version}</h3>${chipEstado(i.estado)}${isSub() && i.estado === "Borrador" ? `<button class="btn sm ok" data-act="publicarInst" data-id="${i.id}">Autorizar y publicar</button>` : ""}${isStaff() && i.estado === "Borrador" ? `<button class="btn sm" data-act="editInst" data-id="${i.id}">Editar</button>` : ""}</div>
        <p class="muted" style="font-size:.85rem">${esc(i.proposito || "")} · Escala: ${(i.escala || []).map(e => chip(e)).join(" ")}</p>
        <ol style="font-size:.86rem;margin:6px 0 0 18px;padding:0">${i.criterios.map(c => `<li>${esc(c.texto)}${c.bloom ? " " + chip("Bloom", "m") : ""}</li>`).join("")}</ol>
        ${i.publicadoPor ? `<p class="faint" style="font-size:.75rem">Publicado: ${esc(i.fechaPublicacion || "")} · ${esc(pname(i.publicadoPor) === "(persona no encontrada)" ? i.publicadoPor : pname(i.publicadoPor))}</p>` : ""}</div>`).join("")}</div>`;
  }
};
ACT.nuevaVersion = async () => {
  const base = instVigente(); const v = Math.max(...L("instrumentos").map(i => i.version)) + 1;
  const id = "inst-v" + v + "-" + newId().slice(-3);
  await save("instrumentos", id, { ...base, id, version: v, estado: "Borrador", publicadoPor: "", fechaPublicacion: "" }, "nueva versión de instrumento");
  toast("Borrador creado."); setTimeout(() => ACT.editInst({ dataset: { id } }), 300);
};
ACT.editInst = el => {
  const i = byId("instrumentos", el.dataset.id);
  modal({ title: `Editar instrumento v${i.version}`, wide: true, body: `
    <div class="f"><label>Nombre</label><input type="text" name="nombre" value="${esc(i.nombre)}"></div>
    <div class="f"><label>Propósito</label><input type="text" name="proposito" value="${esc(i.proposito || "")}"></div>
    <div class="f"><label>Criterios (uno por línea; agrega [bloom] al criterio que analiza el verbo de la progresión)</label><textarea name="criterios" style="min-height:220px">${esc(i.criterios.map(c => c.texto + (c.bloom ? " [bloom]" : "")).join("\n"))}</textarea></div>
    <div class="f"><label>Escala (separada por coma)</label><input type="text" name="escala" value="${esc(i.escala.join(", "))}"></div>
    <div class="f"><label>Preguntas de autorreflexión (una por línea)</label><textarea name="pa">${esc((i.preguntasAutorreflexion || []).join("\n"))}</textarea></div>
    <div class="f"><label>Preguntas del diálogo reflexivo (una por línea)</label><textarea name="pd">${esc((i.preguntasDialogo || []).join("\n"))}</textarea></div>`,
    onSubmit: async o => {
      const lines = o.criterios.split("\n").map(x => x.trim()).filter(Boolean);
      await save("instrumentos", i.id, { nombre: o.nombre, proposito: o.proposito, criterios: lines.map((t, k) => ({ id: "c" + (k + 1), texto: t.replace(/\s*\[bloom\]\s*/i, ""), bloom: /\[bloom\]/i.test(t) })),
        escala: o.escala.split(",").map(x => x.trim()).filter(Boolean), preguntasAutorreflexion: o.pa.split("\n").map(x => x.trim()).filter(Boolean), preguntasDialogo: o.pd.split("\n").map(x => x.trim()).filter(Boolean) }, "edición de instrumento");
      toast("Borrador actualizado.");
    }
  });
};
ACT.publicarInst = async el => {
  if (!confirm("¿Publicar esta versión? La versión vigente pasará a histórico; las observaciones anteriores conservan su versión.")) return;
  for (const x of L("instrumentos").filter(x => x.estado === "Publicado")) await save("instrumentos", x.id, { estado: "Histórico" }, "instrumento a histórico");
  await save("instrumentos", el.dataset.id, { estado: "Publicado", publicadoPor: me(), fechaPublicacion: today() }, "publicación de instrumento");
  toast("Instrumento publicado.");
};
