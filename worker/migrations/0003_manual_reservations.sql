-- Reserva manual desde el panel administrativo.
-- Ejecutar una sola vez después de hacer una copia de seguridad de D1:
--   npx wrangler d1 execute stardust-db --remote --file=migrations/0003_manual_reservations.sql
--
-- canal        : whatsapp | correo | telegram | discord (NULL en reservas públicas)
-- lectura_tipo : corta | extensa (NULL en reservas públicas)
-- origen       : publico (web) | manual (panel)

ALTER TABLE consultas ADD COLUMN canal TEXT;

ALTER TABLE consultas ADD COLUMN lectura_tipo TEXT;

ALTER TABLE consultas ADD COLUMN origen TEXT NOT NULL DEFAULT 'publico';

CREATE INDEX IF NOT EXISTS idx_consultas_origen ON consultas (origen, fecha);
