// ui/calendar-ui.js - Calendario de fechas personalizado (lunes a viernes)
// Reemplaza al input type=date nativo: sabados y domingos no se pueden elegir.

const CAL_WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; // semana inicia en lunes
const CAL_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CAL_DAYNAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

let _calYear = null;
let _calMonth = null;

function _capWord(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
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
  state.fecha = iso;
  const input = document.getElementById('inpDate');
  if (input) input.value = iso;
  setCalendarOpen(false);
  renderCalendar();
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

  let html = '<div class="flex items-center justify-between mb-2">';
  html += '<button type="button" id="calPrevBtn" class="cal-nav"' + (canGoBack ? '' : ' disabled') + ' aria-label="Mes anterior"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>';
  html += '<div class="font-title text-lg italic text-txt select-none">' + _capWord(CAL_MONTHS[month]) + ' ' + year + '</div>';
  html += '<button type="button" id="calNextBtn" class="cal-nav" aria-label="Mes siguiente"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>';
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

    let cls = 'cal-day';
    if (isWeekend) cls += ' is-weekend';
    if (isPast) cls += ' is-past';
    if (isToday && !isPast && !isWeekend) cls += ' is-today';
    if (isSelected) cls += ' selected';

    html += '<button type="button" class="' + cls + '" data-iso="' + iso + '"' + (isWeekend || isPast ? ' disabled' : '') + '>' + d + '</button>';
  }
  html += '</div>';
  html += '<div class="calendar-note">sábados y domingos no disponibles</div>';

  container.innerHTML = html;

  const prevBtn = document.getElementById('calPrevBtn');
  const nextBtn = document.getElementById('calNextBtn');
  if (prevBtn) prevBtn.addEventListener('click', function () { changeCalendarMonth(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { changeCalendarMonth(1); });
  container.querySelectorAll('.cal-day:not(:disabled)').forEach(function (btn) {
    btn.addEventListener('click', function () { selectCalendarDate(btn.dataset.iso); });
  });

  const lbl = document.getElementById('dateTriggerLabel');
  if (lbl) {
    lbl.textContent = state.fecha ? '\u2726 ' + _capWord(formatPrettyDate(state.fecha)) : 'elegir fecha';
  }
  if (window.lucide) setTimeout(function () { lucide.createIcons(); }, 0);
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
