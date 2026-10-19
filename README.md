# SIAP · Sistema Integral de Acompañamiento Pedagógico
CBT No. 6 Gerardo Linares Terrón, Toluca · Ciclo 2026-2027

Sistema web responsivo (HTML, CSS y JavaScript puro) para el seguimiento de planeaciones,
sesiones, concreción áulica, observación de clase, autorreflexión, diálogo reflexivo,
acuerdos, Vo.Bo., proyectos PAEC y reportes.

## Archivos
- `index.html` – aplicación
- `js/config.js` – **único archivo que se edita** (modo local / firebase)
- `js/seed.js` – catálogo inicial generado de los Excel institucionales
- `firestore.rules` – reglas de seguridad por rol (pegar en Firebase)
- `guia-instalacion.html` – guía visual paso a paso

## Modos
- `local`: datos en el navegador (pruebas y piloto).
- `firebase`: Firestore + Authentication, tiempo real, gratis (plan Spark).

Abrir siempre desde un servidor web (GitHub Pages, Netlify o Live Server), no con doble clic.
