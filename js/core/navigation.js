// ── core/navigation.js — Motor de navegación entre pasos ──

function getCurrentStep() {
  for (let i = 0; i <= 4; i++) {
    const el = document.getElementById('step' + i);
    if (el && !el.classList.contains('hidden')) return i;
  }
  return -1;
}

function goStep(n) {
  // ── Save state from inputs ──
  const brandHeader = document.getElementById('brandHeader');
  const progressBar = document.getElementById('progressBar');
  if (n !== 0) {
    brandHeader.classList.remove('hidden');
    progressBar.classList.remove('hidden');
    state.nombre = document.getElementById('inpName').value.trim();
    state.contacto = document.getElementById('inpContact').value.trim();
    state.detalle = document.getElementById('inpDetalle').value.trim();
    state.fecha = document.getElementById('inpDate').value;
    updateDateRestrictions();
  } else {
    brandHeader.classList.add('hidden');
    progressBar.classList.add('hidden');
  }

  // ── Step 1: adapt for returning users ──
  if (n === 1) {
    const inputGroup = document.getElementById('contactInputGroup');
    const subtitle = document.getElementById('contactSubtitle');
    if (state.esConsultanteNueva === false) {
      inputGroup.classList.add('hidden');
      subtitle.textContent = 'para identificar tu reserva necesito tu nombre y cómo contactarte';
    } else {
      inputGroup.classList.remove('hidden');
      subtitle.textContent = '¿Cómo puedo comunicarme contigo?';
    }
  }

  // ── Validations (must happen before animation) ──
  if (n === 2 && !validateStep2()) return;
  if (n === 3 && !validateStep3()) return;
  if (n === 4) {
    if (!state.fecha) return showNotification('Selecciona una fecha');
    if (!state.horario) return showNotification('Selecciona un horario');
    if (!state.pago) return showNotification('Selecciona un método de pago');
    if (!validateStep4Payment()) return;
    buildReceipt();
  }

  // ── Animate transition: fade out → fade in ──
  const current = getCurrentStep();
  const currentEl = document.getElementById('step' + current);
  const targetEl = document.getElementById('step' + n);

  if (current === n) return; // same step, no animation

  function showTarget() {
    // Hide all steps
    for (let i = 0; i <= 4; i++) {
      const el = document.getElementById('step' + i);
      if (el) {
        el.classList.add('hidden');
        el.classList.remove('fade-in', 'fade-out');
      }
    }
    // Show target
    targetEl.classList.remove('hidden');
    void targetEl.offsetWidth; // force reflow to restart animation
    targetEl.classList.add('fade-in');

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

  // If current step exists, fade it out first
  if (currentEl && !currentEl.classList.contains('hidden')) {
    currentEl.classList.remove('fade-in');
    void currentEl.offsetWidth;
    currentEl.classList.add('fade-out');
    setTimeout(showTarget, 200);
  } else {
    showTarget();
  }
}