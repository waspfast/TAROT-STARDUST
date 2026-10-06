-- ===== Stardust Tarot -- esquema D1 (cupo diario, 4 contadores) =====
-- Limites (desde 2026-10-12):
--   cortas:   4 normal + 5 emergencia por dia
--   extensas: 3 normal + 1 emergencia por dia
-- Antes de 2026-10-12: normal <= 6, emergencia <= 6 (extensa bloqueada).

DROP TABLE IF EXISTS reservas;

CREATE TABLE reservas (
  fecha              TEXT    PRIMARY KEY,   -- YYYY-MM-DD
  corta_normal       INTEGER NOT NULL DEFAULT 0,
  corta_emergencia   INTEGER NOT NULL DEFAULT 0,
  extensa_normal     INTEGER NOT NULL DEFAULT 0,
  extensa_emergencia INTEGER NOT NULL DEFAULT 0
);