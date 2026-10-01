// data/availability.js - Cupos por dia (backend Cloudflare Worker)
var BOOKING_LIMITS = { normal: 6, emergencia: 6 };
// Dias sin cupo (agotados): escribe aqui las fechas "YYYY-MM-DD" que quieras bloquear.
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

function getDayAvailability(iso) {
  var c = _availability[iso];
  var normal = c ? (c.normal || 0) : 0;
  var emergencia = c ? (c.emergencia || 0) : 0;
  if (DIAS_AGOTADOS.indexOf(iso) !== -1) {
    normal = BOOKING_LIMITS.normal;
    emergencia = BOOKING_LIMITS.emergencia;
  }
  var normalLeft = Math.max(0, BOOKING_LIMITS.normal - normal);
  var emergenciaLeft = Math.max(0, BOOKING_LIMITS.emergencia - emergencia);
  return {
    normal: normal,
    emergencia: emergencia,
    normalLeft: normalLeft,
    emergenciaLeft: emergenciaLeft,
    full: normalLeft === 0 && emergenciaLeft === 0
  };
}

function markBooked(iso, isEmergency) {
  var c = _availability[iso] || { normal: 0, emergencia: 0 };
  if (isEmergency) { c.emergencia = (c.emergencia || 0) + 1; }
  else { c.normal = (c.normal || 0) + 1; }
  _availability[iso] = c;
}
