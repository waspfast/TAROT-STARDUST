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
    // WhatsApp: acepta cualquier formato/país, pero exige que sea un número (al menos un dígito, sin letras)
    if (state.platform === 'whatsapp' && !(/\d/.test(state.contacto) && !/[a-zA-Z]/.test(state.contacto))) {
      return showNotification('ingresa tu número de teléfono');
    }
  }
  return true;
}

// Validación del paso de lecturas (al menos una lectura seleccionada)
function validateReadings() {
  if (Object.keys(state.readings).length === 0) return showNotification('selecciona al menos una lectura');
  return true;
}

// Validación del detalle de la consulta (obligatorio antes de avanzar)
function validateDetail() {
  if (state.detalle) return true;
  const inp = document.getElementById('inpDetalle');
  const err = document.getElementById('detalleError');
  if (inp) inp.classList.add('border-red-400');
  if (err) err.classList.remove('hidden');
  showNotification('por favor, escribe el contexto de lo que quieres preguntar');
  return false;
}

// Limpia el aviso rojo del detalle cuando la persona empieza a escribir
function clearDetalleError() {
  const inp = document.getElementById('inpDetalle');
  const err = document.getElementById('detalleError');
  if (inp) inp.classList.remove('border-red-400');
  if (err) err.classList.add('hidden');
}

// Las referencias de pago ya no se solicitan (el panel de detalle está oculto),
// por eso solo se valida que se haya elegido un método de pago.
function validateStep4Payment() {
  if (!state.pago) return showNotification('selecciona un método de pago');
  return true;
}