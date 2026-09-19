// ── data/readings.js — Catálogo de lecturas, nombres y categorías ──
const readingNames = {
  amor_corta: 'Amor & Relaciones Corta',
  amor_radiografia: 'Radiografía de Amor',
  amor_que_somos: '¿Qué Somos Tú y Yo?',
  trabajo_corta: 'Trabajo & Dinero Corta',
  trabajo_extensa: 'Trabajo & Dinero Extensa',
  trabajo_negocio: 'Tu Negocio en Cartas',
  general_corta: 'Lectura General Corta',
  general_extensa: 'Lectura General Extensa',
  general_caminos: 'Caminos y Señales',
  general_nuevo_ciclo: 'Nuevo Ciclo, Nueva Piel',
  general_proposito: '¿Para Qué Estoy Aquí?',
  rapidas_si_no: 'Sí o No',
  rapidas_carta_mes: 'Carta del Mes'
};

const categoryLabels = {
  amor: 'amor & relaciones',
  trabajo: 'trabajo',
  general: 'general',
  rapidas: 'respuestas rápidas'
};

const categoryDescriptions = {
  amor: 'todo sobre vínculos, encuentros y desencuentros del corazón',
  trabajo: 'tu propósito, decisiones laborales y relación con la abundancia',
  general: 'un panorama abierto de tu energía actual y caminos posibles',
  rapidas: 'respuestas claras y directas para una pregunta puntual'
};

