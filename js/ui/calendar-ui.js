// ui/calendar-ui.js - Calendario de fechas personalizado (lunes a viernes)
// Las fechas abiertas y sus excepciones vienen de la disponibilidad servida por D1.

const CAL_WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; // semana inicia en lunes
const CAL_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CAL_DAYNAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

let _calYear = null;
let _calMonth = null;
let _availLoaded = {};
let _availLoading = {};
let _availFailed = {};
let _availErrorShown = {};
let _fdateIso = ''; // día tocado en el modal "agenda llena / solo emergencia"

function _capWord(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function _loadMonthAvailability(year, month) {
  const key = year + '-' + String(month + 1).padStart(2, '0');
  if (_availLoaded[key] || _availLoading[key] || _availFailed[key]) return;
  _availLoading[key] = true;
  const from = formatDateValue(new Date(year, month, 1));
  const to = formatDateValue(new Date(year, month + 1, 0));
  let ok = false;
  try {
    ok = await fetchAvailability(from, to);
  } finally {
    _availLoading[key] = false;
  }
  if (ok) {
    _availLoaded[key] = true;
    _availFailed[key] = false;
    _availErrorShown[key] = false;
  } else {
    _availFailed[key] = true;
    if (!_availErrorShown[key]) {
      _availErrorShown[key] = true;
      showNotification('no se pudo cargar la disponibilidad. inténtalo de nuevo en un momento ✦');
    }
  }
  renderCalendar();
}

// Vuelve a intentar cargar el mes visible (boton "reintentar" del calendario).
function retryMonthAvailability() {
  if (_calYear === null || _calMonth === null) return;
  const key = _calYear + '-' + String(_calMonth + 1).padStart(2, '0');
  _availLoaded[key] = false;
  _availLoading[key] = false;
  _availFailed[key] = false;
  _availErrorShown[key] = false;
  renderCalendar();
}

// Fecha minima permitida: hoy + 2 dias normal, hoy mismo si es emergencia
function getCalendarMinDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = new Date(today);
  min.setDate(today.getDate() + (state.emergency ? 0 : 2));
  if (typeof hasExtensiveSelection === 'function' && hasExtensiveSelection()) {
    const extensaMin = new Date(EXTENSIVE_MIN_FECHA + 'T00:00:00');
    if (extensaMin > min) return extensaMin;
  }
  return min;
}

// '2026-08-10'  ->  'lunes 10 de agosto'
function formatPrettyDate(iso) {
  if (!iso) return '';
  const p = iso.split('-');
  if (p.length !== 3) return iso;
  const y = Number(p[0]);
  const m = Number(p[1]) - 1;
  const d = Number(p[2]);
  return CAL_DAYNAMES[new Date(y, m, d).getDay()] + ' ' + d + ' de ' + CAL_MONTHS[m];
}

function selectCalendarDate(iso) {
  if (!(typeof isOpenWeekend === 'function' && isOpenWeekend(iso))) return;
  const minIso = formatDateValue(getCalendarMinDate());
  if (iso < minIso) return; // dia ya pasado o no disponible
  const cupo = getDayCupo(iso);
  const useEmergency = state.emergency && isEmergencyWindow(iso)
    && getEmergencySurcharge() > 0 && cupo.emergencia;
  if (useEmergency ? !cupo.emergencia : !cupo.normal) return; // sin cupo del tipo elegido
  state.fecha = iso;
  const input = document.getElementById('inpDate');
  if (input) input.value = iso;
  setCalendarOpen(false);
  renderCalendar();
  // Cambia el día: el horario elegido deja de valer.
  if (typeof clearSlotSelection === 'function') clearSlotSelection();
  if (typeof updateEmergencyToggle === 'function') updateEmergencyToggle();
  if (typeof loadSlotGrid === 'function') loadSlotGrid();
}

