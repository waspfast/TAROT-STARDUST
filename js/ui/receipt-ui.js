// ── ui/receipt-ui.js — Construcción del recibo visual y texto ──

function buildReceipt() {
  let html = '';
  const row = (l, v) => `<div class="flex justify-between"><span class="text-txtsoft">${l}</span><span class="font-medium">${v}</span></div>`;
  html += row('Nombre', state.nombre);
  html += row('Plataforma', state.platform.charAt(0).toUpperCase() + state.platform.slice(1));
  html += row('Contacto', state.contacto);
  html += row('Fecha', state.fecha);
  html += row('Horario', state.horario);
  html += '<div class="border-t border-dashed border-gray-200 my-2"></div>';
  html += '<p class="text-xs text-txtsoft font-medium uppercase tracking-wide mb-1">Lecturas</p>';
  for (const [key, price] of Object.entries(state.readings)) {
    html += row(readingNames[key], '$' + price.toFixed(2));
  }
  if (state.emergency) html += row('Emergencia', '+$7.00');
  if (state.pago === 'PayPal') html += row('Comisión PayPal', '+$2.50');
  html += '<div class="border-t border-dashed border-gray-200 my-2"></div>';
  html += row('Método de pago', state.pago);
  if (state.detalle) {
    html += `<div class="mt-2"><span class="text-txtsoft text-xs">Detalle:</span><p class="text-sm mt-0.5">${state.detalle}</p></div>`;
  }
  document.getElementById('receiptBody').innerHTML = html;
  document.getElementById('receiptTotal').textContent = '$' + calcTotal().toFixed(2);
}

function generateReceiptText() {
  const line = '─'.repeat(32);
  let t = '';
  t += '       ⊹ ୨ᰔ୧ ⊹\n';
  t += '   The Stardust Tarot\n';
  t += '   Comprobante de Lectura\n';
  t += line + '\n';
  t += `Nombre: ${state.nombre}\n`;
  t += `Plataforma: ${state.platform}\n`;
  t += `Contacto: ${state.contacto}\n`;
  t += `Fecha: ${state.fecha}\n`;
  t += `Horario: ${state.horario}\n`;
  t += line + '\n';
  t += 'LECTURAS:\n';
  for (const [key, price] of Object.entries(state.readings)) {
    t += `  • ${readingNames[key]} — $${price.toFixed(2)}\n`;
  }
  if (state.emergency) t += `  • Emergencia — +$7.00\n`;
  if (state.pago === 'PayPal') t += `  • Comisión PayPal — +$2.50\n`;
  t += line + '\n';
  t += `Método de pago: ${state.pago}\n`;
  if (state.detalle) t += `Detalle: ${state.detalle}\n`;
  t += line + '\n';
  t += `TOTAL: $${calcTotal().toFixed(2)}\n`;
  t += '       ⊹ ୨ᰔ୧ ⊹\n';
  return t;
}