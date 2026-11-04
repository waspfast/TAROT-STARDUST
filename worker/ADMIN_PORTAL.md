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
  `en_proceso`; el panel permite cambiarlo a `finalizado` o `cancelada`. Una
  consulta cancelada sigue en el registro (y se puede volver a abrir), pero no
  suma ingresos: queda fuera del total, del ticket medio y de la curva. Para el
  estado `cancelada` hace falta la migración `0004_cancel_status.sql`; si el panel
  se usa sin ella, el cambio responde `409` con `MIGRACION_0004_PENDIENTE` y un
  mensaje que indica qué migración falta.
- `consultas.detalle` guarda el contexto que la consultante escribe al reservar
  en la web (texto libre, recortado a 600 caracteres en el Worker). El registro
  lo muestra bajo el nombre, la ficha lo abre completo y el buscador lo incluye;
  las reservas manuales del panel también pueden escribirlo. Las fichas antiguas
  sin detalle siguen funcionando: la columna se pide por niveles y, si la
  migración no está aplicada, el panel y la web guardan la reserva sin ella.
- Añade reglas semanales y excepciones por fecha en D1. Se sembraron los horarios,
  cupos, fines de semana, bloqueos y excepciones que estaban en el código original.
- Los cupos siguen separados entre lecturas cortas/extensas y normales/emergencia.
  La regla de solapamiento de horarios existente se mantiene.
- El estado administrativo no libera ni vuelve a ocupar cupos. Marcar una
  consulta como `cancelada` solo cambia su estado y la excluye de los ingresos:
  no borra la ficha, no devuelve el cupo ni libera el bloque de la agenda, porque
  los registros históricos no están enlazados a sus contadores y bloques con un
  identificador de reserva. Tampoco hay acciones para mover citas.
- El historial muestra hasta 200 consultas por filtro. No muestra datos de pago.
  El detalle que escribe la consultante se añadió en la migración `0004` y, desde
  entonces, se ve en el registro y completo en la ficha de cada consulta.
- Los contadores de `reservas` sin ninguna consulta individual para la misma
  fecha no se listan en Consultas: son totales por día, sin nombre, estado ni
  cita asociada, así que no se pueden presentar como reservas individuales. Solo
  se reflejan en Gráficos, dentro del periodo elegido, como filas “sin ficha” del
  ranking y en la torta de modalidad (emergencias vs. normales). Una fecha que ya
  tiene consultas individuales se omite para no contar dos veces.
- El inicio del panel prioriza la próxima consulta de hoy y las que están “Por
  confirmar” (estado `en_proceso` en D1). El resumen consulta el mes actual y el
  siguiente (hasta 200 fichas por mes); la búsqueda histórica conserva su filtro
  y su límite de 200 fichas.
- La portada es un dashboard tipo bento: arriba, tres tarjetas KPI (lecturas de
  hoy con micro-barras de los últimos cinco días, consultantes del mes y una
  tarjeta de acento con las lecturas en progreso); debajo, una cuadrícula con el
  medidor de ocupación en semicírculo del mes visible, la tarjeta de perfil con
  “Abiertas / Frecuentes / Nuevas”, el calendario con el botón “Gestionar
  fechas”, la lista de lecturas en curso (borde lateral de acento y chip de
  estado) y la próxima lectura con su agenda desplegable. Inicio no muestra
  métricas de ingresos mensuales ni ingresos del día: el dinero vive solo en
  Gráficos. Conserva la paleta, las fuentes, la navegación y las preferencias
  visuales ya definidas en `admin/style.css`; el diseño de referencia se usa
  solo para la jerarquía y la composición.
- La vista Consultas se organiza en tres bloques: una fila de KPIs del periodo
  (en registro con micro-barras de los últimos siete días, en progreso,
  finalizadas, canceladas y emergencias en la tarjeta de acento), una tarjeta de
  filtros con el selector Día/Mes, el filtro por estado (incluye “Canceladas”),
  la búsqueda y la tira de días de la semana (con un punto en los días que tienen
  fichas, flechas ‹ › y el botón “Hoy”), y una cuadrícula con el registro del
  periodo más una columna lateral con la tarjeta “Tipos de lectura” del día
  actual. El modo Día filtra por fecha las fichas del mes ya cargado y el modo
  Mes conserva el filtro mensual; el estado y la búsqueda se aplican sobre ese
  mismo conjunto sin nuevas peticiones, así que los KPIs no cambian al alternar
  estado o búsqueda. Si un día no tiene fichas, el registro muestra un estado
  vacío con el atajo “Ver mes completo”. La tarjeta lateral toma los contadores
  de `reservas` del día de hoy para las barras Cortas/Extensas y, si el día
  todavía no tiene contadores, usa las fichas del día como respaldo.
