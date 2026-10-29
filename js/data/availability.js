// data/availability.js - reglas y reservas servidas desde D1 por el Worker.

var _availability = {};

// Las fechas sin regla cargada se consideran cerradas.
function isOpenWeekend(iso) {
  return !!(_availability[iso] && _availability[iso].is_open);
}

// ¿La fecha tiene cupo de emergencia fuera de la ventana normal?
function isSpecialEmergencyDate(iso) {
  return !!(_availability[iso] && _availability[iso].emergencia_extendida);
}

async function fetchAvailability(fromIso, toIso) {
  try {
    var base = (typeof WORKER_URL === 'string' ? WORKER_URL : '').replace(/\/+$/, '');
    var url = base + '/disponibilidad?from=' + encodeURIComponent(fromIso) + '&to=' + encodeURIComponent(toIso);
    var res = await fetch(url);
    if (!res.ok) {
      console.error('El Worker respondió con error al consultar disponibilidad:', res.status);
      return false;
    }
    var data = await res.json();
    if (data && data.dias) {
      Object.keys(data.dias).forEach(function (k) { _availability[k] = data.dias[k]; });
    }
    return true;
  } catch (e) {
    console.error('No se pudo cargar la disponibilidad:', e);
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
    if (!res.ok) {
      console.error('El Worker respondió con error al consultar los horarios:', res.status);
      return false;
    }
    var data = await res.json();
    var dia = data && data.dias ? data.dias[iso] : null;
    if (dia) _availability[iso] = Object.assign({}, _availability[iso] || {}, dia);
    return true;
  } catch (e) {
    console.error('No se pudieron cargar los horarios del día:', e);
    return false;
  }
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
  var limits = c.limits || {};
  var cortaNormal = c.corta_normal || 0;
  var cortaEmerg = c.corta_emergencia || 0;
  var extensaNormal = c.extensa_normal || 0;
  var extensaEmerg = c.extensa_emergencia || 0;

  if (!c.is_open) {
    return {
      corta_normal: cortaNormal, corta_emergencia: cortaEmerg,
      extensa_normal: extensaNormal, extensa_emergencia: extensaEmerg,
      normalLeft: 0, emergenciaLeft: 0, full: true
    };
  }

  var sel = _tiposSeleccion();
  var normalLeft = Math.min(
    sel.corta ? Math.max(0, (limits.corta_normal || 0) - cortaNormal) : Infinity,
    sel.extensa ? Math.max(0, (limits.extensa_normal || 0) - extensaNormal) : Infinity
  );
  var emergenciaLeft = Math.min(
    sel.corta ? Math.max(0, (limits.corta_emergencia || 0) - cortaEmerg) : Infinity,
    sel.extensa ? Math.max(0, (limits.extensa_emergencia || 0) - extensaEmerg) : Infinity
  );
  if (!isFinite(normalLeft)) normalLeft = 0;
  if (!isFinite(emergenciaLeft)) emergenciaLeft = 0;

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

// Ventana horaria definida en D1 para la fecha.
function ventanaDe(fecha) {
  var day = _availability[fecha] || {};
  return { inicioMin: slotToMinutes(day.inicio), finMin: slotToMinutes(day.fin) };
}

// Todos los inicios posibles de la rejilla: 10:00, 10:30, ... 17:30
// (o los de la ventana especial del dia, ej. 10:30 ... 14:30)
function grillaHorarios(fecha) {
  var ventana = ventanaDe(fecha);
  var out = [];
  for (var m = ventana.inicioMin; m < ventana.finMin; m += SLOT_STEP_MIN) out.push(slotToHhmm(m));
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
//   'no-cabe'    -> la lectura no termina dentro de la ventana del dia
function horariosDisponibles(fecha, duracion, ocupados) {
  var dur = duracion || totalReadingDuration();
  var occ = ocupados || getOcupadosDia(fecha);
  var lista = [];

  grillaHorarios(fecha).forEach(function (inicio) {
    var inicioMin = slotToMinutes(inicio);
    var estado = 'libre';

    if (inicioMin + dur > ventanaDe(fecha).finMin) {
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
