// ui/calendar-ui.js - Calendario de fechas personalizado (lunes a viernes)
// Reemplaza al input type=date nativo: sabados y domingos no se pueden elegir.

const CAL_WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; // semana inicia en lunes
const CAL_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CAL_DAYNAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

let _calYear = null;
let _calMonth = null;
let _availLoaded = {};

function _capWord(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function _loadMonthAvailability(year, month) {
  const key = year + '-' + String(month + 1).padStart(2, '0');
  if (_availLoaded[key]) return;
  _availLoaded[key] = true;
  const from = formatDateValue(new Date(year, month, 1));
  const to = formatDateValue(new Date(year, month + 1, 0));
  await fetchAvailability(from, to);
  renderCalendar();
}

// Fecha minima permitida: hoy + 2 dias normal, hoy mismo si es emergencia
function getCalendarMinDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = new Date(today);
  min.setDate(today.getDate() + (state.emergency ? 0 : 2));
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
  const p = iso.split('-').map(Number);
  const dow = new Date(p[0], p[1] - 1, p[2]).getDay();
  if (dow === 0 || dow === 6) return; // sabado o domingo: no permitido
  const minIso = formatDateValue(getCalendarMinDate());
  if (iso < minIso) return; // dia ya pasado o no disponible
  const avail = getDayAvailability(iso);
  const useEmergency = state.emergency && isEmergencyWindow(iso)
    && getEmergencySurcharge() > 0 && avail.emergenciaLeft > 0;
  if (useEmergency ? avail.emergenciaLeft <= 0 : avail.normalLeft <= 0) return; // sin cupo del tipo elegido
  state.fecha = iso;
  const input = document.getElementById('inpDate');
  if (input) input.value = iso;
  setCalendarOpen(false);
  renderCalendar();
  if (typeof updateEmergencyToggle === 'function') updateEmergencyToggle();
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
  const minIso = formatDateValue(minDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayIso = formatDateValue(now);

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

  html += '<div class="calendar-grid">';
  for (let i = 0; i < 7; i++) {
    html += '<div class="cal-weekday' + (i >= 5 ? ' weekend' : '') + '">' + CAL_WEEKDAYS[i] + '</div>';
  }
  for (let i = 0; i < lead; i++) html += '<div class="cal-empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    const iso = formatDateValue(new Date(year, month, d));
    const isWeekend = dow === 0 || dow === 6;
    const isPast = !isWeekend && iso < minIso;
    const isToday = iso === todayIso;
    const isSelected = state.fecha === iso;
    const avail = getDayAvailability(iso);
    // Estado del dia segun el modo activo:
    //   open = hay cupo | only-emergency = normal lleno pero emergencia libre | full = sin cupo
    // La emergencia aplica dentro de la ventana (hoy → domingo de la semana que viene) si la lectura califica.
    let status = 'open';
    if (!isWeekend && !isPast) {
      const emergencyOk = isEmergencyWindow(iso) && canEmergencyReading && avail.emergenciaLeft > 0;
      if (state.emergency && emergencyOk) {
        status = 'open';
      } else if (avail.normalLeft <= 0) {
        status = emergencyOk ? 'only-emergency' : 'full';
      }
    }
    const isFull = status === 'full';
    const isOnlyEmergency = status === 'only-emergency';

    let cls = 'cal-day';
    if (isWeekend) cls += ' is-weekend';
    if (isPast) cls += ' is-past';
    if (isFull) cls += ' is-full';
    if (isOnlyEmergency) cls += ' is-only-emergency';
    if (isToday && !isPast && !isWeekend) cls += ' is-today';
    if (isSelected) cls += ' selected';

    let inner = '<span class="cal-num">' + d + '</span>';
    if (!isWeekend && !isPast) {
      let dotCls = 'cal-dot';
      if (isFull) dotCls += ' is-full';
      else if (isOnlyEmergency) dotCls += ' is-only-emergency';
      inner += '<span class="' + dotCls + '"></span>';
    }

    html += '<button type="button" class="' + cls + '" data-iso="' + iso + '"' + (isWeekend || isPast ? ' disabled' : '') + '>' + inner + '</button>';
  }
  html += '</div>';
  html += '<div class="calendar-note"><span class="note-row"><span class="note-item"><i class="dot dot-green"></i>disponible</span><span class="note-item"><i class="dot dot-gold"></i>solo emergencia</span><span class="note-item"><i class="dot dot-red"></i>agenda llena</span></span></div>';

  container.innerHTML = html;

  const prevBtn = document.getElementById('calPrevBtn');
  const nextBtn = document.getElementById('calNextBtn');
  if (prevBtn) prevBtn.addEventListener('click', function () { changeCalendarMonth(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { changeCalendarMonth(1); });
  container.querySelectorAll('.cal-day:not(:disabled)').forEach(function (btn) {
    btn.addEventListener('click', function () {
        if (btn.classList.contains('is-full')) showFullDateModal('full');
        else if (btn.classList.contains('is-only-emergency')) showFullDateModal('emergency');
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

function showFullDateModal(mode) {
  const isEmergency = mode === 'emergency';
  const title = document.getElementById('fdateTitle');
  const text = document.getElementById('fdateText');
  const btn = document.getElementById('fdateBtn');
  const emergencyBox = document.getElementById('fdateEmergency');
  const toggle = document.getElementById('fdateToggle');

  if (isEmergency) {
    if (title) title.textContent = 'solo emergencia ✨';
    if (text) text.textContent = 'esta fecha ya no tiene cupo normal, pero sí de emergencia (+$' + getEmergencySurcharge().toFixed(2) + '). actívala para reservar este día ♥';
    if (btn) btn.hidden = true;
    if (emergencyBox) emergencyBox.hidden = false;
    if (toggle) { toggle.classList.remove('on'); toggle.classList.add('off'); }
  } else {
    if (title) title.textContent = 'agenda llena ✨';
    if (text) text.textContent = 'esa fecha ya no tiene cupo. elige otro día disponible ✨';
    if (btn) btn.hidden = false;
    if (emergencyBox) emergencyBox.hidden = true;
  }
  const m = document.getElementById('fullDateModal');
  if (m) m.classList.add('open');
}

// Interruptor del modal: activa el modo emergencia y cierra tras ver la animacion.
function fdateToggleEmergency() {
  const toggle = document.getElementById('fdateToggle');
  if (toggle) { toggle.classList.remove('off'); toggle.classList.add('on'); }
  if (!state.emergency) toggleEmergency();
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
