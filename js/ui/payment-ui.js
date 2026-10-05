// ── ui/payment-ui.js — Toggle de paneles de detalle de pago ──

const PAYMENT_DETAIL_MAP = {
  'Binance USDT': 'detalleBinance',
  'Pago Móvil': 'detallePagoMovil',
  'PayPal': 'detallePayPal',
  'Tarjeta Internacional': 'detalleTarjeta'
};

// Panel de detalle de pago deshabilitado: ya no se solicitan referencias de pago.
// Se mantiene la función para no romper las llamadas existentes, pero siempre
// deja el panel oculto (no se despliega ningún submenú al elegir un método).
function togglePaymentDetail() {
  const panel = document.getElementById('paymentDetailsPanel');
  if (panel) panel.classList.add('hidden');
  document.querySelectorAll('.payment-detail').forEach(d => {
    d.classList.remove('open');
    d.classList.add('hidden');
  });
}