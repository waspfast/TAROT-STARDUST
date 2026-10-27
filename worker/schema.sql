-- ===== Stardust Tarot -- esquema D1 =====
-- Seguro de re-ejecutar: solo crea lo que falta, NUNCA borra reservas existentes.
--
-- Aplicar en produccion (desde la carpeta worker/):
--   npx wrangler d1 execute stardust-db --remote --file=schema.sql
--
-- Tablas:
--   1) reservas -> 4 contadores diarios (limite de lecturas por dia)
--   2) slots    -> agenda por bloques de 30 min (10:00 - 18:00)

-- ── 1) Contadores diarios ────────────────────────────────────────────
-- Limites (desde 2026-10-12):
--   cortas:   6 normal + 5 emergencia por dia
--   extensas: 3 normal + 0 emergencia por dia
-- Antes de 2026-10-12: normal <= 6, emergencia <= 6 (extensa bloqueada).
CREATE TABLE IF NOT EXISTS reservas (
  fecha              TEXT    PRIMARY KEY,   -- YYYY-MM-DD
  corta_normal       INTEGER NOT NULL DEFAULT 0,
  corta_emergencia   INTEGER NOT NULL DEFAULT 0,
  extensa_normal     INTEGER NOT NULL DEFAULT 0,
  extensa_emergencia INTEGER NOT NULL DEFAULT 0
);

-- ── 2) Agenda por horarios ───────────────────────────────────────────
-- Un bloque = 30 minutos, de 10:00 a 18:00 (inicios validos: 10:00 ... 17:30).
-- Cada lectura ocupa 1 bloque (25 min) o 2 bloques (35 min); se guarda una fila
-- por cada bloque que ocupa, con el tipo de reserva:
--   'normal'     -> lectura agendada en la ventana normal
--   'emergencia' -> lectura de emergencia (puede solaparse con una normal)
--
-- Reglas (garantizadas por la PK + el trigger de abajo):
--   * maximo 1 normal y 1 emergencia por bloque (nunca 2 del mismo tipo)
--   * una emergencia puede entrar sobre un bloque ocupado por una normal
--   * una normal NO puede entrar si el bloque ya tiene cualquier reserva
CREATE TABLE IF NOT EXISTS slots (
  fecha  TEXT NOT NULL,   -- YYYY-MM-DD
  inicio TEXT NOT NULL,   -- HH:MM (inicio del bloque)
  tipo   TEXT NOT NULL,   -- 'normal' | 'emergencia'
  PRIMARY KEY (fecha, inicio, tipo)
);

CREATE INDEX IF NOT EXISTS idx_slots_fecha ON slots (fecha, inicio);

-- Bloquea una reserva normal cuando el mismo bloque ya tiene una emergencia.
-- (Los casos normal-vs-normal y emergencia-vs-emergencia ya los corta la PK.)
CREATE TRIGGER IF NOT EXISTS slots_normal_sin_emergencia
BEFORE INSERT ON slots
WHEN NEW.tipo = 'normal'
  AND EXISTS (
    SELECT 1 FROM slots
    WHERE fecha = NEW.fecha AND inicio = NEW.inicio AND tipo = 'emergencia'
  )
BEGIN
  SELECT RAISE(ABORT, 'HORARIO_OCUPADO');
END;