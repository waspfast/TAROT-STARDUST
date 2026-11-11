-- Ocupación real de cada consulta, para devolver el cupo al cancelarla.
-- Ejecutar una sola vez, después de las migraciones 0002 a 0005:
--   npx wrangler d1 execute stardust-db --local  --file=migrations/0006_consulta_ocupacion.sql
--   npx wrangler d1 execute stardust-db --remote --file=migrations/0006_consulta_ocupacion.sql
--
--   cortas        : lecturas cortas que ocupó la reserva (25 min, 1 bloque)
--   extensas      : lecturas extensas que ocupó la reserva (35 min, 2 bloques)
--   duracion      : minutos de agenda que ocupó (25 o 35)
--   cupo_liberado : 1 cuando la cancelación ya devolvió el cupo del día; evita
--                   liberarlo dos veces si la consulta se reabre y se vuelve a
--                   cancelar.
--
-- Las reservas anteriores a esta migración quedan con NULL: el panel no puede
-- saber si eran cortas o extensas, así que no libera su cupo automáticamente
-- (de esa forma nunca se sobre-reserva el día).

ALTER TABLE consultas ADD COLUMN cortas INTEGER;
ALTER TABLE consultas ADD COLUMN extensas INTEGER;
ALTER TABLE consultas ADD COLUMN duracion INTEGER;
ALTER TABLE consultas ADD COLUMN cupo_liberado INTEGER NOT NULL DEFAULT 0;
