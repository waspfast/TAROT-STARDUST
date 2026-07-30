// ── actions/sharing.js — Compartir recibo por plataforma ──

function sendToContact() {
  const text = encodeURIComponent(generateReceiptText());
  if (state.platform === 'whatsapp') {
    const num = state.contacto.replace(/\D/g, '');
    window.open(`https://wa.me/${num}?text=${text}`, '_blank');
  } else if (state.platform === 'telegram') {
    window.open(`https://t.me/${state.contacto.replace('@','')}?text=${text}`, '_blank');
  } else if (state.platform === 'correo') {
    window.open(`mailto:${state.contacto}?subject=${encodeURIComponent('Recibo Stardust Tarot')}&body=${text}`, '_blank');
  } else if (state.platform === 'discord') {
    navigator.clipboard.writeText(generateReceiptText());
    showNotification('Recibo copiado — pégalo en Discord');
  }
  showNotification('Enviado a tu contacto');
}

function sendToStardust() {
  navigator.clipboard.writeText(generateReceiptText());
  window.open('https://www.instagram.com/thestardust.tarot/', '_blank');
  showNotification('Recibo copiado — pégalo en Instagram');
}

function copyToClipboard() {
  navigator.clipboard.writeText(generateReceiptText());
  showNotification('Recibo copiado al portapapeles');
}