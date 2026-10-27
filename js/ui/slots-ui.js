// ── ui/slots-ui.js — Horario en menú desplegable (bloques de 30 min, 10:00 – 18:00) ──
// Pinta los horarios disponibles del día elegido en un <select>, muestra las horas
// en formato am/pm y guarda la elección en `state.inicio` / `state.duracion` /
// `state.slotTipo` / `state.horario`.

// Carga los bloques ocupados del día elegido y repinta el menú.
function loadSlotGrid() {
  if (!state.fecha || typeof fetchDaySlots !== 'function') {
    renderSlotSelect();
    return;
  }
  var iso = state.fecha;
  fetchDaySlots(iso).then(function () {
    if (state.fecha === iso) renderSlotSelect();
  });
}

// ¿Este bloque se puede elegir con la modalidad actual?
function slotSeleccionable(slot) {
  if (!slot) return false;
  if (slot.estado === 'libre') return true;
  // Con la emergencia activa, un bloque tomado por una lectura normal queda
  // disponible: la emergencia puede solaparse con UNA normal (⚡).
  return slot.estado === 'normal' && !!state.emergency;
}

// "10:00" -> "10:00 am" · "13:30" -> "1:30 pm" · "17:30" -> "5:30 pm"
function formatSlot12h(inicio) {
  var min = typeof slotToMinutes === 'function' ? slotToMinutes(inicio) : NaN;
  if (!isFinite(min)) return String(inicio || '');
  var h = Math.floor(min / 60);
  var m = min % 60;
  var sufijo = h >= 12 ? 'pm' : 'am';
  var h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + sufijo;
}

// Texto que se ve en el menú para un bloque disponible (⚡ = se solapa con otra lectura).
function slotEtiqueta(slot) {
  var hora = formatSlot12h(slot.inicio);
  if (slot.estado === 'normal' && state.emergency) return hora + ' ⚡';
  return hora;
}

function renderSlotSelect() {
  var select = document.getElementById('slotSelect');
  if (!select) return;

  if (!state.fecha) {
    select.innerHTML = '<option value="" selected>elige una fecha para ver los horarios ✦</option>';
    select.disabled = true;
    select.value = '';
    bindSlotSelect();
    updateSlotHint();
    return;
  }

  var duracion = totalReadingDuration();
  // Solo se ofrecen los bloques que se pueden tomar: los ocupados no se listan.
  var disponibles = horariosDisponibles(state.fecha, duracion).filter(slotSeleccionable);

  if (!disponibles.length) {
    select.innerHTML = '<option value="" selected>ya no quedan horarios para este día ✦ elige otra fecha</option>';
    select.disabled = true;
    select.value = '';
    bindSlotSelect();
    updateSlotHint();
    return;
  }

  var opciones = ['<option value="">— elige un horario —</option>'];
  disponibles.forEach(function (s) {
    var titulo = (s.estado === 'normal' && state.emergency)
      ? formatSlot12h(s.inicio) + ' · con otra lectura (disponible por emergencia)'
      : formatSlot12h(s.inicio) + ' · disponible';
    opciones.push('<option value="' + s.inicio + '"'
      + (state.inicio === s.inicio ? ' selected' : '')
      + ' title="' + titulo + '">'
      + slotEtiqueta(s) + '</option>');
  });

  select.disabled = false;
  select.innerHTML = opciones.join('');
  // Si el horario guardado ya no está entre los disponibles, queda el placeholder.
  select.value = disponibles.some(function (s) { return s.inicio === state.inicio; }) ? state.inicio : '';

  bindSlotSelect();
  updateSlotHint();
}

// Un solo listener para el menú (se rehace el HTML, no los listeners).
function bindSlotSelect() {
  var select = document.getElementById('slotSelect');
  if (!select || select.dataset.bound === '1') return;
  select.dataset.bound = '1';
  select.addEventListener('change', function () {
    selectSlot(select.value);
  });
}

function selectSlot(inicio) {
  if (!state.fecha) return showNotification('selecciona una fecha primero');

  // Volver al placeholder = quitar el horario elegido.
  if (!inicio) {
    clearSlotSelection();
    renderSlotSelect();
    return;
  }

  var duracion = totalReadingDuration();
  var slot = horariosDisponibles(state.fecha, duracion).find(function (s) {
    return s.inicio === inicio;
  });
  if (!slot || slot.estado === 'pasado' || slot.estado === 'no-cabe') {
    renderSlotSelect();
    return;
  }
  if (slot.estado === 'emergencia' || (slot.estado === 'normal' && !state.emergency)) {
    renderSlotSelect();
    return showNotification('ese horario ya está ocupado ✦ elige otro');
  }

  state.inicio = inicio;
  state.duracion = duracion;
  state.slotTipo = state.emergency ? 'emergencia' : 'normal';
  state.horario = formatSlot12h(inicio) + ' · ' + duracion + ' min';
  renderSlotSelect();
}

function clearSlotSelection() {
  state.inicio = '';
  state.duracion = 0;
  state.slotTipo = '';
  state.horario = '';
}

// Revalida el horario elegido: si cambiaron las lecturas (duración), la
// modalidad (normal/emergencia) o el día, la selección se limpia.
function syncSlotSelection() {
  if (!state.inicio) return;
  var duracion = totalReadingDuration();
  var tipo = state.emergency ? 'emergencia' : 'normal';

  if (state.duracion !== duracion || (state.slotTipo && state.slotTipo !== tipo)) {
    clearSlotSelection();
    renderSlotSelect();
    return;
  }

  var slot = horariosDisponibles(state.fecha, duracion).find(function (s) {
    return s.inicio === state.inicio;
  });

  if (!slotSeleccionable(slot)) {
    clearSlotSelection();
    renderSlotSelect();
  }
}

function updateSlotHint() {
  var hint = document.getElementById('slotHint');
  if (!hint) return;

  if (state.inicio) {
    var texto = '✦ ' + formatSlot12h(state.inicio) + ' · ' + state.duracion + ' min';
    var sufijo = state.slotTipo === 'emergencia' ? ' · emergencia ⚡' : '';
    hint.innerHTML = 'seleccionado: <span class="slot-hint-selected">' + texto + '</span>' + sufijo;
    return;
  }

  var duracion = totalReadingDuration();
  if (!state.fecha) {
    hint.textContent = 'elige una fecha para ver los horarios disponibles';
    return;
  }
  if (!horariosDisponibles(state.fecha, duracion).some(slotSeleccionable)) {
    hint.textContent = 'no quedan horarios disponibles para este día · elige otra fecha';
    return;
  }
  if (state.emergency) {
    hint.textContent = 'bloques de 30 min · tu lectura de emergencia dura ' + duracion
      + ' min · ⚡ = horario con otra lectura (puedes tomarlo)';
    return;
  }
  hint.textContent = 'bloques de 30 min · tu lectura dura ' + duracion + ' min · elige un horario libre';
}
