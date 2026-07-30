// ── core/router.js — Entradas principales: bienvenida, reset ──

function welcomeAction(tipo) {
  state.esConsultanteNueva = (tipo === 'nueva');
  goStep(1);
}

function showOptionsAgain() {
  document.getElementById('successPanel').classList.add('hidden');
  document.getElementById('optionsPanel').classList.remove('hidden');
  document.getElementById('confirmHint').classList.remove('hidden');
}

function resetForm() {
  state.esConsultanteNueva = null;
  state.platform = ''; state.contacto = ''; state.nombre = '';
  state.readings = {}; state.emergency = false;
  state.fecha = ''; state.horario = ''; state.pago = ''; state.detalle = '';
  state.readingCategory = '';
  state.payRef = ''; state.payEmail = ''; state.payBanco = ''; state.payTelefono = ''; state.payRefPayPal = '';

  document.getElementById('inpName').value = '';
  document.getElementById('inpContact').value = '';
  document.getElementById('inpDetalle').value = '';
  document.getElementById('inpDate').value = '';
  document.getElementById('platformHint').textContent = '';
  document.getElementById('inpContact').placeholder = 'Selecciona una plataforma arriba';

  // Reset payment detail fields
  ['payRefBinance','payEmailBinance','payBancoDestino','payTelefono','payRefPayPal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Reset payment select
  const payBanco = document.getElementById('payBancoDestino');
  if (payBanco) payBanco.value = '';

  const panel = document.getElementById('paymentDetailsPanel');
  if (panel) panel.classList.add('hidden');
  document.querySelectorAll('.payment-detail').forEach(d => { d.classList.remove('open'); d.classList.add('hidden'); });

  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.category-btn').forEach(c => c.classList.remove('active'));
  backToCategories();
  updateSelectedReadingsSummary();
  const t = document.getElementById('emergencyToggle');
  t.classList.remove('on'); t.classList.add('off');
  goStep(0);
}