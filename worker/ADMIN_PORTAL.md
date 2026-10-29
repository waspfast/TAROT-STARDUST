# Portal administrativo

El portal vive en `../admin` y lo sirve el mismo Worker desde un dominio propio,
por ejemplo `https://admin.tarotstardust.com/`. La página usa el Worker del mismo
origen: Access protege la interfaz y el Worker vuelve a validar el JWT antes de
entregar datos o aceptar cambios.

La primera interfaz operativa está hecha con HTML/CSS/JavaScript en `../admin`.
Las rutas JSON no dependen de ese framework; puedes sustituir la interfaz por el
cliente Leptos/Rust de referencia y compilarlo hacia esa misma carpeta cuando
tengas Rust/Trunk configurados.

## Modelo de datos y comportamiento

- La migración no borra ni reemplaza `reservas`, `slots` ni los registros de `consultas`.
- Añade `consultas.estado`, cuyo valor inicial para el historial existente es
  `en_proceso`; el panel permite cambiarlo a `finalizado`.
- Añade reglas semanales y excepciones por fecha en D1. Se sembraron los horarios,
  cupos, fines de semana, bloqueos y excepciones que estaban en el código original.
- Los cupos siguen separados entre lecturas cortas/extensas y normales/emergencia.
  La regla de solapamiento de horarios existente se mantiene.
- El estado administrativo no libera ni vuelve a ocupar cupos. No hay acciones
  de cancelar o mover citas, porque los registros históricos no están enlazados a
  sus contadores y bloques con un identificador de reserva.
- El historial muestra hasta 200 consultas por filtro. No muestra datos de pago
  ni detalles privados de la consulta que el esquema actual no guarda en D1.
- Los contadores de `reservas` sin ninguna consulta individual para la misma
  fecha aparecen aparte como “Registros manuales sin desglose”. Son totales por
  categoría, no citas/personas individuales; se filtran por mes, no por estado o
  búsqueda textual. Una fecha que ya tiene consultas individuales se omite de
  esta sección para no presentar sus contadores como registros adicionales.
- El inicio del panel prioriza la próxima consulta de hoy y las que están “Por
  confirmar” (estado `en_proceso` en D1). El resumen consulta el mes actual y el
  siguiente (hasta 200 fichas por mes); la búsqueda histórica conserva su filtro
  y su límite de 200 fichas.
- El menú lateral separa el panel en cuatro vistas (Inicio, Consultas, Gráficos y
  Disponibilidad) sin recargar la página: solo se muestra una a la vez y la URL
  conserva el ancla (`#inicio`, `#consultas`, `#graficos`, `#disponibilidad`),
  así que se puede abrir una vista directamente sin salto de scroll (las anclas
  apuntan a la vista y no a un elemento con ese `id`). Los enlaces internos de
  las tarjetas cambian de vista antes de desplazarse; el calendario y la agenda
  viven en Inicio y el formulario de ajustes en Disponibilidad.
- `GET /api/admin/ingresos?granularidad=mes|semana|año` agrupa el importe de las
  consultas con ficha por periodo (la semana empieza en lunes) y devuelve
  `periodos[]` con `inicio`, `fin`, `ingresos`, `consultas` y `promedio`, más
  `total`, `consultas` y `promedio_consulta`. El importe usa `consultas.total`
  como fuente principal; si falta o está vacío, suma el desglose `precios`. Las
  fechas inválidas se descartan y los registros manuales sin ficha no participan,
  porque no tienen importe asociado.
- El gráfico de ingresos de Gráficos usa ese endpoint con pestañas Semana, Mes y
  Año; el mes y el histórico de los otros dos gráficos no cambian la granularidad
  de ingresos, que siempre resume todo el historial.
- El calendario distingue fichas de consultas individuales de lecturas
  contabilizadas. Los cupos libres se calculan con los contadores de lectura de
  D1, no representan un número de citas disponibles.
- La densidad y el modo discreto se guardan en el almacenamiento local del
  navegador de quien administra el panel; no se envían a D1. El modo discreto
  oculta los nombres y teléfonos en la interfaz mientras está activo.

## Configuración en Cloudflare

