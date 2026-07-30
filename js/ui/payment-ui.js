// ── ui/payment-ui.js — Toggle de paneles de detalle de pago ──

const PAYMENT_DETAIL_MAP = {
  'Binance USDT': 'detalleBinance',
  'Pago Móvil': 'detallePagoMovil',
  'PayPal': 'detallePayPal',
  'Tarjeta Internacional': 'detalleTarjeta'
};

function togglePaymentDetail(metodo) {
  const panel = document.getElementById('paymentDetailsPanel');
  const allDetails = document.querySelectorAll('.payment-detail');
  const targetId = PAYMENT_DETAIL_MAP[metodo];
  if (!targetId) { panel.classList.add('hidden'); return; }
  const target = document.getElementById(targetId);
  const isSame = target.classList.contains('open');
  allDetails.forEach(d => { d.classList.remove('open'); d.classList.add('hidden'); });
  if (isSame) {
    panel.classList.add('hidden');
  } else {
    panel.classList.remove('hidden');
    target.classList.remove('hidden');
    target.classList.add('open');
  }
}