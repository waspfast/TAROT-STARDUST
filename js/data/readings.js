// ── data/readings.js — Catálogo de lecturas, nombres y categorías ──
const readingNames = {
  general_corta: 'Lectura General corta',
  amor_corta: 'Amor & Relaciones corta',
  trabajo_corta: 'Trabajo & Dinero corta',
  trabajo_extensa: 'Trabajo & Dinero extensa',
  general_extensa: 'Lectura General extensa',
  especial_anio: 'Lectura Radiografía De Amor extensa'
};

const categoryLabels = {
  amor: 'Amor & Relaciones',
  trabajo: 'Trabajo',
  general: 'General',
  extensa: 'Lectura extensa'
};

const categoryDescriptions = {
  amor: 'todo sobre vínculos, encuentros y desencuentros del corazón',
  trabajo: 'tu propósito, decisiones laborales y relación con la abundancia',
  general: 'un panorama abierto de tu energía actual y caminos posibles',
  extensa: 'una exploración profunda con más cartas y más tiempo para ti'
};

const readingsCatalog = [
  {
    id: 'general_corta',
    categories: ['general'],
    title: 'Lectura General corta',
    price: 7.50,
    detail: '$7.50 — 6 cartas — 10 min',
    paraTi: 'para cuando necesitas claridad rápida sobre una situación puntual',
    queEsperar: 'una mirada directa con 6 cartas que iluminan tu presente y te ayudan a ver el siguiente paso',
    ejemplo: '¿este cambio es para mí? ¿qué energía me rodea ahora?'
  },
  {
    id: 'amor_corta',
    categories: ['amor'],
    title: 'Amor & Relaciones corta',
    price: 7.50,
    detail: '$7.50 — 6 cartas — 10 min',
    paraTi: 'para respirar y ver con nuevos ojos lo que sientes por alguien — o por ti misma',
    queEsperar: 'una lectura breve pero profunda sobre la energía del vínculo, lo que se dice y lo que se calla',
    ejemplo: '¿qué hay entre nosotros? ¿es momento de soltar o de acercarme?'
  },
  {
    id: 'trabajo_corta',
    categories: ['trabajo'],
    title: 'Trabajo & Dinero corta',
    price: 7.50,
    detail: '$7.50 — 6 cartas — 10 min',
    paraTi: 'cuando el trabajo o el dinero te tienen dando vueltas y necesitas una brújula',
    queEsperar: 'una lectura enfocada en tu camino profesional, oportunidades y relación con la abundancia',
    ejemplo: '¿sigo en este trabajo? ¿se abre una puerta para mí?'
  },
  {
    id: 'trabajo_extensa',
    categories: ['trabajo', 'extensa'],
    title: 'Trabajo & Dinero extensa',
    price: 12.50,
    detail: '$12.50 — 12 cartas — 20 min',
    paraTi: 'una mirada más profunda sobre dinámicas laborales, decisiones y oportunidades de crecimiento',
    queEsperar: 'una lectura enfocada en tu camino profesional, oportunidades y relación con la abundancia',
    ejemplo: '¿qué oportunidades hay para mí en mi carrera? ¿cómo puedo mejorar mi relación con el dinero?'
  },
  {
    id: 'general_extensa',
    categories: ['general', 'extensa'],
    title: 'Lectura General extensa',
    price: 12.50,
    detail: '$12.50 — 12 cartas — 20 min',
    paraTi: 'para un momento de introspección profunda, cuando quieres ver el bosque completo y no solo el árbol',
    queEsperar: 'una exploración amplia con 12 cartas que recorren tu energía, tus retos y tus dones — con tiempo para matices',
    ejemplo: '¿hacia dónde voy? ¿qué necesito soltar para avanzar?'
  },
  {
    id: 'especial_anio',
    categories: ['amor', 'extensa'],
    title: 'Lectura Radiografía De Amor extensa',
    price: 12.50,
    detail: '$12.50 — 12 cartas — 20 min',
    paraTi: 'para ir al fondo de un vínculo, una ruptura o un patrón que se repite en tus relaciones',
    queEsperar: 'una radiografía profunda de tu vida amorosa: raíces del hoy, lecciones del pasado y semillas para el mañana',
    ejemplo: '¿por qué repito esta historia? ¿qué viene para mi vida amorosa?'
  }
];