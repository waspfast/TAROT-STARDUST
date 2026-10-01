// ===== Stardust Tarot Worker =====
// - GET /disponibilidad?from=YYYY-MM-DD&to=YYYY-MM-DD : consulta disponibilidad en el KV
// - POST / : guarda el cupo en el KV y notifica a Telegram

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

async function getCounts(env, iso) {
  if (!env.BOOKINGS) return { normal: 0, emergencia: 0 };
  const raw = await env.BOOKINGS.get(dateKey(iso));
  return raw ? JSON.parse(raw) : { normal: 0, emergencia: 0 };
}

async function setCounts(env, iso, counts) {
  if (!env.BOOKINGS) return;
  await env.BOOKINGS.put(dateKey(iso), JSON.stringify(counts));
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

async function enviarTelegram(env, data) {
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
    data.emergencia || data.es_emergencia ? `⚡  emergencia   ·  ${data.emergencia || "Sí"}` : "",
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
  const esEmergencia = data.es_emergencia === true || Boolean(data.emergencia);

  // Actualiza los cupos en KV si la fecha es válida
  if (fecha && typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const counts = await getCounts(env, fecha);
    if (esEmergencia) {
      counts.emergencia = (counts.emergencia || 0) + 1;
    } else {
      counts.normal = (counts.normal || 0) + 1;
    }
    await setCounts(env, fecha, counts);
  }

  // Envía el mensaje detallado a Telegram
  await enviarTelegram(env, data);

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