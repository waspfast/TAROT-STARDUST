-- Pagos y cargos de cada consulta (método de pago, recargo de emergencia y
-- comisión por PayPal / tarjeta internacional).
-- Ejecutar una sola vez, después de las migraciones 0002, 0003 y 0004:
--   npx wrangler d1 execute stardust-db --local  --file=migrations/0005_consulta_pago.sql
--   npx wrangler d1 execute stardust-db --remote --file=migrations/0005_consulta_pago.sql
--
--   metodo_pago        : 'Binance USDT' | 'Pago Móvil' | 'PayPal' | 'Tarjeta Internacional' (NULL en manuales)
--   recargo_emergencia : monto del recargo de emergencia (NULL si no aplica)
--   comision_pago      : comisión por PayPal o tarjeta internacional (NULL si no aplica)
--   canal              : reutiliza la columna existente; las reservas en línea ahora
--                        guardan aquí la plataforma de contacto (whatsapp/correo/telegram/discord)

ALTER TABLE consultas ADD COLUMN metodo_pago TEXT;
ALTER TABLE consultas ADD COLUMN recargo_emergencia REAL;
ALTER TABLE consultas ADD COLUMN comision_pago REAL;
