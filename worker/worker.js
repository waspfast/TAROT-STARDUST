// ===== Stardust Tarot Worker =====
// - GET /disponibilidad?from&to : disponibilidad (contadores diarios + agenda por horarios)
// - POST / : reserva horario + cupo ATOMICOS y notifica a Telegram
//   (si el POST no trae "inicio", se reserva solo por contadores: clientes con HTML en cache)
//
// Cupo: usa D1 (SQLite) para reservar SIN Durable Objects.
// Si el binding "DB" aun no existe, cae a KV (NO atomico, sin agenda por horarios).
//
// Modelo de cupos (4 contadores por dia):
//   corta_normal / corta_emergencia / extensa_normal / extensa_emergencia
// Desde 2026-10-12:
//   cortas:   6 normal + 5 emergencia por dia
//   extensas: 3 normal + 0 emergencia por dia
// Antes de 2026-10-12 (transicion): normal <= 6, emergencia <= 6 (extensa bloqueada)
//
// Agenda por horarios (tabla "slots"):
//   rejilla de bloques de 30 min de 10:00 a 18:00 (inicios 10:00 ... 17:30)
//   corta = 25 min (1 bloque) · extensa = 35 min (2 bloques)
//   una emergencia puede solaparse con UNA normal; nunca con otra emergencia
//   una normal no puede entrar si el bloque ya tiene cualquier reserva

const TRANSICION_FECHA = "2026-10-12";

// ── Rejilla de horarios ──────────────────────────────────────────────
const SLOT_STEP_MIN = 30;
const SLOT_INICIO_MIN = 10 * 60;   // 10:00
const SLOT_FIN_MIN = 18 * 60;      // 18:00 (fin de la ultima lectura)
const DURACION_CORTA_MIN = 25;
const DURACION_EXTENSA_MIN = 35;


const LIMITES_NUEVO = {
  normal:     { corta: 6, extensa: 3 },
  emergencia: { corta: 5, extensa: 0 },
};

const LIMITES_ANTERIOR = {
  normal:     { corta: 6, extensa: 0 },
  emergencia: { corta: 6, extensa: 0 },
};

// Dias sin cupo (agotados): fechas que el backend rechaza aunque llegue un POST directo.
const DIAS_AGOTADOS = [
  "2026-09-30", "2026-10-01", "2026-10-02",
  "2026-10-23", "2026-10-26", "2026-10-29", "2026-10-30",
  "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27",
  "2026-12-04", "2026-12-09", "2026-12-10", "2026-12-11",
];

// Limites por fecha: sobrescriben los limites generales solo en esos dias.
const LIMITES_ESPECIALES = {
  // domingo: solo 2 extensas de emergencia (sin normal, sin cortas)
  "2026-11-29": { normal: { corta: 0, extensa: 0 }, emergencia: { corta: 0, extensa: 2 } },
  // domingo: 3 cortas normal + 3 cortas de emergencia
  "2026-12-06": { normal: { corta: 3, extensa: 0 }, emergencia: { corta: 3, extensa: 0 } },
  // lunes: 2 cortas + 1 extensa normal + 3 cortas de emergencia
  "2026-12-07": { normal: { corta: 2, extensa: 1 }, emergencia: { corta: 3, extensa: 0 } },
  // martes: 3 cortas normal + 3 cortas de emergencia
  "2026-12-08": { normal: { corta: 3, extensa: 0 }, emergencia: { corta: 3, extensa: 0 } },
  // sabado: solo cortas normales
  "2026-12-12": { normal: { corta: 6, extensa: 0 }, emergencia: { corta: 0, extensa: 0 } },
  // domingo: solo cortas normales
  "2026-12-13": { normal: { corta: 6, extensa: 0 }, emergencia: { corta: 0, extensa: 0 } },
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS_HEADERS),
  });
}

function dateKey(iso) {
  return "booking:" + iso;
}

function useD1(env) {
  return !!env.DB;
}

// Columnas que toca una reserva segun su modalidad.
function columnas(esEmergencia) {
  if (esEmergencia) return { corta: "corta_emergencia", extensa: "extensa_emergencia" };
  return { corta: "corta_normal", extensa: "extensa_normal" };
}

// Limites vigentes segun la fecha de la reserva.
function limitesPara(fecha) {
  if (LIMITES_ESPECIALES[fecha]) return LIMITES_ESPECIALES[fecha];
  return fecha >= TRANSICION_FECHA ? LIMITES_NUEVO : LIMITES_ANTERIOR;
}

