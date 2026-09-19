// ── data/quiz.js — Test "¿Qué lectura necesitas hoy?" ──

const quizQuestions = [
  {
    id: 'q1',
    title: '¿Desde dónde llegas hoy?',
    subtitle: 'Elige lo que más se acerca a lo que estás sintiendo ahora mismo',
    options: [
      { value: 'moving', label: 'Algo se está moviendo pero no sé bien qué es' },
      { value: 'concrete', label: 'Tengo una situación concreta que no me deja en paz' },
      { value: 'decision', label: 'Estoy frente a una decisión y no sé para dónde ir' },
      { value: 'cycle', label: 'Siento que un ciclo terminó o está por terminar' },
      { value: 'internal', label: 'Las preguntas que tengo no son sobre lo de afuera, son sobre mí' }
    ]
  },
  {
    id: 'q2',
    title: '¿De qué área de tu vida viene el ruido?',
    subtitle: 'Lo que más espacio ocupa en tu cabeza ahora',
    options: [
      { value: 'love', label: 'Del amor o de alguien en particular' },
      { value: 'unlabeled', label: 'Con alguien, pero no sé qué somos' },
      { value: 'work', label: 'Del trabajo o el dinero' },
      { value: 'building', label: 'De algo que estoy construyendo o creando' },
      { value: 'everything', label: 'De todo un poco, no es una sola cosa' },
      { value: 'deep', label: 'No lo puedo ubicar en un área, es algo más profundo' }
    ]
  },
  {
    id: 'q3',
    title: '¿Cuánta profundidad necesitas hoy?',
    subtitle: 'Sé honesta contigo misma',
    options: [
      { value: 'quick', label: 'Necesito claridad rápida, algo concreto' },
      { value: 'deep', label: 'Quiero entender de fondo lo que está pasando' },
      { value: 'full', label: 'Quiero verlo todo, no solo un pedazo' }
    ]
  },
  {
    id: 'q4',
    title: '¿Qué esperas llevarte de esta lectura?',
    subtitle: 'No hay respuesta correcta',
    options: [
      { value: 'direction', label: 'Una dirección, algo que me ayude a moverme' },
      { value: 'repeat', label: 'Entender por qué sigo repitiendo algo' },
      { value: 'coming', label: 'Saber qué viene y qué soltar' },
      { value: 'mirror', label: 'Verme a mí misma desde otro lugar' }
    ]
  }
];

const quizReasons = {
  general_corta: 'necesitas claridad rápida y algo concreto para empezar a moverte',
  general_extensa: 'quieres ver el cuadro completo y entender qué viene',
  amor_corta: 'el corazón necesita claridad rápida y honesta',
  amor_radiografia: 'quieres entender de fondo el patrón que se repite en el amor',
  amor_que_somos: 'hay un vínculo sin etiqueta que necesitas entender',
  trabajo_corta: 'necesitas una dirección concreta en el trabajo o el dinero',
  trabajo_extensa: 'quieres entender de fondo tu relación con el trabajo y el dinero',
  trabajo_negocio: 'estás construyendo algo propio y quieres una mirada honesta',
  general_caminos: 'estás frente a dos caminos y necesitas verlos con más claridad',
  general_nuevo_ciclo: 'un ciclo termina y quieres saber qué viene y qué soltar',
  general_proposito: 'las preguntas que tienes son sobre ti, no sobre lo de afuera'
};

// Resuelve la lectura recomendada según las respuestas (en orden de prioridad)
function resolveQuizResult(answers) {
  const q1 = answers.q1;
  const q2 = answers.q2;
  const q3 = answers.q3;
  const q4 = answers.q4;

  // Señales fuertes de la pregunta 1
  if (q1 === 'internal') return 'general_proposito';
  if (q1 === 'cycle') return 'general_nuevo_ciclo';
  if (q1 === 'decision') return 'general_caminos';

  // Pregunta 2: área de la vida
  if (q2 === 'deep') return 'general_proposito';
  if (q2 === 'unlabeled') return 'amor_que_somos';
  if (q2 === 'building') return 'trabajo_negocio';

  if (q2 === 'love') {
    if (q3 === 'quick') return 'amor_corta';
    if (q4 === 'repeat') return 'amor_radiografia';
    if (q3 === 'deep' || q3 === 'full') return 'amor_radiografia';
    return 'amor_corta';
  }

  if (q2 === 'work') {
    if (q3 === 'quick') return 'trabajo_corta';
    return 'trabajo_extensa';
  }

  if (q2 === 'everything') {
    if (q3 === 'quick') return 'general_corta';
    return 'general_extensa';
  }

  return 'general_corta';
}

function getQuizReason(readingId) {
  return quizReasons[readingId] || '';
}