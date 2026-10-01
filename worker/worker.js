// ===== Stardust Tarot Worker =====
// - GET /disponibilidad?from&to : consulta disponibilidad
// - POST / : reserva cupo ATOMICO y notifica a Telegram
//
// Cupo: usa D1 (SQLite) para reservar SIN Durable Objects.
// Si el binding "DB" aun no existe, cae a KV (NO atomico) para no romper el deploy.

const MAX_NORMAL = 6;
const MAX_EMERGENCIA = 6;

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

const COLS = { normal: "normal", emergencia: "emergencia" };

async function getCounts(env, iso) {
  if (useD1(env)) {
    const row = await env.DB.prepare(
      "SELECT normal, emergencia FROM reservas WHERE fecha = ?"
    ).bind(iso).first();
    return row || { normal: 0, emergencia: 0 };
  }
  if (!env.BOOKINGS) return { normal: 0, emergencia: 0 };
  const raw = await env.BOOKINGS.get(dateKey(iso));
  return raw ? JSON.parse(raw) : { normal: 0, emergencia: 0 };
}

// Reserva el cupo de forma atomica (D1) o con respaldo KV.
// Devuelve true si hay cupo, false si AGENDA_LLENA.
async function reservarCupo(env, fecha, tipo) {
  const col = COLS[tipo];
  const limite = tipo === "emergencia" ? MAX_EMERGENCIA : MAX_NORMAL;

  if (useD1(env)) {
    // Una sola sentencia: inserta o incrementa SOLO si aun hay cupo.
    // SQLite serializa las escrituras, asi que dos reservas simultaneas
    // no pueden pasar ambas el guard "col < limite".
    for (let i = 0; i < 3; i++) {
      try {
        const res = await env.DB.prepare(`
          INSERT INTO reservas (fecha, ${col}) VALUES (?, 1)
          ON CONFLICT(fecha) DO UPDATE SET ${col} = ${col} + 1
          WHERE ${col} < ?
        `).bind(fecha, limite).run();
        return (res.meta && res.meta.changes) > 0;
      } catch (err) {
        // "database is locked" (SQLITE_BUSY) -> reintenta
        if (i === 2) throw err;
        await new Promise((r) => setTimeout(r, 25 * (i + 1)));
      }
    }
  }

  // Respaldo KV (NO atomico): logica anterior.
  const counts = await getCounts(env, fecha);
  const ocupados = Number(counts[tipo]) || 0;
  if (ocupados >= limite) return false;
  counts[tipo] = ocupados + 1;
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
    limites: { normal: MAX_NORMAL, emergencia: MAX_EMERGENCIA },
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
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
      }),
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

  const tipo = esEmergencia ? "emergencia" : "normal";

  const reservado = await reservarCupo(env, fecha, tipo);
  if (!reservado) {
    return json({
      error: "AGENDA_LLENA",
      tipo: tipo,
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