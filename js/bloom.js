/* Taxonomía de Bloom (revisada, Anderson & Krathwohl) — verbos en español.
   Uso: análisis descriptivo de la congruencia entre el verbo de la progresión /
   aprendizaje planeado y la demanda cognitiva observada. NO produce calificación. */
(function () {
  const NIVELES = [
    { n: 1, nombre: "Recordar", desc: "Reconocer y evocar información", verbos: ["recordar","reconocer","identificar","nombrar","enlistar","listar","definir","memorizar","repetir","señalar","citar","enumerar","localizar","registrar","mencionar","recuperar","etiquetar","seleccionar"] },
    { n: 2, nombre: "Comprender", desc: "Construir significado", verbos: ["comprender","explicar","describir","interpretar","resumir","parafrasear","clasificar","ejemplificar","ilustrar","inferir","comparar","discutir","distinguir","expresar","traducir","relacionar","asociar","reconstruir","representar","reconocer"] },
    { n: 3, nombre: "Aplicar", desc: "Usar procedimientos en situaciones", verbos: ["aplicar","usar","utilizar","ejecutar","implementar","resolver","demostrar","calcular","emplear","operar","practicar","programar","manipular","modificar","preparar","producir","instalar","configurar","elaborar","realizar","desarrollar"] },
    { n: 4, nombre: "Analizar", desc: "Descomponer y relacionar partes", verbos: ["analizar","examinar","diferenciar","organizar","atribuir","contrastar","categorizar","investigar","cuestionar","deducir","descomponer","diagramar","estructurar","experimentar","indagar","problematizar","depurar","sistematizar","integrar"] },
    { n: 5, nombre: "Evaluar", desc: "Emitir juicios con criterios", verbos: ["evaluar","valorar","juzgar","argumentar","justificar","criticar","defender","verificar","comprobar","debatir","priorizar","recomendar","seleccionar","fundamentar","monitorear","probar","reflexionar","contrastar"] },
    { n: 6, nombre: "Crear", desc: "Generar productos originales", verbos: ["crear","diseñar","construir","planear","planificar","proponer","inventar","formular","componer","generar","idear","producir","innovar","desarrollar","elaborar","gestionar","administrar","emprender"] }
  ];
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Formas: infinitivo, 3a persona singular/plural, gerundio, imperativo plural aproximado
  const formas = v => {
    const b = norm(v), raiz = b.slice(0, -2), t = b.slice(-2);
    const s = t === "ar" ? raiz + "a" : raiz + "e";
    const g = t === "ar" ? raiz + "ando" : raiz + "iendo";
    return [b, s, s + "n", g, b.replace(/r$/, "rá")].filter((x, i, a) => x.length > 3 && a.indexOf(x) === i);
  };
  const MAPA = {};
  NIVELES.forEach(L => L.verbos.forEach(v => formas(v).forEach(f => { (MAPA[f] = MAPA[f] || new Set()).add(L.n); })));

  function nivelesDe(verbo) { const s = MAPA[norm(verbo).trim()]; return s ? [...s].sort() : []; }

  function analizar(texto) {
    const conteo = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, verbos = {};
    const palabras = norm(texto).match(/[a-zñ]{4,}/g) || [];
    palabras.forEach(p => {
      const s = MAPA[p]; if (!s) return;
      const nivel = Math.max(...s);           // ante ambigüedad se toma el nivel más alto posible
      conteo[nivel]++; verbos[p] = nivel;
    });
    const total = Object.values(conteo).reduce((a, b) => a + b, 0);
    let predominante = null, max = 0;
    Object.entries(conteo).forEach(([k, v]) => { if (v > max) { max = v; predominante = +k; } });
    const maxNivel = Object.keys(conteo).filter(k => conteo[k] > 0).map(Number).sort().pop() || null;
    return { conteo, verbos, total, predominante, maxNivel };
  }

  /* Congruencia descriptiva entre nivel planeado y nivel observado */
  function congruencia(planeado, observado) {
    if (!planeado || !observado) return { clave: "sin-dato", texto: "Sin datos suficientes para describir la congruencia.", chip: "" };
    const d = observado - planeado;
    if (d === 0) return { clave: "congruente", texto: "La demanda cognitiva observada corresponde al nivel del verbo planeado.", chip: "g" };
    if (d > 0) return { clave: "superior", texto: `La actividad observada demandó un nivel más alto (${NIVELES[observado-1].nombre}) que el planeado (${NIVELES[planeado-1].nombre}).`, chip: "b" };
    return { clave: "inferior", texto: `La actividad observada se ubicó en un nivel menor (${NIVELES[observado-1].nombre}) que el planeado (${NIVELES[planeado-1].nombre}). Tema sugerido para el diálogo reflexivo, no un incumplimiento.`, chip: "a" };
  }

  window.BLOOM = { NIVELES, analizar, nivelesDe, congruencia, norm };
})();
