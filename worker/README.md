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
- 5 lecturas normales por dia.
- 3 lecturas de emergencia por dia.
- Cuando ambos cupos se llenan, la pagina marca ese dia en gris y no deja agendarlo.

## Notas
- Los conteos se guardan en el KV namespace "BOOKINGS".
- Si el worker no responde, la pagina deja todos los dias disponibles (no bloquea).