-- Estado "cancelada" y detalle escrito por la consultante.
-- Ejecutar una sola vez, después de las migraciones 0002 y 0003:
--   npx wrangler d1 execute stardust-db --local  --file=migrations/0004_cancel_status.sql
--   npx wrangler d1 execute stardust-db --remote --file=migrations/0004_cancel_status.sql
--
-- SQLite no permite cambiar un CHECK con ALTER TABLE, así que se reconstruye la
-- tabla conservando los identificadores y todas las filas existentes:
--
--   estado  : en_proceso | finalizado | cancelada
--             Las consultas canceladas siguen visibles en el registro, pero no
--             cuentan para los ingresos estimados del panel.
--   detalle : contexto que la consultante escribe al reservar en la web.
--             Es texto libre (se recorta a 600 caracteres desde el Worker).

CREATE TABLE consultas_0004 (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha             TEXT    NOT NULL,
  tipo              TEXT    NOT NULL,
  inicio            TEXT,
  consultante       TEXT,
  nombre            TEXT,
  telefono          TEXT,
  lecturas          TEXT,
  precios           TEXT,
  total             REAL,
  creado_en         TEXT    NOT NULL DEFAULT (datetime('now')),
  estado            TEXT    NOT NULL DEFAULT 'en_proceso'
    CHECK (estado IN ('en_proceso', 'finalizado', 'cancelada')),
  canal             TEXT,
  lectura_tipo      TEXT,
  origen            TEXT    NOT NULL DEFAULT 'publico',
  detalle           TEXT
);

INSERT INTO consultas_0004
  (id, fecha, tipo, inicio, consultante, nombre, telefono, lecturas, precios,
   total, creado_en, estado, canal, lectura_tipo, origen)
SELECT id, fecha, tipo, inicio, consultante, nombre, telefono, lecturas, precios,
       total, creado_en, estado, canal, lectura_tipo, origen
  FROM consultas;

DROP TABLE consultas;

ALTER TABLE consultas_0004 RENAME TO consultas;

CREATE INDEX IF NOT EXISTS idx_consultas_fecha ON consultas (fecha);
CREATE INDEX IF NOT EXISTS idx_consultas_estado_fecha ON consultas (estado, fecha);
CREATE INDEX IF NOT EXISTS idx_consultas_origen ON consultas (origen, fecha);
