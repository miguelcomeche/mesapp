# Libro diario de ventas y exportación para gestoría

## 1. Auditoría del sistema actual (punto 23 del documento)

Lo que ya existe y se reutiliza (no se crean datos de venta duplicados):

| Concepto | Dónde está hoy |
|---|---|
| Ticket / venta | Cada mesa cerrada (`table_sessions` con estado `closed`) |
| Líneas | `order_items` (cantidad, precio unitario, invitación, anulación) |
| Cobros | `payments` (importe, método efectivo/tarjeta, propina, descuento, anulado) |
| Devoluciones | `payment_voids` (anulación completa de un cobro, con motivo) |
| Caja | `cash_sessions` y `cash_movements` |
| Facturas | `invoices`, `invoice_items`, `invoice_tax_breakdown` (ya enlazan con la mesa y el cobro de origen) |
| Tipo de IVA | Solo en la ficha del producto (`menu_items.vat_rate`) |

### Faltan estos datos para que la contabilidad sea inmutable

1. **Foto del producto en el momento de la venta**: las líneas no guardan el nombre ni el tipo de IVA. Si alguien cambia el IVA o el nombre de un producto, los tickets antiguos cambiarían. Hay que añadir a las líneas: `product_name_snapshot`, `vat_rate_snapshot` (se rellenan solas al crear la línea; para las líneas antiguas se copian los valores actuales del producto).
2. **Número de ticket correlativo**: las mesas no tienen número de ticket (#00452). Añadir `ticket_number` correlativo por restaurante, que se asigna al cerrar la mesa.
3. **Fecha de inicio de producción**: el restaurante ya tiene Demo / Producción, pero no tiene fecha de inicio. Añadir `production_start_date`.
4. **Devoluciones parciales**: hoy solo se puede anular un cobro entero. Para devoluciones parciales hace falta una tabla `refunds` (importe, motivo, cobro de origen, quién). Propuesta: crearla ahora para que la contabilidad la soporte; el botón "Devolución parcial" en Pagos se añade en esta misma entrega.
5. **Cierres diarios**: tabla `daily_closings` de solo lectura (foto del resumen del día, nunca se borra ni se edita).

Precio unitario, descuentos e invitaciones ya se guardan en el momento de la venta, así que no hacen falta cambios ahí.

## 2. Qué verá el usuario

En **Analíticas** aparece una pestaña nueva **Facturación** con:

- Tarjetas arriba: Facturado hoy, Cobrado hoy, Efectivo, Tarjeta, IVA, Nº tickets.
- Filtros: Hoy, Ayer, Esta semana, Este mes, Mes anterior, Este trimestre, Trimestre anterior, Este año, Personalizado.
- **Libro diario de ventas**: una fila por día (tickets, bruto, descuentos, devoluciones, neto, base, IVA, total, efectivo, tarjeta, otros, cobrado, diferencia). Muestra "Conciliado ✓" o "⚠ Diferencia" (al pulsar, ves los tickets afectados).
- Al pulsar un día: **Detalle de facturación** con cada ticket (número, hora, mesa, camarero, base, IVA, total, efectivo, tarjeta, otros, estado, factura). Si tiene factura, botón para abrirla; si no, "Emitir factura" que reutiliza la venta original.
- Desglose de IVA por tipo (los que existan, no solo 10 % y 21 %) y métodos de pago.
- Botón **Generar cierre diario** (guarda la foto del día con datos fiscales, caja y conciliación).
- Botón **Exportar para gestoría**: PDF, Excel (8 hojas: Resumen, Ventas diarias, Tickets, IVA, Métodos de pago, Facturas, Devoluciones, Caja, con números y fechas reales) y CSV.

En **Ajustes del restaurante**: entorno Demo / Producción con aviso fuerte al pasar a Producción, y Fecha inicio producción. Con el restaurante en Producción, los botones de "borrar histórico operativo" y "reset facturación" quedan bloqueados (también en la base de datos, no solo en pantalla).

## 3. Reglas contables

- Una venta = una mesa cerrada. Las facturas nominativas nunca suman facturación: solo se listan y se enlazan con su ticket.
- Pagos divididos: cada cobro cuenta en su método (30 € efectivo + 70 € tarjeta).
- Cobros anulados y devoluciones restan; el ticket se queda en el historial como "Devuelto".
- Las líneas anuladas no suman; las invitaciones suman 0 €.
- Base e IVA se calculan por línea con el IVA guardado (precios con IVA incluido) y se reparten los descuentos proporcionalmente.
- Solo entran datos desde la fecha de inicio de producción (en restaurantes en Producción) y del restaurante seleccionado.

## Detalles técnicos

- **Una única capa de cálculo**: función de base de datos `sales_ledger(_restaurant, _from, _to)` con permisos por restaurante, que devuelve tickets, cobros, devoluciones, IVA y facturas. Un único módulo `src/lib/ledger.ts` agrega días/totales; lo usan la pantalla, el PDF (jsPDF), el Excel y el CSV. Así todas las cifras son idénticas.
- Excel: añadir la librería `exceljs` (celdas numéricas con formato de euros y fechas reales).
- Migración: columnas snapshot en `order_items` + trigger que las rellena + relleno de las líneas existentes; `ticket_number` + secuencia por restaurante asignada en el cierre de mesa; `restaurants.production_start_date`; tablas `refunds` y `daily_closings` (permisos, RLS, sin borrado ni edición); `reset_restaurant_operations` y `admin_reset_invoicing`/`admin_delete_invoice` rechazan restaurantes en Producción.
- Prueba de aceptación: script de verificación con los 4 tickets del documento (esperado 230 €, efectivo 110 €, tarjeta 120 €, 3 ventas válidas) en un restaurante demo.