- Cada ficha del registro (y cada entrada de la agenda de Inicio) lleva el nombre
  como enlace: al pulsarlo se abre una ventana modal con fecha, hora, tipo,
  lecturas, precios, total, estado, canal, teléfono, consultante, origen, alta y
  el detalle completo, más los botones “Llamar” y “Copiar teléfono”. La modal
  cierra con la ✕, con el fondo o con `Esc`, y devuelve el foco al enlace. Las
  consultas canceladas se distinguen con un fondo tenue y la hora tachada; el
  estado se cambia desde su selector y, si el servidor falla, vuelve al valor
  anterior con el aviso correspondiente.
- El pie de la tira de días incluye “Hoy”, “Organizar por hora” (ordena el
  registro del periodo por hora de inicio, dejando al final las fichas sin hora)
  e “Imprimir reservas”, que abre un resumen en texto plano del día o del mes
  visible para copiarlo o descargarlo como `.txt`.
- La vista Disponibilidad pone la tarjeta “Nueva reserva” (reserva manual) al lado
  del recuadro “Ajustes de fecha”: en escritorio comparten fila y en móvil se
  apilan, con la reserva debajo. La tarjeta registra una consulta creada a mano
  con `POST /api/admin/consultas`: nombre, contacto, canal (WhatsApp, correo,
  Telegram o Discord), tipo de lectura (corta o extensa), modalidad de
  emergencia opcional, detalle libre opcional y fecha y hora opcional. Su fecha
  sigue al día elegido en el calendario y, si se cambia en el propio formulario,
  selecciona ese día y carga su mes en la vista. Al guardar, el panel refresca la
  disponibilidad, el registro, el resumen de Inicio, la tarjeta “Tipos de lectura”
  y las estadísticas, deja el calendario en la fecha reservada, limpia el detalle
  y muestra la confirmación en la misma tarjeta. Las altas manuales entran con
  `origen = 'manual'` y `estado = 'en_proceso'`, y el registro de Consultas las
  marca con la etiqueta “Manual” junto al canal y el tipo de lectura. No se envía
  notificación a Telegram.
- El alta manual valida en el servidor la fecha real, el nombre y el contacto no
  vacíos, los canales y tipos permitidos y una hora alineada a bloques de 30
  minutos dentro de la jornada publicada. Una fecha cerrada o un cupo agotado
  responden `409` con `AGENDA_LLENA`, un horario ya tomado responde `409` con
  `HORARIO_OCUPADO` y una hora fuera de la ventana responde `400` con
  `HORARIO_INVALIDO`. El bloque de agenda se reserva primero y, si el cupo
  diario falla, se libera para no dejar la agenda ocupada. Cada alta queda
  auditada en `admin_audit` como `consulta.create.manual`.
- El menú lateral separa el panel en cuatro vistas (Inicio, Consultas, Gráficos y
  Disponibilidad) sin recargar la página: solo se muestra una a la vez y la URL
  conserva el ancla (`#inicio`, `#consultas`, `#graficos`, `#disponibilidad`),
  así que se puede abrir una vista directamente sin salto de scroll (las anclas
  apuntan a la vista y no a un elemento con ese `id`). Los enlaces internos de
  las tarjetas cambian de vista antes de desplazarse; el calendario y la agenda
  viven en Inicio y el formulario de ajustes junto a la reserva manual, en
  Disponibilidad.
- `GET /api/admin/ingresos?granularidad=dia|semana|mes|año` agrupa el importe de
  las consultas con ficha por periodo (la semana empieza en lunes) y devuelve
  `periodos[]` con `inicio`, `fin`, `ingresos`, `consultas` y `promedio`, más
  `total`, `consultas` y `promedio_consulta`. El importe usa `consultas.total`
  como fuente principal; si falta o está vacío, suma el desglose `precios`. Las
  fechas inválidas se descartan, las consultas `cancelada` no participan y los
  registros sin importe tampoco, porque no suman dinero ni deben contar para el
  ticket medio. La granularidad `dia` se limita a los 90 días con datos más
  recientes para que la curva siga legible; el histórico completo queda en
  semana, mes y año.
