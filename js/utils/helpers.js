// ── utils/helpers.js — Funciones de utilidad genéricas ──

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateDateRestrictions() {
  const input = document.getElementById('inpDate');
  if (!input) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + (state.emergency ? 0 : 2));
  const minIso = formatDateValue(minDate);
  input.min = minIso;
  if (input.value && input.value < minIso) {
    input.value = '';
    state.fecha = '';
  }
  if (typeof renderCalendar === 'function') renderCalendar();
}

// ── Emergencia ──
// Dias extra de agenda que cubre la emergencia despues de la semana actual.
//   7 = hoy → domingo de la semana que viene (incluye la proxima semana)
//   0 = solo la semana actual (hoy → domingo)
const EMERGENCY_EXTRA_DAYS = 7;

// Ventana de emergencia: hoy hasta el domingo de la semana que viene.
function getEmergencyWindowEndIso() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0 = domingo
  const daysToSunday = dow === 0 ? 0 : 7 - dow; // domingo de la semana actual
  const end = new Date(today);
  end.setDate(today.getDate() + daysToSunday + EMERGENCY_EXTRA_DAYS);
  return formatDateValue(end);
}

// ¿La fecha cae dentro de la ventana de emergencia (hoy → domingo de la semana que viene)?
function isEmergencyWindow(iso) {
  if (!iso) return false;
  const todayIso = formatDateValue(new Date());
  return iso >= todayIso && iso <= getEmergencyWindowEndIso();
}

// Recargo de emergencia según la cantidad de lecturas elegidas.
// Devuelve 0 cuando la emergencia no aplica (nada elegido o alguna lectura sin prioridad).
// $10 base + $5 por cada lectura adicional (1 lectura => $10 | 2 lecturas => $15 | 3 => $20)
function getEmergencySurcharge() {
  const keys = Object.keys(state.readings);
  if (keys.length === 0) return 0;
  for (const key of keys) {
    const r = readingsCatalog.find(function (x) { return x.id === key; });
    if (r && r.emergencyEligible === false) return 0; // una lectura sin prioridad bloquea la emergencia
  }
  return 10 + 5 * (keys.length - 1);
}

// ── Lecturas extensas (20 min o más) ──
// No aplican a emergencia (ver emergencyEligible en el catálogo) y, durante el
// bloqueo temporal de la semana actual, no se pueden seleccionar.
function isExtensiveReading(r) {
  return !!(r && r.durationMin >= 20);
}

// Fin del bloqueo temporal de lecturas extensas (domingo de la semana actual).
// Hasta esta fecha no se pueden elegir lecturas extensas. Cambia esta fecha
// para extender o acortar el bloqueo.
const EXTENSIVE_BLOCK_UNTIL = '2026-10-11';

function isExtensiveBlockActive() {
  return formatDateValue(new Date()) <= EXTENSIVE_BLOCK_UNTIL;
}

function calcTotal() {
  let total = Object.values(state.readings).reduce((a, b) => a + b, 0);
  if (state.emergency) total += getEmergencySurcharge();
  if (state.pago === 'PayPal') total += 2.5;
  return total;
}

function toggleEmergency() {
  state.emergency = !state.emergency;
  const t = document.getElementById('emergencyToggle');
  if (t) {
    t.classList.toggle('on', state.emergency);
    t.classList.toggle('off', !state.emergency);
  }
  updateDateRestrictions();
  if (typeof updateEmergencyToggle === 'function') updateEmergencyToggle();
}

// Muestra/oculta el interruptor de emergencia. Visible solo si:
//  - la lectura elegida califica (recargo > 0)
//  - la fecha elegida está dentro de la ventana de emergencia (si ya hay fecha)
//  - ese día todavía tiene cupo de emergencia disponible
// Si deja de ser válido y estaba activo, lo apaga.
function updateEmergencyToggle() {
  const wrap = document.getElementById('emergencyToggleWrap');
  if (!wrap) return;

  const surcharge = getEmergencySurcharge();
  let available = surcharge > 0;

  if (available && state.fecha) {
    const avail = getDayAvailability(state.fecha);
    available = isEmergencyWindow(state.fecha) && avail.emergenciaLeft > 0;
  }

  const label = document.getElementById('emergencySurcharge');
  if (label && surcharge > 0) label.textContent = '+$' + surcharge.toFixed(2);

  wrap.classList.toggle('hidden', !available);

  if (!available && state.emergency) {
    state.emergency = false;
    const t = document.getElementById('emergencyToggle');
    if (t) { t.classList.remove('on'); t.classList.add('off'); }
    updateDateRestrictions();
  }
}

function showAbout() {
  showNotification('stardust tarot — son lecturas de tarot conscientes, sin predicciones ni respuestas absolutas. un espacio para ver tu situación desde otro ángulo y tomar tus propias decisiones ✨');
}

function showPoliticas() {
  const overlay = document.getElementById('politicasOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  // Re-trigger fade-in animation by removing/adding the class
  const card = overlay.querySelector('.politicas-card');
  if (card) {
    card.classList.remove('fade-in');
    void card.offsetWidth; // force reflow
    card.classList.add('fade-in');
  }
}

function hidePoliticas(e) {
  if (e) e.stopPropagation();
  smoothHideOverlay('politicasOverlay');
}

function showLecturasGuide() {
  const overlay = document.getElementById('lecturasGuideOverlay');
  if (!overlay) return;
  if (typeof renderLecturasGuide === 'function') renderLecturasGuide();
  overlay.classList.remove('hidden');
  const card = overlay.querySelector('.lecturas-guide-card');
  if (card) {
    card.classList.remove('fade-in');
    void card.offsetWidth;
    card.classList.add('fade-in');
  }
}

function hideLecturasGuide(e) {
  if (e) e.stopPropagation();
  smoothHideOverlay('lecturasGuideOverlay');
}

function showQuiz() {
  const overlay = document.getElementById('quizOverlay');
  if (!overlay) return;
  if (typeof startQuiz === 'function') startQuiz();
  overlay.classList.remove('hidden');
  const card = overlay.querySelector('.quiz-card');
  if (card) {
    card.classList.remove('fade-in');
    void card.offsetWidth;
    card.classList.add('fade-in');
  }
}

function hideQuiz(e) {
  if (e) e.stopPropagation();
  smoothHideOverlay('quizOverlay');
}

// Cierre suave de overlays con animacion
function smoothHideOverlay(id) {
  const overlay = document.getElementById(id);
  if (!overlay || overlay.classList.contains('hidden') || overlay.classList.contains('overlay-closing')) return;
  overlay.classList.add('overlay-closing');
  setTimeout(function () {
    overlay.classList.add('hidden');
    overlay.classList.remove('overlay-closing');
  }, 160);
}

// Cerrar cualquier overlay abierto con la tecla Escape
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  smoothHideOverlay('quizOverlay');
  smoothHideOverlay('lecturasGuideOverlay');
  smoothHideOverlay('politicasOverlay');
});
