-- Conserva los contadores, bloques y consultas históricos existentes.
-- Ejecutar una sola vez después de hacer una copia de seguridad de D1.

ALTER TABLE consultas ADD COLUMN estado TEXT NOT NULL DEFAULT 'en_proceso'
  CHECK (estado IN ('en_proceso', 'finalizado'));

CREATE TABLE IF NOT EXISTS availability_defaults (
  weekday INTEGER PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  is_open INTEGER NOT NULL CHECK (is_open IN (0, 1)),
  inicio TEXT NOT NULL,
  fin TEXT NOT NULL,
  corta_normal INTEGER NOT NULL CHECK (corta_normal BETWEEN 0 AND 50),
  corta_emergencia INTEGER NOT NULL CHECK (corta_emergencia BETWEEN 0 AND 50),
  extensa_normal INTEGER NOT NULL CHECK (extensa_normal BETWEEN 0 AND 50),
  extensa_emergencia INTEGER NOT NULL CHECK (extensa_emergencia BETWEEN 0 AND 50),
  emergencia_extendida INTEGER NOT NULL DEFAULT 0 CHECK (emergencia_extendida IN (0, 1))
);

CREATE TABLE IF NOT EXISTS availability_overrides (
  fecha TEXT PRIMARY KEY CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  is_open INTEGER NOT NULL CHECK (is_open IN (0, 1)),
  inicio TEXT NOT NULL,
  fin TEXT NOT NULL,
  corta_normal INTEGER NOT NULL CHECK (corta_normal BETWEEN 0 AND 50),
  corta_emergencia INTEGER NOT NULL CHECK (corta_emergencia BETWEEN 0 AND 50),
  extensa_normal INTEGER NOT NULL CHECK (extensa_normal BETWEEN 0 AND 50),
  extensa_emergencia INTEGER NOT NULL CHECK (extensa_emergencia BETWEEN 0 AND 50),
  emergencia_extendida INTEGER NOT NULL DEFAULT 0 CHECK (emergencia_extendida IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_consultas_estado_fecha ON consultas (estado, fecha);

-- Mantiene el comportamiento original: lunes-viernes de 10:00 a 18:00;
-- sábado y domingo cerrados salvo excepciones por fecha.
INSERT OR IGNORE INTO availability_defaults
  (weekday, is_open, inicio, fin, corta_normal, corta_emergencia, extensa_normal, extensa_emergencia)
VALUES
  (0, 0, '10:00', '18:00', 6, 5, 3, 0),
  (1, 1, '10:00', '18:00', 6, 5, 3, 0),
  (2, 1, '10:00', '18:00', 6, 5, 3, 0),
  (3, 1, '10:00', '18:00', 6, 5, 3, 0),
  (4, 1, '10:00', '18:00', 6, 5, 3, 0),
  (5, 1, '10:00', '18:00', 6, 5, 3, 0),
  (6, 0, '10:00', '18:00', 6, 5, 3, 0);

-- Fechas agotadas que estaban explícitamente bloqueadas en el código original.
INSERT OR IGNORE INTO availability_overrides
  (fecha, is_open, inicio, fin, corta_normal, corta_emergencia, extensa_normal, extensa_emergencia)
VALUES
  ('2026-09-30', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-10-01', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-10-02', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-10-23', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-10-26', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-10-29', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-11-24', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-11-25', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-11-26', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-11-27', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-12-04', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-12-09', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-12-10', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-12-11', 0, '10:00', '18:00', 0, 0, 0, 0),
  ('2026-10-30', 1, '10:30', '15:00', 0, 0, 6, 1),
  ('2026-11-21', 1, '10:00', '18:00', 6, 5, 3, 0),
  ('2026-11-22', 1, '10:00', '18:00', 6, 5, 3, 0),
  ('2026-11-29', 1, '10:00', '18:00', 0, 0, 0, 2),
  ('2026-12-06', 1, '10:00', '18:00', 3, 3, 0, 0),
  ('2026-12-07', 1, '10:00', '18:00', 2, 3, 1, 0),
  ('2026-12-08', 1, '10:00', '18:00', 3, 3, 0, 0),
  ('2026-12-12', 1, '10:00', '18:00', 6, 0, 0, 0),
  ('2026-12-13', 1, '10:00', '18:00', 6, 0, 0, 0);

UPDATE availability_overrides SET emergencia_extendida = 1
 WHERE fecha IN ('2026-10-30', '2026-11-29', '2026-12-06', '2026-12-07', '2026-12-08');
