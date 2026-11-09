/* =============================================================
   Gráficas ligeras (HTML + CSS, sin librerías)
   - barras horizontales apiladas por categoría
   - barras simples (una serie)
   - barra segmentada (parte de un todo, ≤ 6 segmentos)
   Cada marca tiene dato al pasar el cursor / tocar y puede llevar
   a un enlace (#/ruta) o a una acción (data-act).
   Colores por papel: --s1..--s4 categóricos, --o1..--o4 ordinales,
   --vacio para “sin registro”. Validados para daltonismo.
   ============================================================= */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
const destino = d => d.href ? `data-href="${esc(d.href)}" tabindex="0" role="link"` : d.act ? `data-act="${esc(d.act)}" ${Object.entries(d.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")} tabindex="0" role="button"` : "";

export function leyenda(series, totales) {
  return `<div class="g-ley">${series.map(s => `<span><i style="background:var(${s.color})"></i>${esc(s.label)}${totales ? ` <b>${totales[s.key] ?? 0}</b>` : ""}</span>`).join("")}</div>`;
}

/* filas: [{label, sub?, segs:{key:valor}, href?|act?}] · series: [{key,label,color}] */
export function apiladas({ titulo, nota, filas, series, unidad = "", vacio = "Sin datos para mostrar." }) {
  if (!filas.length) return `<div class="g-card"><div class="g-h"><h3>${esc(titulo)}</h3></div><div class="empty">${esc(vacio)}</div></div>`;
  const max = Math.max(1, ...filas.map(f => series.reduce((a, s) => a + (f.segs[s.key] || 0), 0)));
  const tot = {}; series.forEach(s => tot[s.key] = filas.reduce((a, f) => a + (f.segs[s.key] || 0), 0));
  return `<div class="g-card"><div class="g-h"><h3>${esc(titulo)}</h3>${nota ? `<small class="muted">${esc(nota)}</small>` : ""}</div>
    ${leyenda(series, tot)}
    <div class="g-hbars">${filas.map(f => {
      const total = series.reduce((a, s) => a + (f.segs[s.key] || 0), 0);
      return `<div class="g-row ${f.href || f.act ? "g-link" : ""} ${f.activo ? "on" : ""}" ${destino(f)}>
        <span class="g-lab">${esc(f.label)}${f.sub ? `<small>${esc(f.sub)}</small>` : ""}</span>
        <span class="g-track"><span class="g-stack" style="width:${(total / max * 100).toFixed(1)}%">${series.map(s => { const v = f.segs[s.key] || 0; if (!v) return "";
          return `<span class="g-seg" style="flex:${v};background:var(${s.color})" data-tip="${esc(f.label)} · ${esc(s.label)}: ${v}${unidad} de ${total} (${pct(v, total)}%)"></span>`; }).join("")}</span></span>
        <span class="g-val">${f.valorTexto ?? total}</span></div>`;
    }).join("")}</div></div>`;
}

/* filas: [{label, value, href?|act?, tip?}] — una sola serie */
export function barras({ titulo, nota, filas, color = "--s1", unidad = "", vacio = "Sin datos para mostrar." }) {
  const max = Math.max(1, ...filas.map(f => f.value));
  if (!filas.some(f => f.value)) return `<div class="g-card"><div class="g-h"><h3>${esc(titulo)}</h3></div><div class="empty">${esc(vacio)}</div></div>`;
  return `<div class="g-card"><div class="g-h"><h3>${esc(titulo)}</h3>${nota ? `<small class="muted">${esc(nota)}</small>` : ""}</div>
    <div class="g-vbars" style="--n:${filas.length}">${filas.map(f => `<div class="g-col ${f.href || f.act ? "g-link" : ""}" ${destino(f)} data-tip="${esc(f.tip || `${f.label}: ${f.value}${unidad}`)}">
      <span class="g-num">${f.value}</span><span class="g-barw"><span class="g-bar" style="height:${(f.value / max * 100).toFixed(1)}%;background:var(${color})"></span></span>
      <span class="g-clab">${esc(f.label)}</span></div>`).join("")}</div></div>`;
}

/* segs: [{label, value, color, href?}] — proporción de un total */
export function segmentada({ titulo, nota, segs, unidad = "", vacio = "Sin datos para mostrar." }) {
  const total = segs.reduce((a, s) => a + s.value, 0);
  if (!total) return `<div class="g-card"><div class="g-h"><h3>${esc(titulo)}</h3></div><div class="empty">${esc(vacio)}</div></div>`;
  return `<div class="g-card"><div class="g-h"><h3>${esc(titulo)}</h3><small class="muted">${total}${unidad} en total${nota ? " · " + esc(nota) : ""}</small></div>
    <div class="g-segbar">${segs.filter(s => s.value).map(s => `<span class="g-seg ${s.href ? "g-link" : ""}" ${destino(s)} style="flex:${s.value};background:var(${s.color})" data-tip="${esc(s.label)}: ${s.value}${unidad} (${pct(s.value, total)}%)"></span>`).join("")}</div>
    <div class="g-ley g-ley-col">${segs.map(s => `<span class="${s.href ? "g-link" : ""}" ${destino(s)}><i style="background:var(${s.color})"></i>${esc(s.label)} <b>${s.value}</b> <small class="muted">${pct(s.value, total)}%</small></span>`).join("")}</div></div>`;
}

/* ---------- capa de interacción (una vez) ---------- */
if (!window.__graficas) {
  window.__graficas = true;
  const tip = document.createElement("div"); tip.className = "g-tip"; tip.hidden = true; document.body.appendChild(tip);
  const mostrar = (el, x, y) => { tip.textContent = el.dataset.tip; tip.hidden = false; const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 12)) + "px"; tip.style.top = Math.max(8, y - r.height - 10) + "px"; };
  document.addEventListener("pointerdown", e => { const el = e.target.closest?.("[data-tip]"); if (el && e.pointerType !== "mouse") mostrar(el, e.clientX, e.clientY); });
  document.addEventListener("pointermove", e => { const el = e.target.closest?.("[data-tip]"); if (el) mostrar(el, e.clientX, e.clientY); else tip.hidden = true; });
  document.addEventListener("focusin", e => { const el = e.target.closest?.("[data-tip]") || e.target.querySelector?.("[data-tip]"); if (el) { const r = el.getBoundingClientRect(); mostrar(el, r.left, r.top); } });
  document.addEventListener("focusout", () => tip.hidden = true);
  document.addEventListener("click", e => { const el = e.target.closest?.("[data-href]"); if (el) { e.preventDefault(); location.hash = el.dataset.href.replace(/^#/, ""); } });
  document.addEventListener("keydown", e => { if (e.key === "Enter") { const el = e.target.closest?.("[data-href],.g-link[data-act]"); if (el) el.click(); } });
}
