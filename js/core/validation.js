// ── core/validation.js — Validaciones por paso ──

function validateStep2() {
  if (!state.nombre) return showNotification('Ingresa tu nombre');
  if (state.esConsultanteNueva !== false) {
    if (!state.platform) return showNotification('Selecciona una plataforma');
    if (!state.contacto) return showNotification('Ingresa tu contacto');
  }
  return true;
}

function validateStep3() {
  if (Object.keys(state.readings).length === 0) return showNotification('Selecciona al menos una lectura');
  return true;
}

function validateStep4Payment() {
  state.payRef = state.pago === 'Pago Móvil'
    ? (document.getElementById('payRefPM')?.value || '').trim()
    : (document.getElementById('payRefBinance')?.value || '').trim();
  state.payEmail = (document.getElementById('payEmailBinance')?.value || '').trim();
  state.payBanco = document.getElementById('payBancoDestino')?.value || '';
  state.payTelefono = (document.getElementById('payTelefono')?.value || '').trim();
  state.payRefPayPal = (document.getElementById('payRefPayPal')?.value || '').trim();

  if (state.pago === 'Binance USDT') {
    if (!state.payRef) return showNotification('Ingresa el número de referencia de Binance');
    if (!state.payEmail) return showNotification('Ingresa el correo electrónico de quien pagó');
  }
  if (state.pago === 'Pago Móvil') {
    if (!state.payBanco) return showNotification('Selecciona el banco destino');
    if (!state.payTelefono) return showNotification('Ingresa el número de teléfono');
    if (!state.payRef) return showNotification('Ingresa el número de referencia');
  }
  if (state.pago === 'PayPal') {
    if (!state.payRefPayPal) return showNotification('Ingresa el número de referencia de PayPal');
  }
  return true;
}