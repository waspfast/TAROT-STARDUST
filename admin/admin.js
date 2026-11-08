const state = {
  rules: [],
  selectedDate: "",
  month: "",
  discreet: false,
  density: "comfortable",
  consultas: [],
  dashboardConsultas: [],
  expandedTile: null,
  consultaState: "",
  consultaMode: "dia",
  consultaDate: "",
  orderByHora: false,
  consultasBase: [],
  consultasLoaded: false,
  manual: { canal: "whatsapp", tipo: "corta", fecha: "" },
  tiposHoy: null,
  identity: "",
  stats: null,
  ingresos: null,
  ingresosMes: null,
  granularidad: "mes",
  occupancy: null,
  ocupacionGran: "dia",
  activeMetric: "ingresos",
};

const $ = (id) => document.getElementById(id);
const capacityFields = [
  ["corta_normal", "cap-corta-normal"],
  ["corta_emergencia", "cap-corta-emergencia"],
  ["extensa_normal", "cap-extensa-normal"],
  ["extensa_emergencia", "cap-extensa-emergencia"],
];
const preferenceKeys = {
  discreet: "stardust-admin-discreet",
  density: "stardust-admin-density",
};
const chartPalette = ["#d7a3b4", "#d4b06b", "#c4a0ac", "#a8c3b5", "#b9a7d4", "#e3b7a0"];
const consultanteLabels = { nueva: "Nueva", frecuente: "Frecuente", sin_dato: "Sin dato" };
const consultanteColors = { nueva: "#d7a3b4", frecuente: "#d4b06b", sin_dato: "#cfc2c6" };
const tipoLabels = { emergencia: "Emergencias", normal: "Sin emergencia" };
const tipoColors = { emergencia: "#a85c7e", normal: "#a8c3b5" };
const statusOptions = [
  ["en_proceso", "En progreso"],
  ["finalizado", "Finalizada"],
  ["cancelada", "Cancelada"],
];

let pendingRequests = 0;

function setBusy(delta) {
  pendingRequests = Math.max(0, pendingRequests + delta);
  document.documentElement.classList.toggle("is-busy", pendingRequests > 0);
}

function showError(message) {
  $("error").textContent = message;
  $("error").hidden = false;
  $("notice").hidden = true;
}

function showNotice(message) {
  $("notice").textContent = message;
  $("notice").hidden = false;
  $("error").hidden = true;
}

function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.warn("No se pudo leer una preferencia del panel.", error);
    return fallback;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("No se pudo guardar una preferencia del panel.", error);
    showNotice("El ajuste se aplicó, pero el navegador no pudo recordarlo para la próxima sesión.");
  }
}

