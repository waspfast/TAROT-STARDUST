#!/usr/bin/env node
"use strict";
// Verificador de deriva de cupos (SOLO LECTURA: no escribe nada).
//
// Compara, día por día, las tres fuentes de la ocupación:
//   1. contadores de `reservas` (lo que el worker descuenta al reservar)
//   2. suma de las `consultas` activas (estado != 'cancelada')
//   3. bloques de `slots` frente a los bloques que deberían existir
//
// Imprime únicamente los días con diferencia, con el campo, lo esperado
// (según las consultas activas) y lo real (reservas / slots).
//
// Uso:
//   node scripts/verificar-cupos.js --remote
//   node scripts/verificar-cupos.js --local
//   node scripts/verificar-cupos.js --sqlite ruta/al/archivo.sqlite
//   node scripts/verificar-cupos.js --remote --desde 2026-01-01 --hasta 2027-12-31
//
// Para --remote/--local usa wrangler (el que ya usa el proyecto), sin instalar
// dependencias nuevas. Cuando hay diferencias sale con código 1.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const WORKER_DIR = path.join(__dirname, "..", "worker");
const DB_NAME = "stardust-db";
const WRANGLER = "wrangler@4.159.0";
const CONTADORES = ["corta_normal", "corta_emergencia", "extensa_normal", "extensa_emergencia"];
const DURACION_CORTA_MIN = 25;
const DURACION_EXTENSA_MIN = 35;

// ── Argumentos ────────────────────────────────────────────────────────────
function leerOpciones(argv) {
  const opciones = { modo: "remote", db: DB_NAME, sqlite: "", desde: "", hasta: "", cuenta: "" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--remote") opciones.modo = "remote";
    else if (arg === "--local") opciones.modo = "local";
    else if (arg === "--sqlite") { opciones.modo = "sqlite"; opciones.sqlite = argv[++i] || ""; }
    else if (arg === "--db") opciones.db = argv[++i] || DB_NAME;
    else if (arg === "--desde") opciones.desde = argv[++i] || "";
    else if (arg === "--hasta") opciones.hasta = argv[++i] || "";
    else if (arg === "--cuenta") opciones.cuenta = argv[++i] || "";
    else if (arg === "--help" || arg === "-h") {
      console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(2, 22).join("\n"));
      process.exit(0);
    } else {
      console.error("Opción desconocida: " + arg);
      process.exit(2);
    }
  }
  return opciones;
}

// ── Acceso de lectura a la base ───────────────────────────────────────────
function filasLocales(db, sql) {
  return db.prepare(sql).all();
}

function filasWrangler(sql, opciones) {
  const archivo = path.join(os.tmpdir(), "verificar-cupos-" + process.pid + ".sql");
  fs.writeFileSync(archivo, sql, "utf8");
  const bandera = opciones.modo === "remote" ? "--remote" : "--local";
  const comando = ["npx", "-y", WRANGLER, "d1", "execute", opciones.db, bandera,
    "--json", "--file", `"${archivo}"`, "--config", "wrangler.toml"].join(" ");
  const env = Object.assign({}, process.env);
  if (opciones.cuenta) env.CLOUDFLARE_ACCOUNT_ID = opciones.cuenta;
  try {
    const res = spawnSync(comando, { cwd: WORKER_DIR, env, encoding: "utf8", shell: true });
    const salida = String(res.stdout || "");
    const inicio = salida.indexOf("[");
    const fin = salida.lastIndexOf("]");
    if (inicio === -1 || fin === -1) {
      throw new Error("wrangler no devolvió JSON:\n" + (salida || String(res.stderr || "")));
    }
    const datos = JSON.parse(salida.slice(inicio, fin + 1));
    return (datos[0] && datos[0].results) || [];
  } finally {
    try { fs.unlinkSync(archivo); } catch (error) { /* temporal: da igual */ }
  }
}

// Las columnas de ocupación pueden no existir en bases antiguas (pre-0006).
function leerConsultas(db, opciones, columnas) {
  const filtros = [];
  if (opciones.desde) filtros.push("fecha >= '" + opciones.desde + "'");
  if (opciones.hasta) filtros.push("fecha <= '" + opciones.hasta + "'");
  const pedir = (cols) => {
    const sql = "SELECT " + cols + " FROM consultas WHERE estado <> 'cancelada'"
      + (filtros.length ? " AND " + filtros.join(" AND ") : "");
    return opciones.modo === "sqlite" ? filasLocales(db, sql) : filasWrangler(sql, opciones);
  };
  let ultimoError = null;
  for (const cols of columnas) {
    try {
      return pedir(cols);
    } catch (error) {
      ultimoError = error;
      const mensaje = String((error && error.message) || error);
      if (!/no such column|no column named/i.test(mensaje)) throw error;
    }
  }

  throw ultimoError;
}

