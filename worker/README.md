# Stardust Tarot - Worker (cupos por dia)

Este worker hace dos cosas:
1. Recibe las reservas (POST /), suma el cupo del dia y envia el aviso a Telegram.
2. Devuelve los cupos por dia (GET /disponibilidad?from=YYYY-MM-DD&to=YYYY-MM-DD).

## Como desplegarlo

1. Entra a https://dash.cloudflare.com y crea un nuevo Worker.
2. Pega el contenido de worker.js.
3. Crea un KV namespace (Workers and Pages / KV) y copia su ID.
4. Pega ese ID en wrangler.toml (campo "id") o agrega el binding "BOOKINGS" en el dashboard.
5. Pega tu TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID al inicio de worker.js.
6. Despliega y pega la URL del worker en js/config.js (variable WORKER_URL).

## Cupos
- 6 lecturas normales por dia.
- 6 lecturas de emergencia por dia.
- Cuando el cupo del tipo elegido se llena, el worker responde 409 AGENDA_LLENA.

## Cupo atomico (D1) -- recomendado
Por defecto el worker guarda los cupos en KV, pero **KV no es atomico**: entre
leer y escribir hay una ventana donde dos reservas simultaneas pueden pasar
ambas el chequeo y exceder el limite. Para cerrar esa carrera **sin Durable
Objects**, el worker usa D1 (SQLite) cuando existe el binding "DB":

    INSERT INTO reservas (fecha, <tipo>) VALUES (?, 1)
    ON CONFLICT(fecha) DO UPDATE SET <tipo> = <tipo> + 1
    WHERE <tipo> < <limite>;

SQLite serializa las escrituras, asi que la segunda reserva ve el valor ya
commiteado y su guard falla -> 409 AGENDA_LLENA. El cupo nunca se excede.

### Activar D1
1. `npx wrangler d1 create stardust-db`      (copia el database_id)
2. Descomenta el bloque `[[d1_databases]]` en wrangler.toml y pega tu id.
3. `npx wrangler d1 execute stardust-db --remote --file=./schema.sql`
4. `npx wrangler deploy`

Mientras el binding "DB" no exista, el worker sigue usando KV (no atomico),
asi que puedes desplegar sin riesgo.

### Migrar los conteos de KV (opcional)
Al conectar D1 la agenda arranca en 0 (limpia). Para conservar los cupos ya
ocupados, lista las claves del KV y reinsertalas en D1:

    npx wrangler kv key list --namespace-id 70a81faafbc14e7e9ac2010b0cda4d92

OJO: los conteos guardados no distinguen con certeza normal vs emergencia
(hay datos historicos cruzados), asi que contrasta con los recibos de Telegram
antes de confiar en ellos. Si no estas seguro, deja que arranque en 0.

## Notas
- Los conteos se guardan en D1 (si hay binding "DB") o en el KV namespace "BOOKINGS".
- Si el worker no responde, la pagina deja todos los dias disponibles (no bloquea).