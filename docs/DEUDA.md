# Deuda conocida

- Las 4 lecturas extensas que la reconciliación de la migración 0006 dedujo por heurística ("bloque +30 min" cuando la ficha no decía corta/extensa) son las consultas **42** (2026-11-05), **67** y **70** (2026-11-10) y **45** (2026-11-11): la duración guardada es 35 min, pero el dato original no lo confirmaba; si alguna era corta, su cupo quedó contado como extensa.
- Cancelar una consulta **no** dispara ningún efecto secundario: no hay reembolso ni nota de crédito, no se avisa al cliente (ni por correo ni por WhatsApp/Telegram) y el **motivo** de la cancelación no se guarda en ningún sitio.
- La auditoría (`admin_audit`) sólo registra el cambio de estado y si el cupo se liberó o se volvió a ocupar; no hay historial consultable desde el panel ni borrado/restauración de consultas canceladas.
