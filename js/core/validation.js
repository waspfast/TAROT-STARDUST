// ── core/validation.js — Validaciones por paso ──

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

function validateStep4Payment() {
  return true;
}