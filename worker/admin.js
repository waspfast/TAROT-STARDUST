import { verifyAccess } from "./access.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const CAPACITY_COLUMNS = [
  "corta_normal", "corta_emergencia", "extensa_normal", "extensa_emergencia",
];
const STATES = ["en_proceso", "finalizado"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function timeToMinutes(value) {
  if (!TIME_RE.test(value)) return NaN;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseRule(row, date, isOverride) {
  return {
    date,
    is_open: Boolean(row.is_open),
    inicio: row.inicio,
    fin: row.fin,
    corta_normal: row.corta_normal,
    corta_emergencia: row.corta_emergencia,
    extensa_normal: row.extensa_normal,
    extensa_emergencia: row.extensa_emergencia,
    emergencia_extendida: Boolean(row.emergencia_extendida),
    custom: isOverride,
  };
}

export async function getDayRule(db, date) {
  if (!db) throw new Error("El binding D1 DB no está configurado");
  const override = await db.prepare(
    `SELECT is_open, inicio, fin, corta_normal, corta_emergencia,
            extensa_normal, extensa_emergencia, emergencia_extendida
       FROM availability_overrides WHERE fecha = ?`
  ).bind(date).first();
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const row = override || await db.prepare(
    `SELECT is_open, inicio, fin, corta_normal, corta_emergencia,
            extensa_normal, extensa_emergencia, emergencia_extendida
       FROM availability_defaults WHERE weekday = ?`
  ).bind(weekday).first();
  if (!row) throw new Error(`No existe una regla de disponibilidad para ${date}`);
  return parseRule(row, date, Boolean(override));
}

async function readMonth(db, month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const [defaults, overrides, booked, slots, consultations] = await db.batch([
    db.prepare(
      `SELECT weekday, is_open, inicio, fin, corta_normal, corta_emergencia,
              extensa_normal, extensa_emergencia, emergencia_extendida
         FROM availability_defaults`
    ),
    db.prepare(
      `SELECT fecha, is_open, inicio, fin, corta_normal, corta_emergencia,
              extensa_normal, extensa_emergencia, emergencia_extendida
         FROM availability_overrides WHERE fecha >= ? AND fecha <= ?`
    ).bind(first, last),
    db.prepare(
      `SELECT fecha, corta_normal, corta_emergencia, extensa_normal, extensa_emergencia
         FROM reservas WHERE fecha >= ? AND fecha <= ?`
    ).bind(first, last),
    db.prepare(
      "SELECT fecha, inicio, tipo FROM slots WHERE fecha >= ? AND fecha <= ? ORDER BY fecha, inicio"
    ).bind(first, last),
    db.prepare(
      "SELECT fecha, COUNT(*) AS total FROM consultas WHERE fecha >= ? AND fecha <= ? GROUP BY fecha"
    ).bind(first, last),
  ]);
  const defaultsByWeekday = new Map((defaults.results || []).map((row) => [row.weekday, row]));
  const overridesByDate = new Map((overrides.results || []).map((row) => [row.fecha, row]));
  const countsByDate = new Map((booked.results || []).map((row) => [row.fecha, row]));
  const consultationCountsByDate = new Map((consultations.results || []).map((row) => [row.fecha, row.total]));
  const slotsByDate = new Map();
  for (const slot of slots.results || []) {
    if (!slotsByDate.has(slot.fecha)) slotsByDate.set(slot.fecha, { normal: [], emergencia: [] });
    const daySlots = slotsByDate.get(slot.fecha);
    if (!daySlots[slot.tipo].includes(slot.inicio)) daySlots[slot.tipo].push(slot.inicio);
  }

  const days = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const override = overridesByDate.get(date);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const rule = parseRule(override || defaultsByWeekday.get(weekday), date, Boolean(override));
    const counts = countsByDate.get(date) || {};
    days.push({
      ...rule,
      counts: Object.fromEntries(CAPACITY_COLUMNS.map((column) => [column, counts[column] || 0])),
      consultas: consultationCountsByDate.get(date) || 0,
      slots: slotsByDate.get(date) || { normal: [], emergencia: [] },
      custom: overridesByDate.has(date),
    });
  }
  return days;
}

async function listConsultas(db, params) {
  const month = params.get("month") || "";
  const state = params.get("estado") || "";
  const query = (params.get("q") || "").trim().slice(0, 80);
  if (month && !MONTH_RE.test(month)) return json({ error: "Mes inválido" }, 400);
  if (state && !STATES.includes(state)) return json({ error: "Estado inválido" }, 400);

  const clauses = [];
  const binds = [];
  if (month) {
    const [year, monthNumber] = month.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7) + "-01";
    clauses.push("fecha >= ? AND fecha < ?");
    binds.push(`${month}-01`, nextMonth);
  }
  if (state) {
    clauses.push("estado = ?");
    binds.push(state);
  }
  if (query) {
    clauses.push("(nombre LIKE ? OR telefono LIKE ? OR lecturas LIKE ?)");
    binds.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await db.prepare(
    `SELECT id, fecha, tipo, inicio, consultante, nombre, telefono, lecturas,
            precios, total, estado, creado_en
       FROM consultas ${where}
      ORDER BY fecha DESC, inicio DESC, id DESC LIMIT 200`
  ).bind(...binds).all();

  const manualClauses = [
    `(COALESCE(r.corta_normal, 0) + COALESCE(r.corta_emergencia, 0)
      + COALESCE(r.extensa_normal, 0) + COALESCE(r.extensa_emergencia, 0)) > 0`,
    "NOT EXISTS (SELECT 1 FROM consultas c WHERE c.fecha = r.fecha)",
  ];
  const manualBinds = [];
  if (month) {
    const [year, monthNumber] = month.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7) + "-01";
    manualClauses.push("r.fecha >= ? AND r.fecha < ?");
    manualBinds.push(`${month}-01`, nextMonth);
  }
  const manual = await db.prepare(
    `SELECT fecha, corta_normal, corta_emergencia, extensa_normal, extensa_emergencia,
            COALESCE(corta_normal, 0) + COALESCE(corta_emergencia, 0)
              + COALESCE(extensa_normal, 0) + COALESCE(extensa_emergencia, 0) AS total
       FROM reservas r
      WHERE ${manualClauses.join(" AND ")}
      ORDER BY fecha DESC LIMIT 200`
  ).bind(...manualBinds).all();
  return json({
    consultas: result.results || [],
    registros_manuales: manual.results || [],
  });
}

