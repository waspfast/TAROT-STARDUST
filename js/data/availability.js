// data/availability.js - Cupos por dia (backend Cloudflare Worker, 4 contadores)

// Limites del nuevo modelo (desde 2026-10-12)
var BOOKING_LIMITS = {
  corta_normal: 6, corta_emergencia: 5,
  extensa_normal: 3, extensa_emergencia: 1
};
// Limites del modelo anterior (antes de 2026-10-12): normal <= 6, emergencia <= 6
var OLD_LIMITS = { normal: 6, emergencia: 6 };
var TRANSICION_FECHA = '2026-10-12';

// Dias sin cupo (agotados): fechas "YYYY-MM-DD" que quieras bloquear.
var DIAS_AGOTADOS = ['2026-09-30', '2026-10-01', '2026-10-02'];
var _availability = {};

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
    if (r) { if (r.durationMin >= 20) extensa = true; else corta = true; }
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
    var nCorta = sel.corta ? Math.max(0, BOOKING_LIMITS.corta_normal - cortaNormal) : Infinity;
    var nExt = sel.extensa ? Math.max(0, BOOKING_LIMITS.extensa_normal - extensaNormal) : Infinity;
    var eCorta = sel.corta ? Math.max(0, BOOKING_LIMITS.corta_emergencia - cortaEmerg) : Infinity;
    var eExt = sel.extensa ? Math.max(0, BOOKING_LIMITS.extensa_emergencia - extensaEmerg) : Infinity;
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
    if (r) { if (r.durationMin >= 20) extensas++; else cortas++; }
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