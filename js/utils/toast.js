// ── utils/toast.js — Sistema de notificaciones emergentes ──

function showNotification(msg) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast-enter bg-white card-shadow rounded-xl px-4 py-3 text-sm text-txt flex items-center gap-2 max-w-xs';
  toast.innerHTML = `<i data-lucide="info" class="w-4 h-4 text-accent flex-shrink-0"></i>${msg}`;
  container.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}