async function saveAvailability(request, env, actor, date) {
  if (!isRealDate(date)) return json({ error: "Fecha inválida" }, 400);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.is_open !== "boolean"
    || typeof body.emergencia_extendida !== "boolean"
    || !TIME_RE.test(body.inicio) || !TIME_RE.test(body.fin)
    || timeToMinutes(body.inicio) >= timeToMinutes(body.fin)
    || (timeToMinutes(body.fin) - timeToMinutes(body.inicio)) % 30 !== 0
    || CAPACITY_COLUMNS.some((column) =>
      !Number.isInteger(body[column]) || body[column] < 0 || body[column] > 50)) {
    return json({ error: "Revisa jornada y cupos (0 a 50; bloques de 30 minutos)" }, 400);
  }

  const existing = await env.DB.prepare(
    `SELECT corta_normal, corta_emergencia, extensa_normal, extensa_emergencia,
            COALESCE(corta_normal, 0) + COALESCE(corta_emergencia, 0)
          + COALESCE(extensa_normal, 0) + COALESCE(extensa_emergencia, 0) AS total
       FROM reservas WHERE fecha = ?`
  ).bind(date).first();
  const existingSlots = await env.DB.prepare(
    "SELECT inicio FROM slots WHERE fecha = ?"
  ).bind(date).all();
  if (body.is_open && (existingSlots.results || []).some((slot) => {
    const start = timeToMinutes(body.inicio);
    const end = timeToMinutes(body.fin);
    const bookedSlot = timeToMinutes(slot.inicio);
    return bookedSlot < start || bookedSlot + 30 > end || (bookedSlot - start) % 30 !== 0;
  })) {
    return json({
      error: "La nueva jornada dejaría fuera horarios ya reservados",
    }, 409);
  }
  if (body.is_open && existing && CAPACITY_COLUMNS.some(
    (column) => body[column] < (existing[column] || 0)
  )) {
    return json({
      error: "El cupo no puede quedar por debajo de reservas ya registradas",
      existing: existing.total,
    }, 409);
  }

  const values = CAPACITY_COLUMNS.map((column) => body[column]);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO availability_overrides
         (fecha, is_open, inicio, fin, corta_normal, corta_emergencia,
          extensa_normal, extensa_emergencia, emergencia_extendida, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
       ON CONFLICT(fecha) DO UPDATE SET
         is_open = excluded.is_open, inicio = excluded.inicio, fin = excluded.fin,
         corta_normal = excluded.corta_normal, corta_emergencia = excluded.corta_emergencia,
         extensa_normal = excluded.extensa_normal, extensa_emergencia = excluded.extensa_emergencia,
         emergencia_extendida = excluded.emergencia_extendida,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`
    ).bind(date, body.is_open ? 1 : 0, body.inicio, body.fin, ...values,
      body.emergencia_extendida ? 1 : 0, actor),
    env.DB.prepare(
      "INSERT INTO admin_audit (actor, action, target, detail) VALUES (?, ?, ?, ?)"
    ).bind(actor, "availability.save", date, JSON.stringify(body)),
  ]);
  return json({ ok: true, existing_bookings: existing ? existing.total : 0 });
}

async function updateConsultaState(request, env, actor, id) {
  if (!/^[1-9]\d*$/.test(id)) return json({ error: "ID inválido" }, 400);
  const body = await request.json().catch(() => null);
  if (!body || !STATES.includes(body.estado)) return json({ error: "Estado inválido" }, 400);
  const result = await env.DB.batch([
    env.DB.prepare("UPDATE consultas SET estado = ? WHERE id = ?").bind(body.estado, Number(id)),
    env.DB.prepare(
      "INSERT INTO admin_audit (actor, action, target, detail) VALUES (?, ?, ?, ?)"
    ).bind(actor, "consulta.state", id, JSON.stringify({ estado: body.estado })),
  ]);
  if (!result[0].meta.changes) return json({ error: "Consulta no encontrada" }, 404);
  return json({ ok: true });
}

async function resetAvailability(env, actor, date) {
  if (!isRealDate(date)) return json({ error: "Fecha inválida" }, 400);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM availability_overrides WHERE fecha = ?").bind(date),
    env.DB.prepare(
      "INSERT INTO admin_audit (actor, action, target) VALUES (?, ?, ?)"
    ).bind(actor, "availability.reset", date),
  ]);
  return json({ ok: true });
}

async function statsConsultas(db, params) {
  const month = params.get("month") || "";
  if (month && !MONTH_RE.test(month)) return json({ error: "Mes inválido" }, 400);

  const clauses = [];
  const binds = [];
  if (month) {
    const [year, monthNumber] = month.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7) + "-01";
    clauses.push("fecha >= ? AND fecha < ?");
    binds.push(`${month}-01`, nextMonth);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await db.prepare(
    `SELECT lecturas, consultante, estado FROM consultas ${where}`
  ).bind(...binds).all();

  const readings = new Map();
  const clients = { nueva: 0, frecuente: 0, sin_dato: 0 };
  const states = { en_proceso: 0, finalizado: 0 };
  let total = 0;

  for (const row of result.results || []) {
    total += 1;
    if (row.estado === "finalizado") states.finalizado += 1;
    else states.en_proceso += 1;
    if (row.consultante === "nueva" || row.consultante === "frecuente") clients[row.consultante] += 1;
    else clients.sin_dato += 1;

    const seen = new Set();
    for (const raw of String(row.lecturas || "").split(",")) {
      const name = raw.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      readings.set(name, (readings.get(name) || 0) + 1);
    }
  }

  const lecturas = [...readings.entries()]
    .map(([nombre, count]) => ({ nombre, total: count }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));

  return json({ total, lecturas, consultantes: clients, estados: states });
}

function normalizeGranularity(value) {
  const raw = String(value || "mes").toLowerCase();
  if (raw === "año" || raw === "anio" || raw === "year" || raw === "anual") return "año";
  if (raw === "semana" || raw === "week" || raw === "semanal") return "semana";
  return "mes";
}

function amountFromText(value) {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

// El total cobrado manda; si la consulta no lo tiene, sumamos el desglose de precios.
function consultaAmount(row) {
  const total = row ? row.total : null;
  if (total !== null && total !== undefined && total !== "") {
    const parsed = Number(total);
    if (Number.isFinite(parsed)) return parsed;
  }
  return String(row && row.precios ? row.precios : "")
    .split(",")
    .reduce((sum, part) => sum + amountFromText(part), 0);
}

function periodRange(fecha, granularidad) {
  const [year, month, day] = fecha.split("-").map(Number);
  if (granularidad === "año") {
    return { inicio: `${fecha.slice(0, 4)}-01-01`, fin: `${fecha.slice(0, 4)}-12-31` };
  }
  if (granularidad === "mes") {
    const prefix = fecha.slice(0, 7);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { inicio: `${prefix}-01`, fin: `${prefix}-${String(lastDay).padStart(2, "0")}` };
  }
  // Semana que empieza en lunes.
  const date = new Date(Date.UTC(year, month - 1, day));
  const offset = (date.getUTCDay() + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - offset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { inicio: start.toISOString().slice(0, 10), fin: end.toISOString().slice(0, 10) };
}

const roundMoney = (value) => Math.round(value * 100) / 100;

async function statsIngresos(db, params) {
  const granularidad = normalizeGranularity(params.get("granularidad"));
  const result = await db.prepare("SELECT fecha, total, precios FROM consultas").all();
  const periodos = new Map();
  let total = 0;
  let consultas = 0;

  for (const row of result.results || []) {
    if (typeof row.fecha !== "string" || !isRealDate(row.fecha)) continue;
    const amount = consultaAmount(row);
    const { inicio, fin } = periodRange(row.fecha, granularidad);
    if (!periodos.has(inicio)) periodos.set(inicio, { inicio, fin, ingresos: 0, consultas: 0 });
    const bucket = periodos.get(inicio);
    bucket.ingresos += amount;
    bucket.consultas += 1;
    total += amount;
    consultas += 1;
  }

  const lista = [...periodos.values()]
    .map((bucket) => ({
      ...bucket,
      ingresos: roundMoney(bucket.ingresos),
      promedio: bucket.consultas ? roundMoney(bucket.ingresos / bucket.consultas) : 0,
    }))
    .sort((left, right) => left.inicio.localeCompare(right.inicio));

  return json({
    granularidad,
    periodos: lista,
    total: roundMoney(total),
    consultas,
    promedio_consulta: consultas ? roundMoney(total / consultas) : 0,
  });
}

export async function handleAdmin(request, env) {
  const user = await verifyAccess(request, env);
  if (!user) return json({ error: "No autorizado" }, 401);

  const url = new URL(request.url);
  if (request.method !== "GET" && request.headers.get("Origin") !== url.origin) {
    return json({ error: "Origen no permitido" }, 403);
  }
  const path = url.pathname.replace(/\/+$/, "");
  try {
    if (request.method === "GET" && path === "/api/admin/me") return json({ email: user.email });
    if (request.method === "GET" && path === "/api/admin/consultas") {
      return await listConsultas(env.DB, url.searchParams);
    }
    if (request.method === "GET" && path === "/api/admin/estadisticas") {
      return await statsConsultas(env.DB, url.searchParams);
    }
    if (request.method === "GET" && path === "/api/admin/ingresos") {
      return await statsIngresos(env.DB, url.searchParams);
    }
    if (request.method === "GET" && path === "/api/admin/availability") {
      const month = url.searchParams.get("month") || "";
      if (!MONTH_RE.test(month)) return json({ error: "Mes inválido" }, 400);
      return json({ month, days: await readMonth(env.DB, month) });
    }
    const ruleMatch = path.match(/^\/api\/admin\/availability\/(\d{4}-\d{2}-\d{2})$/);
    if (ruleMatch && request.method === "PUT") {
      return await saveAvailability(request, env, user.email, ruleMatch[1]);
    }
    if (ruleMatch && request.method === "DELETE") {
      return await resetAvailability(env, user.email, ruleMatch[1]);
    }
    const stateMatch = path.match(/^\/api\/admin\/consultas\/(\d+)\/estado$/);
    if (stateMatch && request.method === "PUT") {
      return await updateConsultaState(request, env, user.email, stateMatch[1]);
    }
    return json({ error: "No encontrado" }, 404);
  } catch (error) {
    console.error("Error en API administrativa:", error);
    return json({ error: "Error interno del panel" }, 500);
  }
}
