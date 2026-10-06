// ===== Stardust Tarot Worker =====
// - GET /disponibilidad?from&to : consulta disponibilidad (4 contadores)
// - POST / : reserva cupo ATOMICO y notifica a Telegram
//
// Cupo: usa D1 (SQLite) para reservar SIN Durable Objects.
// Si el binding "DB" aun no existe, cae a KV (NO atomico).
//
// Modelo de cupos (4 contadores por dia):
//   corta_normal / corta_emergencia / extensa_normal / extensa_emergencia
// Desde 2026-10-12:
//   cortas:   6 normal + 5 emergencia por dia
//   extensas: 3 normal + 1 emergencia por dia
// Antes de 2026-10-12 (transicion): normal <= 6, emergencia <= 6 (extensa bloqueada)

const TRANSICION_FECHA = "2026-10-12";

const LIMITES_NUEVO = {
  normal:     { corta: 6, extensa: 3 },
  emergencia: { corta: 5, extensa: 1 },
};

const LIMITES_ANTERIOR = {
  normal:     { corta: 6, extensa: 0 },
  emergencia: { corta: 6, extensa: 0 },
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
  return fecha >= TRANSICION_FECHA ? LIMITES_NUEVO : LIMITES_ANTERIOR;
}

const CONTEO_VACIO = { corta_normal: 0, corta_emergencia: 0, extensa_normal: 0, extensa_emergencia: 0 };

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

async function handleDisponibilidad(env, url) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const dias = {};

  if (from && to) {
    const start = new Date(from + "T00:00:00Z");
    const end = new Date(to + "T00:00:00Z");
    const total = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

    for (let i = 0; i < total; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      dias[iso] = await getCounts(env, iso);
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
  const esEmergencia = data.es_emergencia === true;

  if (!fecha || typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return json({ error: "FECHA_INVALIDA" }, 400);
  }

  // Cantidad de lecturas cortas y extensas de la reserva (por defecto: 1 corta).
  let cortas = Number(data.cortas);
  let extensas = Number(data.extensas);
  if (!Number.isFinite(cortas) || cortas < 0) cortas = 1;
  if (!Number.isFinite(extensas) || extensas < 0) extensas = 0;
  if (cortas === 0 && extensas === 0) cortas = 1;

  const reservado = await reservarCupo(env, fecha, esEmergencia, cortas, extensas);
  if (!reservado) {
    return json({
      error: "AGENDA_LLENA",
      tipo: esEmergencia ? "emergencia" : "normal",
      fecha: fecha,
    }, 409);
  }

  // Envía el mensaje detallado a Telegram
  await enviarTelegram(env, data, esEmergencia);

  return json({ success: true, ok: true });
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