- La vista Gráficos abre con cuatro tarjetas-botón (ingresos del mes, ocupación,
  ingreso promedio y nuevas vs. frecuentes) y una tarjeta destacada con la
  lectura más pedida. Al pulsar una tarjeta se marca como activa y la vista se
  desplaza al desglose correspondiente: curva de ingresos y ticket medio (con
  pestañas Día, Semana, Mes y Año), ocupación por día o por semana, barras de
  porcentaje de lecturas y, en el bloque de comunidad, dos tortas: consultantes
  nuevas vs. frecuentes y modalidad (emergencias vs. sin emergencia). La curva
  marca con un punto dorado los máximos locales de la serie y, cuando son pocos,
  escribe el importe sobre cada pico (etiquetas HTML, porque el SVG se estira con
  el ancho del contenedor). La torta de modalidad suma las fichas por `tipo` y
  los contadores históricos sin ficha. El comparativo de ingresos y de ticket
  medio usa el periodo mensual anterior con datos, siempre del endpoint de
  ingresos con granularidad mensual.
- La ocupación se calcula con `/api/admin/availability?month=`: cupos usados
  entre cupos publicados de los días abiertos. Por eso "Todo el histórico" no
  puede mostrarla y la tarjeta pide un mes concreto; el desglose solo recalcula
  al cambiar de mes o al alternar Día y Semana, sin pedir la estadística otra vez.
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
npx wrangler d1 execute stardust-db --local --file=./migrations/0003_manual_reservations.sql
npx wrangler d1 execute stardust-db --remote --file=./migrations/0003_manual_reservations.sql
npx wrangler deploy
```

`schema.sql` usa `CREATE ... IF NOT EXISTS` y prepara el esquema local para probar
la migración. `0002_admin_portal.sql` contiene un `ALTER TABLE` de una sola
ejecución; no vuelvas a aplicarlo en la misma base después de que termine
correctamente. Revisa primero la salida del comando local. No compartas ni
publiques el respaldo.

`0003_manual_reservations.sql` añade a `consultas` las columnas `canal`,
`lectura_tipo` y `origen` (con `'publico'` por defecto), más un índice por
origen y fecha. También es de una sola ejecución. Si el panel se despliega antes
de aplicar esta migración, la reserva manual sigue guardando la ficha y el cupo,
pero sin canal ni tipo de lectura, y el registro funciona con las columnas
anteriores.

`0004_cancel_status.sql` añade la columna `detalle` (`TEXT` opcional) y amplía el
`CHECK` de `consultas.estado` para aceptar `cancelada` (reconstruye la tabla y
copia los datos; es de una sola ejecución). El Worker y el panel funcionan antes
de aplicarla: la lectura del detalle usa un respaldo sin la columna y la web
guarda la reserva sin él. Lo único que no funciona sin la migración es guardar
`detalle` y pasar una consulta a `cancelada`; el panel lo avisa con
`MIGRACION_0004_PENDIENTE` en lugar de fallar en silencio. Aplícala primero en
local y después en remoto:

```text
npx wrangler d1 execute stardust-db --local --file=migrations/0004_cancel_status.sql
npx wrangler d1 execute stardust-db --remote --file=migrations/0004_cancel_status.sql
```

Después de desplegar el Worker, publica también en el hosting del sitio público
los cambios de `js/data/availability.js`, `js/ui/calendar-ui.js`, `js/ui/slots-ui.js`
y del `index.html` público (el campo de detalle ahora limita la entrada a 600
caracteres). Si el sitio se publica desde Git, publica esos cambios por el flujo
habitual de tu hosting. El calendario público necesita esos archivos
para mostrar las reglas que ahora sirven desde D1. El formulario público ya
envía el contexto de la consulta en el campo `detalle` (`js/actions/notify.js`),
así que no hace falta tocar el cliente público para que el panel lo reciba: el
Worker descarta el relleno “Sin detalle” y guarda el texto cuando la migración
`0004` está aplicada. El campo del sitio público limita la entrada a 600
caracteres, el mismo tope que aplica el Worker.

## Pruebas posteriores

- Abre `https://admin.tarotstardust.com/`; Access debe pedir autenticación.
- Desde una sesión autorizada, confirma que aparecen las consultas existentes.
- Cambia una consulta de “En proceso” a “Finalizado” y confirma que sobrevive a
  una recarga.
