-- ===== Stardust Tarot -- esquema D1 (cupo diario) =====
-- Respalda la reserva ATOMICA del cupo diario (sin Durable Objects).
--
-- Crear la tabla (una sola vez):
--   npx wrangler d1 execute stardust-db --remote --file=./schema.sql
--
-- Que hace la atomicidad: el worker ejecuta
--   INSERT INTO reservas (fecha, <tipo>) VALUES (?, 1)
--   ON CONFLICT(fecha) DO UPDATE SET <tipo> = <tipo> + 1
--   WHERE <tipo> < <limite>;
-- SQLite serializa las escrituras, asi que dos reservas simultaneas no
-- pueden pasar ambas el guard y el cupo nunca se excede.

CREATE TABLE IF NOT EXISTS reservas (
  fecha      TEXT    PRIMARY KEY,            -- YYYY-MM-DD
  normal     INTEGER NOT NULL DEFAULT 0,     -- reservas normales  (max 6)
  emergencia INTEGER NOT NULL DEFAULT 0      -- reservas emergencia (max 6)
);
