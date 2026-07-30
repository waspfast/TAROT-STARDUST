// ── actions/download.js — Descarga de imagen del recibo ──

function downloadImage() {
  const receipt = document.getElementById('receiptCard');
  if (!receipt) return;
  receipt.style.border = 'none';
  html2canvas(receipt, { backgroundColor: '#faf6f2', scale: 2 }).then(canvas => {
    receipt.style.border = '';
    const link = document.createElement('a');
    link.download = 'recibo-stardust-tarot.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showNotification('Imagen descargada');
  }).catch(err => {
    receipt.style.border = '';
    console.error(err);
    showNotification('Error al generar la imagen');
  });
}