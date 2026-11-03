// ===== Stardust Tarot — núcleo de reservas =====
// Utilidades compartidas por la reserva pública (worker.js) y la reserva
// manual del panel (admin.js): cupos diarios atómicos en D1 y agenda por
// bloques de 30 minutos.
//
// Modelo de cupos (4 contadores por día):
//   corta_normal / corta_emergencia / extensa_normal / extensa_emergencia
//
// Agenda (tabla "slots"):
//   corta = 25 min (1 bloque) · extensa = 35 min (2 bloques)
//   una emergencia puede solaparse con UNA normal; nunca con otra emergencia
//   una normal no puede entrar si el bloque ya tiene cualquier reserva

export const SLOT_STEP_MIN = 30;
export const DURACION_CORTA_MIN = 25;
export const DURACION_EXTENSA_MIN = 35;

function dateKey(iso) {
  return "booking:" + iso;
}

export function useD1(env) {
  return !!env.DB;
}

// Columnas que toca una reserva segun su modalidad.
function columnas(esEmergencia) {
  if (esEmergencia) return { corta: "corta_emergencia", extensa: "extensa_emergencia" };
  return { corta: "corta_normal", extensa: "extensa_normal" };
}

// Limites vigentes en la regla semanal o excepcion de la fecha.
function limitesPara(rule) {
  return {
    normal: { corta: rule.corta_normal, extensa: rule.extensa_normal },
    emergencia: { corta: rule.corta_emergencia, extensa: rule.extensa_emergencia },
  };
}

export const CONTEO_VACIO = { corta_normal: 0, corta_emergencia: 0, extensa_normal: 0, extensa_emergencia: 0 };

// ── Rejilla de horarios: utilidades ──────────────────────────────────
export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function toHhmm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

// Ventana horaria definida para la fecha.
export function ventanaDe(rule) {
  return { inicioMin: toMinutes(rule.inicio), finMin: toMinutes(rule.fin) };
}

// Inicios validos dentro de la ventana del dia: 10:00, 10:30, ... 17:30
// (o 10:30, 11:00, ... 14:30 en los dias con ventana especial).
export function inicioValido(minutes, rule) {
  const ventana = ventanaDe(rule);
  return (
    Number.isFinite(minutes) &&
    minutes >= ventana.inicioMin &&
    minutes < ventana.finMin &&
    (minutes - ventana.inicioMin) % SLOT_STEP_MIN === 0
  );
}

// Bloques de 30 min que ocupa una lectura (25 min -> 1, 35 min -> 2)
export function bloquesDe(inicioMin, duracion) {
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

export async function getCounts(env, iso) {
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
export async function reservarCupo(env, fecha, esEmergencia, cortas, extensas, rule) {
  const cols = columnas(esEmergencia);
  const lim = limitesPara(rule)[esEmergencia ? "emergencia" : "normal"];

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
export async function getSlotsByDay(env, from, to) {
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
export async function reservarSlot(env, fecha, tipo, bloques) {
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
export async function liberarSlot(env, fecha, tipo, bloques) {
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