function changeCalendarMonth(dir) {
  const d = new Date(_calYear, _calMonth + dir, 1);
  _calYear = d.getFullYear();
  _calMonth = d.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const container = document.getElementById('customCalendar');
  if (!container) return;

  const minDate = getCalendarMinDate();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayIso = formatDateValue(now);

  // Mínimos reales para reservar, independientes del estado actual de emergencia:
  //   normal     -> hoy + 2 días
  //   emergencia -> hoy (la ventana de emergencia empieza hoy)
  // Las lecturas extensas nunca reservan antes de EXTENSIVE_MIN_FECHA (ni con emergencia).
  const normalMinDate = new Date(now);
  normalMinDate.setDate(now.getDate() + 2);
  let normalMinIso = formatDateValue(normalMinDate);
  let emergencyMinIso = todayIso;
  if (typeof hasExtensiveSelection === 'function' && hasExtensiveSelection()) {
    const extensaMinIso = formatDateValue(new Date(EXTENSIVE_MIN_FECHA + 'T00:00:00'));
    if (extensaMinIso > normalMinIso) normalMinIso = extensaMinIso;
    if (extensaMinIso > emergencyMinIso) emergencyMinIso = extensaMinIso;
  }

  // La primera vez inicia en el mes de la fecha minima disponible
  if (_calYear === null || _calMonth === null) {
    _calYear = minDate.getFullYear();
    _calMonth = minDate.getMonth();
  }

  const year = _calYear;
  const month = _calMonth;
  const firstDow = new Date(year, month, 1).getDay(); // 0 = domingo
  const lead = firstDow === 0 ? 6 : firstDow - 1; // celdas vacias hasta el primer lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const minMonthStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canGoBack = new Date(year, month, 1) > minMonthStart;
  const canEmergencyReading = getEmergencySurcharge() > 0; // la lectura elegida permite emergencia

  let html = '<div class="flex items-center justify-between mb-2">';
  html += '<button type="button" id="calPrevBtn" class="cal-nav"' + (canGoBack ? '' : ' disabled') + ' aria-label="mes anterior"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>';
  html += '<div class="font-title text-lg italic text-txt select-none">' + CAL_MONTHS[month] + ' ' + year + '</div>';
  html += '<button type="button" id="calNextBtn" class="cal-nav" aria-label="mes siguiente"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>';
  html += '</div>';

  const key = year + '-' + String(month + 1).padStart(2, '0');
  const ready = !!_availLoaded[key];
  const failed = !!_availFailed[key];

  if (!ready) {
    html += '<div class="cal-loading' + (failed ? ' is-error' : '') + '">';
    if (failed) {
      html += '<p class="cal-loading-text">no pudimos cargar las fechas disponibles. revisa tu conexión e inténtalo de nuevo.</p>';
      html += '<button type="button" id="calRetryBtn" class="cal-retry">reintentar</button>';
    } else {
      html += '<span class="cal-spinner" aria-hidden="true"></span>';
      html += '<p class="cal-loading-text">cargando fechas disponibles…</p>';
    }
    html += '</div>';
  } else {
  html += '<div class="calendar-grid">';
  for (let i = 0; i < 7; i++) {
    html += '<div class="cal-weekday' + (i >= 5 ? ' weekend' : '') + '">' + CAL_WEEKDAYS[i] + '</div>';
  }
  for (let i = 0; i < lead; i++) html += '<div class="cal-empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    const iso = formatDateValue(new Date(year, month, d));
    const isOpen = typeof isOpenWeekend === 'function' && isOpenWeekend(iso);
    const isWeekend = (dow === 0 || dow === 6) && !isOpen;
    const isClosed = !isOpen;
    const isToday = iso === todayIso;
    const isSelected = state.fecha === iso;
    const cupo = getDayCupo(iso);

    // Capacidad real del día según el calendario (no sólo los contadores de D1):
    //   canBookNormal    -> agenda con hueco normal dentro del mínimo normal
    //   canBookEmergency -> hueco de emergencia dentro de su ventana (hoy → domingo siguiente)
    const emergencyOk = isOpen && isEmergencyWindow(iso) && canEmergencyReading && cupo.emergencia;
    const canBookNormal = isOpen && iso >= normalMinIso && cupo.normal;
    const canBookEmergency = isOpen && iso >= emergencyMinIso && emergencyOk;

    // Día bloqueado (gris): antes del mínimo normal y sin opción de emergencia.
    // Los días previos al mínimo normal (hoy / mañana) SÍ se ofrecen si hay emergencia.
    const isPast = isOpen && iso < normalMinIso && !canBookEmergency;

    // Estado del dia segun el modo activo:
    //   open = hay cupo (normal, o emergencia ya activada) | only-emergency = normal lleno pero emergencia libre | full = sin cupo
    let status = isClosed ? 'full' : 'open';
    if (isOpen) {
      if (canBookNormal) status = 'open';
      else if (canBookEmergency) status = state.emergency ? 'open' : 'only-emergency';
      else status = 'full';
    }
    const isFull = status === 'full';
    const isOnlyEmergency = status === 'only-emergency';

    let cls = 'cal-day';
    if (isWeekend) cls += ' is-weekend';
    if (isPast) cls += ' is-past';
    if (isFull) cls += ' is-full';
    if (isOnlyEmergency) cls += ' is-only-emergency';
    if (isToday && !isPast && isOpen) cls += ' is-today';
    if (isSelected) cls += ' selected';

    let inner = '<span class="cal-num">' + d + '</span>';
    if (isOpen && !isPast) {
      let dotCls = 'cal-dot';
      if (isFull) dotCls += ' is-full';
      else if (isOnlyEmergency) dotCls += ' is-only-emergency';
      inner += '<span class="' + dotCls + '"></span>';
    }

    html += '<button type="button" class="' + cls + '" data-iso="' + iso + '"' + (isClosed || isPast ? ' disabled' : '') + '>' + inner + '</button>';
  }
  html += '</div>';
  html += '<div class="calendar-note"><span class="note-row"><span class="note-item"><i class="dot dot-green"></i>disponible</span><span class="note-item"><i class="dot dot-gold"></i>solo emergencia disponible</span><span class="note-item"><i class="dot dot-red"></i>agenda llena</span></span></div>';
  }

  container.innerHTML = html;

  const prevBtn = document.getElementById('calPrevBtn');
  const nextBtn = document.getElementById('calNextBtn');
  if (prevBtn) prevBtn.addEventListener('click', function () { changeCalendarMonth(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { changeCalendarMonth(1); });
  const retryBtn = document.getElementById('calRetryBtn');
  if (retryBtn) retryBtn.addEventListener('click', retryMonthAvailability);
  container.querySelectorAll('.cal-day:not(:disabled)').forEach(function (btn) {
    btn.addEventListener('click', function () {
        if (btn.classList.contains('is-full')) showFullDateModal('full', btn.dataset.iso);
        else if (btn.classList.contains('is-only-emergency')) showFullDateModal('emergency', btn.dataset.iso);
        else selectCalendarDate(btn.dataset.iso);
      });
  });

  const lbl = document.getElementById('dateTriggerLabel');
  if (lbl) {
    lbl.textContent = state.fecha ? '\u2726 ' + formatPrettyDate(state.fecha) : 'elegir fecha';
  }
  if (window.lucide) setTimeout(function () { lucide.createIcons(); }, 0);
  _loadMonthAvailability(year, month);
}

// Deselecciona la fecha y vuelve a mostrar "elegir fecha"
function resetCalendarDate() {
  state.fecha = '';
  const input = document.getElementById('inpDate');
  if (input) input.value = '';
  if (typeof clearSlotSelection === 'function') clearSlotSelection();
  if (typeof renderCalendar === 'function') renderCalendar();
  if (typeof updateEmergencyToggle === 'function') updateEmergencyToggle();
}

function isCalendarOpen() {
  const wrap = document.getElementById('calendarCollapse');
  return wrap ? wrap.classList.contains('open') : false;
}

function setCalendarOpen(open) {
  const wrap = document.getElementById('calendarCollapse');
  const trig = document.getElementById('datePickerTrigger');
  if (!wrap) return;
  wrap.classList.toggle('open', open);
  if (trig) {
    trig.classList.toggle('open', open);
    trig.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

function toggleCalendar() {
  setCalendarOpen(!isCalendarOpen());
}

function showFullDateModal(mode, iso) {
  const isEmergency = mode === 'emergency';
  _fdateIso = iso || '';
  const title = document.getElementById('fdateTitle');
  const text = document.getElementById('fdateText');
  const btn = document.getElementById('fdateBtn');
  const emergencyBox = document.getElementById('fdateEmergency');

  if (isEmergency) {
    if (title) title.textContent = 'solo emergencia disponible ✨';
    if (text) text.textContent = 'esta fecha ya no tiene cupo normal, pero sí de emergencia (+$' + getEmergencySurcharge().toFixed(2) + '). actívala para el día pautado ♥';
    if (btn) btn.hidden = true;
    if (emergencyBox) emergencyBox.hidden = false;
  } else {
    if (title) title.textContent = 'agenda llena ✨';
    if (text) text.textContent = 'esa fecha ya no tiene cupo. elige otro día disponible ✨';
    if (btn) btn.hidden = false;
    if (emergencyBox) emergencyBox.hidden = true;
  }
  const m = document.getElementById('fullDateModal');
  if (m) m.classList.add('open');
}

// Botón "solo emergencia disponible": activa la emergencia y deja pautado ese día.
function fdateToggleEmergency() {
  const iso = _fdateIso;
  if (!state.emergency) toggleEmergency();
  // Deja la fecha elegida con sus horarios de emergencia ⚡ listos para tomar.
  if (iso && typeof selectCalendarDate === 'function') selectCalendarDate(iso);
  setTimeout(closeFullDateModal, 300);
}

// Boton "entendido" (solo modo agenda llena).
function fdateAction() {
  closeFullDateModal();
}

function closeFullDateModal() {
  const m = document.getElementById('fullDateModal');
  if (m) m.classList.remove('open');
}
