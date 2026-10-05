// ── core/validation.js — Validaciones por paso ──

function syncPaymentDetailsFromForm() {
  const payRefBinance = document.getElementById('payRefBinance');
  const payEmailBinance = document.getElementById('payEmailBinance');
  const payBancoDestino = document.getElementById('payBancoDestino');
  const payTelefono = document.getElementById('payTelefono');
  const payRefPM = document.getElementById('payRefPM');
  const payRefPayPal = document.getElementById('payRefPayPal');

  state.payRef = (payRefBinance && payRefBinance.value.trim())
    || (payRefPM && payRefPM.value.trim())
    || (payRefPayPal && payRefPayPal.value.trim())
    || state.payRef;
  state.payEmail = (payEmailBinance && payEmailBinance.value.trim()) || state.payEmail;
  state.payBanco = (payBancoDestino && payBancoDestino.value.trim()) || state.payBanco;
  state.payTelefono = (payTelefono && payTelefono.value.trim()) || state.payTelefono;
  state.payRefPayPal = (payRefPayPal && payRefPayPal.value.trim()) || state.payRefPayPal;
  return true;
}

// Validación del paso de contacto (nombre, plataforma, contacto)
function validateContact() {
  if (!state.nombre) return showNotification('ingresa tu nombre');
  if (state.esConsultanteNueva !== false) {
    if (!state.platform) return showNotification('selecciona una plataforma');
    if (!state.contacto) return showNotification('ingresa tu contacto');
  }
  return true;
}

// Validación del paso de lecturas (al menos una lectura seleccionada)
function validateReadings() {
  if (Object.keys(state.readings).length === 0) return showNotification('selecciona al menos una lectura');
  return true;
}

// Las referencias de pago ya no se solicitan (el panel de detalle está oculto),
// por eso solo se valida que se haya elegido un método de pago.
function validateStep4Payment() {
  if (!state.pago) return showNotification('selecciona un método de pago');
  return true;
}