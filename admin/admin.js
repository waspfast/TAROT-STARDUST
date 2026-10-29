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
  stats: null,
  ingresos: null,
  granularidad: "mes",
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
const emptyDonut = "conic-gradient(rgba(58,53,53,.09) 0 100%)";

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
      throw new Error(data.error || `Error HTTP ${response.status}`);
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

function renderCalendar() {
  const calendar = $("calendar");
  calendar.replaceChildren();
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
    const { booked, capacity, free } = totalsFor(rule);
    const reservations = Number(rule?.consultas || 0);
    const ratio = capacity ? Math.min(1, booked / capacity) : 0;
    const wrapper = document.createElement("span");
    wrapper.className = "calendar-day";
    wrapper.dataset.column = String((blanks + day - 1) % 7 + 1);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "d";
    button.dataset.date = date;
    button.textContent = String(day);
    button.style.setProperty("--heat", `${Math.round(ratio * 70)}%`);
    if (!rule?.is_open) button.classList.add("is-closed");
    if (reservations > 0 || booked > 0) button.classList.add("has-bookings");
    if (rule?.is_open && free === 0) button.classList.add("is-full");
    if (date === today) button.classList.add("is-today");
    if (date === state.selectedDate) button.classList.add("is-selected");
    button.setAttribute("aria-pressed", String(date === state.selectedDate));

    const openLabel = rule?.is_open ? "abierta" : "cerrada";
    const tip = `${date}: ${openLabel}; ${reservations} ${reservations === 1 ? "reserva individual" : "reservas individuales"}; ${booked} ${booked === 1 ? "lectura contabilizada" : "lecturas contabilizadas"}; ${free} ${free === 1 ? "cupo de lectura libre" : "cupos de lectura libres"}.`;
    button.setAttribute("aria-label", tip);
    if (reservations > 0 || booked > 0) {
      const badge = document.createElement("span");
      badge.className = "day-bookings";
      badge.textContent = String(reservations || booked);
      badge.setAttribute("aria-hidden", "true");
      button.append(badge);
    }
    button.addEventListener("click", () => selectDate(date));
    wrapper.append(button);

    const tooltip = document.createElement("span");
    tooltip.className = "cal-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.textContent = tip;
    wrapper.append(tooltip);
    calendar.append(wrapper);
  }
}
function selectDate(date) {
  state.selectedDate = date;
  for (const button of $("calendar").querySelectorAll(".d")) {
    const selected = button.dataset.date === date;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  fillRuleForm(state.rules.find((item) => item.date === date));
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
  $("availability-summary").textContent = rule
    ? `${rule.is_open ? "Abierta" : "Cerrada"} · ${free} ${free === 1 ? "cupo de lectura libre" : "cupos de lectura libres"} el ${state.selectedDate}`
    : "Selecciona una fecha en el calendario";
}

async function loadAvailability() {
  state.month = $("availability-month").value || monthValue();
  const data = await request(`/api/admin/availability?month=${encodeURIComponent(state.month)}`);
  state.rules = data.days;
  renderCalendar();
  fillRuleForm(state.rules.find((item) => item.date === state.selectedDate));
  const openDays = state.rules.filter((item) => item.is_open).length;
  $("stat-open-days").textContent = String(openDays);
  $("availability-summary").textContent = `${openDays} fechas abiertas este mes`;
}

function shiftMonth(delta) {
  const current = $("availability-month").value || monthValue();
  const [year, monthNumber] = current.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  $("availability-month").value = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  state.selectedDate = `${$("availability-month").value}-01`;
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
  try {
    const saved = await request(`/api/admin/availability/${state.selectedDate}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    await loadAvailability();
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
function appendText(parent, tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value || "—";
  parent.append(element);
  return element;
}

function statusLabel(status) {
  return status === "finalizado" ? "Finalizada" : "En progreso";
}

function compareConsultas(left, right) {
  return `${left.fecha} ${left.inicio || "99:99"}`.localeCompare(`${right.fecha} ${right.inicio || "99:99"}`);
}

function consultationDateTime(consulta) {
  if (!consulta.inicio || !/^\d{2}:\d{2}$/.test(consulta.inicio)) return null;
  return new Date(`${consulta.fecha}T${consulta.inicio}:00`);
}

function appendTileRecord(container, consulta, options = {}) {
  const item = document.createElement("div");
  item.className = "tile-list-item";
  appendText(item, "span", "tile-list-time", consulta.inicio || "—");
  appendText(item, "span", "tile-list-name", formatName(consulta.nombre));
  const phone = formatPhone(consulta.telefono);
  const date = options.showDate === false ? "" : `${consulta.fecha} · `;
  appendText(item, "span", "tile-list-meta",
    `${date}${statusLabel(consulta.estado)} · ${consulta.tipo === "emergencia" ? "Emergencia" : "Normal"}`
    + (phone ? ` · ${phone}` : ""));
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
    return consulta.estado !== "finalizado" && at && at.getTime() >= now.getTime();
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

  $("stat-total").textContent = String(todaysConsultas.length);
  $("stat-finished").textContent = String(todaysConsultas.filter((consulta) => consulta.estado === "finalizado").length);

  const list = $("today-list");
  list.replaceChildren();
  if (!todaysConsultas.length) appendEmptyMessage(list, "No hay consultas individuales registradas para hoy.");
  else todaysConsultas.forEach((consulta) => appendTileRecord(list, consulta, { showDate: false }));
  return upcoming.length > 0;
}

function renderConfirmTile() {
  const confirmationList = state.dashboardConsultas
    .filter((consulta) => consulta.estado === "en_proceso")
    .sort(compareConsultas);
  $("confirm-count").textContent = String(confirmationList.length);
  $("stat-progress").textContent = String(confirmationList.length);
  $("confirm-copy").textContent = confirmationList.length
    ? `${confirmationList.length} ${confirmationList.length === 1 ? "consulta sigue" : "consultas siguen"} en progreso.`
    : "Todo al día; no hay consultas en progreso.";
  $("confirm-tile").classList.toggle("is-priority", confirmationList.length > 0);

  const preview = $("confirm-preview");
  const detail = $("confirm-list");
  preview.replaceChildren();
  detail.replaceChildren();
  if (!confirmationList.length) {
    appendEmptyMessage(preview, "Puedes seguir con lo que necesites, con calma.");
    appendEmptyMessage(detail, "No hay consultas en progreso en este periodo.");
    return 0;
  }
  confirmationList.slice(0, 2).forEach((consulta) => appendTileRecord(preview, consulta));
  confirmationList.forEach((consulta) => appendTileRecord(detail, consulta));
  return confirmationList.length;
}

function renderDashboard(now = new Date()) {
  const hasUpcomingToday = renderTodayTile(now);
  const pendingCount = renderConfirmTile();
  const dashboard = $("dashboard");
  dashboard.classList.toggle("is-confirming", pendingCount > 0);
  dashboard.classList.toggle("is-quiet", !hasUpcomingToday);
  dashboard.classList.toggle("is-empty", pendingCount === 0);
}
function renderConsultas(consultas) {
  state.consultas = consultas;
  $("consulta-count").textContent = String(consultas.length);
  const container = $("consultas-list");
  container.replaceChildren();
  if (!consultas.length) {
    appendText(container, "p", "sub", "No hay consultas que coincidan con estos filtros.");
    return;
  }

  for (const consulta of consultas) {
    const card = document.createElement("article");
    card.className = "consulta";
    appendText(card, "span", "consulta-time", consulta.inicio || "—");
    const details = document.createElement("div");
    appendText(details, "div", "consulta-who", formatName(consulta.nombre));
    appendText(details, "div", "consulta-sub",
      `${consulta.fecha} · ${consulta.tipo === "emergencia" ? "Emergencia" : "Normal"}`
      + `${consulta.consultante ? ` · Consultante ${consulta.consultante}` : ""}`);
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
    const status = document.createElement("select");
    status.className = "status-control";
    status.setAttribute("aria-label", `Estado de la consulta ${consulta.id}`);
    for (const [value, label] of [["en_proceso", "En progreso"], ["finalizado", "Finalizada"]]) {
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
        await Promise.all([loadConsultas(), loadDashboardConsultas(), loadStats()]);
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
}

function renderManualRecords(records) {
  const container = $("manual-list");
  container.replaceChildren();
  const total = records.reduce((sum, record) => sum + Number(record.total || 0), 0);
  $("manual-total").textContent = `${total} ${total === 1 ? "lectura" : "lecturas"}`;
  if (!records.length) {
    appendText(container, "p", "sub", "No hay contadores históricos sin consulta individual para este mes.");
    return;
  }

  for (const record of records) {
    const card = document.createElement("article");
    card.className = "consulta manual-record";
    appendText(card, "span", "consulta-time", "—");
    const detail = document.createElement("div");
    detail.className = "consulta-main";
    appendText(detail, "div", "consulta-who", "Registro manual · Sin desglose");
    appendText(detail, "div", "consulta-sub", `${record.fecha} · ${record.total} lecturas contabilizadas`);
    card.append(detail);
    appendText(card, "span", "pill manual-pill", "Manual");
    appendText(card, "p", "consulta-detail",
      `Cortas normales: ${record.corta_normal}`
      + ` · cortas emergencia: ${record.corta_emergencia}`
      + ` · extensas normales: ${record.extensa_normal}`
      + ` · extensas emergencia: ${record.extensa_emergencia}`);
    container.append(card);
  }
}

async function loadConsultas() {
  const params = new URLSearchParams();
  if ($("consultas-month").value) params.set("month", $("consultas-month").value);
  if (state.consultaState) params.set("estado", state.consultaState);
  if ($("consultas-search").value.trim()) params.set("q", $("consultas-search").value.trim());
  const data = await request(`/api/admin/consultas?${params}`);
  renderConsultas(data.consultas);
  renderManualRecords(data.registros_manuales || []);
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
  loadConsultas().catch((error) => showError(error.message));
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

function donutGradient(items) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) return emptyDonut;
  let offset = 0;
  const stops = items.filter((item) => item.value > 0).map((item) => {
    const start = (offset / total) * 100;
    offset += item.value;
    const end = (offset / total) * 100;
    return `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function renderDonut(donutId, legendId, centerId, items, centerTotal, emptyText) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  $(donutId).style.setProperty("--segments", donutGradient(items));
  const legend = $(legendId);
  legend.replaceChildren();
  if (!total) {
    const message = document.createElement("li");
    message.className = "legend-empty";
    message.textContent = emptyText;
    legend.append(message);
  } else {
    for (const entry of items.filter((item) => item.value > 0)) {
      const row = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = entry.color;
      const name = document.createElement("span");
      name.className = "legend-name";
      name.textContent = entry.label;
      name.title = entry.label;
      const value = document.createElement("span");
      value.className = "legend-value";
      value.textContent = `${entry.value} · ${Math.round((entry.value / total) * 100)}%`;
      row.append(dot, name, value);
      legend.append(row);
    }
  }
  $(centerId).textContent = String(centerTotal ?? 0);
}

function renderStats(data) {
  const total = Number(data?.total || 0);
  const lecturas = Array.isArray(data?.lecturas) ? data.lecturas : [];
  const consultantes = data?.consultantes || {};
  const lecturaTotal = lecturas.reduce((sum, item) => sum + Number(item.total || 0), 0);
  renderDonut("lecturas-donut", "lecturas-legend", "lecturas-center", groupReadings(lecturas), lecturaTotal,
    "Aún no hay lecturas registradas en este periodo.");
  const consultanteItems = ["nueva", "frecuente", "sin_dato"].map((key) => ({
    label: consultanteLabels[key],
    value: Number(consultantes[key] || 0),
    color: consultanteColors[key],
  }));
  renderDonut("consultantes-donut", "consultantes-legend", "consultantes-center", consultanteItems, total,
    "Aún no hay consultas registradas en este periodo.");
  $("stats-total").textContent = `${total} ${total === 1 ? "consulta" : "consultas"}`;
  $("stats-total").title = $("stats-all").checked
    ? "Histórico completo"
    : formatMonthLabel($("stats-month").value);
}

async function loadStats() {
  const all = $("stats-all").checked;
  $("stats-month").disabled = all;
  const params = new URLSearchParams();
  if (!all) params.set("month", $("stats-month").value || monthValue());
  const query = params.toString();
  const data = await request(`/api/admin/estadisticas${query ? `?${query}` : ""}`);
  state.stats = data;
  renderStats(data);
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
  if (granularidad === "semana") return formatShortDay(inicio);
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

function renderIngresos(data) {
  const periodos = Array.isArray(data?.periodos) ? data.periodos : [];
  const granularidad = data?.granularidad || state.granularidad;
  $("ingresos-total").textContent = formatMoney(data?.total);
  $("ingresos-promedio").textContent = formatMoney(data?.promedio_consulta);
  $("ingresos-count").textContent = String(Number(data?.consultas) || 0);

  const container = $("ingresos-bars");
  container.replaceChildren();
  container.classList.toggle("is-dense", periodos.length > 14);
  container.setAttribute("aria-label",
    `Ingresos por ${granularidad}: ${periodos.length} ${periodos.length === 1 ? "periodo" : "periodos"}, total ${formatMoney(data?.total)}`);
  if (!periodos.length) {
    appendText(container, "p", "bars-empty", "Aún no hay consultas con importe registrado.");
    syncBarsScroll(container);
    return;
  }

  const max = Math.max(...periodos.map((periodo) => Number(periodo.ingresos) || 0), 1);
  for (const periodo of periodos) {
    const ingresos = Number(periodo.ingresos) || 0;
    const consultas = Number(periodo.consultas) || 0;
    const label = periodLabel(periodo, granularidad);

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.title = granularidad === "semana"
      ? `Semana del ${periodo.inicio} al ${periodo.fin} · ${formatMoney(ingresos)} · ${consultas} ${consultas === 1 ? "consulta" : "consultas"} · promedio ${formatMoney(periodo.promedio)}`
      : `${label} · ${formatMoney(ingresos)} · ${consultas} ${consultas === 1 ? "consulta" : "consultas"} · promedio ${formatMoney(periodo.promedio)}`;

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.height = `${Math.max(2, Math.round((ingresos / max) * 100))}%`;
    track.append(fill);

    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = ingresos ? formatMoney(ingresos) : "—";
    const caption = document.createElement("span");
    caption.className = "bar-label";
    caption.textContent = label;

    bar.append(track, value, caption);
    container.append(bar);
  }
  syncBarsScroll(container);
}

async function loadIngresos() {
  const granularidad = state.granularidad || "mes";
  const data = await request(`/api/admin/ingresos?granularidad=${encodeURIComponent(granularidad)}`);
  state.ingresos = data;
  state.granularidad = data.granularidad || granularidad;
  renderIngresos(data);
}

function bindIngresosTabs() {
  const bars = $("ingresos-bars");
  if (bars) {
    bars.addEventListener("scroll", () => syncBarsScroll(bars), { passive: true });
    window.addEventListener("resize", () => syncBarsScroll(bars));
  }
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
    loadIngresos().catch((error) => showError(error.message));
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
  const detailId = tile.querySelector(".tile-expand").getAttribute("aria-controls");
  const detail = $(detailId);
  const button = tile.querySelector(".tile-expand");
  tile.classList.toggle("is-expanded", expanded);
  button.setAttribute("aria-expanded", String(expanded));
  detail.hidden = !expanded;
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
  for (const tile of document.querySelectorAll(".bento-tile[data-tile]")) {
    tile.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("a, button, input, select, label")) return;
      toggleTile(tile);
    });
    tile.querySelector(".tile-expand").addEventListener("click", () => toggleTile(tile));
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
  const navLinks = [...document.querySelectorAll(".side .nav[data-goto-view]")];
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
async function initialize() {
  startClock();
  updateDensity(readPreference(preferenceKeys.density, "comfortable"));
  updateDiscreet(readPreference(preferenceKeys.discreet, "false") === "true");
  bindTiles();
  bindTabs();
  bindIngresosTabs();
  bindReveal();
  bindView();
  try {
    const user = await request("/api/admin/me");
    $("identity").textContent = `Sesión autorizada: ${user.email}`;
    $("availability-month").value = monthValue();
    $("consultas-month").value = monthValue();
    $("stats-month").value = monthValue();
    state.month = $("availability-month").value;
    state.selectedDate = dateValue().startsWith(`${state.month}-`)
      ? dateValue()
      : `${state.month}-01`;
    await Promise.all([loadAvailability(), loadConsultas(), loadDashboardConsultas(), loadStats(), loadIngresos()]);
    window.setInterval(() => renderTodayTile(), 30000);
  } catch (error) {
    showError(error.message);
    $("identity").textContent = "No se pudo verificar la sesión.";
  }
}

$("availability-month").addEventListener("change", () => {
  state.selectedDate = `${$("availability-month").value}-01`;
  loadAvailability().catch((error) => showError(error.message));
});
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
$("search-consultas").addEventListener("click", () => {
  loadConsultas().catch((error) => showError(error.message));
});
$("consultas-search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loadConsultas().catch((error) => showError(error.message));
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