const CONTEO_VACIO = { corta_normal: 0, corta_emergencia: 0, extensa_normal: 0, extensa_emergencia: 0 };

// ── Rejilla de horarios: utilidades ──────────────────────────────────
function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function toHhmm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

// Inicios validos de la rejilla: 10:00, 10:30, ... 17:30
function inicioValido(minutes) {
  return (
    Number.isFinite(minutes) &&
    minutes >= SLOT_INICIO_MIN &&
    minutes < SLOT_FIN_MIN &&
    (minutes - SLOT_INICIO_MIN) % SLOT_STEP_MIN === 0
  );
}

// Bloques de 30 min que ocupa una lectura (25 min -> 1, 35 min -> 2)
function bloquesDe(inicioMin, duracion) {
  const n = Math.max(1, Math.ceil(duracion / SLOT_STEP_MIN));
  const bloques = [];
  for (let i = 0; i < n; i++) bloques.push(toHhmm(inicioMin + i * SLOT_STEP_MIN));
  return bloques;
}

// Un error de la PK o del trigger significa "ese horario ya esta tomado".
function esConflictoDeSlot(err) {
  const msg = String((err && err.message) || err || "");
  return msg.indexOf("HORARIO_OCUPADO") !== -1 || msg.indexOf("UNIQUE constraint failed") !== -1;
}


async function getCounts(env, iso) {
  if (useD1(env)) {
    const row = await env.DB.prepare(
      "SELECT corta_normal, corta_emergencia, extensa_normal, extensa_emergencia FROM reservas WHERE fecha = ?"
    ).bind(iso).first();
    return row || Object.assign({}, CONTEO_VACIO);
  }
  if (!env.BOOKINGS) return Object.assign({}, CONTEO_VACIO);
  const raw = await env.BOOKINGS.get(dateKey(iso));
  return raw ? JSON.parse(raw) : Object.assign({}, CONTEO_VACIO);
}

// Reserva el cupo (corta y/o extensa) de forma atomica.
// Devuelve true si hay cupo, false si AGENDA_LLENA.
async function reservarCupo(env, fecha, esEmergencia, cortas, extensas) {
  const cols = columnas(esEmergencia);
  const lim = limitesPara(fecha)[esEmergencia ? "emergencia" : "normal"];

  // Una sola reserva no puede exceder el limite de su tipo.
  if (cortas > lim.corta || extensas > lim.extensa) return false;

  if (useD1(env)) {
    const colCorta = cols.corta;
    const colExtensa = cols.extensa;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await env.DB.prepare(`
          INSERT INTO reservas (fecha, ${colCorta}, ${colExtensa}) VALUES (?, ?, ?)
          ON CONFLICT(fecha) DO UPDATE SET
            ${colCorta} = ${colCorta} + excluded.${colCorta},
            ${colExtensa} = ${colExtensa} + excluded.${colExtensa}
          WHERE ${colCorta} + excluded.${colCorta} <= ?
            AND ${colExtensa} + excluded.${colExtensa} <= ?
        `).bind(fecha, cortas, extensas, lim.corta, lim.extensa).run();
        return (res.meta && res.meta.changes) > 0;
      } catch (err) {
        // "database is locked" (SQLITE_BUSY) -> reintenta
        if (i === 2) throw err;
        await new Promise((r) => setTimeout(r, 25 * (i + 1)));
      }
    }
    return false;
  }

  // Respaldo KV (NO atomico).
  const counts = await getCounts(env, fecha);
  const cCorta = Number(counts[cols.corta]) || 0;
  const cExtensa = Number(counts[cols.extensa]) || 0;
  if (cCorta + cortas > lim.corta || cExtensa + extensas > lim.extensa) return false;
  counts[cols.corta] = cCorta + cortas;
  counts[cols.extensa] = cExtensa + extensas;
  await env.BOOKINGS.put(dateKey(fecha), JSON.stringify(counts));
  return true;
}

// ── Agenda por horarios (tabla slots) ────────────────────────────────

