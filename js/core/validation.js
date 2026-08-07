// ── core/validation.js — Validaciones por paso ──

// Validación del paso de contacto (nombre, plataforma, contacto)
function validateContact() {
  if (!state.nombre) return showNotification('Ingresa tu nombre');
  if (state.esConsultanteNueva !== false) {
    if (!state.platform) return showNotification('Selecciona una plataforma');
    if (!state.contacto) return showNotification('Ingresa tu contacto');
  }
  return true;
}

// Validación del paso de lecturas (al menos una lectura seleccionada)
function validateReadings() {
  if (Object.keys(state.readings).length === 0) return showNotification('Selecciona al menos una lectura');
  return true;
}

function validateStep4Payment() {
  return true;
}