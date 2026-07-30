// ── core/navigation.js — Motor de navegación entre pasos ──

function goStep(n) {
  const brandHeader = document.getElementById('brandHeader');
  const progressBar = document.getElementById('progressBar');

  if (n === 0) {
    brandHeader.classList.add('hidden');
    progressBar.classList.add('hidden');
  } else {
    brandHeader.classList.remove('hidden');
    progressBar.classList.remove('hidden');
    state.nombre = document.getElementById('inpName').value.trim();
    state.contacto = document.getElementById('inpContact').value.trim();
    state.detalle = document.getElementById('inpDetalle').value.trim();
    state.fecha = document.getElementById('inpDate').value;
    updateDateRestrictions();
  }

  // Step 1: adapt for returning users
  if (n === 1) {
    const extras = document.getElementById('contactExtras');
    const subtitle = document.getElementById('contactSubtitle');
    if (state.esConsultanteNueva === false) {
      extras.classList.add('hidden');
      subtitle.textContent = 'solo necesito tu nombre';
    } else {
      extras.classList.remove('hidden');
      subtitle.textContent = '¿Cómo puedo comunicarme contigo?';
    }
  }

  // Validations
  if (n === 2 && !validateStep2()) return;
  if (n === 3 && !validateStep3()) return;
  if (n === 4) {
    if (!state.fecha) return showNotification('Selecciona una fecha');
    if (!state.horario) return showNotification('Selecciona un horario');
    if (!state.pago) return showNotification('Selecciona un método de pago');
    if (!validateStep4Payment()) return;
    buildReceipt();
  }

  // Hide all steps
  [0,1,2,3,4].forEach(i => {
    const el = document.getElementById('step' + i);
    if (el) { el.classList.add('hidden'); el.classList.remove('fade-in'); }
  });
  const target = document.getElementById('step' + n);
  target.classList.remove('hidden');
  void target.offsetWidth;
  target.classList.add('fade-in');

  // Update progress dots
  if (n >= 1) {
    for (let i = 1; i <= 4; i++) {
      const dot = document.getElementById('dot' + i);
      dot.classList.toggle('bg-accent', i <= n);
      dot.classList.toggle('bg-gray-300', i > n);
      if (i < 4) {
        const bar = document.getElementById('bar' + i);
        bar.classList.toggle('bg-accent', i < n);
        bar.classList.toggle('bg-gray-300', i >= n);
      }
    }
  }

  // Reset step4 panels
  if (n === 4) {
    document.getElementById('preConfirmBtns').classList.remove('hidden');
    document.getElementById('loadingPanel').classList.add('hidden');
    document.getElementById('optionsPanel').classList.add('hidden');
    document.getElementById('successPanel').classList.add('hidden');
    document.getElementById('consentCheck').checked = false;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => lucide.createIcons(), 50);
}