// Bloques ocupados entre dos fechas, agrupados por dia y tipo.
// { "2026-12-01": { normal: ["10:00"], emergencia: ["11:30"] } }
async function getSlotsByDay(env, from, to) {
  const out = {};
  if (!useD1(env) || !from || !to) return out;
  try {
    const res = await env.DB.prepare(
      "SELECT fecha, inicio, tipo FROM slots WHERE fecha >= ? AND fecha <= ? ORDER BY fecha, inicio"
    ).bind(from, to).all();
    (res.results || []).forEach((row) => {
      const dia = out[row.fecha] || (out[row.fecha] = { normal: [], emergencia: [] });
      const clave = row.tipo === "emergencia" ? "emergencia" : "normal";
      if (dia[clave].indexOf(row.inicio) === -1) dia[clave].push(row.inicio);
    });
  } catch (err) {
    // Si la tabla "slots" aun no existe, la agenda por horarios queda vacia.
    console.error("No se pudieron leer los slots:", err.message);
  }
  return out;
}

// Filas que ocupan algunos de los bloques pedidos (de cualquier tipo).
async function slotsOcupados(env, fecha, bloques) {
  if (!useD1(env) || !bloques.length) return [];
  const marcas = bloques.map(() => "?").join(", ");
  const res = await env.DB.prepare(
    `SELECT inicio, tipo FROM slots WHERE fecha = ? AND inicio IN (${marcas})`
  ).bind(fecha, ...bloques).all();
  return res.results || [];
}

// Reserva los bloques de una lectura de forma atomica.
// Devuelve false si el horario ya esta tomado (HORARIO_OCUPADO).
async function reservarSlot(env, fecha, tipo, bloques) {
  if (!useD1(env)) return true; // sin D1 no hay agenda por horarios
  if (!bloques.length) return false;

  // Una reserva normal no convive con nada: si hay cualquier fila, se rechaza.
  // (La emergencia solo choca con otra emergencia; eso lo corta la PK.)
  if (tipo === "normal") {
    const ocupados = await slotsOcupados(env, fecha, bloques);
    if (ocupados.length > 0) return false;
  }

  const stmts = bloques.map((bloque) =>
    env.DB.prepare("INSERT INTO slots (fecha, inicio, tipo) VALUES (?, ?, ?)").bind(fecha, bloque, tipo)
  );

  for (let i = 0; i < 3; i++) {
    try {
      // batch = una sola transaccion: entra la lectura completa o no entra nada
      await env.DB.batch(stmts);
      return true;
    } catch (err) {
      if (esConflictoDeSlot(err)) return false;
      if (i === 2) throw err; // "database is locked" (SQLITE_BUSY) -> reintenta
      await new Promise((r) => setTimeout(r, 25 * (i + 1)));
    }
  }
  return false;
}

// Deshace una reserva de horario (se usa si el cupo diario ya estaba lleno).
async function liberarSlot(env, fecha, tipo, bloques) {
  if (!useD1(env) || !bloques.length) return;
  try {
    const marcas = bloques.map(() => "?").join(", ");
    await env.DB.prepare(
      `DELETE FROM slots WHERE fecha = ? AND tipo = ? AND inicio IN (${marcas})`
    ).bind(fecha, tipo, ...bloques).run();
  } catch (err) {
    console.error("No se pudo liberar el horario:", err.message);
  }
}

async function handleDisponibilidad(env, url) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const dias = {};

  if (from && to) {
    const start = new Date(from + "T00:00:00Z");
    const end = new Date(to + "T00:00:00Z");
    const total = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    const slotsPorDia = await getSlotsByDay(env, from, to);

    for (let i = 0; i < total; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const dia = await getCounts(env, iso);
      // Bloques ocupados del dia, separados por tipo de reserva.
      dia.slots = slotsPorDia[iso] || { normal: [], emergencia: [] };
      dias[iso] = dia;
    }
  }

  return json({
    limites: {
      nuevo: LIMITES_NUEVO,
      anterior: LIMITES_ANTERIOR,
      transicion: TRANSICION_FECHA,
    },
    dias: dias,
  });
}

