-- ===== Stardust Tarot -- migracion de citas ya hechas (KV -> D1) =====
-- El contador de D1 arranca en 0 al conectar la base. Este archivo carga las
-- reservas que ya existian para no perderlas.
--
-- Ejecutar DESPUES de crear la tabla (schema.sql):
--   npx wrangler d1 execute stardust-db --remote --file=./seed.sql
--
-- Notas:
--  - Las reservas guardadas como "emergencia" en KV en realidad eran normales
--    (el campo se lleno mal), asi que se migran TODAS como normal.
--  - El 2026-10-05 quedo en 9 (excede el tope de 6): el dia aparece lleno para
--    normales, pero sigue con cupo de emergencia.
--  - Las fechas 2030-01-01 / 2030-01-02 se omiten (datos de prueba).
--  - Se usa INSERT OR IGNORE para poder re-ejecutar sin duplicar ni sobrescribir.

INSERT OR IGNORE INTO reservas (fecha, normal, emergencia) VALUES
  ('2026-10-02', 1, 0),
  ('2026-10-05', 9, 0),
  ('2026-10-06', 4, 0),
  ('2026-10-09', 1, 0),
  ('2026-10-12', 1, 0);
