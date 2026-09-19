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

function calcTotal() {
  let total = Object.values(state.readings).reduce((a, b) => a + b, 0);
  if (state.emergency) total += 7;
  if (state.pago === 'PayPal') total += 2.5;
  return total;
}

function toggleEmergency() {
  state.emergency = !state.emergency;
  const t = document.getElementById('emergencyToggle');
  t.classList.toggle('on', state.emergency);
  t.classList.toggle('off', !state.emergency);
  updateDateRestrictions();
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
