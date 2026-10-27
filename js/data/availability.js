// data/availability.js - Cupos por dia (backend Cloudflare Worker, 4 contadores)

// Limites del nuevo modelo (desde 2026-10-12)
var BOOKING_LIMITS = {
  corta_normal: 6, corta_emergencia: 5,
  extensa_normal: 3, extensa_emergencia: 0
};
// Limites del modelo anterior (antes de 2026-10-12): normal <= 6, emergencia <= 6
var OLD_LIMITS = { normal: 6, emergencia: 6 };
var TRANSICION_FECHA = '2026-10-12';

// Dias sin cupo (agotados): fechas "YYYY-MM-DD" que quieras bloquear.
var DIAS_AGOTADOS = [
  '2026-09-30', '2026-10-01', '2026-10-02',
  '2026-10-23', '2026-10-26', '2026-10-29', '2026-10-30',
  '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27',
  '2026-12-04', '2026-12-09', '2026-12-10', '2026-12-11'
];

// Fines de semana abiertos: sabados/domingos que SI se pueden reservar.
var DIAS_FINDE_ABIERTOS = [
  '2026-11-21', '2026-11-22', '2026-11-29',
  '2026-12-06', '2026-12-12', '2026-12-13'
];

// Limites por fecha: sobrescriben BOOKING_LIMITS solo en esos dias.
var LIMITES_ESPECIALES = {
  // domingo: solo 2 extensas de emergencia (sin normal, sin cortas)
  '2026-11-29': { corta_normal: 0, extensa_normal: 0, corta_emergencia: 0, extensa_emergencia: 2 },
  // domingo: 3 cortas normal + 3 cortas de emergencia
  '2026-12-06': { corta_normal: 3, extensa_normal: 0, corta_emergencia: 3, extensa_emergencia: 0 },
  // lunes: 2 cortas + 1 extensa normal + 3 cortas de emergencia
  '2026-12-07': { corta_normal: 2, extensa_normal: 1, corta_emergencia: 3, extensa_emergencia: 0 },
  // martes: 3 cortas normal + 3 cortas de emergencia
  '2026-12-08': { corta_normal: 3, extensa_normal: 0, corta_emergencia: 3, extensa_emergencia: 0 },
  // sabado: solo cortas normales
  '2026-12-12': { corta_normal: 6, extensa_normal: 0, corta_emergencia: 0, extensa_emergencia: 0 },
  // domingo: solo cortas normales
  '2026-12-13': { corta_normal: 6, extensa_normal: 0, corta_emergencia: 0, extensa_emergencia: 0 }
};

var _availability = {};

// ¿Este sabado/domingo esta abierto para reservar?
function isOpenWeekend(iso) {
  return DIAS_FINDE_ABIERTOS.indexOf(iso) !== -1;
}

// ¿La fecha tiene cupo de emergencia fuera de la ventana normal?
function isSpecialEmergencyDate(iso) {
  var lim = LIMITES_ESPECIALES[iso];
  return !!(lim && (lim.corta_emergencia > 0 || lim.extensa_emergencia > 0));
}

