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
  input.min = formatDateValue(minDate);
  if (input.value && input.value < input.min) input.value = '';
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
