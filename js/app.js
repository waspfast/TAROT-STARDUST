// ── app.js — Punto de entrada: inicializa la aplicación ──
lucide.createIcons();
updateDateRestrictions();
renderCategorySubtitles();
renderBookingReadingList();
if (typeof renderSlotGrid === 'function') renderSlotGrid();
lucide.createIcons();
goStep(0);