1. Confirma que el dominio `tarotstardust.com` está en la misma cuenta Cloudflare
   que D1 y el Worker `stardustworker`.
2. En **Workers & Pages → stardustworker → Settings → Domains & Routes**, añade
   `admin.tarotstardust.com` como **Custom Domain**. Cloudflare configura el DNS
   y certificado del subdominio. No cambies los registros del dominio principal
   ni del sitio público.
3. En **Zero Trust → Access → Applications**, crea una aplicación **Self-hosted**
   para `admin.tarotstardust.com/*` y una política **Allow** que incluya solo tu
   correo. Guarda el *Application Audience (AUD) Tag* y el dominio del equipo,
   como `mi-equipo.cloudflareaccess.com`.
4. Sustituye `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` y `ADMIN_EMAILS` en `wrangler.toml`.
   Son configuración pública, no contraseñas. No agregues tokens o claves al
   repositorio.
5. Si el panel dice no autorizado, revisa que la aplicación Access cubra todo el
   host del subdominio y que el equipo, AUD y correo coincidan exactamente.

El Worker conserva su endpoint público `workers.dev` para las reservas. Access
no protege `workers.dev`; por eso las rutas `/api/admin/*` verifican además el JWT
firmado, su issuer, audiencia, vigencia y correo permitido. Los endpoints
administrativos solo devuelven información con una sesión válida.

## Respaldo, migración y despliegue

Haz respaldo antes de tocar D1. El archivo exportado contiene datos personales:
guárdalo de forma privada y no lo subas al repositorio.

Desde la carpeta `worker/`:

```powershell
npx wrangler d1 export stardust-db --remote --output=backup-before-admin.sql
npx wrangler d1 execute stardust-db --local --file=./schema.sql
npx wrangler d1 execute stardust-db --local --file=./migrations/0002_admin_portal.sql
npx wrangler d1 execute stardust-db --remote --file=./migrations/0002_admin_portal.sql
npx wrangler deploy
```

`schema.sql` usa `CREATE ... IF NOT EXISTS` y prepara el esquema local para probar
la migración. `0002_admin_portal.sql` contiene un `ALTER TABLE` de una sola
ejecución; no vuelvas a aplicarlo en la misma base después de que termine
correctamente. Revisa primero la salida del comando local. No compartas ni
publiques el respaldo.

Después de desplegar el Worker, publica también en el hosting del sitio público
los cambios de `js/data/availability.js`, `js/ui/calendar-ui.js` y
`js/ui/slots-ui.js`. Si el sitio se publica desde Git, publica esos cambios por
el flujo habitual de tu hosting. El calendario público necesita esos archivos
para mostrar las reglas que ahora sirven desde D1.

## Pruebas posteriores

- Abre `https://admin.tarotstardust.com/`; Access debe pedir autenticación.
- Desde una sesión autorizada, confirma que aparecen las consultas existentes.
- Cambia una consulta de “En proceso” a “Finalizado” y confirma que sobrevive a
  una recarga.
- Recorre las cuatro vistas del menú (Inicio, Consultas, Gráficos, Disponibilidad)
  y confirma que no hay secciones duplicadas ni enlaces que apunten a una vista
  oculta. En Gráficos, alterna Semana, Mes y Año en el gráfico de ingresos y
  comprueba que el total coincide con la suma de las consultas de cada periodo.
  Abrir una vista con `#consultas`, `#graficos` o `#disponibilidad` debe mostrar
  esa vista desde arriba, sin saltos de scroll.
- En pantallas estrechas (y en Semana, donde caben muchas barras) el gráfico de
  ingresos se desplaza en horizontal: la orilla se difumina mientras queden
  barras por ver y las etiquetas de importe y periodo deben quedar completas.
- Ajusta una fecha de prueba y revisa que `/disponibilidad` y el calendario
  público reflejen la misma jornada y cupos.
- Prueba una sesión privada/no autorizada: `/api/admin/me`, consultas y cambios
  deben responder `401` o la pantalla de Access, nunca datos.

No despliegues la migración remota ni la aplicación Access por mí: ambas acciones
requieren acceso a tu cuenta Cloudflare. Antes de publicar, verifica especialmente
que el nombre de la base D1 y su `database_id` en `wrangler.toml` son los correctos.