async function enviarTelegram(env, data, esEmergencia) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  const mensaje = [
    "✦ ·· nueva reserva confirmada ·· ✦",
    "",
    "- - - - - - - - - - - - - - - - - - ",
    `🤍  consultante  ·  ${data.usuario || "-"}`,
    `🌙  contacto     ·  ${data.plataforma || "-"} — ${data.contacto || "-"}`,
    "",
    "- - - - - - - - - - - - - - - - - - ",
    `🗓️  fecha        ·  ${data.fecha || "-"}`,
    `⏱️  horario      ·  ${data.horario || "-"}`,
    "",
    "- - - - - - - - - - - - - - - - - - ",
    `🃏  lecturas     ·  ${data.lecturas || "-"}`,
    `🪷  método pago  ·  ${data.metodo_pago || "-"}`,
    `💫  total        ·  ${data.total || "-"}`,
    "",
    "- - - - - - - - - - - - - - - - - - ",
    esEmergencia ? `⚡  emergencia   ·  Sí` : "",
    data.detalle ? `✉️  detalle      ·  ${data.detalle}` : "",
    data.banco ? `🏦  banco        ·  ${data.banco}` : "",
    data.telefono ? `📞  teléfono     ·  ${data.telefono}` : "",
    data.ref_pago_movil ? `🧾  ref p. móvil ·  ${data.ref_pago_movil}` : "",
    data.ref_binance ? `🪙  ref binance  ·  ${data.ref_binance}` : "",
    data.email_pagador ? `📧  email pago   ·  ${data.email_pagador}` : "",
    data.ref_paypal ? `💳  ref paypal   ·  ${data.ref_paypal}` : "",
    "",
    "·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·",
    "✦  revisa el panel para gestionar  ✦",
  ]
    .filter(Boolean)
    .join("\n");

  const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: mensaje }),
    });
  } catch (err) {
    console.error("Error enviando a Telegram:", err);
  }
}

async function handleReserva(env, request) {
  let data = {};
  try {
    data = await request.json();
  } catch (e) {}

  const fecha = data.fecha;
  const esEmergencia = data.es_emergencia === true || data.tipo === "emergencia";
  const tipo = esEmergencia ? "emergencia" : "normal";

  if (!fecha || typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return json({ error: "FECHA_INVALIDA" }, 400);
  }

  if (DIAS_AGOTADOS.includes(fecha)) {
    return json({ error: "AGENDA_LLENA", fecha: fecha, bloqueado: true }, 409);
  }

  // Cantidad de lecturas cortas y extensas de la reserva (por defecto: 1 corta).
  let cortas = Number(data.cortas);
  let extensas = Number(data.extensas);
  if (!Number.isFinite(cortas) || cortas < 0) cortas = 1;
  if (!Number.isFinite(extensas) || extensas < 0) extensas = 0;
  if (cortas === 0 && extensas === 0) cortas = 1;

  // ── Horario (rejilla de bloques de 30 min) ──
  // "inicio" viene siempre del flujo nuevo. Si un cliente viejo (HTML en caché)
  // no lo manda, se mantiene la reserva por contadores para no romper la compra.
  let duracion = Number(data.duracion);
  if (!Number.isFinite(duracion) || duracion <= 0) {
    duracion = extensas > 0 ? DURACION_EXTENSA_MIN : DURACION_CORTA_MIN;
  }

  let inicio = null;
  let bloques = [];
  const sinHorario = data.inicio === undefined || data.inicio === null || data.inicio === "";
  if (!sinHorario) {
    const inicioMin = toMinutes(data.inicio);
    if (!inicioValido(inicioMin) || inicioMin + duracion > SLOT_FIN_MIN) {
      return json({ error: "HORARIO_INVALIDO", inicio: data.inicio }, 400);
    }
    inicio = toHhmm(inicioMin);
    bloques = bloquesDe(inicioMin, duracion);

    // 1) Horario: atomico. Si ya esta tomado, no se toca ningun contador.
    const slotOk = await reservarSlot(env, fecha, tipo, bloques);
    if (!slotOk) {
      return json({ error: "HORARIO_OCUPADO", fecha: fecha, inicio: inicio, tipo: tipo }, 409);
    }
  }

  // 2) Cupo diario: si el dia ya llego a su limite, se libera el horario.
  const reservado = await reservarCupo(env, fecha, esEmergencia, cortas, extensas);
  if (!reservado) {
    await liberarSlot(env, fecha, tipo, bloques);
    return json({
      error: "AGENDA_LLENA",
      tipo: tipo,
      fecha: fecha,
    }, 409);
  }

  // Envía el mensaje detallado a Telegram
  await enviarTelegram(env, data, esEmergencia);

  return json({ success: true, ok: true, inicio: inicio, duracion: duracion, tipo: tipo });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/disponibilidad") {
      return handleDisponibilidad(env, url);
    }

    if (request.method === "POST") {
      try {
        return await handleReserva(env, request);
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    return json({ error: "Método no permitido" }, 405);
  },
};