// Misma inferencia que ocupacionDe() del worker.
function ocupacionDe(fila) {
  if (fila.cortas != null || fila.extensas != null) {
    const cortas = Math.max(0, Number(fila.cortas) || 0);
    const extensas = Math.max(0, Number(fila.extensas) || 0);
    if (!cortas && !extensas) return null;
    const duracion = Number(fila.duracion) > 0
      ? Number(fila.duracion)
      : (extensas > 0 ? DURACION_EXTENSA_MIN : DURACION_CORTA_MIN);
    return { cortas, extensas, duracion };
  }
  if (fila.lectura_tipo === "corta") return { cortas: 1, extensas: 0, duracion: DURACION_CORTA_MIN };
  if (fila.lectura_tipo === "extensa") return { cortas: 0, extensas: 1, duracion: DURACION_EXTENSA_MIN };
  return null;
}

function nuevoDia() {
  return {
    esperado: { corta_normal: 0, corta_emergencia: 0, extensa_normal: 0, extensa_emergencia: 0 },
    real: { corta_normal: 0, corta_emergencia: 0, extensa_normal: 0, extensa_emergencia: 0 },
    bloquesEsperados: { normal: 0, emergencia: 0 },
    bloquesReales: { normal: 0, emergencia: 0 },
    sinDato: 0,
  };
}

function main() {
  const opciones = leerOpciones(process.argv.slice(2));
  let db = null;
  if (opciones.modo === "sqlite") {
    if (!opciones.sqlite) { console.error("Falta la ruta de --sqlite"); process.exit(2); }
    const { DatabaseSync } = require("node:sqlite");
    db = new DatabaseSync(opciones.sqlite);
  }

  const leer = (sql) => (opciones.modo === "sqlite"
    ? filasLocales(db, sql)
    : filasWrangler(sql, opciones));

  const reservas = leer("SELECT fecha, " + CONTADORES.join(", ") + " FROM reservas");
  const consultas = leerConsultas(db, opciones, [
    "fecha, tipo, inicio, cortas, extensas, duracion, lectura_tipo",
    "fecha, tipo, inicio, lectura_tipo",
    "fecha, tipo, inicio",
  ]);
  const slots = leer("SELECT fecha, inicio, tipo FROM slots");

  const dias = new Map();
  const dia = (fecha) => {
    if (!dias.has(fecha)) dias.set(fecha, nuevoDia());
    return dias.get(fecha);
  };

  for (const fila of reservas) {
    const d = dia(fila.fecha);
    for (const col of CONTADORES) d.real[col] = Number(fila[col]) || 0;
  }

  for (const fila of consultas) {
    const d = dia(fila.fecha);
    const ocupacion = ocupacionDe(fila);
    if (!ocupacion) { d.sinDato += 1; continue; }
    const esEmergencia = fila.tipo === "emergencia";
    d.esperado[esEmergencia ? "corta_emergencia" : "corta_normal"] += ocupacion.cortas;
    d.esperado[esEmergencia ? "extensa_emergencia" : "extensa_normal"] += ocupacion.extensas;
    if (fila.inicio) {
      const bloques = Math.max(1, Math.ceil(ocupacion.duracion / 30));
      d.bloquesEsperados[esEmergencia ? "emergencia" : "normal"] += bloques;
    }
  }

  for (const fila of slots) {
    const d = dia(fila.fecha);
    d.bloquesReales[fila.tipo === "emergencia" ? "emergencia" : "normal"] += 1;
  }

  const lineas = [];
  const fechas = Array.from(dias.keys()).sort();
  for (const fecha of fechas) {
    const d = dias.get(fecha);
    for (const col of CONTADORES) {
      if (d.esperado[col] !== d.real[col]) {
        lineas.push(fecha + "  " + col.padEnd(20, " ")
          + " esperado=" + d.esperado[col] + "  real=" + d.real[col]);
      }
    }
    for (const clave of ["normal", "emergencia"]) {
      if (d.bloquesEsperados[clave] !== d.bloquesReales[clave]) {
        lineas.push(fecha + "  " + ("bloques:" + clave).padEnd(20, " ")
          + " esperado=" + d.bloquesEsperados[clave] + "  real=" + d.bloquesReales[clave]);
      }
    }
    if (d.sinDato > 0) {
      lineas.push(fecha + "  consultas sin dato de ocupación: " + d.sinDato);
    }
  }

  console.log("Fuente: " + (opciones.modo === "sqlite" ? opciones.sqlite : opciones.modo + " (" + opciones.db + ")"));
  console.log("Días revisados: " + fechas.length);
  if (!lineas.length) {
    console.log("Sin diferencias.");
    process.exitCode = 0;
    return;
  }
  console.log("");
  for (const linea of lineas) console.log(linea);
  console.log("");
  console.log("Diferencias: " + lineas.length);
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error("ERROR: " + ((error && error.stack) || error));
  process.exitCode = 2;
}
