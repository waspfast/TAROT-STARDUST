// ── actions/notify.js — Envío al Cloudflare Worker ──

function getReceiptDataForNotification() {
  const lecturas = Object.keys(state.readings).length
    ? Object.keys(state.readings).map(key => readingNames[key] || key).join(', ')
    : 'Sin lectura seleccionada';
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
    if (!response.ok) { console.error('Worker respondió con error:', data); return false; }
    return true;
  } catch (err) {
    console.error('Error enviando notificación:', err);
    return false;
  }
}

async function confirmReceipt() {
  if (!document.getElementById('consentCheck').checked) {
    return showNotification('Acepta las condiciones para continuar');
  }
  document.getElementById('preConfirmBtns').classList.add('hidden');
  document.getElementById('loadingPanel').classList.remove('hidden');
  const ok = await enviarNotificacionRecibo();
  document.getElementById('loadingPanel').classList.add('hidden');
  if (!ok) {
    document.getElementById('preConfirmBtns').classList.remove('hidden');
    return showNotification('No se pudo enviar la confirmación. Intenta de nuevo.');
  }
  document.getElementById('confirmHint').classList.remove('hidden');
  document.getElementById('successPanel').classList.remove('hidden');
  document.getElementById('successPanel').classList.add('fade-in');
}