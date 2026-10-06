-- ===== Stardust Tarot -- migracion de citas ya hechas (4 contadores) =====
-- Conteos reales de reservas existentes. Los conteos "normal"/"emergencia"
-- historicos se asignaron a las columnas "corta_*" (lecturas cortas). Si hubo
-- extensas reales en alguna fecha, se corrigen luego.

INSERT OR IGNORE INTO reservas (fecha, corta_normal, corta_emergencia, extensa_normal, extensa_emergencia) VALUES
  ('2026-10-02', 1, 0, 0, 0),
  ('2026-10-05', 9, 6, 0, 0),
  ('2026-10-06', 6, 1, 0, 0),
  ('2026-10-07', 6, 0, 0, 0),
  ('2026-10-08', 6, 0, 0, 0),
  ('2026-10-09', 6, 0, 0, 0),
  ('2026-10-12', 6, 0, 0, 0),
  ('2026-10-13', 6, 0, 0, 0),
  ('2026-10-14', 1, 0, 0, 0),
  ('2026-10-16', 2, 0, 0, 0);