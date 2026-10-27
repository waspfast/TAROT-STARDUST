// ── ui/slots-ui.js — Rejilla de horarios (bloques de 30 min, 10:00 – 18:00) ──
// Pinta los horarios del día elegido, marca los ocupados y guarda la elección
// en `state.inicio` / `state.duracion` / `state.slotTipo` / `state.horario`.

// Carga los bloques ocupados del día elegido y repinta la rejilla.
function loadSlotGrid() {
  if (!state.fecha || typeof fetchDaySlots !== 'function') {
    renderSlotGrid();
    return;
  }
  var iso = state.fecha;
  fetchDaySlots(iso).then(function () {
    if (state.fecha === iso) renderSlotGrid();
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

function slotEtiqueta(slot) {
  if (slot.estado === 'emergencia') return slot.inicio + ' ocupado';
  if (slot.estado === 'normal') {
    return slot.inicio + (state.emergency ? ' con otra lectura, disponible para emergencia' : ' ocupado');
  }
  return slot.inicio + ' disponible';
}

function renderSlotGrid() {
  var grid = document.getElementById('slotGrid');
  if (!grid) return;

  if (!state.fecha) {
    grid.innerHTML = '<p class="slot-empty">elige una fecha para ver los horarios ✦</p>';
    updateSlotHint();
    return;
  }

  var duracion = totalReadingDuration();
  var lista = horariosDisponibles(state.fecha, duracion);
  // "Hoy" solo ofrece horas futuras; los bloques donde la lectura no cabe no se muestran.
  var visibles = lista.filter(function (s) {
    return s.estado !== 'pasado' && s.estado !== 'no-cabe';
  });

  if (!visibles.length) {
    grid.innerHTML = '<p class="slot-empty">ya no quedan horarios para este día ✦ elige otra fecha</p>';
    updateSlotHint();
    return;
  }

  grid.innerHTML = visibles.map(function (s) {
    var clases = ['slot-pill'];
    var marca = '';
    if (s.estado === 'normal' && state.emergency) {
      clases.push('is-emergency');
      marca = '<span class="slot-bolt" aria-hidden="true">⚡</span>';
    } else if (s.estado !== 'libre') {
      clases.push('is-busy');
    }
    if (state.inicio === s.inicio) clases.push('is-selected');

    return '<button type="button" class="' + clases.join(' ') + '"'
      + ' data-inicio="' + s.inicio + '" data-estado="' + s.estado + '"'
      + ' aria-pressed="' + (state.inicio === s.inicio) + '"'
      + ' aria-disabled="' + (slotSeleccionable(s) ? 'false' : 'true') + '"'
      + ' aria-label="' + slotEtiqueta(s) + '">'
      + marca + '<span>' + s.inicio + '</span></button>';
  }).join('');

  bindSlotGrid();
  updateSlotHint();
}

// Un solo listener para toda la rejilla (se rehace el HTML, no los listeners).
function bindSlotGrid() {
  var grid = document.getElementById('slotGrid');
  if (!grid || grid.dataset.bound === '1') return;
  grid.dataset.bound = '1';
  grid.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.slot-pill') : null;
    if (!btn) return;
    selectSlot(btn.dataset.inicio);
  });
}

function selectSlot(inicio) {
  if (!state.fecha) return showNotification('selecciona una fecha primero');
  var duracion = totalReadingDuration();
  var slot = horariosDisponibles(state.fecha, duracion).find(function (s) {
    return s.inicio === inicio;
  });
  if (!slot) return;
  if (slot.estado === 'pasado' || slot.estado === 'no-cabe') return;
  if (slot.estado === 'emergencia') return showNotification('ese horario ya está ocupado ✦ elige otro');
  if (slot.estado === 'normal' && !state.emergency) {
    return showNotification('ese horario ya está ocupado ✦ elige otro');
  }

  state.inicio = inicio;
  state.duracion = duracion;
  state.slotTipo = state.emergency ? 'emergencia' : 'normal';
  state.horario = inicio + ' · ' + duracion + ' min';
  renderSlotGrid();
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
    renderSlotGrid();
    return;
  }

  var slot = horariosDisponibles(state.fecha, duracion).find(function (s) {
    return s.inicio === state.inicio;
  });

  if (!slotSeleccionable(slot)) {
    clearSlotSelection();
    renderSlotGrid();
  }
}

function updateSlotHint() {
  var hint = document.getElementById('slotHint');
  if (!hint) return;

  if (state.inicio) {
    var texto = '✦ ' + state.inicio + ' · ' + state.duracion + ' min';
    var sufijo = state.slotTipo === 'emergencia' ? ' · emergencia ⚡' : '';
    hint.innerHTML = 'seleccionado: <span class="slot-hint-selected">' + texto + '</span>' + sufijo;
    return;
  }

  var duracion = totalReadingDuration();
  if (!state.fecha) {
    hint.textContent = 'elige una fecha para ver los horarios disponibles';
    return;
  }
  if (state.emergency) {
    hint.textContent = 'bloques de 30 min · tu lectura de emergencia dura ' + duracion
      + ' min · ⚡ = horario con otra lectura (puedes tomarlo)';
    return;
  }
  hint.textContent = 'bloques de 30 min · tu lectura dura ' + duracion + ' min · elige un horario libre';
}