async function request(path, options = {}) {
  setBusy(1);
  try {
    const response = await fetch(path, {
      cache: "no-store",
      ...options,
      headers: { "content-type": "application/json", ...options.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Acceso no autorizado. Comprueba Cloudflare Access y vuelve a iniciar sesión.");
      }
      throw new Error(data.message || data.error || `Error HTTP ${response.status}`);
    }
    return data;
  } finally {
    setBusy(-1);
  }
}

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nextMonthValue(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatLongDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatMonthLabel(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  if (!year || !month) return "";
  return new Intl.DateTimeFormat("es", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

/* "octubre de 2026" -> "Octubre 2026" (encabezado del calendario) */
function monthTitle(value) {
  return capitalize(formatMonthLabel(value)).replace(/\s+de\s+/gi, " ") || "—";
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function startClock() {
  const clockTime = $("clock-time");
  const clockDate = $("clock-date");
  const timeFormat = new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateFormat = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const tick = () => {
    const now = new Date();
    clockTime.textContent = timeFormat.format(now);
    clockTime.setAttribute("datetime", now.toISOString());
    clockDate.textContent = dateFormat.format(now);
  };
  tick();
  window.setInterval(tick, 1000);
}
function formatName(name) {
  if (!name) return "Sin nombre";
  if (!state.discreet) return name;
  return discreetName(name) || "Sin nombre";
}

function formatPhone(phone) {
  if (!phone) return "";
  return state.discreet ? "••••••••" : phone;
}

function discreetName(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${Array.from(part)[0]}.`)
    .join(" ");
}

function totalsFor(rule) {
  const booked = Object.values(rule?.counts || {}).reduce((sum, count) => sum + Number(count || 0), 0);
  const capacity = capacityFields.reduce((sum, [column]) => sum + Number(rule?.[column] || 0), 0);
  return { booked, capacity, free: Math.max(0, capacity - booked) };
}

function describeDay(rule) {
  const { booked, capacity, free } = totalsFor(rule);
  const reservations = Number(rule?.consultas || 0);
  const ratio = capacity ? Math.min(1, booked / capacity) : 0;
  const isOpen = !!rule?.is_open;
  const level = !isOpen ? "closed" : ratio >= 1 ? "full" : ratio > 0 ? "mid" : "free";
  const label = { free: "Libre", mid: "Ocupación media", full: "Llena", closed: "Cerrada" }[level];
  const meta = isOpen
    ? `${booked} de ${capacity} ${capacity === 1 ? "cupo usado" : "cupos usados"} · ${free} ${free === 1 ? "libre" : "libres"}`
      + (reservations ? ` · ${reservations} ${reservations === 1 ? "reserva" : "reservas"}` : "")
    : `Sin cupos publicados · ${booked} ${booked === 1 ? "lectura contabilizada" : "lecturas contabilizadas"}`;
  return { level, label, meta, booked, capacity, free, reservations };
}

function renderCalendar() {
  closeDaySheet();
  const calendar = $("calendar");
  calendar.replaceChildren();
  const calendarTitle = $("cal-title");
  if (calendarTitle) calendarTitle.textContent = monthTitle(state.month);
  for (const label of ["L", "M", "X", "J", "V", "S", "D"]) {
    const weekday = document.createElement("span");
    weekday.className = "wd";
    weekday.textContent = label;
    calendar.append(weekday);
  }

  const [year, month] = state.month.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const blanks = (firstDay + 6) % 7;
  for (let index = 0; index < blanks; index++) {
    const blank = document.createElement("span");
    blank.className = "cal-blank";
    blank.setAttribute("aria-hidden", "true");
    calendar.append(blank);
  }

  const rulesByDate = new Map(state.rules.map((rule) => [rule.date, rule]));
  const days = new Date(year, month, 0).getDate();
  const today = dateValue();
  for (let day = 1; day <= days; day++) {
    const date = `${state.month}-${String(day).padStart(2, "0")}`;
    const rule = rulesByDate.get(date);
    const { level, label, meta } = describeDay(rule);
    const dayLabel = capitalize(formatLongDate(date));
    const selected = date === state.selectedDate;
    const position = blanks + day - 1;
    const wrapper = document.createElement("div");
    wrapper.className = "calendar-day";
    wrapper.dataset.column = String((position % 7) + 1);
    wrapper.dataset.row = String(Math.floor(position / 7) + 1);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "d";
    button.dataset.date = date;
    button.dataset.level = level;
    button.textContent = String(day); // el único número de la celda: la fecha
    if (date === today) button.classList.add("is-today");
    if (selected) button.classList.add("is-selected");
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", `${dayLabel}: ${label}. ${meta}.`);
    button.addEventListener("click", () => {
      selectDate(date);
      openDaySheet(date);
    });
    wrapper.append(button);

    const tooltip = document.createElement("div");
    tooltip.className = "cal-tooltip";
    tooltip.setAttribute("role", "dialog");
    tooltip.setAttribute("aria-label", `Detalle de ${dayLabel}`);
    appendText(tooltip, "p", "cal-tip-date", dayLabel);
    appendText(tooltip, "p", "cal-tip-meta", `${label} · ${meta}`);
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "cal-edit";
    edit.textContent = "Editar fecha";
    edit.addEventListener("click", () => {
      selectDate(date);
      activateView("disponibilidad");
    });
    const quick = document.createElement("button");
    quick.type = "button";
    quick.className = "cal-edit cal-quick";
    quick.textContent = rule && rule.is_open ? "Cerrar día" : "Abrir día";
    quick.addEventListener("click", () => toggleDayOpen(date));
    tooltip.append(edit, quick);
    wrapper.append(tooltip);
    calendar.append(wrapper);
  }
  renderGauge();
}
function selectDate(date) {
  state.selectedDate = date;
  for (const button of $("calendar").querySelectorAll(".d")) {
    const selected = button.dataset.date === date;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  fillRuleForm(state.rules.find((item) => item.date === date));
  syncManualDate(date);
}

function openDaySheet(date) {
  const sheet = $("day-sheet");
  if (!sheet || !window.matchMedia("(max-width:767px)").matches) return;
  const rule = state.rules.find((item) => item.date === date);
  const { label, meta } = describeDay(rule);
  $("day-sheet-title").textContent = capitalize(formatLongDate(date));
  $("day-sheet-level").textContent = label;
  $("day-sheet-meta").textContent = meta;
  const toggle = $("day-sheet-toggle");
  if (toggle) toggle.textContent = rule && rule.is_open ? "Cerrar día" : "Abrir día";
  sheet.dataset.date = date;
  sheet.classList.add("is-open");
  const backdrop = $("cal-backdrop");
  if (backdrop) backdrop.hidden = false;
  $("day-sheet-edit").focus({ preventScroll: true });
}

function closeDaySheet() {
  const sheet = $("day-sheet");
  const backdrop = $("cal-backdrop");
  if (backdrop) backdrop.hidden = true;
  if (!sheet) return;
  sheet.classList.remove("is-open");
  delete sheet.dataset.date;
}

function bindDaySheet() {
  const sheet = $("day-sheet");
  if (!sheet) return;
  const backdrop = $("cal-backdrop");
  if (backdrop) backdrop.addEventListener("click", closeDaySheet);
  const close = $("day-sheet-close");
  if (close) close.addEventListener("click", closeDaySheet);
  const toggle = $("day-sheet-toggle");
  if (toggle) toggle.addEventListener("click", () => {
    const date = sheet.dataset.date;
    if (date) toggleDayOpen(date);
  });
  const edit = $("day-sheet-edit");
  if (edit) edit.addEventListener("click", () => {
    const date = sheet.dataset.date;
    closeDaySheet();
    if (date) selectDate(date);
    activateView("disponibilidad");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDaySheet();
  });
  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width:767px)").matches) closeDaySheet();
  });
}

/* en móvil se cambia de mes deslizando sobre la cuadrícula */
function bindCalendarSwipe() {
  const calendar = $("calendar");
  if (!calendar) return;
  let startX = 0;
  let startY = 0;
  let tracking = false;
  calendar.addEventListener("touchstart", (event) => {
    tracking = event.touches.length === 1 && window.matchMedia("(max-width:767px)").matches;
    if (!tracking) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });
  calendar.addEventListener("touchend", (event) => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    shiftMonth(deltaX < 0 ? 1 : -1);
  }, { passive: true });
}

function fillRuleForm(rule) {
  $("rule-title").textContent = state.selectedDate ? formatLongDate(state.selectedDate) : "Selecciona una fecha";
  const { booked, free } = totalsFor(rule);
  $("rule-meta").textContent = rule
    ? `${rule.custom ? "Excepción" : "Regla semanal"} · ${booked} lecturas contabilizadas · ${free} cupos de lectura libres`
    : "";
  $("rule-open").checked = !!rule?.is_open;
  $("rule-emergency-extended").checked = !!rule?.emergencia_extendida;
  $("rule-start").value = rule?.inicio || "10:00";
  $("rule-end").value = rule?.fin || "18:00";
  for (const [column, id] of capacityFields) $(id).value = String(rule?.[column] ?? 0);
  $("save-rule").disabled = !state.selectedDate;
  $("reset-rule").hidden = !rule?.custom;
}

async function loadAvailability() {
  state.month = state.month || monthValue();
  const data = await request(`/api/admin/availability?month=${encodeURIComponent(state.month)}`);
  state.rules = data.days;
  renderCalendar();
  fillRuleForm(state.rules.find((item) => item.date === state.selectedDate));
  syncManualDate(state.selectedDate);
  const openDays = state.rules.filter((item) => item.is_open).length;
  $("stat-open-days").textContent = String(openDays);
  syncTiposHoy();
}

function shiftMonth(delta) {
  const current = state.month || monthValue();
  const [year, monthNumber] = current.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  state.month = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  state.selectedDate = `${state.month}-01`;
  loadAvailability().catch((error) => showError(error.message));
}

async function saveRule(event) {
  event.preventDefault();
  if (!state.selectedDate) return;
  const body = {
    is_open: $("rule-open").checked,
    emergencia_extendida: $("rule-emergency-extended").checked,
    inicio: $("rule-start").value,
    fin: $("rule-end").value,
  };
  for (const [column, id] of capacityFields) body[column] = Number($(id).value);
  $("save-rule").disabled = true;
  const date = state.selectedDate;
  try {
    const saved = await request(`/api/admin/availability/${date}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    // Feedback instantáneo: aplica los valores guardados sin esperar el refetch.
    const rule = state.rules.find((item) => item.date === date);
    if (rule) {
      Object.assign(rule, body, { custom: true });
      renderCalendar();
      fillRuleForm(rule);
      $("stat-open-days").textContent = String(state.rules.filter((item) => item.is_open).length);
    }
    // Reconcilia contadores y lecturas en segundo plano.
    loadAvailability().catch((error) => showError(error.message));
    showNotice(!body.is_open && saved.existing_bookings
      ? `La fecha quedó cerrada. Aún hay ${saved.existing_bookings} ${saved.existing_bookings === 1 ? "lectura contabilizada" : "lecturas contabilizadas"}; puedes avisar a quienes reservaron del cambio.`
      : "La disponibilidad de esta fecha quedó guardada.");
  } catch (error) {
    showError(error.message);
  } finally {
    $("save-rule").disabled = false;
  }
}

async function resetRule() {
  if (!state.selectedDate || !window.confirm("¿Volver a la regla semanal para esta fecha?")) return;
  try {
    await request(`/api/admin/availability/${state.selectedDate}`, { method: "DELETE" });
    await loadAvailability();
    showNotice("La fecha volvió a seguir su regla semanal.");
  } catch (error) {
    showError(error.message);
  }
}
// Abre o cierra un día con un solo clic desde el calendario, conservando los
// cupos (contadores) y la jornada que ya tenga configurados.
async function toggleDayOpen(date) {
  const rule = state.rules.find((item) => item.date === date);
  if (!rule) return;
  const capacity = ["corta_normal", "corta_emergencia", "extensa_normal", "extensa_emergencia"]
    .reduce((sum, column) => sum + (Number(rule[column]) || 0), 0);
  if (!rule.is_open && capacity <= 0) {
    // Sin cupos definidos: abre el formulario para fijarlos antes de abrir.
    selectDate(date);
    activateView("disponibilidad");
    closeDaySheet();
    showNotice("Define los cupos de este día y pulsa «Guardar cambios» para abrirlo.");
    return;
  }
  const body = {
    is_open: !rule.is_open,
    emergencia_extendida: !!rule.emergencia_extendida,
    inicio: rule.inicio || "10:00",
    fin: rule.fin || "18:00",
    corta_normal: Number(rule.corta_normal) || 0,
    corta_emergencia: Number(rule.corta_emergencia) || 0,
    extensa_normal: Number(rule.extensa_normal) || 0,
    extensa_emergencia: Number(rule.extensa_emergencia) || 0,
  };
  try {
    const saved = await request(`/api/admin/availability/${date}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    Object.assign(rule, body, { custom: true });
    closeDaySheet();
    renderCalendar();
    if (state.selectedDate === date) fillRuleForm(rule);
    $("stat-open-days").textContent = String(state.rules.filter((item) => item.is_open).length);
    if (body.is_open) {
      showNotice(`Abriste el ${formatLongDate(date)}.`);
    } else if (!saved || !saved.existing_bookings) {
      showNotice(`Cerraste el ${formatLongDate(date)}.`);
    } else {
      showNotice(`Cerraste el ${formatLongDate(date)}. Aún hay ${saved.existing_bookings} ${saved.existing_bookings === 1 ? "lectura contabilizada" : "lecturas contabilizadas"}.`);
    }
    loadAvailability().catch((error) => showError(error.message));
  } catch (error) {
    showError(error.message);
  }
}
function appendText(parent, tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value || "—";
  parent.append(element);
  return element;
}

function statusLabel(status) {
  if (status === "finalizado") return "Finalizada";
  if (status === "cancelada") return "Cancelada";
  return "En progreso";
}

function compareConsultas(left, right) {
  return `${left.fecha} ${left.inicio || "99:99"}`.localeCompare(`${right.fecha} ${right.inicio || "99:99"}`);
}

// Orden por hora para el modo Día: primero la agenda y al final las fichas sin
// hora asignada.
function compareByHour(left, right) {
  const hour = `${left.inicio || "99:99"}`.localeCompare(`${right.inicio || "99:99"}`);
  if (hour !== 0) return hour;
  return String(left.id || "").localeCompare(String(right.id || ""));
}

// El nombre abre la ficha completa; así el teléfono, el detalle y el origen
// quedan a un toque sin cargar la lista del registro.
function nameControl(consulta, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = formatName(consulta.nombre);
  button.title = "Ver ficha completa";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openConsultaModal(consulta);
  });
  return button;
}

function consultationDateTime(consulta) {
  if (!consulta.inicio || !/^\d{2}:\d{2}$/.test(consulta.inicio)) return null;
  return new Date(`${consulta.fecha}T${consulta.inicio}:00`);
}

function detalleTexto(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value, max = 140) {
  const text = detalleTexto(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/* ---------- resumen imprimible: ayudas de texto ---------- */
// Ancho de la "hoja" en columnas. Cabecera centrada, resto a la izquierda.
const printWidth = 52;
const printRule = "─".repeat(printWidth);
const printSep = "· ─ ─ ─ ♡ ─ ─ ─ ♡ ─ ─ ─ ♡ ─ ─ ─ ·";

function centerText(value, width = printWidth) {
  const text = String(value ?? "").trim();
  if (!text || text.length >= width) return text;
  return " ".repeat(Math.floor((width - text.length) / 2)) + text;
}

// Parte el texto por palabras para que quepa en la hoja (las palabras más
// largas que el ancho se cortan duro para no desbordar la línea).
function wrapText(value, width = printWidth) {
  const text = detalleTexto(value);
  if (!text) return [];
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (!line && word.length <= width) {
      line = word;
      continue;
    }
    if (line && line.length + 1 + word.length <= width) {
      line += ` ${word}`;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (line.length > width) {
      lines.push(line.slice(0, width));
      line = line.slice(width);
    }
  }
  if (line) lines.push(line);
  return lines;
}

function appendTileRecord(container, consulta, options = {}) {
  const item = document.createElement("div");
  item.className = "tile-list-item";
  appendText(item, "span", "tile-list-time", consulta.inicio || "—");
  item.append(nameControl(consulta, "tile-list-name name-link"));
  const phone = formatPhone(consulta.telefono);
  const date = options.showDate === false ? "" : `${consulta.fecha} · `;
  appendText(item, "span", "tile-list-meta",
    `${date}${statusLabel(consulta.estado)} · ${consulta.tipo === "emergencia" ? "Emergencia" : "Normal"}`
    + (phone ? ` · ${phone}` : ""));
  const detalle = truncateText(consulta.detalle, 110);
  if (detalle) appendText(item, "span", "tile-list-detail", detalle);
  container.append(item);
}

function appendEmptyMessage(container, message) {
  appendText(container, "p", "tile-copy", message);
}

function renderTodayTile(now = new Date()) {
  const today = dateValue(now);
  const todaysConsultas = state.dashboardConsultas
    .filter((consulta) => consulta.fecha === today)
    .sort(compareConsultas);
  const upcoming = todaysConsultas.filter((consulta) => {
    const at = consultationDateTime(consulta);
    // Una consulta cancelada ya no es la próxima lectura del día.
    return consulta.estado === "en_proceso" && at && at.getTime() >= now.getTime();
  });
  const next = upcoming[0];

  $("today-date").textContent = formatLongDate(today);
  $("today-summary").textContent = todaysConsultas.length
    ? `${todaysConsultas.length} ${todaysConsultas.length === 1 ? "consulta individual registrada" : "consultas individuales registradas"} para hoy.`
    : "Hoy no tienes consultas individuales registradas.";
  if (next) {
    $("today-next").textContent = formatName(next.nombre);
    const remaining = Math.max(0, Math.ceil((consultationDateTime(next).getTime() - now.getTime()) / 60000));
    let relative = "ahora";
    if (remaining === 1) relative = "en menos de 1 min";
    else if (remaining > 1 && remaining < 60) relative = `en ${remaining} min`;
    else if (remaining >= 60) {
      const hours = Math.floor(remaining / 60);
      const minutes = remaining % 60;
      relative = `en ${hours} h${minutes ? ` ${minutes} min` : ""}`;
    }
    const phone = formatPhone(next.telefono);
    $("today-countdown").textContent = `${next.inicio} · ${relative}${phone ? ` · ${phone}` : ""}`;
  } else {
    $("today-next").textContent = todaysConsultas.length ? "No tienes otra lectura próxima" : "Un espacio para ti";
    $("today-countdown").textContent = "";
  }

  const list = $("today-list");
  list.replaceChildren();
  if (!todaysConsultas.length) appendEmptyMessage(list, "No hay consultas individuales registradas para hoy.");
  else todaysConsultas.forEach((consulta) => appendTileRecord(list, consulta, { showDate: false }));
  return upcoming.length > 0;
}

/* ---------- inicio: KPIs, ocupación, perfil y lecturas en curso ---------- */
function readingsOf(consulta) {
  const names = new Set();
  for (const raw of String(consulta?.lecturas || "").split(",")) {
    const name = raw.trim();
    if (name) names.add(name);
  }
  return names.size;
}

function consultasOfMonth(month) {
  return state.dashboardConsultas.filter((consulta) => String(consulta.fecha || "").startsWith(month));
}

function renderSparkline(now) {
  const container = $("kpi-spark");
  if (!container) return;
  const values = [];
  for (let offset = 4; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - offset);
    const key = dateValue(day);
    values.push(state.dashboardConsultas
      .filter((consulta) => consulta.fecha === key)
      .reduce((sum, consulta) => sum + readingsOf(consulta), 0));
  }
  const max = Math.max(1, ...values);
  container.replaceChildren();
  for (const value of values) {
    const bar = document.createElement("i");
    bar.style.height = `${Math.max(10, Math.round(value / max * 100))}%`;
    container.append(bar);
  }
}

function renderProfile(monthList = consultasOfMonth(monthValue())) {
  const email = String(state.identity || "").trim();
  const avatar = $("perfil-avatar");
  if (avatar) avatar.textContent = email ? email.charAt(0).toUpperCase() : "✶";
  const mail = $("perfil-mail");
  if (mail) mail.textContent = email || "Sesión autorizada";
  $("perfil-abiertas").textContent = String(monthList.filter((consulta) => consulta.estado === "en_proceso").length);
  $("perfil-frecuentes").textContent = String(monthList.filter((consulta) => consulta.consultante === "frecuente").length);
  $("perfil-nuevas").textContent = String(monthList.filter((consulta) => consulta.consultante === "nueva").length);
}

function renderKpiRow(now = new Date()) {
  const today = dateValue(now);
  const todays = state.dashboardConsultas.filter((consulta) => consulta.fecha === today);
  const readings = todays.reduce((sum, consulta) => sum + readingsOf(consulta), 0);
  $("kpi-hoy").textContent = String(readings);
  $("kpi-hoy-foot").textContent = todays.length
    ? `${todays.length} ${todays.length === 1 ? "consulta" : "consultas"} hoy · últimos 5 días`
    : "Sin consultas individuales hoy";
  renderSparkline(now);

  const month = monthValue();
  const monthList = consultasOfMonth(month);
  $("kpi-consultantes").textContent = String(monthList.length);
  $("kpi-consultantes-foot").textContent =
    `${monthList.length === 1 ? "consultante" : "consultantes"} en ${formatMonthLabel(month)}`;
  renderProfile(monthList);
}

function summarizeDays(days) {
  let booked = 0;
  let capacity = 0;
  let open = 0;
  for (const day of Array.isArray(days) ? days : []) {
    if (!day?.is_open) continue;
    const totals = totalsFor(day);
    booked += totals.booked;
    capacity += totals.capacity;
    open += 1;
  }
  return { booked, capacity, open, rate: capacity ? Math.min(100, booked / capacity * 100) : null };
}

function renderGauge() {
  const arc = $("gauge-arc");
  const value = $("gauge-value");
  if (!arc || !value) return;
  const summary = summarizeDays(state.rules);
  const rate = summary.rate;
  // el trazo usa pathLength="100": el offset es el complemento de la ocupación
  const offset = rate === null ? 100 : Math.round((100 - rate) * 10) / 10;
  arc.style.strokeDashoffset = String(offset);
  value.textContent = rate === null ? "—" : formatPercent(rate);
  const month = $("gauge-month");
  if (month) month.textContent = monthTitle(state.month);
  const foot = $("gauge-foot");
  if (foot) {
    foot.textContent = summary.capacity
      ? `${summary.booked} de ${summary.capacity} cupos usados en ${summary.open} `
        + `${summary.open === 1 ? "fecha abierta" : "fechas abiertas"}.`
      : "Publica fechas abiertas para ver la ocupación.";
  }
  const gauge = $("gauge");
  if (gauge) {
    gauge.setAttribute("aria-label", rate === null
      ? "Ocupación del mes: sin cupos publicados"
      : `Ocupación del mes: ${formatPercent(rate)}, ${summary.booked} de ${summary.capacity} cupos usados`);
  }
}

function appendCursoRecord(container, consulta) {
  const item = document.createElement("article");
  item.className = "curso-item";
  const main = document.createElement("div");
  main.className = "curso-main";
  main.append(nameControl(consulta, "curso-name name-link"));
  const phone = formatPhone(consulta.telefono);
  appendText(main, "div", "curso-meta",
    `${formatLongDate(consulta.fecha)}${consulta.inicio ? ` · ${consulta.inicio}` : ""}`
    + `${consulta.tipo === "emergencia" ? " · Emergencia" : ""}${phone ? ` · ${phone}` : ""}`);
  item.append(main);
  appendText(item, "span", "curso-chip", statusLabel(consulta.estado));
  container.append(item);
}

function renderProgressTile() {
  const list = state.dashboardConsultas
    .filter((consulta) => consulta.estado === "en_proceso")
    .sort(compareConsultas);
  $("kpi-progreso").textContent = String(list.length);
  $("curso-count").textContent = String(list.length);
  $("curso-copy").textContent = list.length
    ? `${list.length} ${list.length === 1 ? "lectura sigue" : "lecturas siguen"} en progreso.`
    : "Todo al día; no hay lecturas por acompañar.";

  const preview = $("curso-list");
  const all = $("curso-all");
  preview.replaceChildren();
  all.replaceChildren();
  if (!list.length) {
    appendEmptyMessage(preview, "Tu espacio está al día, con calma.");
    appendEmptyMessage(all, "No hay lecturas en progreso en este periodo.");
    return 0;
  }
  list.slice(0, 3).forEach((consulta) => appendCursoRecord(preview, consulta));
  list.forEach((consulta) => appendCursoRecord(all, consulta));
  return list.length;
}

function renderDashboard(now = new Date()) {
  const hasUpcomingToday = renderTodayTile(now);
  const pendingCount = renderProgressTile();
  renderKpiRow(now);
  renderGauge();
  const dashboard = $("dashboard");
  dashboard.classList.toggle("has-pending", pendingCount > 0);
  dashboard.classList.toggle("is-quiet", !hasUpcomingToday);
}
function renderConsultas(consultas) {
  state.consultas = consultas;
  $("consulta-count").textContent = state.consultasLoaded ? String(consultas.length) : "—";
  const container = $("consultas-list");
  container.replaceChildren();

  for (const consulta of consultas) {
    const card = document.createElement("article");
    card.className = "consulta";
    if (consulta.estado === "cancelada") card.classList.add("is-cancelada");
    appendText(card, "span", "consulta-time", consulta.inicio || "—");
    const details = document.createElement("div");
    details.append(nameControl(consulta, "consulta-who name-link"));
    const parts = [
      consulta.fecha,
      consulta.tipo === "emergencia" ? "Emergencia" : "Normal",
    ];
    if (consulta.lectura_tipo === "extensa") parts.push("Extensa");
    else if (consulta.lectura_tipo === "corta") parts.push("Corta");
    if (consulta.canal && manualChannelLabels[consulta.canal]) {
      parts.push(manualChannelLabels[consulta.canal]);
    }
    if (consulta.consultante) parts.push(`Consultante ${consulta.consultante}`);
    appendText(details, "div", "consulta-sub", parts.join(" · "));
    if (consulta.origen === "manual") {
      const tag = document.createElement("span");
      tag.className = "consulta-origen";
      tag.textContent = "Manual";
      details.append(tag);
    }
    if (consulta.telefono) {
      const phone = document.createElement("p");
      phone.className = "consulta-phone";
      if (state.discreet) {
        phone.textContent = `Teléfono: ${formatPhone(consulta.telefono)}`;
      } else {
        const link = document.createElement("a");
        link.href = `tel:${consulta.telefono.replace(/[^\d+]/g, "")}`;
        link.textContent = `Teléfono: ${consulta.telefono}`;
        phone.append(link);
      }
      details.append(phone);
    }
    const detalle = truncateText(consulta.detalle, 180);
    if (detalle) appendText(details, "p", "consulta-note", detalle);
    const status = document.createElement("select");
    status.className = "status-control";
    status.setAttribute("aria-label", `Estado de la consulta ${consulta.id}`);
    for (const [value, label] of statusOptions) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      status.append(option);
    }
    status.value = consulta.estado;
    status.addEventListener("change", async () => {
      const previousStatus = consulta.estado;
      status.disabled = true;
      try {
        await request(`/api/admin/consultas/${consulta.id}/estado`, {
          method: "PUT",
          body: JSON.stringify({ estado: status.value }),
        });
        showNotice("El estado de la consulta quedó actualizado.");
        await Promise.all([loadConsultas(), loadDashboardConsultas(), loadStats(), loadIngresos()]);
      } catch (error) {
        status.value = previousStatus;
        showError(error.message);
      } finally {
        status.disabled = false;
      }
    });
    card.append(details, status);
    appendText(card, "p", "consulta-detail",
      `Lecturas: ${consulta.lecturas || "—"}`
      + `\nPrecios: ${consulta.precios || "—"} · Total: ${consulta.total ?? "—"}`);
    container.append(card);
  }

  const empty = $("consultas-empty");
  if (empty) {
    empty.hidden = !state.consultasLoaded || consultas.length > 0;
    const message = $("consultas-empty-text");
    if (message) {
      message.textContent = state.consultaMode === "dia" && state.consultaDate
        ? `No hay entradas registradas para el ${formatLongDate(state.consultaDate)}.`
        : "No hay consultas que coincidan con estos filtros.";
    }
    const seeMonth = $("consultas-ver-mes");
    if (seeMonth) seeMonth.hidden = !state.consultasLoaded || state.consultaMode !== "dia";
  }
}

async function loadConsultas() {
  const params = new URLSearchParams();
  const month = $("consultas-month").value || monthValue();
  if (month) params.set("month", month);
  const data = await request(`/api/admin/consultas?${params}`);
  state.consultasBase = Array.isArray(data?.consultas) ? data.consultas : [];
  state.consultasLoaded = true;
  renderConsultasView();
}

function setConsultaState(value) {
  state.consultaState = value;
  const tabs = $("consulta-tabs");
  if (tabs) {
    for (const button of tabs.querySelectorAll(".seg-btn")) {
      const active = (button.dataset.state || "") === value;
      button.classList.toggle("on", active);
      button.setAttribute("aria-selected", String(active));
    }
  }
  applyWithTransition(renderConsultasView);
}

/* ---------- consultas: KPIs, modo día/mes y tipos de lectura de hoy ---------- */
const dayWeekdayFormat = new Intl.DateTimeFormat("es", { weekday: "short" });

function parseDateValue(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftDateValue(value, days) {
  const date = parseDateValue(value) || new Date();
  date.setDate(date.getDate() + days);
  return dateValue(date);
}

function startOfWeekValue(value) {
  const date = parseDateValue(value) || new Date();
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return dateValue(date);
}

function consultaPeriodoEntries() {
  if (state.consultaMode !== "dia" || !state.consultaDate) return state.consultasBase;
  return state.consultasBase.filter((consulta) => consulta.fecha === state.consultaDate);
}

function consultaMatchesQuery(consulta, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return [consulta.nombre, consulta.telefono, consulta.lecturas, consulta.detalle]
    .some((value) => String(value || "").toLowerCase().includes(needle));
}

function consultaPeriodoLabel() {
  if (state.consultaMode === "dia" && state.consultaDate) return formatLongDate(state.consultaDate);
  return monthTitle($("consultas-month").value || monthValue()).toLowerCase();
}

function renderConsultasKpis(periodo) {
  const enProgreso = periodo.filter((consulta) => consulta.estado === "en_proceso").length;
  const finalizadas = periodo.filter((consulta) => consulta.estado === "finalizado").length;
  const canceladas = periodo.filter((consulta) => consulta.estado === "cancelada").length;
  const emergencias = periodo.filter((consulta) => consulta.tipo === "emergencia").length;
  const label = consultaPeriodoLabel();

  $("consulta-kpi-registro").textContent = String(periodo.length);
  $("consulta-kpi-registro-foot").textContent = periodo.length
    ? `${periodo.length === 1 ? "consulta registrada" : "consultas registradas"} · ${label}`
    : `Sin consultas registradas · ${label}`;
  $("consulta-kpi-progreso").textContent = String(enProgreso);
  $("consulta-kpi-progreso-foot").textContent = `en progreso · ${label}`;
  $("consulta-kpi-finalizadas").textContent = String(finalizadas);
  $("consulta-kpi-finalizadas-foot").textContent = `finalizadas · ${label}`;
  $("consulta-kpi-canceladas").textContent = String(canceladas);
  $("consulta-kpi-canceladas-foot").textContent = canceladas
    ? `${canceladas === 1 ? "cancelada" : "canceladas"} · ${label}`
    : `Sin cancelaciones · ${label}`;
  $("consulta-kpi-emergencias").textContent = String(emergencias);
  $("consulta-kpi-emergencias-foot").textContent = emergencias
    ? `${emergencias} ${emergencias === 1 ? "lectura de emergencia" : "lecturas de emergencia"} · ${label}`
    : `Sin emergencias registradas · ${label}`;
  renderConsultasSparkline();
}

function renderConsultasSparkline(now = new Date()) {
  const container = $("consulta-kpi-spark");
  if (!container) return;
  const seen = new Set();
  const pool = [...state.dashboardConsultas, ...state.consultasBase]
    .filter((consulta) => (seen.has(consulta.id) ? false : seen.add(consulta.id)));
  const values = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - offset);
    const key = dateValue(day);
    values.push(pool.filter((consulta) => consulta.fecha === key).length);
  }
  const max = Math.max(1, ...values);
  container.replaceChildren();
  for (const value of values) {
    const bar = document.createElement("i");
    bar.style.height = `${Math.max(12, Math.round(value / max * 100))}%`;
    container.append(bar);
  }
}

function renderDayStrip() {
  const strip = $("consulta-days");
  if (!strip) return;
  const today = dateValue();
  const selected = state.consultaDate || today;
  const first = startOfWeekValue(selected);
  const counts = new Map();
  for (const consulta of state.consultasBase) {
    counts.set(consulta.fecha, (counts.get(consulta.fecha) || 0) + 1);
  }
  strip.replaceChildren();
  for (let index = 0; index < 7; index += 1) {
    const date = shiftDateValue(first, index);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "day-chip";
    chip.dataset.date = date;
    chip.setAttribute("role", "tab");
    chip.setAttribute("aria-label", formatLongDate(date));
    const active = date === selected;
    chip.classList.toggle("on", active);
    chip.setAttribute("aria-selected", String(active));
    if (date === today) chip.classList.add("is-today");
    if (counts.get(date)) chip.classList.add("has-readings");
    const weekday = dayWeekdayFormat.format(parseDateValue(date)).replace(/\.$/, "");
    appendText(chip, "span", "day-chip-weekday", capitalize(weekday));
    appendText(chip, "span", "day-chip-number", String(Number(date.slice(8, 10))));
    const dot = document.createElement("span");
    dot.className = "day-chip-dot";
    dot.setAttribute("aria-hidden", "true");
    chip.append(dot);
    strip.append(chip);
  }
  const range = $("consulta-range");
  if (range) range.textContent = formatLongDate(selected);
  const tiposDate = $("consulta-tipos-date");
  if (tiposDate) tiposDate.textContent = formatShortDay(today);
}

function lecturaEsCorta(consulta) {
  return String(consulta.lecturas || "").toLowerCase().includes("corta");
}

function topLecturaDelDia(fichas) {
  const tally = new Map();
  for (const consulta of fichas) {
    for (const raw of String(consulta.lecturas || "").split(/[,·|]/)) {
      const name = raw.trim();
      if (!name) continue;
      tally.set(name, (tally.get(name) || 0) + 1);
    }
  }
  let best = null;
  for (const [name, count] of tally) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

function renderTiposHoy() {
  if (!$("tipos-corta-bar")) return;
  const today = dateValue();
  const counts = state.tiposHoy?.date === today ? state.tiposHoy.counts : null;
  const fichas = (state.dashboardConsultas.length ? state.dashboardConsultas : state.consultasBase)
    .filter((consulta) => consulta.fecha === today);

  let cortas = Number(counts?.corta_normal || 0) + Number(counts?.corta_emergencia || 0);
  let extensas = Number(counts?.extensa_normal || 0) + Number(counts?.extensa_emergencia || 0);
  let emergencias = Number(counts?.corta_emergencia || 0) + Number(counts?.extensa_emergencia || 0);
  let normales = Number(counts?.corta_normal || 0) + Number(counts?.extensa_normal || 0);

  if (cortas + extensas === 0 && fichas.length) {
    cortas = fichas.filter(lecturaEsCorta).length;
    extensas = fichas.length - cortas;
    emergencias = fichas.filter((consulta) => consulta.tipo === "emergencia").length;
    normales = fichas.length - emergencias;
  }

  const total = cortas + extensas;
  const pctCortas = total ? Math.round(cortas / total * 100) : 0;
  const pctExtensas = total ? Math.round(extensas / total * 100) : 0;

  $("tipos-corta-bar").style.width = `${pctCortas}%`;
  $("tipos-extensa-bar").style.width = `${pctExtensas}%`;
  $("tipos-corta-pct").textContent = total ? `${pctCortas}%` : "—";
  $("tipos-extensa-pct").textContent = total ? `${pctExtensas}%` : "—";
  $("tipos-corta-foot").textContent = total ? `${cortas} de ${total} lecturas de hoy` : "Sin movimientos hoy";
  $("tipos-extensa-foot").textContent = total ? `${extensas} de ${total} lecturas de hoy` : "Sin movimientos hoy";

  const top = topLecturaDelDia(fichas);
  $("tipos-top-name").textContent = top ? capitalize(top.name) : "Sin lecturas registradas";
  $("tipos-top-count").textContent = top ? String(top.count) : "—";
  $("tipos-emergencias").textContent = String(emergencias);
  $("tipos-normales").textContent = String(normales);
  const card = document.querySelector(".consulta-tipos");
  if (card) card.classList.toggle("is-empty", total === 0);
}

function renderConsultasView() {
  const periodo = consultaPeriodoEntries();
  const query = ($("consultas-search")?.value || "").trim();
  let visibles = periodo
    .filter((consulta) => !state.consultaState || consulta.estado === state.consultaState)
    .filter((consulta) => consultaMatchesQuery(consulta, query));
  if (state.orderByHora) visibles = visibles.slice().sort(compareByHour);
  syncOrderButton();
  renderConsultas(visibles);
  if (state.consultasLoaded) renderConsultasKpis(periodo);
  renderDayStrip();
  renderTiposHoy();
}

function syncOrderButton() {
  const button = $("consulta-order");
  if (!button) return;
  const active = Boolean(state.orderByHora);
  button.classList.toggle("is-on", active);
  button.setAttribute("aria-pressed", String(active));
}

function setConsultaMode(mode) {
  state.consultaMode = mode === "mes" ? "mes" : "dia";
  if (state.consultaMode === "dia" && !state.consultaDate) state.consultaDate = dateValue();
  const switcher = $("consulta-mode");
  if (switcher) {
    for (const button of switcher.querySelectorAll(".seg-btn")) {
      const active = (button.dataset.mode || "") === state.consultaMode;
      button.classList.toggle("on", active);
      button.setAttribute("aria-selected", String(active));
    }
  }
  const monthField = $("consultas-month-field");
  if (monthField) monthField.hidden = state.consultaMode !== "mes";
  const dayNav = $("consulta-day-nav");
  if (dayNav) dayNav.hidden = state.consultaMode !== "dia";
  const dayFoot = $("consulta-day-foot");
  if (dayFoot) dayFoot.hidden = state.consultaMode !== "dia";

  if (state.consultaMode === "dia" && state.consultaDate) {
    const month = state.consultaDate.slice(0, 7);
    if ($("consultas-month").value !== month) {
      $("consultas-month").value = month;
      loadConsultas().catch((error) => showError(error.message));
      return;
    }
  }
  applyWithTransition(renderConsultasView);
}

function selectConsultaDay(date) {
  if (!date) return;
  state.consultaDate = date;
  setConsultaMode("dia");
}

function shiftConsultaWeek(delta) {
  state.consultaDate = shiftDateValue(state.consultaDate || dateValue(), delta * 7);
  setConsultaMode("dia");
}

async function loadTiposHoy() {
  if (syncTiposHoy()) return;
  const today = dateValue();
  const month = today.slice(0, 7);
  const data = await request(`/api/admin/availability?month=${encodeURIComponent(month)}`);
  const days = Array.isArray(data?.days) ? data.days : [];
  const day = days.find((entry) => entry.date === today);
  state.tiposHoy = {
    date: today,
    counts: day?.counts || {},
    consultas: Number(day?.consultas) || 0,
  };
  renderTiposHoy();
}

/* Reutiliza las reglas ya cargadas cuando el mes visible es el actual. */
function syncTiposHoy() {
  const today = dateValue();
  if (state.month !== today.slice(0, 7) || !Array.isArray(state.rules)) return false;
  const day = state.rules.find((entry) => entry.date === today);
  if (!day) return false;
  state.tiposHoy = {
    date: today,
    counts: day.counts || {},
    consultas: Number(day.consultas) || 0,
  };
  renderTiposHoy();
  return true;
}

function bindConsultasFilters() {
  const mode = $("consulta-mode");
  if (mode) {
    mode.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest(".seg-btn") : null;
      if (!button) return;
      setConsultaMode(button.dataset.mode || "dia");
    });
  }
  const strip = $("consulta-days");
  if (strip) {
    strip.addEventListener("click", (event) => {
      const chip = event.target instanceof Element ? event.target.closest(".day-chip") : null;
      if (!chip) return;
      selectConsultaDay(chip.dataset.date || "");
    });
  }
  const prev = $("consulta-day-prev");
  if (prev) prev.addEventListener("click", () => shiftConsultaWeek(-1));
  const next = $("consulta-day-next");
  if (next) next.addEventListener("click", () => shiftConsultaWeek(1));
  const todayButton = $("consulta-today");
  if (todayButton) todayButton.addEventListener("click", () => selectConsultaDay(dateValue()));
  const orderButton = $("consulta-order");
  if (orderButton) orderButton.addEventListener("click", () => {
    state.orderByHora = !state.orderByHora;
    applyWithTransition(renderConsultasView);
  });
  const printButton = $("consulta-print");
  if (printButton) printButton.addEventListener("click", openPrintModal);
  const seeMonth = $("consultas-ver-mes");
  if (seeMonth) seeMonth.addEventListener("click", () => setConsultaMode("mes"));
}

function buildDayPrintText(fecha, consultas, scope = "dia") {
  const esMes = scope === "mes";
  const titulo = esMes ? capitalize(monthTitle(fecha)) : capitalize(formatLongDate(fecha));
  const encabezado = esMes ? "RESERVAS DEL MES" : "RESERVAS DEL DÍA";
  const generado = new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  // Cabecera centrada, todo lo demás alineado a la izquierda.
  const lines = [
    centerText("✦ ˖⁺⋆ ˖ ✦ ⋆ ˖⁺ ✦ ⋆ ˖⁺⋆"),
    centerText("♡  S T A R D U S T   T A R O T  ♡"),
    centerText("✦  ✧  ✦  ✧  ✦"),
    centerText(encabezado),
    centerText(titulo),
    centerText("✦ ˖⁺⋆ ˖ ✦ ⋆ ˖⁺ ✦ ⋆ ˖⁺⋆"),
    "",
  ];
  if (!consultas.length) {
    lines.push(esMes ? "Sin reservas registradas en este mes." : "Sin reservas registradas para este día.", "");
    lines.push(printRule);
    lines.push(`Generado ${generado}`);
    lines.push(printRule);
  } else {
    for (const consulta of consultas) {
      lines.push(printSep);
      const hour = (consulta.inicio || "--:--").padEnd(5, " ");
      const name = truncateText(consulta.nombre, 26) || "Sin nombre";
      lines.push(`${hour}  ${name.padEnd(28, " ")} ${statusLabel(consulta.estado).toUpperCase()}`);
      const meta = [
        consulta.tipo === "emergencia" ? "Emergencia" : "Normal",
        consulta.lectura_tipo === "extensa" ? "Extensa" : consulta.lectura_tipo === "corta" ? "Corta" : null,
        consulta.origen === "manual" ? "Manual" : null,
        consulta.canal ? manualChannelLabels[consulta.canal] || null : null,
      ].filter(Boolean).join(" · ");
      if (meta) for (const row of wrapText(meta)) lines.push(row);
      if (consulta.lecturas) for (const row of wrapText(`Lecturas: ${consulta.lecturas}`)) lines.push(row);
      const phone = String(consulta.telefono || "").trim();
      if (phone) lines.push(`Tel. ${state.discreet ? formatPhone(phone) : phone}`);
      const detalle = detalleTexto(consulta.detalle);
      if (detalle) {
        lines.push("Detalle:");
        for (const row of wrapText(detalle)) lines.push(row);
      }
      lines.push("");
    }
    const progreso = consultas.filter((consulta) => consulta.estado === "en_proceso").length;
    const finalizadas = consultas.filter((consulta) => consulta.estado === "finalizado").length;
    const canceladas = consultas.filter((consulta) => consulta.estado === "cancelada").length;
    lines.push(printRule);
    lines.push(`TOTAL ${consultas.length} ${consultas.length === 1 ? "reserva" : "reservas"}`);
    const resumen = `${progreso} en progreso · ${finalizadas} ${finalizadas === 1 ? "finalizada" : "finalizadas"}`
      + (canceladas ? ` · ${canceladas} ${canceladas === 1 ? "cancelada" : "canceladas"}` : "");
    for (const row of wrapText(resumen)) lines.push(row);
    lines.push(`Generado ${generado}`);
    lines.push(printRule);
  }
  lines.push(centerText("✦ ⋆ ˖ gracias por consultar las estrellas ˖ ⋆ ✦"));
  return lines.join("\n");
}

function printScope() {
  if (state.consultaMode === "dia") {
    const fecha = state.consultaDate || dateValue();
    return { scope: "dia", clave: fecha, titulo: capitalize(formatLongDate(fecha)) };
  }
  const mes = $("consultas-month")?.value || monthValue();
  return { scope: "mes", clave: mes, titulo: capitalize(monthTitle(mes)) };
}

function openPrintModal() {
  const { scope, clave, titulo } = printScope();
  const consultas = consultaPeriodoEntries().slice().sort(compareByHour);
  $("print-output").textContent = buildDayPrintText(clave, consultas, scope);
  $("print-title").textContent = titulo;
  const eyebrow = $("print-eyebrow");
  if (eyebrow) eyebrow.textContent = scope === "mes" ? "RESUMEN DEL MES" : "RESUMEN DEL DÍA";
  openSheet("print-modal", "print-backdrop");
}

function downloadPrintText() {
  const output = $("print-output");
  if (!output) return;
  const { scope, clave } = printScope();
  const blob = new Blob([output.textContent || ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reservas-${scope === "mes" ? "mes-" : ""}${clave}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function bindSheets() {
  for (const backdropId of ["consulta-modal-backdrop", "print-backdrop"]) {
    const backdrop = $(backdropId);
    if (backdrop) backdrop.addEventListener("click", closeSheet);
  }
  const closeConsulta = $("consulta-modal-close");
  if (closeConsulta) closeConsulta.addEventListener("click", closeSheet);
  const closePrint = $("print-close");
  if (closePrint) closePrint.addEventListener("click", closeSheet);
  const call = $("consulta-modal-call");
  if (call) {
    call.addEventListener("click", () => {
      if (call.dataset.phone) window.location.href = `tel:${call.dataset.phone}`;
    });
  }
  const copyPhone = $("consulta-modal-copy");
  if (copyPhone) {
    copyPhone.addEventListener("click", () => copyWithFeedback(copyPhone, copyPhone.dataset.phone || ""));
  }
  const copyPrint = $("print-copy");
  if (copyPrint) {
    copyPrint.addEventListener("click", () => copyWithFeedback(copyPrint, $("print-output")?.textContent || ""));
  }
  const download = $("print-download");
  if (download) download.addEventListener("click", downloadPrintText);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sheetState.modal) closeSheet();
  });
}

/* ---------- ficha de la consulta y resumen imprimible ---------- */

const sheetState = { modal: null, backdrop: null, focus: null };

function openSheet(modalId, backdropId) {
  const modal = $(modalId);
  if (!modal) return;
  closeSheet();
  const backdrop = $(backdropId);
  sheetState.modal = modal;
  sheetState.backdrop = backdrop;
  sheetState.focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (backdrop) backdrop.hidden = false;
  modal.hidden = false;
  modal.classList.add("is-open");
  const target = modal.querySelector("[data-autofocus], button, a, input, textarea");
  if (target) target.focus({ preventScroll: true });
}

function closeSheet() {
  const { modal, backdrop, focus } = sheetState;
  sheetState.modal = null;
  sheetState.backdrop = null;
  sheetState.focus = null;
  if (modal) {
    modal.classList.remove("is-open");
    modal.hidden = true;
  }
  if (backdrop) backdrop.hidden = true;
  if (focus && document.contains(focus)) {
    try {
      focus.focus({ preventScroll: true });
    } catch (error) {
      // el elemento ya no acepta foco: no hacemos nada
    }
  }
}

function modalRow(label, value) {
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  detail.textContent = value || "—";
  return [term, detail];
}

function openConsultaModal(consulta) {
  if (!consulta) return;
  $("consulta-modal-title").textContent = formatName(consulta.nombre);
  $("consulta-modal-eyebrow").textContent = consulta.origen === "manual"
    ? "RESERVA MANUAL"
    : "RESERVA EN LÍNEA";
  const body = $("consulta-modal-body");
  body.replaceChildren();
  const rows = [
    ["Fecha", capitalize(formatLongDate(consulta.fecha))],
    ["Hora", consulta.inicio || "Sin hora asignada"],
    ["Tipo", consulta.tipo === "emergencia" ? "Emergencia" : "Normal"],
    ["Lecturas", consulta.lecturas || ""],
    ["Precios", consulta.precios || ""],
    ["Total", consulta.total === null || consulta.total === undefined || consulta.total === ""
      ? ""
      : formatMoney(consulta.total)],
    ["Estado", statusLabel(consulta.estado)],
    ["Canal", consulta.canal && manualChannelLabels[consulta.canal] ? manualChannelLabels[consulta.canal] : ""],
    ["Teléfono", consulta.telefono ? (state.discreet ? formatPhone(consulta.telefono) : consulta.telefono) : ""],
    ["Consultante", consulta.consultante ? capitalize(consulta.consultante) : ""],
    ["Registrada", consulta.creado_en || ""],
  ];
  for (const [label, value] of rows) body.append(...modalRow(label, value));
  if (consulta.origen) body.append(...modalRow("Origen", consulta.origen === "manual" ? "Manual" : "Pública"));

  const detalle = detalleTexto(consulta.detalle);
  const detailBox = $("consulta-modal-detail");
  detailBox.textContent = detalle || "Sin detalle escrito por la consultante.";
  detailBox.classList.toggle("is-empty", !detalle);

  const phone = String(consulta.telefono || "").replace(/[^\d+]/g, "");
  const call = $("consulta-modal-call");
  const copy = $("consulta-modal-copy");
  if (call) {
    call.dataset.phone = phone;
    call.disabled = !phone;
  }
  if (copy) {
    copy.dataset.phone = phone;
    copy.disabled = !phone;
  }
  openSheet("consulta-modal", "consulta-modal-backdrop");
}

async function copyText(value) {
  const text = String(value || "");
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // sin permiso de portapapeles: probamos el respaldo
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  } catch (error) {
    return false;
  }
}

async function copyWithFeedback(button, value) {
  if (!button) return;
  const original = button.dataset.label || button.textContent;
  button.dataset.label = original;
  const ok = await copyText(value);
  button.textContent = ok ? "Copiado ✓" : "Selecciona y copia";
  window.setTimeout(() => {
    button.textContent = original;
  }, 1600);
}

/* ---------- disponibilidad: reserva manual ---------- */
const manualChannelHints = {
  whatsapp: "Número de teléfono",
  correo: "correo@ejemplo.com",
  telegram: "Usuario o número de Telegram",
  discord: "Usuario de Discord",
};
const manualChannelLabels = {
  whatsapp: "WhatsApp",
  correo: "Correo",
  telegram: "Telegram",
  discord: "Discord",
};
const manualChipFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

function manualDateLabel(value) {
  const date = parseDateValue(value);
  return date ? manualChipFormat.format(date) : "—";
}

function setManualMessage(text, tone = "info") {
  const box = $("manual-message");
  if (!box) return;
  box.textContent = text || "";
  box.hidden = !text;
  if (text) box.dataset.tone = tone;
  else delete box.dataset.tone;
}

function updateManualChannel(channel) {
  state.manual.canal = manualChannelHints[channel] ? channel : "whatsapp";
  const group = $("manual-canal");
  if (group) {
    for (const button of group.querySelectorAll("[data-canal]")) {
      const active = button.dataset.canal === state.manual.canal;
      button.classList.toggle("on", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }
  const contacto = $("manual-contacto");
  if (contacto) contacto.placeholder = manualChannelHints[state.manual.canal];
}

function updateManualKind(kind) {
  state.manual.tipo = kind === "extensa" ? "extensa" : "corta";
  const group = $("manual-tipo");
  if (!group) return;
  for (const button of group.querySelectorAll("[data-tipo]")) {
    const active = button.dataset.tipo === state.manual.tipo;
    button.classList.toggle("on", active);
    button.setAttribute("aria-selected", String(active));
  }
}

/* Regla del día elegido, solo si su mes ya está cargado en Disponibilidad. */
function manualRuleFor(date) {
  if (!date || !Array.isArray(state.rules)) return null;
  return state.rules.find((item) => item.date === date) || null;
}

function updateManualSubmit(event, options = {}) {
  const button = $("manual-submit");
  const message = $("manual-message");
  if (!button) return;
  // Solo un cambio del usuario limpia el mensaje anterior de la tarjeta.
  const edited = !!event && typeof event.type === "string";
  const nombre = ($("manual-nombre").value || "").trim();
  const contacto = ($("manual-contacto").value || "").trim();
  const fecha = $("manual-fecha").value;
  const rule = manualRuleFor(fecha);
  const closed = !!rule && !rule.is_open;
  button.disabled = !nombre || !contacto || !fecha || closed;
  if (closed) {
    // Al recorrer el calendario basta con dejar el botón bloqueado en silencio;
    // el aviso aparece cuando la persona intenta rellenar la reserva.
    if (edited) setManualMessage(`El ${formatLongDate(fecha)} está cerrado: actívalo en «Ajustes de fecha» o elige otro día.`, "error");
  } else if (!options.keepMessage && (edited || (message && message.dataset.tone === "error"))) {
    setManualMessage("");
  }
}

/* La fecha del formulario sigue al día elegido en el calendario (y viceversa). */
function syncManualDate(date) {
  const value = date || state.selectedDate || dateValue();
  state.manual.fecha = value;
  const field = $("manual-fecha");
  if (field && field.value !== value) field.value = value;
  const chip = $("manual-date-chip");
  if (chip) chip.textContent = manualDateLabel(value);
  updateManualSubmit();
}

/* Cambiar la fecha en la tarjeta selecciona ese día; si es de otro mes, lo carga. */
function selectAvailabilityDate(date) {
  if (!date) return;
  if (date.slice(0, 7) !== state.month) {
    state.month = date.slice(0, 7);
    state.selectedDate = date;
    loadAvailability().catch((error) => showError(error.message));
    return;
  }
  selectDate(date);
}

function manualErrorMessage(error) {
  const message = String((error && error.message) || "");
  if (message.includes("AGENDA_LLENA")) return "Esa fecha está cerrada o ya no tiene cupo para ese tipo de lectura.";
  if (message.includes("HORARIO_OCUPADO")) return "Ese horario ya está ocupado: prueba con otro bloque.";
  if (message.includes("HORARIO_INVALIDO")) return "La hora debe caer dentro de la jornada y en bloques de 30 minutos.";
  if (message.includes("FECHA_INVALIDA")) return "Elige una fecha válida.";
  if (message.includes("CANAL_INVALIDO")) return "Elige un canal de contacto.";
  return message || "No se pudo registrar la reserva.";
}

async function submitManualReserva(event) {
  event.preventDefault();
  const button = $("manual-submit");
  if (!button || button.disabled) return;
  const payload = {
    nombre: ($("manual-nombre").value || "").trim(),
    contacto: ($("manual-contacto").value || "").trim(),
    detalle: ($("manual-detalle")?.value || "").trim(),
    canal: state.manual.canal,
    tipo: state.manual.tipo,
    emergencia: $("manual-emergencia").checked,
    fecha: $("manual-fecha").value,
    hora: $("manual-hora").value,
  };
  if (!payload.nombre || !payload.contacto || !payload.fecha) return;

  button.disabled = true;
  setManualMessage("Registrando la reserva…", "info");
  try {
    const data = await request("/api/admin/consultas", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const consulta = (data && data.consulta) || {};
    const fecha = consulta.fecha || payload.fecha;
    setManualMessage(
      `Reserva registrada: ${formatName(consulta.nombre || payload.nombre)} · `
      + `${formatLongDate(fecha)}`
      + `${consulta.inicio ? ` · ${consulta.inicio}` : " · sin hora"}.`,
      "ok"
    );
    $("manual-nombre").value = "";
    $("manual-contacto").value = "";
    if ($("manual-detalle")) $("manual-detalle").value = "";
    $("manual-hora").value = "";
    $("manual-emergencia").checked = false;
    // Disponibilidad se queda en el día reservado; Consultas, en ese día también.
    state.month = fecha.slice(0, 7);
    state.selectedDate = fecha;
    state.consultaDate = fecha;
    $("consultas-month").value = fecha.slice(0, 7);
    await Promise.all([
      loadAvailability(),
      loadConsultas(),
      loadDashboardConsultas(),
      loadStats(),
    ]);
    await loadTiposHoy().catch(() => {});
    setConsultaMode("dia");
    syncManualDate(fecha);
    showNotice("La reserva manual quedó registrada en el panel.");
  } catch (error) {
    setManualMessage(manualErrorMessage(error), "error");
  } finally {
    button.disabled = false;
    // Recalcula el botón sin borrar el aviso recién mostrado.
    updateManualSubmit(null, { keepMessage: true });
  }
}

function bindManualReserva() {
  const form = $("manual-reserva");
  if (!form) return;
  form.addEventListener("submit", submitManualReserva);

  const nombre = $("manual-nombre");
  if (nombre) nombre.addEventListener("input", updateManualSubmit);
  const contacto = $("manual-contacto");
  if (contacto) contacto.addEventListener("input", updateManualSubmit);
  const hora = $("manual-hora");
  if (hora) hora.addEventListener("change", updateManualSubmit);
  const emergencia = $("manual-emergencia");
  if (emergencia) emergencia.addEventListener("change", updateManualSubmit);

  const canal = $("manual-canal");
  if (canal) {
    canal.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-canal]") : null;
      if (!button) return;
      updateManualChannel(button.dataset.canal || "whatsapp");
      updateManualSubmit();
    });
  }

  const tipo = $("manual-tipo");
  if (tipo) {
    tipo.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-tipo]") : null;
      if (!button) return;
      updateManualKind(button.dataset.tipo || "corta");
    });
  }

  const fecha = $("manual-fecha");
  if (fecha) {
    fecha.addEventListener("change", (event) => {
      const value = fecha.value;
      if (!value) {
        state.manual.fecha = "";
        const chip = $("manual-date-chip");
        if (chip) chip.textContent = "—";
        updateManualSubmit(event);
        return;
      }
      selectAvailabilityDate(value);
      updateManualSubmit(event);
    });
  }

  updateManualChannel(state.manual.canal);
  updateManualKind(state.manual.tipo);
  syncManualDate(state.selectedDate || dateValue());
}

async function loadDashboardConsultas() {
  const currentMonth = monthValue();
  const months = [currentMonth, nextMonthValue(currentMonth)];
  const results = await Promise.all(months.map(async (month) => {
    const params = new URLSearchParams({ month });
    return request(`/api/admin/consultas?${params}`);
  }));
  const consultasById = new Map();
  for (const result of results) {
    for (const consulta of result.consultas || []) consultasById.set(consulta.id, consulta);
  }
  state.dashboardConsultas = [...consultasById.values()].sort(compareConsultas);
  renderDashboard();
}
function groupReadings(entries) {
  const items = entries.slice(0, 5).map((entry, index) => ({
    label: capitalize(entry.nombre),
    value: Number(entry.total || 0),
    color: chartPalette[index % chartPalette.length],
  }));
  const rest = entries.slice(5).reduce((sum, entry) => sum + Number(entry.total || 0), 0);
  if (rest > 0) items.push({ label: "Otras lecturas", value: rest, color: "#cfc2c6" });
  return items;
}

/* ---------- métricas-botón: estado activo y salto al desglose ---------- */
const metricLabels = {
  ingresos: "Ingresos del mes",
  ocupacion: "Ocupación",
  promedio: "Ingreso promedio",
  frecuencia: "Nuevas vs. frecuentes",
  ranking: "Lecturas más pedidas",
};
const SVG_NS = "http://www.w3.org/2000/svg";

function svgNode(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function chartEmpty(message) {
  const paragraph = document.createElement("p");
  paragraph.className = "chart-empty";
  paragraph.textContent = message;
  return paragraph;
}

function chartEmptyItem(message) {
  const item = document.createElement("li");
  item.className = "legend-empty";
  item.textContent = message;
  return item;
}

function percentOf(part, total) {
  return total > 0 ? (Number(part) || 0) / total * 100 : 0;
}

function formatPercent(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

/* ---------- movimiento: helpers compartidos por las gráficas ---------- */
const COUNT_DURATION = 700;
const countFrames = new WeakMap(); // elemento -> frame pendiente
const countValues = new WeakMap(); // elemento -> último número pintado

// Con prefers-reduced-motion las gráficas muestran su estado final, sin animar.
function motionOK() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOutCubic(progress) {
  return 1 - (1 - progress) ** 3;
}

function readCount(element) {
  const stored = countValues.get(element);
  if (typeof stored === "number") return stored;
  const parsed = Number.parseFloat(String(element.textContent).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/* Cifras que ruedan: van del número que se está viendo al nuevo, cancelando el
   frame anterior del mismo elemento (renderKpis se llama varias veces por carga).
   Si el valor no cambió, se escribe una sola vez sin animación. */
function countTo(element, value, formatter = (number) => String(Math.round(number))) {
  if (!element) return;
  const pending = countFrames.get(element);
  if (pending) {
    window.cancelAnimationFrame(pending);
    countFrames.delete(element);
  }
  const target = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(target)) {
    countValues.delete(element);
    element.textContent = "—";
    return;
  }
  const start = readCount(element);
  const draw = (number) => {
    countValues.set(element, number);
    element.textContent = formatter(number);
  };
  if (!motionOK() || Math.abs(target - start) < 0.005) {
    draw(target);
    return;
  }
  const begin = window.performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - begin) / COUNT_DURATION);
    if (progress >= 1) {
      countFrames.delete(element);
      draw(target);
      return;
    }
    draw(start + (target - start) * easeOutCubic(progress));
    countFrames.set(element, window.requestAnimationFrame(tick));
  };
  countFrames.set(element, window.requestAnimationFrame(tick));
}

/* Los gráficos se reconstruyen en cada render (replaceChildren), así que la
   transición CSS de transform no se dispararía sola. `prepareEntrance` marca el
   estado inicial al crear el nodo —antes de insertarlo— y `playEntrance` suelta
   el final en el siguiente frame. El orden importa: si el estado inicial se
   aplica después de un flush de layout, el navegador toma "sin transform" como
   punto de partida y la entrada se dispara al revés. */
function prepareEntrance(node, from, index, options = {}) {
  if (!node) return node;
  const staggerLimit = Number.isFinite(options.staggerLimit) ? options.staggerLimit : Infinity;
  node.style.setProperty("--i", String(Math.min(index, staggerLimit)));
  if (motionOK()) node.style.transform = from;
  return node;
}

function playEntrance(nodes) {
  const items = nodes.filter(Boolean);
  if (!items.length || !motionOK()) return;
  void items[0].getBoundingClientRect(); // fija el estado inicial antes de soltarlo
  window.requestAnimationFrame(() => {
    for (const node of items) node.style.removeProperty("transform");
  });
}

/* skeleton de la primera carga: se apaga cuando estadísticas e ingresos pintaron */
const chartsReady = { stats: false, ingresos: false };

function markChartsReady(key) {
  if (key) chartsReady[key] = true;
  if (!chartsReady.stats || !chartsReady.ingresos) return;
  const section = $("vista-graficos");
  if (section) section.classList.remove("is-loading");
}

function selectMetric(metric, options = {}) {
  const active = metricLabels[metric] ? metric : "ingresos";
  state.activeMetric = active;
  for (const card of document.querySelectorAll("[data-metric]")) {
    const on = card.dataset.metric === active;
    card.classList.toggle("is-active", on);
    card.setAttribute("aria-pressed", String(on));
  }
  for (const panel of document.querySelectorAll(".stat-detail")) {
    panel.classList.toggle("is-active", panel.dataset.detail === active);
  }
  if (!options.scroll) return;
  const detail = document.querySelector(`.stat-detail[data-detail="${active}"]`);
  if (!detail) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  detail.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

function bindStatMetrics() {
  const metrics = $("stats-metrics");
  if (metrics) {
    metrics.addEventListener("click", (event) => {
      const card = event.target instanceof Element ? event.target.closest("[data-metric]") : null;
      if (!card) return;
      selectMetric(card.dataset.metric, { scroll: true });
    });
  }
  const tabs = $("ocupacion-tabs");
  if (tabs) {
    tabs.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest(".seg-btn") : null;
      if (!button) return;
      const gran = button.dataset.ocupacion || "dia";
      if (gran === state.ocupacionGran) return;
      state.ocupacionGran = gran;
      for (const item of tabs.querySelectorAll(".seg-btn")) {
        const on = item === button;
        item.classList.toggle("on", on);
        item.setAttribute("aria-selected", String(on));
      }
      renderOcupacion();
    });
  }
  const bars = $("ocupacion-bars");
  if (bars) {
    bars.addEventListener("scroll", () => syncBarsScroll(bars), { passive: true });
    window.addEventListener("resize", () => syncBarsScroll(bars));
  }
}

function monthlyPeriodos() {
  return Array.isArray(state.ingresosMes?.periodos) ? state.ingresosMes.periodos : [];
}

function kpiPeriod() {
  const periodos = monthlyPeriodos();
  if (!periodos.length) return { current: null, previous: null };
  const target = $("stats-all")?.checked ? "" : ($("stats-month").value || monthValue());
  let index = target ? periodos.findIndex((item) => String(item.inicio).slice(0, 7) === target) : -1;
  if (index < 0) index = periodos.length - 1;
  return { current: periodos[index] || null, previous: periodos[index - 1] || null };
}

function deltaChip(current, previous) {
  const base = Number(previous) || 0;
  const value = Number(current) || 0;
  if (!base) return { text: value ? "nuevo" : "—", tone: "flat" };
  const variation = (value - base) / base * 100;
  const tone = Math.abs(variation) < 0.05 ? "flat" : variation > 0 ? "up" : "down";
  const sign = variation > 0 ? "+" : variation < 0 ? "\u2212" : "";
  return { text: `${sign}${Math.abs(variation).toFixed(1)}%`, tone };
}

function renderChip(id, chip) {
  const element = $(id);
  if (!element) return;
  element.textContent = chip.text;
  element.classList.remove("up", "down", "flat");
  element.classList.add(chip.tone);
}

function occupancySummary() {
  const days = Array.isArray(state.occupancy?.days) ? state.occupancy.days : [];
  return { ...summarizeDays(days), days };
}

function occupancyDays(days) {
  return days.map((day) => {
    const totals = totalsFor(day);
    const date = String(day?.date || "");
    const capacity = day?.is_open ? totals.capacity : 0;
    return {
      date,
      label: String(Number(date.slice(8, 10)) || date.slice(8, 10)),
      booked: totals.booked,
      capacity,
      consultas: Number(day?.consultas) || 0,
      value: capacity ? Math.min(100, totals.booked / capacity * 100) : 0,
    };
  });
}

function occupancyWeeks(days) {
  const groups = new Map();
  for (const day of days) {
    const date = String(day?.date || "");
    if (!date) continue;
    const [year, month, dayNumber] = date.split("-").map(Number);
    const current = new Date(Date.UTC(year, month - 1, dayNumber));
    const monday = new Date(current);
    monday.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (!groups.has(key)) {
      groups.set(key, { date: key, label: formatShortDay(key), booked: 0, capacity: 0, consultas: 0 });
    }
    const group = groups.get(key);
    if (day?.is_open) {
      const totals = totalsFor(day);
      group.booked += totals.booked;
      group.capacity += totals.capacity;
    }
    group.consultas += Number(day?.consultas) || 0;
  }
  return [...groups.values()].map((group) => ({
    ...group,
    value: group.capacity ? Math.min(100, group.booked / group.capacity * 100) : 0,
  }));
}

function occupancyLabel(item, gran) {
  if (gran === "semana") return `Semana del ${formatShortDay(item.date)}`;
  return capitalize(formatLongDate(item.date));
}

function renderOcupacion() {
  const summary = occupancySummary();
  const gran = state.ocupacionGran === "semana" ? "semana" : "dia";
  $("ocupacion-media").textContent = summary.rate === null ? "—" : formatPercent(summary.rate);
  $("ocupacion-cupos").textContent = summary.capacity ? `${summary.booked}/${summary.capacity}` : "—";
  $("ocupacion-consultas").textContent = String(Number(state.stats?.total) || 0);

  const container = $("ocupacion-bars");
  if (!container) return;
  const items = gran === "semana" ? occupancyWeeks(summary.days) : occupancyDays(summary.days);
  container.replaceChildren();
  container.classList.toggle("is-dense", items.length > 14);
  if (!items.length) {
    container.append(chartEmpty(state.occupancy
      ? "No hay días con cupos publicados en este periodo."
      : "Elige un mes concreto para ver la ocupación día a día."));
    syncBarsScroll(container);
    return;
  }
  container.setAttribute("aria-label",
    `Ocupación por ${gran}: ${items.length} ${items.length === 1 ? "periodo" : "periodos"}, media ${formatPercent(summary.rate || 0)}`);
  const fills = [];
  for (const item of items) {
    const bar = document.createElement("div");
    bar.className = item.capacity ? "bar" : "bar is-closed";
    bar.title = item.capacity
      ? `${occupancyLabel(item, gran)} · ${formatPercent(item.value)} de ocupación · ${item.booked} de ${item.capacity} cupos · ${item.consultas} ${item.consultas === 1 ? "consulta" : "consultas"}`
      : `${occupancyLabel(item, gran)} · sin cupos publicados`;
    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.height = item.capacity ? `${Math.max(2, Math.round(item.value))}%` : "0%";
    prepareEntrance(fill, "scaleY(0)", fills.length, { staggerLimit: 12 });
    fills.push(fill);
    track.append(fill);
    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = item.capacity ? formatPercent(item.value) : "—";
    const caption = document.createElement("span");
    caption.className = "bar-label";
    caption.textContent = item.label;
    bar.append(track, value, caption);
    container.append(bar);
  }
  syncBarsScroll(container);
  playEntrance(fills);
}

function renderRanking(entries) {
  const list = $("ranking-list");
  if (!list) return;
  list.replaceChildren();
  const items = groupReadings(Array.isArray(entries) ? entries : []);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  $("ranking-total").textContent = `${total} ${total === 1 ? "lectura" : "lecturas"}`;
  if (!total) {
    list.append(chartEmptyItem("Aún no hay lecturas registradas en este periodo."));
    return;
  }
  const fills = [];
  for (const item of items) {
    const share = percentOf(item.value, total);
    const row = document.createElement("li");
    row.className = "ratio-row";
    const head = document.createElement("span");
    head.className = "ratio-head";
    const name = document.createElement("span");
    name.className = "ratio-name";
    name.textContent = item.label;
    name.title = item.label;
    const value = document.createElement("span");
    value.className = "ratio-value";
    value.textContent = `${formatPercent(share)} · ${item.value}`;
    head.append(name, value);
    const track = document.createElement("span");
    track.className = "ratio-track";
    const fill = document.createElement("i");
    fill.style.width = `${Math.max(3, share).toFixed(1)}%`;
    fill.style.background = item.color;
    prepareEntrance(fill, "scaleX(0)", fills.length);
    fills.push(fill);
    track.append(fill);
    row.append(head, track);
    list.append(row);
  }
  playEntrance(fills);
}

/* ---------- donas: conic-gradient animado con custom properties ---------- */
// Tres cortes registrados con @property permiten interpolar el degradado. Si el
// navegador no expone la API de @property o el usuario pide menos movimiento, la
// dona se pinta directamente en su estado final.
const DONUT_GRADIENT = "conic-gradient("
  + "var(--c1,transparent) 0% var(--a1,0%),"
  + "var(--c2,transparent) var(--a1,0%) var(--a2,0%),"
  + "var(--c3,transparent) var(--a2,0%) var(--a3,0%),"
  + "transparent var(--a3,0%) 100%)";
const donutAnimatable = typeof CSS === "undefined"
  ? false
  : typeof CSS.registerProperty === "function"
    && (typeof CSS.supports !== "function"
      || CSS.supports("background-image", "conic-gradient(#000 0% 50%, #fff 50% 100%)"));

function donutStops(items) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const stops = [];
  for (const item of items) {
    if (!item.value) continue;
    cursor += percentOf(item.value, total);
    stops.push({ color: item.color, end: cursor });
  }
  if (stops.length) stops[stops.length - 1].end = 100;
  return stops;
}

// Los cortes que faltan se pegan al 100%: su banda queda vacía y el resto del
// anillo es transparente, así se ve el fondo de la torta mientras se llena.
function applyDonut(donut, stops, ends) {
  for (let index = 0; index < 3; index += 1) {
    const stop = stops[index];
    donut.style.setProperty(`--c${index + 1}`, stop ? stop.color : "transparent");
    const end = Number.isFinite(ends[index]) ? ends[index] : 100;
    donut.style.setProperty(`--a${index + 1}`, `${end.toFixed(2)}%`);
  }
  donut.style.backgroundImage = DONUT_GRADIENT;
}

function renderDonut(donut, stops) {
  if (!donut) return;
  const ends = stops.map((stop) => stop.end);
  if (!motionOK() || !donutAnimatable) {
    applyDonut(donut, stops, ends);
    return;
  }
  applyDonut(donut, stops, [0, 0, 0]); // anillo vacío como punto de partida
  void donut.offsetWidth;
  window.requestAnimationFrame(() => applyDonut(donut, stops, ends));
}

function renderFrecuencia(consultantes) {
  const counts = {
    nueva: Number(consultantes?.nueva) || 0,
    frecuente: Number(consultantes?.frecuente) || 0,
    sin_dato: Number(consultantes?.sin_dato) || 0,
  };
  const total = counts.nueva + counts.frecuente + counts.sin_dato;
  const donut = $("frecuencia-donut");
  const legend = $("frecuencia-legend");
  if (!donut || !legend) return;
  legend.replaceChildren();
  const totalLabel = $("frecuencia-donut-total");
  if (totalLabel) totalLabel.textContent = String(total);
  const label = $("frecuencia-donut-label");
  if (label) label.textContent = total === 1 ? "consulta" : "consultas";
  if (!total) {
    donut.style.removeProperty("background-image");
    donut.setAttribute("aria-label", "Sin consultas registradas en este periodo");
    legend.append(chartEmptyItem("Aún no hay consultas registradas en este periodo."));
    return;
  }
  const plurals = { nueva: "Nuevas", frecuente: "Frecuentes", sin_dato: "Sin dato" };
  renderDonut(donut, donutStops([
    { value: counts.frecuente, color: consultanteColors.frecuente },
    { value: counts.nueva, color: consultanteColors.nueva },
    { value: counts.sin_dato, color: consultanteColors.sin_dato },
  ]));
  donut.setAttribute("aria-label",
    `Consultantes: ${counts.frecuente} frecuentes, ${counts.nueva} nuevas, ${counts.sin_dato} sin dato`);
  for (const key of ["frecuente", "nueva", "sin_dato"]) {
    const row = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = consultanteColors[key];
    const name = document.createElement("span");
    name.className = "legend-name";
    name.textContent = plurals[key];
    const value = document.createElement("span");
    value.className = "legend-value";
    value.textContent = `${counts[key]} · ${formatPercent(percentOf(counts[key], total))}`;
    row.append(dot, name, value);
    legend.append(row);
  }
}

function renderTipos(tipos) {
  const counts = {
    emergencia: Number(tipos?.emergencia) || 0,
    normal: Number(tipos?.normal) || 0,
  };
  const total = counts.emergencia + counts.normal;
  const donut = $("tipos-donut");
  const legend = $("tipos-legend");
  if (!donut || !legend) return;
  legend.replaceChildren();
  const totalLabel = $("tipos-donut-total");
  if (totalLabel) totalLabel.textContent = String(total);
  const label = $("tipos-donut-label");
  if (label) label.textContent = total === 1 ? "consulta" : "consultas";
  if (!total) {
    donut.style.removeProperty("background-image");
    donut.setAttribute("aria-label", "Sin consultas registradas en este periodo");
    legend.append(chartEmptyItem("Aún no hay consultas registradas en este periodo."));
    return;
  }
  renderDonut(donut, donutStops([
    { value: counts.emergencia, color: tipoColors.emergencia },
    { value: counts.normal, color: tipoColors.normal },
  ]));
  donut.setAttribute("aria-label",
    `Modalidad: ${counts.emergencia} con emergencia, ${counts.normal} sin emergencia`);
  for (const key of ["emergencia", "normal"]) {
    const row = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = tipoColors[key];
    const name = document.createElement("span");
    name.className = "legend-name";
    name.textContent = tipoLabels[key];
    const value = document.createElement("span");
    value.className = "legend-value";
    value.textContent = `${counts[key]} · ${formatPercent(percentOf(counts[key], total))}`;
    row.append(dot, name, value);
    legend.append(row);
  }
}

function renderKpis() {
  const { current, previous } = kpiPeriod();
  const stats = state.stats || {};
  const consultas = Number(stats.total) || 0;
  const all = Boolean($("stats-all")?.checked);
  const periodName = all
    ? "Todo el histórico"
    : monthTitle($("stats-month").value || monthValue());
  const currentName = current ? periodLabel(current, "mes") : "";
  const previousName = previous ? periodLabel(previous, "mes") : "";

  $("kpi-ingresos-label").textContent = all ? "Ingresos · histórico" : "Ingresos del mes";
  countTo($("kpi-ingresos"), Number(all ? state.ingresosMes?.total : current?.ingresos) || 0, formatMoney);
  $("kpi-ingresos").title = current
    ? `${formatMoney(current.ingresos)} en ${currentName}${previous ? ` · ${formatMoney(previous.ingresos)} en ${previousName}` : ""}`
    : "Sin importes registrados";
  renderChip("kpi-ingresos-chip", all
    ? { text: "—", tone: "flat" }
    : deltaChip(current?.ingresos, previous?.ingresos));
  $("kpi-ingresos-foot").textContent = all
    ? "Todos los meses · solo finalizadas"
    : current
      ? `${currentName} · vs. ${previousName || "sin periodo previo"}`
      : "Sin periodos registrados";

  const summary = occupancySummary();
  countTo($("kpi-ocupacion"), summary.rate, formatPercent);
  $("kpi-ocupacion-foot").textContent = summary.rate === null
    ? "Elige un mes para ver la ocupación"
    : `${consultas} ${consultas === 1 ? "consulta realizada" : "consultas realizadas"}`;
  const mini = $("kpi-ocupacion-mini");
  mini.replaceChildren();
  for (const week of occupancyWeeks(summary.days).slice(-6)) {
    const notch = document.createElement("i");
    notch.style.height = `${Math.max(4, Math.round(week.value))}%`;
    mini.append(notch);
  }

  countTo($("kpi-promedio"), Number(all ? state.ingresosMes?.promedio_consulta : current?.promedio) || 0, formatMoney);
  renderChip("kpi-promedio-chip", deltaChip(current?.promedio, previous?.promedio));
  $("kpi-promedio-foot").textContent = current
    ? `${Number(current.consultas) || 0} ${Number(current.consultas) === 1 ? "consulta" : "consultas"} en ${currentName}`
    : "Ticket medio por consulta";

  const counts = {
    nueva: Number(stats.consultantes?.nueva) || 0,
    frecuente: Number(stats.consultantes?.frecuente) || 0,
    sin_dato: Number(stats.consultantes?.sin_dato) || 0,
  };
  const identified = counts.nueva + counts.frecuente;
  $("kpi-frecuente-pct").textContent = identified ? formatPercent(percentOf(counts.frecuente, identified)) : "—";
  $("kpi-nueva-pct").textContent = identified ? formatPercent(percentOf(counts.nueva, identified)) : "—";
  renderChip("kpi-frecuencia-chip", counts.sin_dato
    ? { text: `${counts.sin_dato} sin dato`, tone: "flat" }
    : { text: "\u25CF Al día", tone: identified ? "up" : "flat" });
  $("kpi-frecuencia-foot").textContent = identified || counts.sin_dato
    ? `${counts.nueva} ${counts.nueva === 1 ? "nueva" : "nuevas"} · ${counts.frecuente} ${counts.frecuente === 1 ? "frecuente" : "frecuentes"}${counts.sin_dato ? ` · ${counts.sin_dato} sin dato` : ""}`
    : "Sin consultas en el periodo";

  const lecturas = Array.isArray(stats.lecturas) ? stats.lecturas : [];
  const totalLecturas = lecturas.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const top = lecturas[0] || null;
  const topCount = Number(top?.total) || 0;
  $("kpi-ranking-name").textContent = top ? capitalize(top.nombre) : "Sin lecturas todavía";
  $("kpi-ranking-share").textContent = topCount ? formatPercent(percentOf(topCount, totalLecturas)) : "—";
  $("kpi-ranking-meta").textContent = top
    ? `${topCount} ${topCount === 1 ? "pedida" : "pedidas"} de ${totalLecturas} · ${periodName}`
    : "Sin lecturas en el periodo";

  selectMetric(state.activeMetric);
}

function renderStats(data) {
  const total = Number(data?.total || 0);
  const manualTotal = Number(data?.manual_total || 0);
  renderRanking(Array.isArray(data?.lecturas) ? data.lecturas : []);
  renderFrecuencia(data?.consultantes || {});
  renderTipos(data?.tipos || {});
  countTo($("stats-total"), total, (number) => {
    const finished = Math.round(number);
    return `${finished} ${finished === 1 ? "finalizada" : "finalizadas"}`;
  });
  $("stats-total").title = $("stats-all").checked
    ? "Histórico completo"
    : formatMonthLabel($("stats-month").value);
  const hint = $("stats-hint");
  if (hint) {
    hint.textContent = "Las lecturas se cuentan por cada tipo elegido en una consulta;"
      + " una reserva con varias lecturas suma en cada una."
      + (manualTotal
        ? ` Incluye ${manualTotal} ${manualTotal === 1 ? "lectura" : "lecturas"}`
          + " de contadores históricos sin ficha (solo totales por día)."
        : "");
  }
  renderOcupacion();
  renderKpis();
  markChartsReady("stats");
}

async function loadStats() {
  const all = $("stats-all").checked;
  $("stats-month").disabled = all;
  const month = all ? "" : ($("stats-month").value || monthValue());
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  const query = params.toString();
  const data = await request(`/api/admin/estadisticas${query ? `?${query}` : ""}`);
  state.stats = data;
  try {
    await loadOccupancy(month);
  } catch (error) {
    state.occupancy = null;
    console.warn("No se pudo cargar la ocupación del periodo.", error);
  }
  renderStats(data);
}

// La ocupación sale de la disponibilidad publicada del mes: cupos usados / cupos abiertos.
async function loadOccupancy(month) {
  if (!month) {
    state.occupancy = null;
    return;
  }
  if (state.occupancy?.month === month) return;
  if (state.month === month && state.rules.length) {
    state.occupancy = { month, days: state.rules };
    return;
  }
  const data = await request(`/api/admin/availability?month=${encodeURIComponent(month)}`);
  state.occupancy = { month, days: Array.isArray(data?.days) ? data.days : [] };
}

/* ingresos por periodo */
const amountFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDayFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const monthYearFormat = new Intl.DateTimeFormat("es", { month: "short", year: "numeric" });

function formatMoney(value) {
  return `$${amountFormat.format(Number(value) || 0)}`;
}

function formatShortDay(value) {
  const date = new Date(`${value}T12:00:00`);
  if (!value || Number.isNaN(date.getTime())) return String(value || "");
  return shortDayFormat.format(date).replace(/\.$/, "");
}

function periodLabel(periodo, granularidad) {
  const inicio = String(periodo?.inicio || "");
  if (granularidad === "año") return inicio.slice(0, 4);
  if (granularidad === "dia" || granularidad === "semana") return formatShortDay(inicio);
  const date = new Date(`${inicio.slice(0, 7)}-01T12:00:00`);
  if (!inicio || Number.isNaN(date.getTime())) return inicio;
  return monthYearFormat.format(date).replace(/\.$/, "");
}

function syncBarsScroll(container) {
  if (!container) return;
  const max = container.scrollWidth - container.clientWidth;
  container.classList.toggle("is-more-left", container.scrollLeft > 2);
  container.classList.toggle("is-more-right", max > 2 && container.scrollLeft < max - 2);
}

// Máximos locales de la serie: solo se marcan los periodos con ingresos mayores
// que sus vecinos, así una subida continua no llena la curva de picos.
function findPeaks(values) {
  const peaks = [];
  values.forEach((value, index) => {
    if (!(value > 0)) return;
    const previous = index > 0 ? values[index - 1] : null;
    const next = index < values.length - 1 ? values[index + 1] : null;
    const beatsPrevious = previous === null || value > previous;
    const beatsNext = next === null || value > next;
    if (beatsPrevious && beatsNext) peaks.push(index);
  });
  return peaks;
}

function renderCurve(periodos, granularidad) {
  const plot = $("ingresos-curve");
  const labels = $("ingresos-curve-labels");
  if (!plot || !labels) return;
  plot.replaceChildren();
  labels.replaceChildren();
  $("ingresos-curve-max").textContent = "";
  if (!periodos.length) {
    plot.append(chartEmpty("Aún no hay consultas con importe registrado."));
    return;
  }
  const width = 640;
  const height = 200;
  const padX = 8;
  const padY = 14;
  const ingresos = periodos.map((periodo) => Number(periodo.ingresos) || 0);
  const promedios = periodos.map((periodo) => Number(periodo.promedio) || 0);
  const maxIngreso = Math.max(...ingresos, 1);
  const maxPromedio = Math.max(...promedios, 1);
  const stepX = periodos.length > 1 ? (width - padX * 2) / (periodos.length - 1) : 0;
  const xAt = (index) => (periodos.length > 1 ? padX + index * stepX : width / 2);
  const yIncome = (value) => height - padY - value / maxIngreso * (height - padY * 2);
  const yAverage = (value) => height - padY - value / maxPromedio * (height - padY * 2);
  const line = (values, y) => values
    .map((value, index) => `${index ? "L" : "M"}${xAt(index).toFixed(1)} ${y(value).toFixed(1)}`)
    .join(" ");

  const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" });
  // Relleno del área: degradado vertical rosa -> transparente (los colores y la
  // opacidad se ajustan desde CSS con .curve-stop-top / .curve-stop-bottom).
  const defs = svgNode("defs");
  const areaGradient = svgNode("linearGradient", {
    id: "curve-area-gradient",
    gradientUnits: "userSpaceOnUse",
    x1: 0,
    y1: padY,
    x2: 0,
    y2: height - padY,
  });
  areaGradient.append(svgNode("stop", { class: "curve-stop-top", offset: "0%" }));
  areaGradient.append(svgNode("stop", { class: "curve-stop-bottom", offset: "100%" }));
  defs.append(areaGradient);
  svg.append(defs);
  const grid = svgNode("g", { class: "curve-grid" });
  for (const ratio of [0, 0.5, 1]) {
    const y = (padY + (height - padY * 2) * ratio).toFixed(1);
    grid.append(svgNode("line", { x1: 0, x2: width, y1: y, y2: y, "vector-effect": "non-scaling-stroke" }));
  }
  svg.append(grid);
  svg.append(svgNode("path", {
    class: "curve-area",
    d: `${line(ingresos, yIncome)} L${xAt(periodos.length - 1).toFixed(1)} ${height - padY} L${xAt(0).toFixed(1)} ${height - padY} Z`,
  }));
  svg.append(svgNode("path", {
    class: "curve-line",
    d: line(ingresos, yIncome),
    pathLength: 1,
    "vector-effect": "non-scaling-stroke",
  }));
  svg.append(svgNode("path", {
    class: "curve-avg",
    d: line(promedios, yAverage),
    "vector-effect": "non-scaling-stroke",
  }));
  if (periodos.length <= 24) {
    for (const [index, value] of ingresos.entries()) {
      svg.append(svgNode("circle", {
        class: "curve-dot",
        cx: xAt(index).toFixed(1),
        cy: yIncome(value).toFixed(1),
        r: 3,
        "vector-effect": "non-scaling-stroke",
      }));
    }
  }
  const peaks = findPeaks(ingresos);
  for (const index of peaks.slice(0, 24)) {
    svg.append(svgNode("circle", {
      class: "curve-peak",
      cx: xAt(index).toFixed(1),
      cy: yIncome(ingresos[index]).toFixed(1),
      r: 4,
      "vector-effect": "non-scaling-stroke",
    }));
  }
  plot.append(svg);
  if (peaks.length && peaks.length <= 6) {
    // Etiqueta HTML sobre el pico: el SVG usa preserveAspectRatio="none", así que
    // un <text> se deformaría con el ancho del contenedor.
    for (const index of peaks) {
      const tag = document.createElement("span");
      tag.className = "curve-peak-label";
      tag.style.left = `${xAt(index) / width * 100}%`;
      tag.style.top = `${yIncome(ingresos[index]) / height * 100}%`;
      if (index === 0) tag.dataset.edge = "start";
      if (index === periodos.length - 1) tag.dataset.edge = "end";
      tag.textContent = formatMoney(ingresos[index]);
      plot.append(tag);
    }
  }
  plot.setAttribute("aria-label",
    `Curva de ${periodos.length} ${periodos.length === 1 ? "periodo" : "periodos"}: ingresos máximos ${formatMoney(maxIngreso)}, ticket medio máximo ${formatMoney(maxPromedio)}`
    + (peaks.length ? `, ${peaks.length} ${peaks.length === 1 ? "pico" : "picos"} marcados` : ""));
  $("ingresos-curve-max").textContent = `máx ${formatMoney(maxIngreso)} · ticket ${formatMoney(maxPromedio)}`;

  const picks = periodos.length <= 6
    ? periodos.map((_, index) => index)
    : [...new Set(Array.from({ length: 6 }, (_, step) => Math.round(step * (periodos.length - 1) / 5)))];
  for (const index of picks) {
    const label = document.createElement("span");
    label.textContent = periodLabel(periodos[index], granularidad);
    labels.append(label);
  }
  // El SVG nuevo arranca recortado y la animación CSS lo abre de izquierda a
  // derecha; puntos, picos y etiquetas entran con su propio retraso. Con
  // prefers-reduced-motion no se marca: el estado base ya es el final.
  plot.classList.toggle("is-revealed", motionOK());
}

function renderIngresos(data) {
  const periodos = Array.isArray(data?.periodos) ? data.periodos : [];
  const granularidad = data?.granularidad || state.granularidad;
  countTo($("ingresos-total"), Number(data?.total) || 0, formatMoney);
  countTo($("ingresos-promedio"), Number(data?.promedio_consulta) || 0, formatMoney);
  $("ingresos-count").textContent = String(Number(data?.consultas) || 0);
  renderCurve(periodos, granularidad);
  if (granularidad === "mes") state.ingresosMes = data;
  renderKpis();
  markChartsReady("ingresos");
}

async function loadIngresos(options = {}) {
  const granularidad = state.granularidad || "mes";
  const data = await request(`/api/admin/ingresos?granularidad=${encodeURIComponent(granularidad)}`);
  state.ingresos = data;
  state.granularidad = data.granularidad || granularidad;
  if (options.transition) applyWithTransition(() => renderIngresos(data));
  else renderIngresos(data);
}

function bindIngresosTabs() {
  const tabs = $("ingresos-tabs");
  if (!tabs) return;
  tabs.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest(".seg-btn") : null;
    if (!button) return;
    const granularidad = button.dataset.granularidad || "mes";
    if (granularidad === state.granularidad) return;
    state.granularidad = granularidad;
    for (const item of tabs.querySelectorAll(".seg-btn")) {
      const active = item === button;
      item.classList.toggle("on", active);
      item.setAttribute("aria-selected", String(active));
    }
    loadIngresos({ transition: true }).catch((error) => showError(error.message));
  });
}

function updateDensity(value) {
  state.density = value === "compact" ? "compact" : "comfortable";
  document.body.dataset.density = state.density;
  $("density-toggle").value = state.density;
}

function updateDiscreet(value) {
  state.discreet = value;
  $("discreet-toggle").textContent = value ? "Mostrar datos" : "Modo discreto";
  $("discreet-toggle").setAttribute("aria-pressed", String(value));
  renderConsultas(state.consultas);
  renderDashboard();
}

function applyTileExpansion(tile, expanded) {
  const button = tile.querySelector(".tile-expand, [data-tile-toggle]");
  if (!button) return;
  const detail = $(button.getAttribute("aria-controls"));
  tile.classList.toggle("is-expanded", expanded);
  button.setAttribute("aria-expanded", String(expanded));
  if (detail) detail.hidden = !expanded;
}

function applyWithTransition(update) {
  let applied = false;
  const run = () => {
    if (applied) return;
    applied = true;
    update();
  };
  if (typeof document.startViewTransition === "function") {
    try {
      document.startViewTransition(run);
      window.setTimeout(run, 150);
      return;
    } catch (error) {
      // sin transición: aplicamos el cambio de inmediato
    }
  }
  run();
}

function closeExpandedTile() {
  if (!state.expandedTile) return;
  const previous = state.expandedTile;
  state.expandedTile = null;
  applyWithTransition(() => applyTileExpansion(previous, false));
}

function toggleTile(tile) {
  const previous = state.expandedTile;
  const next = previous === tile ? null : tile;
  state.expandedTile = next;
  applyWithTransition(() => {
    if (previous && previous !== next) applyTileExpansion(previous, false);
    if (next) applyTileExpansion(next, true);
  });
}

function bindTiles() {
  for (const tile of document.querySelectorAll("[data-tile]")) {
    tile.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("a, button, input, select, label")) return;
      toggleTile(tile);
    });
    const trigger = tile.querySelector(".tile-expand, [data-tile-toggle]");
    if (trigger) trigger.addEventListener("click", () => toggleTile(tile));
  }
  document.addEventListener("click", (event) => {
    if (!state.expandedTile || !(event.target instanceof Element)) return;
    if (!state.expandedTile.contains(event.target)) closeExpandedTile();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeExpandedTile();
  });
}

function bindReveal() {
  const items = [...document.querySelectorAll("[data-reveal]")];
  if (!items.length) return;
  for (const item of items) item.classList.add("reveal");
  const check = () => {
    const viewport = window.innerHeight;
    for (const item of items) {
      if (item.classList.contains("in")) continue;
      if (item.getBoundingClientRect().top < viewport * 0.94) item.classList.add("in");
    }
  };
  window.addEventListener("scroll", check, { passive: true });
  window.addEventListener("resize", check);
  window.addEventListener("load", check);
  check();
}

let activateView = () => {};

function bindView() {
  const views = [...document.querySelectorAll("main [data-view]")];
  if (!views.length) return;
  const navLinks = [...document.querySelectorAll(".side .nav[data-goto-view], .tabbar .nav[data-goto-view]")];
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveal = (view) => {
    const items = [view, ...view.querySelectorAll("[data-reveal]")];
    const animate = !reduceMotion();
    if (animate) {
      for (const item of items) item.classList.remove("in");
      window.requestAnimationFrame(() => {
        for (const item of items) item.classList.add("in");
      });
      return;
    }
    for (const item of items) item.classList.add("in");
  };
  const scrollToId = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    window.scrollTo({
      top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - 16),
      behavior: reduceMotion() ? "auto" : "smooth",
    });
  };

  activateView = (name, options = {}) => {
    const target = views.find((view) => view.dataset.view === name) || views[0];
    if (!target) return;
    for (const view of views) {
      const active = view === target;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
      if (active) {
        reveal(view);
        const bars = view.querySelector(".bars");
        if (bars) window.requestAnimationFrame(() => syncBarsScroll(bars));
      }
    }
    for (const link of navLinks) {
      const active = link.dataset.gotoView === target.dataset.view;
      link.classList.toggle("on", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    if (options.hash !== false) {
      const hash = `#${target.dataset.view}`;
      if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
    }
    if (options.target) window.requestAnimationFrame(() => scrollToId(options.target));
    else if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
    }
  };

  for (const link of document.querySelectorAll("[data-goto-view]")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      activateView(link.dataset.gotoView || "inicio", { target: link.dataset.gotoTarget || "" });
    });
  }

  // El hash puede verse como "ruido" si el navegador salta al elemento; la vista
  // ya se muestra arriba, así que leemos el hash, lo retiramos y lo devolvemos
  // sin desplazar la página.
  let initial = "";
  const rawHash = window.location.hash || "";
  try {
    initial = decodeURIComponent(rawHash.replace(/^#/, ""));
  } catch (error) {
    initial = "";
  }
  const hasViewHash = views.some((view) => view.dataset.view === initial);
  if (rawHash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

  activateView(hasViewHash ? initial : "inicio", { scroll: false, hash: false });
  if (rawHash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hasViewHash ? `#${initial}` : ""}`);

  // El navegador salta al ancla al terminar de cargar; como la vista ya se
  // muestra arriba, devolvemos el scroll salvo que la persona ya se haya movido.
  if (hasViewHash) {
    let userMoved = false;
    for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) {
      window.addEventListener(type, () => { userMoved = true; }, { once: true, passive: true });
    }
    const resetScroll = () => {
      if (!userMoved) window.scrollTo({ top: 0, behavior: "auto" });
    };
    resetScroll();
    window.addEventListener("load", resetScroll, { once: true });
  }

  window.addEventListener("hashchange", () => {
    const name = (window.location.hash || "").replace(/^#/, "");
    const target = views.find((view) => view.dataset.view === name);
    if (target && target.hidden) activateView(target.dataset.view, { hash: false });
  });
}

function bindTabs() {
  const tabs = $("consulta-tabs");
  if (tabs) {
    tabs.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest(".seg-btn") : null;
      if (!button) return;
      setConsultaState(button.dataset.state || "");
    });
  }
  for (const link of document.querySelectorAll("[data-goto-state]")) {
    link.addEventListener("click", () => setConsultaState(link.dataset.gotoState || ""));
  }
}
function bindSettingsSheet() {
  const toggle = $("settings-toggle");
  const sheet = $("settings-sheet");
  const backdrop = $("settings-backdrop");
  const close = $("settings-close");
  if (!toggle || !sheet || !backdrop) return;
  const isOpen = () => sheet.classList.contains("is-open");
  const setOpen = (open) => {
    sheet.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    backdrop.hidden = !open;
  };
  toggle.addEventListener("click", () => setOpen(!isOpen()));
  if (close) close.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });
  for (const link of sheet.querySelectorAll("[data-goto-view]")) {
    link.addEventListener("click", () => setOpen(false));
  }
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 768 && isOpen()) setOpen(false);
  });
}


async function initialize() {
  startClock();
  updateDensity(readPreference(preferenceKeys.density, "comfortable"));
  updateDiscreet(readPreference(preferenceKeys.discreet, "false") === "true");
  bindTiles();
  bindTabs();
  bindIngresosTabs();
  bindStatMetrics();
  bindReveal();
  bindView();
  bindSettingsSheet();
  bindDaySheet();
  bindSheets();
  bindCalendarSwipe();
  bindConsultasFilters();
  bindManualReserva();
  try {
    const user = await request("/api/admin/me");
    state.identity = String(user.email || "");
    $("identity").textContent = `Sesión autorizada: ${user.email}`;
    $("consultas-month").value = monthValue();
    $("stats-month").value = monthValue();
    state.month = monthValue();
    state.consultaDate = dateValue();
    state.selectedDate = dateValue().startsWith(`${state.month}-`)
      ? dateValue()
      : `${state.month}-01`;
    setConsultaMode(state.consultaMode);
    await Promise.all([
      loadAvailability(),
      loadConsultas(),
      loadDashboardConsultas(),
      loadStats(),
      loadIngresos(),
      loadTiposHoy(),
    ]);
    window.setInterval(() => renderDashboard(), 30000);
  } catch (error) {
    showError(error.message);
    // sin datos no hay gráficas que esperar: se apaga el skeleton de la primera carga
    markChartsReady("stats");
    markChartsReady("ingresos");
    $("identity").textContent = "No se pudo verificar la sesión.";
  }
}

$("cal-prev").addEventListener("click", () => shiftMonth(-1));
$("cal-next").addEventListener("click", () => shiftMonth(1));
$("rule-form").addEventListener("submit", saveRule);
$("reset-rule").addEventListener("click", resetRule);
$("discreet-toggle").addEventListener("click", () => {
  const nextValue = !state.discreet;
  savePreference(preferenceKeys.discreet, String(nextValue));
  updateDiscreet(nextValue);
});
$("density-toggle").addEventListener("change", (event) => {
  savePreference(preferenceKeys.density, event.target.value);
  updateDensity(event.target.value);
});
$("search-consultas").addEventListener("click", () => renderConsultasView());
$("consultas-search").addEventListener("input", () => renderConsultasView());
$("consultas-search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    renderConsultasView();
  }
});
$("consultas-month").addEventListener("change", () => {
  loadConsultas().catch((error) => showError(error.message));
});
$("stats-month").addEventListener("change", () => {
  loadStats().catch((error) => showError(error.message));
});
$("stats-all").addEventListener("change", () => {
  loadStats().catch((error) => showError(error.message));
});

initialize();
