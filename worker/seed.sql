-- ===== Stardust Tarot -- migracion de citas ya hechas (KV -> D1) =====
-- El contador de D1 arranca en 0 al conectar la base. Este archivo carga las
-- reservas que ya existian para no perderlas.
--
-- Ejecutar DESPUES de crear la tabla (schema.sql):
--   npx wrangler d1 execute stardust-db --remote --file=./seed.sql
--
-- Notas:
--  - La mayoria de las reservas guardadas como "emergencia" en KV eran
--    normales; para el 2026-10-05 se confirmaron 8 emergencias y 1 normal.
--  - El 2026-10-05 excede el tope de 6 emergencias; queda lleno para ese tipo.
--  - Las fechas 2030-01-01 / 2030-01-02 se omiten (datos de prueba).
--  - Se usa INSERT OR IGNORE para poder re-ejecutar sin duplicar ni sobrescribir.

INSERT OR IGNORE INTO reservas (fecha, normal, emergencia) VALUES
  ('2026-10-02', 1, 0),
  ('2026-10-05', 1, 8),
  ('2026-10-06', 4, 0),
  ('2026-10-09', 1, 0),
  ('2026-10-12', 1, 0);
