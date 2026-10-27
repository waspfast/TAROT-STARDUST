// ── app.js — Punto de entrada: inicializa la aplicación ──
lucide.createIcons();
updateDateRestrictions();
renderCategorySubtitles();
renderBookingReadingList();
if (typeof renderSlotSelect === 'function') renderSlotSelect();
lucide.createIcons();
goStep(0);
