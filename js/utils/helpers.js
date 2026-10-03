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
// Ventana de emergencia: hoy hasta el domingo de la semana actual.
function getEmergencyWindowEndIso() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0 = domingo
  const end = new Date(today);
  if (dow !== 0) end.setDate(today.getDate() + (7 - dow));
  return formatDateValue(end);
}

// ¿La fecha cae dentro de la semana actual (hoy → domingo)?
function isEmergencyWindow(iso) {
  if (!iso) return false;
  const todayIso = formatDateValue(new Date());
  return iso >= todayIso && iso <= getEmergencyWindowEndIso();
}

// Recargo de emergencia según la duración total de las lecturas elegidas.
// Devuelve 0 cuando la emergencia no aplica (nada elegido o alguna lectura sin prioridad).
// < 20 min => +$7 | >= 20 min => +$10
function getEmergencySurcharge() {
  const keys = Object.keys(state.readings);
  if (keys.length === 0) return 0;
  let totalMin = 0;
  for (const key of keys) {
    const r = readingsCatalog.find(function (x) { return x.id === key; });
    if (!r) continue;
    if (r.emergencyEligible === false) return 0; // una lectura sin prioridad bloquea la emergencia
    totalMin += r.durationMin || 0;
  }
  return totalMin >= 20 ? 10 : 7;
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
//  - la fecha elegida está dentro de la semana actual (si ya hay fecha)
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
