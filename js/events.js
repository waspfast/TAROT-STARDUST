// ── events.js — Todos los event listeners DOM ──

// Category buttons
document.querySelectorAll('.category-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showReadingCategory(btn.dataset.category);
  });
});
document.getElementById('backToCategories').addEventListener('click', backToCategories);

// Platform chips
document.querySelectorAll('[data-platform]').forEach(c => {
  c.addEventListener('click', () => {
    document.querySelectorAll('[data-platform]').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    state.platform = c.dataset.platform;
    document.getElementById('platformHint').textContent = platformHints[state.platform] || '';
    document.getElementById('inpContact').placeholder = platformHints[state.platform] || '';
  });
});

// Horario chips
document.querySelectorAll('.horario-chip').forEach(c => {
  c.addEventListener('click', () => {
    document.querySelectorAll('.horario-chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    state.horario = c.dataset.horario;
  });
});

// Pago chips
document.querySelectorAll('.pago-chip').forEach(c => {
  c.addEventListener('click', () => {
    document.querySelectorAll('.pago-chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    state.pago = c.dataset.pago;
    togglePaymentDetail(state.pago);
  });
});