async function fetchAvailability(fromIso, toIso) {
  try {
    var base = (typeof WORKER_URL === 'string' ? WORKER_URL : '').replace(/\/+$/, '');
    var url = base + '/disponibilidad?from=' + encodeURIComponent(fromIso) + '&to=' + encodeURIComponent(toIso);
    var res = await fetch(url);
    if (!res.ok) return false;
    var data = await res.json();
    if (data && data.dias) {
      Object.keys(data.dias).forEach(function (k) { _availability[k] = data.dias[k]; });
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Refresca solo un dia (los bloques ocupados cambian a cada rato).
// Mantiene los contadores que ya se tenian si la respuesta no los trae.
async function fetchDaySlots(iso) {
  if (!iso) return false;
  try {
    var base = (typeof WORKER_URL === 'string' ? WORKER_URL : '').replace(/\/+$/, '');
    var url = base + '/disponibilidad?from=' + encodeURIComponent(iso) + '&to=' + encodeURIComponent(iso);
    var res = await fetch(url);
    if (!res.ok) return false;
    var data = await res.json();
    var dia = data && data.dias ? data.dias[iso] : null;
    if (dia) _availability[iso] = Object.assign({}, _availability[iso] || {}, dia);
    return true;
  } catch (e) {
    return false;
  }
}

function _esNuevoModelo(iso) {
  return iso >= TRANSICION_FECHA;
}

// Tipos (corta/extensa) presentes en la seleccion actual.
function _tiposSeleccion() {
  var corta = false, extensa = false;
  var keys = state && state.readings ? Object.keys(state.readings) : [];
  keys.forEach(function (k) {
    var r = readingsCatalog.find(function (x) { return x.id === k; });
    if (r) { if (r.type === 'extensa') extensa = true; else corta = true; }
  });
  if (!corta && !extensa) corta = true; // sin seleccion -> asume corta
  return { corta: corta, extensa: extensa };
}

function getDayAvailability(iso) {
  var c = _availability[iso] || {};
  var cortaNormal = c.corta_normal || 0;
  var cortaEmerg = c.corta_emergencia || 0;
  var extensaNormal = c.extensa_normal || 0;
  var extensaEmerg = c.extensa_emergencia || 0;

  if (DIAS_AGOTADOS.indexOf(iso) !== -1) {
    return {
      corta_normal: cortaNormal, corta_emergencia: cortaEmerg,
      extensa_normal: extensaNormal, extensa_emergencia: extensaEmerg,
      normalLeft: 0, emergenciaLeft: 0, full: true
    };
  }

  var sel = _tiposSeleccion();
  var normalLeft, emergenciaLeft;

  if (_esNuevoModelo(iso)) {
    // Limites por defecto o los especiales de esta fecha.
    var lim = LIMITES_ESPECIALES[iso];
    var limCortaN = lim ? lim.corta_normal : BOOKING_LIMITS.corta_normal;
    var limExtN = lim ? lim.extensa_normal : BOOKING_LIMITS.extensa_normal;
    var limCortaE = lim ? lim.corta_emergencia : BOOKING_LIMITS.corta_emergencia;
    var limExtE = lim ? lim.extensa_emergencia : BOOKING_LIMITS.extensa_emergencia;
    var nCorta = sel.corta ? Math.max(0, limCortaN - cortaNormal) : Infinity;
    var nExt = sel.extensa ? Math.max(0, limExtN - extensaNormal) : Infinity;
    var eCorta = sel.corta ? Math.max(0, limCortaE - cortaEmerg) : Infinity;
    var eExt = sel.extensa ? Math.max(0, limExtE - extensaEmerg) : Infinity;
    normalLeft = Math.min(nCorta, nExt);
    emergenciaLeft = Math.min(eCorta, eExt);
    if (!isFinite(normalLeft)) normalLeft = 0;
    if (!isFinite(emergenciaLeft)) emergenciaLeft = 0;
  } else {
    // modelo anterior: extensa bloqueada, corta hasta 6/6
    normalLeft = Math.max(0, OLD_LIMITS.normal - cortaNormal - extensaNormal);
    emergenciaLeft = Math.max(0, OLD_LIMITS.emergencia - cortaEmerg - extensaEmerg);
  }

  return {
    corta_normal: cortaNormal, corta_emergencia: cortaEmerg,
    extensa_normal: extensaNormal, extensa_emergencia: extensaEmerg,
    normalLeft: normalLeft, emergenciaLeft: emergenciaLeft,
    full: normalLeft <= 0 && emergenciaLeft <= 0
  };
}

function markBooked(iso, isEmergency, inicio, duracion) {
  var c = _availability[iso] || { corta_normal: 0, corta_emergencia: 0, extensa_normal: 0, extensa_emergencia: 0 };
  var cortas = 0, extensas = 0;
  var keys = state && state.readings ? Object.keys(state.readings) : [];
  keys.forEach(function (k) {
    var r = readingsCatalog.find(function (x) { return x.id === k; });
    if (r) { if (r.type === 'extensa') extensas++; else cortas++; }
  });
  if (isEmergency) {
    c.corta_emergencia = (c.corta_emergencia || 0) + cortas;
    c.extensa_emergencia = (c.extensa_emergencia || 0) + extensas;
  } else {
    c.corta_normal = (c.corta_normal || 0) + cortas;
    c.extensa_normal = (c.extensa_normal || 0) + extensas;
  }
  _availability[iso] = c;
  if (inicio) markSlotBooked(iso, inicio, duracion, isEmergency ? 'emergencia' : 'normal');
}

// ── Rejilla de horarios (bloques de 30 min, 10:00 – 18:00) ──────────
// corta   = 25 min -> 1 bloque
// extensa = 35 min -> 2 bloques
// seleccion mixta (corta + extensa) = extensa -> 2 bloques
var SLOT_STEP_MIN = 30;
var SLOT_INICIO_MIN = 10 * 60;   // 10:00
var SLOT_FIN_MIN = 18 * 60;      // 18:00 (fin de la ultima lectura)
var DURACION_CORTA_MIN = 25;
var DURACION_EXTENSA_MIN = 35;

function slotToMinutes(hhmm) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function slotToHhmm(minutes) {
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

// Todos los inicios posibles de la rejilla: 10:00, 10:30, ... 17:30
function grillaHorarios() {
  var out = [];
  for (var m = SLOT_INICIO_MIN; m < SLOT_FIN_MIN; m += SLOT_STEP_MIN) out.push(slotToHhmm(m));
  return out;
}

// Duracion total de la seleccion (mixta cuenta como extensa).
function totalReadingDuration() {
  var keys = state && state.readings ? Object.keys(state.readings) : [];
  if (!keys.length) return DURACION_CORTA_MIN;
  var extensa = false;
  keys.forEach(function (k) {
    var r = readingsCatalog.find(function (x) { return x.id === k; });
    if (r && r.type === 'extensa') extensa = true;
  });
  return extensa ? DURACION_EXTENSA_MIN : DURACION_CORTA_MIN;
}

// Bloques de 30 min que ocupa una lectura (25 min -> 1, 35 min -> 2)
function bloquesDeSlot(inicio, duracion) {
  var inicioMin = slotToMinutes(inicio);
  if (!isFinite(inicioMin)) return [];
  var n = Math.max(1, Math.ceil((duracion || DURACION_CORTA_MIN) / SLOT_STEP_MIN));
  var out = [];
  for (var i = 0; i < n; i++) out.push(slotToHhmm(inicioMin + i * SLOT_STEP_MIN));
  return out;
}

// Bloques ocupados de un dia segun el backend: { normal: [], emergencia: [] }
function getOcupadosDia(iso) {
  var c = (iso && _availability[iso]) || {};
  var s = c.slots || {};
  return {
    normal: Array.isArray(s.normal) ? s.normal : [],
    emergencia: Array.isArray(s.emergencia) ? s.emergencia : []
  };
}

// ¿La hora ya paso? (solo aplica al dia de hoy)
function _slotEsPasado(fecha, inicioMin) {
  var hoy = typeof formatDateValue === 'function' ? formatDateValue(new Date()) : '';
  if (!hoy || fecha !== hoy) return false;
  var ahora = new Date();
  return inicioMin <= ahora.getHours() * 60 + ahora.getMinutes();
}

// Rejilla completa de la fecha con el estado de cada bloque:
//   'libre'      -> se puede elegir
//   'normal'     -> ocupado por una lectura normal (con emergencia: ⚡ disponible)
//   'emergencia' -> ocupado por una emergencia (siempre bloqueado)
//   'pasado'     -> hora ya pasada (hoy)
//   'no-cabe'    -> la lectura no termina antes de las 18:00
function horariosDisponibles(fecha, duracion, ocupados) {
  var dur = duracion || totalReadingDuration();
  var occ = ocupados || getOcupadosDia(fecha);
  var lista = [];

  grillaHorarios().forEach(function (inicio) {
    var inicioMin = slotToMinutes(inicio);
    var estado = 'libre';

    if (inicioMin + dur > SLOT_FIN_MIN) {
      estado = 'no-cabe';
    } else if (_slotEsPasado(fecha, inicioMin)) {
      estado = 'pasado';
    } else {
      var bloques = bloquesDeSlot(inicio, dur);
      var chocaEmergencia = bloques.some(function (b) { return occ.emergencia.indexOf(b) !== -1; });
      var chocaNormal = bloques.some(function (b) { return occ.normal.indexOf(b) !== -1; });
      if (chocaEmergencia) estado = 'emergencia';
      else if (chocaNormal) estado = 'normal';
    }

    lista.push({ inicio: inicio, estado: estado });
  });

  return lista;
}

// Marca el horario recien reservado para no volver a ofrecerlo en esta sesion.
function markSlotBooked(iso, inicio, duracion, tipo) {
  if (!iso || !inicio) return;
  var c = _availability[iso] || (_availability[iso] = {});
  var s = c.slots || (c.slots = { normal: [], emergencia: [] });
  var clave = tipo === 'emergencia' ? 'emergencia' : 'normal';
  if (!Array.isArray(s.normal)) s.normal = [];
  if (!Array.isArray(s.emergencia)) s.emergencia = [];
  bloquesDeSlot(inicio, duracion).forEach(function (b) {
    if (s[clave].indexOf(b) === -1) s[clave].push(b);
  });
}
