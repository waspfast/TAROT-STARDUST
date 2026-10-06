// ── actions/notify.js — Envío al Cloudflare Worker ──

function getReceiptDataForNotification() {
  const lecturas = Object.keys(state.readings).length
    ? Object.keys(state.readings).map(key => readingNames[key] || key).join(', ')
    : 'Sin lectura seleccionada';

  let cortas = 0, extensas = 0;
  Object.keys(state.readings).forEach(function (key) {
    const r = readingsCatalog.find(function (x) { return x.id === key; });
    if (r) { if (r.durationMin >= 20) extensas++; else cortas++; }
  });

  const payRefInput = document.getElementById('payRefBinance') || document.getElementById('payRefPM') || document.getElementById('payRefPayPal');
  const payEmailInput = document.getElementById('payEmailBinance');
  const payBancoInput = document.getElementById('payBancoDestino');
  const payTelefonoInput = document.getElementById('payTelefono');
  const payRefPayPalInput = document.getElementById('payRefPayPal');

  if (payRefInput && payRefInput.value.trim()) state.payRef = payRefInput.value.trim();
  if (payEmailInput && payEmailInput.value.trim()) state.payEmail = payEmailInput.value.trim();
  if (payBancoInput && payBancoInput.value.trim()) state.payBanco = payBancoInput.value.trim();
  if (payTelefonoInput && payTelefonoInput.value.trim()) state.payTelefono = payTelefonoInput.value.trim();
  if (payRefPayPalInput && payRefPayPalInput.value.trim()) state.payRefPayPal = payRefPayPalInput.value.trim();

  const pagoInfo = {};
  if (state.pago === 'Binance USDT') {
    pagoInfo.ref_binance = state.payRef;
    pagoInfo.email_pagador = state.payEmail;
  }
  if (state.pago === 'Pago Móvil') {
    pagoInfo.banco = state.payBanco;
    pagoInfo.telefono = state.payTelefono;
    pagoInfo.ref_pago_movil = state.payRef;
  }
  if (state.pago === 'PayPal') pagoInfo.ref_paypal = state.payRefPayPal;
  return {
    usuario: state.nombre || 'Sin nombre',
    plataforma: state.platform || 'Sin plataforma',
    contacto: state.contacto || 'Sin contacto',
    fecha: state.fecha || 'Sin fecha',
    horario: state.horario || 'Sin horario',
    metodo_pago: state.pago || 'Sin método',
    total: `$${calcTotal().toFixed(2)}`,
    lecturas, detalle: state.detalle || 'Sin detalle',
    emergencia: state.emergency ? 'Sí' : 'No',
    es_emergencia: !!state.emergency,
    cortas: cortas, extensas: extensas,
    ...pagoInfo
  };
}

async function enviarNotificacionRecibo() {
  try {
    const datosRecibo = getReceiptDataForNotification();
    console.log('Enviando al worker:', datosRecibo);
    const response = await fetch(WORKER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosRecibo)
    });
    const text = await response.text();
    console.log('Status del worker:', response.status);
    console.log('Respuesta del worker:', text);
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) {}
    if (!response.ok) {
      if (data.error !== 'AGENDA_LLENA') console.error('Worker respondió con error:', data);
      return { ok: false, error: data.error };
    }
    return { ok: true };
  } catch (err) {
    console.error('Error enviando notificación:', err);
    return { ok: false };
  }
}

async function confirmReceipt() {
  if (!document.getElementById('consentCheck').checked) {
    return showNotification('acepta las condiciones para continuar');
  }
  document.getElementById('preConfirmBtns').classList.add('hidden');
  document.getElementById('loadingPanel').classList.remove('hidden');
  const resultado = await enviarNotificacionRecibo();
  document.getElementById('loadingPanel').classList.add('hidden');
  if (!resultado.ok) {
    document.getElementById('preConfirmBtns').classList.remove('hidden');
    if (resultado.error === 'AGENDA_LLENA') {
      return showNotification('La agenda ya está llena para la fecha que elegiste. Elige otro día disponible.');
    }
    return showNotification('no se pudo enviar la confirmación. intenta de nuevo.');
  }
  if (typeof markBooked === 'function') markBooked(state.fecha, !!state.emergency);
  document.getElementById('confirmHint').classList.remove('hidden');
  document.getElementById('successPanel').classList.remove('hidden');
  document.getElementById('successPanel').classList.add('fade-in');
}