- Con la migración `0004` aplicada, pasa una consulta con importe a “Cancelada”:
  debe quedarse en el registro con el estilo tenue, desaparecer del total, del
  ticket medio y de la curva de ingresos, y volver a sumar si la reabres. Repite
  la prueba sin la migración: el panel debe mostrar el aviso
  `MIGRACION_0004_PENDIENTE` en vez de dejar la consulta en un estado dudoso.
- Reserva una lectura desde el sitio público escribiendo en el campo de detalle:
  la ficha debe guardarlo, mostrarlo bajo el nombre en el registro y devolverlo en
  la búsqueda. Prueba una ficha antigua sin detalle para confirmar que no aparece
  el bloque vacío ni errores.
- Pulsa el nombre de una consulta: la modal debe abrir con todos los datos y el
  detalle completo, y cerrarse con ✕, con el fondo y con `Esc` devolviendo el foco
  al enlace. “Copiar teléfono” debe funcionar también sin permiso de portapapeles
  (respaldo con selección de texto).
- En Consultas, activa “Organizar por hora” en modo Mes: el registro debe quedar
  ordenado por hora de inicio y las fichas sin hora al final. “Imprimir reservas”
  debe generar el resumen del día o del mes visible y permitir copiarlo o
  descargarlo en `.txt`.
- En Disponibilidad, registra una reserva manual con detalle y confirma que el
  campo se envía al servidor y se limpia después de guardar.
- En Disponibilidad, con un día ya elegido en el calendario, registra una reserva
  manual con nombre, contacto y hora: debe aparecer en el registro con la
  etiqueta “Manual”, descontar el cupo del día y ocupar el bloque en la agenda.
  Repite el alta con la misma hora para confirmar que responde “horario ocupado”
  sin crear la ficha.
- En Disponibilidad, elige una fecha cerrada en el calendario: el botón
  “Registrar reserva” queda deshabilitado y el aviso aparece al escribir en el
  formulario. Si se fuerza la petición, el servidor responde `409`.
- En Disponibilidad, cambia la fecha desde el formulario a otro mes: el
  calendario debe cargar ese mes y dejar seleccionado el día.
- Recorre las cuatro vistas del menú (Inicio, Consultas, Gráficos, Disponibilidad)
  y confirma que no hay secciones duplicadas ni enlaces que apunten a una vista
  oculta. En Gráficos, alterna Día, Semana, Mes y Año en el gráfico de ingresos y
  comprueba que el total coincide con la suma de las consultas de cada periodo y
  que los picos marcados corresponden a los valores más altos de la curva.
  Abrir una vista con `#consultas`, `#graficos` o `#disponibilidad` debe mostrar
  esa vista desde arriba, sin saltos de scroll.
- En Consultas, alterna Día y Mes, navega con las flechas de la semana y pulsa
  “Hoy”: los KPIs, la tira de días y la tarjeta “Tipos de lectura” deben seguir
  al periodo elegido, y un día sin fichas debe mostrar el atajo “Ver mes
  completo”.
- Pulsa cada tarjeta de Gráficos y confirma que se marca como activa, que lleva
  al desglose correspondiente y que el realce dorado queda en la tarjeta y en su
  panel.
- En pantallas estrechas (y en la ocupación por día, donde caben muchas barras)
  el gráfico se desplaza en horizontal: la orilla se difumina mientras queden
  barras por ver y las etiquetas deben quedar completas.
- Ajusta una fecha de prueba y revisa que `/disponibilidad` y el calendario
  público reflejen la misma jornada y cupos.
- Prueba una sesión privada/no autorizada: `/api/admin/me`, consultas y cambios
  deben responder `401` o la pantalla de Access, nunca datos.

No despliegues la migración remota ni la aplicación Access por mí: ambas acciones
requieren acceso a tu cuenta Cloudflare. Antes de publicar, verifica especialmente
que el nombre de la base D1 y su `database_id` en `wrangler.toml` son los correctos.
