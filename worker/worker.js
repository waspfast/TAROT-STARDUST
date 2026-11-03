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
//   rejilla de bloques de 30 min; la jornada se define en las reglas de D1
//   corta = 25 min (1 bloque) · extensa = 35 min (2 bloques)
//   una emergencia puede solaparse con UNA normal; nunca con otra emergencia
//   una normal no puede entrar si el bloque ya tiene cualquier reserva

import { getDayRule, handleAdmin } from "./admin.js";
import { verifyAccess } from "./access.js";
import {
  DURACION_CORTA_MIN,
  DURACION_EXTENSA_MIN,
  bloquesDe,
  getCounts,
  getSlotsByDay,
  inicioValido,
  liberarSlot,
  reservarCupo,
  reservarSlot,
  toHhmm,
  toMinutes,
  useD1,
  ventanaDe,
} from "./booking.js";

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

// ── Detalle de la consulta (tabla consultas) ─────────────────────────
// Guarda nombre, telefono, lecturas y precios de la reserva. Es solo un
// registro historico: si la tabla aun no existe, la reserva no se ve afectada.
function montoNumerico(valor) {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const limpio = String(valor == null ? "" : valor).replace(/[^0-9.]/g, "");
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? n : null;
}

async function registrarConsulta(env, fecha, tipo, inicio, data) {
  if (!useD1(env)) return;

  const nombre = data.nombre || data.usuario || null;
  const telefono = data.contacto || null;
  // Solo los precios, separados por coma (ej. "7.5" o "7.5, 22").
  let precios = null;
  if (typeof data.precios === "string" && data.precios.trim()) {
    precios = data.precios.trim();
  } else if (Array.isArray(data.precios)) {
    // Compatibilidad con clientes que aun envian [{ id, nombre, precio }].
    precios = data.precios
      .map(function (p) { return p && typeof p === "object" ? p.precio : p; })
      .filter(function (p) { return p !== null && p !== undefined && p !== ""; })
      .join(", ") || null;
  }
  const consultante =
    data.consultante_nueva === true ? "nueva"
    : data.consultante_nueva === false ? "frecuente"
    : null;

  try {
    await env.DB.prepare(
      `INSERT INTO consultas
        (fecha, tipo, inicio, consultante, nombre, telefono, lecturas, precios, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      fecha,
      tipo,
      inicio,
      consultante,
      nombre,
      telefono,
      data.lecturas || null,
      precios,
      montoNumerico(data.total)
    ).run();
  } catch (err) {
    console.error("No se pudo registrar la consulta:", err.message);
  }
}

async function handleDisponibilidad(env, url) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const dias = {};

  if (from && to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return json({ error: "Rango de fechas inválido" }, 400);
    }
    const start = new Date(from + "T00:00:00Z");
    const end = new Date(to + "T00:00:00Z");
    const total = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    if (!Number.isFinite(total) || total < 1 || total > 62) {
      return json({ error: "El rango debe contener entre 1 y 62 días" }, 400);
    }
    const slotsPorDia = await getSlotsByDay(env, from, to);

    for (let i = 0; i < total; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const dia = await getCounts(env, iso);
      const rule = await getDayRule(env.DB, iso);
      // Bloques ocupados del dia, separados por tipo de reserva.
      dia.slots = slotsPorDia[iso] || { normal: [], emergencia: [] };
      dia.is_open = rule.is_open;
      dia.inicio = rule.inicio;
      dia.fin = rule.fin;
      dia.emergencia_extendida = rule.emergencia_extendida;
      dia.limits = {
        corta_normal: rule.corta_normal,
        corta_emergencia: rule.corta_emergencia,
        extensa_normal: rule.extensa_normal,
        extensa_emergencia: rule.extensa_emergencia,
      };
      dias[iso] = dia;
    }
  }

  return json({ dias: dias });
}

async function enviarTelegram(env, data, esEmergencia) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  const mensaje = [
    "✦ ·· nueva reserva confirmada ·· ✦",
    "",
    "- - - - - - - - - - - - - - - - - - ",
    `🤍  consultante  ·  ${data.usuario || "-"}${data.consultante_nueva === true ? " (nueva)" : data.consultante_nueva === false ? " (frecuente)" : ""}`,
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

  const parsedDate = typeof fecha === "string" ? new Date(`${fecha}T00:00:00Z`) : null;
  if (!fecha || typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== fecha) {
    return json({ error: "FECHA_INVALIDA" }, 400);
  }

  const rule = await getDayRule(env.DB, fecha);
  if (!rule.is_open) {
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
    const ventana = ventanaDe(rule);
    if (!inicioValido(inicioMin, rule) || inicioMin + duracion > ventana.finMin) {
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
  const reservado = await reservarCupo(env, fecha, esEmergencia, cortas, extensas, rule);
  if (!reservado) {
    await liberarSlot(env, fecha, tipo, bloques);
    return json({
      error: "AGENDA_LLENA",
      tipo: tipo,
      fecha: fecha,
    }, 409);
  }

  // 3) Registro historico del detalle (consultante, nombre, telefono, precios).
  await registrarConsulta(env, fecha, tipo, inicio, data);

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

    if (url.pathname.startsWith("/api/admin/")) {
      return handleAdmin(request, env);
    }

    if (request.method === "GET" && url.pathname === "/disponibilidad") {
      try {
        return await handleDisponibilidad(env, url);
      } catch (err) {
        console.error("Error leyendo disponibilidad:", err);
        return json({ error: "No se pudo consultar la disponibilidad" }, 500);
      }
    }

    if (request.method === "POST") {
      try {
        return await handleReserva(env, request);
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    if ((request.method === "GET" || request.method === "HEAD") && env.ASSETS) {
      if (!await verifyAccess(request, env)) return json({ error: "No autorizado" }, 401);
      return env.ASSETS.fetch(request);
    }

    return json({ error: "Método no permitido" }, 405);
  },
};