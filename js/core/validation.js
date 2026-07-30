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
  return true;
}
