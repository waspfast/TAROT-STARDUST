// ── ui/receipt-ui.js — Construcción del recibo visual y texto ──

function buildReceipt() {
  let html = '';
  const row = (l, v) => `<div class="flex justify-between"><span class="text-txtsoft">${l}</span><span class="font-medium">${v}</span></div>`;
  html += row('nombre', state.nombre);
  html += row('plataforma', state.platform);
  html += row('contacto', state.contacto);
  html += row('fecha', state.fecha);
  html += row('horario', state.horario);
  html += '<div class="border-t border-dashed border-gray-200 my-2"></div>';
  html += '<p class="text-xs text-txtsoft font-medium uppercase tracking-wide mb-1">lecturas</p>';
  for (const [key, price] of Object.entries(state.readings)) {
    html += row(readingNames[key], '$' + price.toFixed(2));
  }
  if (state.emergency) html += row('emergencia', '+$7.00');
  if (state.pago === 'PayPal') html += row('comisión PayPal', '+$2.50');
  html += '<div class="border-t border-dashed border-gray-200 my-2"></div>';
  html += row('método de pago', state.pago);
  if (state.detalle) {
    html += `<div class="mt-2"><span class="text-txtsoft text-xs">detalle:</span><p class="text-sm mt-0.5">${state.detalle}</p></div>`;
  }
  document.getElementById('receiptBody').innerHTML = html;
  document.getElementById('receiptTotal').textContent = '$' + calcTotal().toFixed(2);
}

function generateReceiptText() {
  const line = '─'.repeat(32);
  let t = '';
  t += '       ⊹ ୨ᰔ୧ ⊹\n';
  t += '   The Stardust Tarot\n';
  t += '   comprobante de lectura\n';
  t += line + '\n';
  t += `nombre: ${state.nombre}\n`;
  t += `plataforma: ${state.platform}\n`;
  t += `contacto: ${state.contacto}\n`;
  t += `fecha: ${state.fecha}\n`;
  t += `horario: ${state.horario}\n`;
  t += line + '\n';
  t += 'lecturas:\n';
  for (const [key, price] of Object.entries(state.readings)) {
    t += `  • ${readingNames[key]} — $${price.toFixed(2)}\n`;
  }
  if (state.emergency) t += `  • emergencia — +$7.00\n`;
  if (state.pago === 'PayPal') t += `  • comisión PayPal — +$2.50\n`;
  t += line + '\n';
  t += `método de pago: ${state.pago}\n`;
  if (state.detalle) t += `detalle: ${state.detalle}\n`;
  t += line + '\n';
  t += `TOTAL: $${calcTotal().toFixed(2)}\n`;
  t += '       ⊹ ୨ᰔ୧ ⊹\n';
  return t;
}