const readingsCatalog = [
  // ── AMOR ──
  {
    id: 'amor_corta',
    categories: ['amor'],
    title: 'Amor & Relaciones Corta',
    price: 7.50,
    meta: '6 cartas · 10 min',
    detail: '$7.50 · 6 cartas · 10 min',
    paraTi: 'a veces el corazón tiene demasiado ruido como para escucharse a sí mismo. Esta lectura te ayuda a ver con más claridad lo que está pasando, ya sea con alguien más o contigo misma en el amor.',
    ejemplo: '¿Qué hay realmente entre nosotros? ¿Suelto o me acerco? ¿Cómo empiezo a tratarme mejor?'
  },
  {
    id: 'amor_radiografia',
    categories: ['amor'],
    title: 'Radiografía de Amor',
    price: 12.50,
    meta: '11 cartas · 20 min',
    detail: '$12.50 · 11 cartas · 20 min',
    paraTi: 'esta no es una lectura de superficie. Vamos al fondo: al patrón que se repite, al vínculo que no terminas de entender, a lo que quedó sin resolver. Para cuando quieres entender de verdad qué está pasando, no solo sentirte mejor por un rato.',
    ejemplo: '¿Por qué sigo viviendo esta misma historia? ¿Qué viene para mi vida amorosa?'
  },
  {
    id: 'amor_que_somos',
    categories: ['amor'],
    title: '¿Qué Somos Tú y Yo?',
    price: 12.50,
    meta: '11 cartas · 20 min',
    detail: '$12.50 · 11 cartas · 20 min',
    paraTi: 'hay vínculos que existen sin etiqueta. Que se sienten reales pero no avanzan. Que vuelven, que están, pero no terminan de comprometerse. Esta lectura es para eso que hay entre ustedes y que ninguno ha sabido — o querido — ponerle nombre todavía.\nMiramos qué siente realmente esa persona, qué está frenando que esto avance y qué te conviene hacer con lo que las cartas muestren.',
    ejemplo: '¿Hay algo genuino aquí o estoy esperando algo que no va a llegar? ¿Qué hago con esto?'
  },
  // ── TRABAJO ──
  {
    id: 'trabajo_corta',
    categories: ['trabajo'],
    title: 'Trabajo & Dinero Corta',
    price: 7.50,
    meta: '6 cartas · 10 min',
    detail: '$7.50 · 6 cartas · 10 min',
    paraTi: 'cuando el trabajo te pesa, una decisión no llega o el dinero no fluye como quisieras. Las cartas te dan una dirección clara para que dejes de dar vueltas y puedas empezar a moverte.',
    ejemplo: '¿Me quedo o me voy? ¿Se abre algo para mí? ¿Qué está frenando mi flujo económico?'
  },
  {
    id: 'trabajo_extensa',
    categories: ['trabajo'],
    title: 'Trabajo & Dinero Extensa',
    price: 12.50,
    meta: '12 cartas · 20 min',
    detail: '$12.50 · 12 cartas · 20 min',
    paraTi: 'una mirada más profunda a tu relación con el trabajo y el dinero. Lo que está operando detrás de escena, las puertas que se están abriendo y los bloqueos que quizás ni habías notado. Para momentos de decisión importante o cuando sientes que algo tiene que cambiar.',
    ejemplo: '¿Qué oportunidades hay para mí ahora? ¿Cómo puedo mejorar mi relación con el dinero?'
  },
  {
    id: 'trabajo_negocio',
    categories: ['trabajo'],
    title: 'Tu Negocio en Cartas',
    price: 12.50,
    meta: '10 cartas · 20 min',
    detail: '$12.50 · 10 cartas · 20 min',
    paraTi: 'para las que están construyendo algo propio y quieren una mirada honesta sobre cómo va. Miramos la energía de tu proyecto, lo que está funcionando aunque no lo veas, lo que te está frenando y cuál es el próximo paso concreto que las cartas muestran para ti.',
    ejemplo: '¿Está listo mi proyecto para crecer? ¿Qué me frena? ¿Hacia dónde enfocar mi energía ahora?'
  },
  // ── GENERAL ──
  {
    id: 'general_corta',
    categories: ['general'],
    title: 'Lectura General Corta',
    price: 7.50,
    meta: '6 cartas · 10 min',
    detail: '$7.50 · 6 cartas · 10 min',
    paraTi: 'algo se está moviendo y lo sientes, aunque no sepas exactamente qué es. Esta lectura te da una mirada rápida y honesta sobre lo que te rodea ahora mismo y hacia dónde apunta lo que estás viviendo.',
    ejemplo: '¿Este cambio es para mí? ¿Qué necesito ver que todavía no estoy viendo?'
  },
  {
    id: 'general_extensa',
    categories: ['general'],
    title: 'Lectura General Extensa',
    price: 12.50,
    meta: '11 cartas · 20 min',
    detail: '$12.50 · 11 cartas · 20 min',
    paraTi: 'para cuando quieres ver el cuadro completo, no solo el pedazo que duele. Miramos diferentes áreas de tu vida: lo que está fluyendo, lo que te pide atención y lo que viene si sigues por este camino.',
    ejemplo: '¿Hacia dónde voy? ¿Qué necesito soltar para poder avanzar?'
  },
  {
    id: 'general_caminos',
    categories: ['general'],
    title: 'Caminos y Señales',
    price: 12.50,
    meta: '10 cartas · 20 min',
    detail: '$12.50 · 10 cartas · 20 min',
    paraTi: 'estás frente a dos caminos y ninguno se siente del todo claro. Esta lectura no elige por ti, pero sí te muestra la energía de cada opción, lo que cada una implica y lo que las cartas ven en cada dirección. Para que cuando decidas, lo hagas desde un lugar más claro.',
    ejemplo: '¿Me quedo o me voy? ¿Este trabajo o el otro? ¿Sigo o cierro?'
  },
  {
    id: 'general_nuevo_ciclo',
    categories: ['general'],
    title: 'Nuevo Ciclo, Nueva Piel',
    price: 12.50,
    meta: '12 cartas · 20 min',
    detail: '$12.50 · 12 cartas · 20 min',
    paraTi: 'cada cierre merece un momento para mirarlo de frente. Esta lectura es para cuando un ciclo termina y otro empieza, ya sea un año nuevo, tu cumpleaños o ese momento en que sientes que algo en ti cambió para siempre. Vemos qué viene, qué soltar y qué energía trae este nuevo período para ti.',
    ejemplo: '¿Qué me espera en esta nueva etapa? ¿Qué necesito dejar ir para poder recibirla bien?'
  },
  {
    id: 'general_proposito',
    categories: ['general'],
    title: '¿Para Qué Estoy Aquí?',
    price: 16,
    meta: '12 cartas · 25 min',
    detail: '$16.00 · 12 cartas · 25 min',
    paraTi: 'esta es la lectura más profunda del catálogo. No va sobre una situación puntual sino sobre ti: quién eres, qué patrones cargas, qué se te da naturalmente y qué viniste a hacer en esta etapa de tu vida. Para cuando las preguntas que tienes no tienen que ver con lo de afuera sino con lo de adentro.',
    ejemplo: '¿Qué se me da naturalmente que todavía no estoy usando? ¿Qué me frena de ser quien quiero ser?'
  },
  // ── RESPUESTAS RÁPIDAS ──
  {
    id: 'rapidas_si_no',
    categories: ['rapidas'],
    title: 'Sí o No',
    price: 5,
    meta: '3 cartas · 5 min',
    detail: '$5.00 · 3 cartas · 5 min',
    paraTi: 'a veces solo necesitas una respuesta para una pregunta concreta. Sin rodeos, sin vueltas. Traes tu pregunta, las cartas te dan una dirección clara y los matices que necesitas escuchar.',
    ejemplo: '¿Acepto esta propuesta? ¿Le escribo? ¿Es el momento?'
  },
  {
    id: 'rapidas_carta_mes',
    categories: ['rapidas'],
    title: 'Carta del Mes',
    price: 5,
    meta: '1 carta · mensaje para los próximos 30 días',
    detail: '$5.00 · 1 carta · mensaje para los próximos 30 días',
    paraTi: 'una carta. Un mensaje. Lo que necesitas saber para este mes que empieza. Sin complicaciones, sin largo rato frente a la pantalla. Solo una guía clara para que camines este mes con más intención.',
    ejemplo: '¿Qué energía me acompaña este mes? ¿En qué enfocarme?'
  }
];