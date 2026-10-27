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

function markBooked(iso, isEmergency) {
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
}