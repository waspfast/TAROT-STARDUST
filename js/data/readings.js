// ── data/readings.js — Catálogo de lecturas, nombres y categorías ──
const readingNames = {
  general_corta: 'Lectura General corta',
  amor_corta: 'Amor & Relaciones corta',
  trabajo_corta: 'Trabajo & Dinero corta',
  general_extensa: 'Lectura General extensa',
  especial_anio: 'Lectura Radiografía De Amor extensa'
};

const categoryLabels = {
  amor: 'Amor & Relaciones',
  trabajo: 'Trabajo',
  general: 'General',
  extensa: 'Lectura extensa'
};

const readingsCatalog = [
  { id: 'general_corta', categories: ['general'], title: 'Lectura General corta', price: 7.50, detail: '$7.50 — 6 cartas — 10 min' },
  { id: 'amor_corta', categories: ['amor'], title: 'Amor & Relaciones corta', price: 7.50, detail: '$7.50 — 6 cartas — 10 min' },
  { id: 'trabajo_corta', categories: ['trabajo'], title: 'Trabajo & Dinero corta', price: 7.50, detail: '$7.50 — 6 cartas — 10 min' },
  { id: 'general_extensa', categories: ['general', 'extensa'], title: 'Lectura General extensa', price: 12.50, detail: '$12.50 — 11 cartas — 20 min' },
  { id: 'especial_anio', categories: ['amor', 'extensa'], title: 'Lectura Radiografía De Amor extensa', price: 12.50, detail: '$12.50 — 11 cartas — 20 min' }
];