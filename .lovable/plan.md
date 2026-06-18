# Módulo de Facturación — Plan de Implementación

Implementación por fases. Es un módulo grande; propongo construirlo en 3 entregas para que puedas validar cada una antes de seguir.

---

## FASE 1 — Núcleo de Facturación (emitir + historial + PDF)

### Base de datos (nueva migración)

Nuevas tablas:

- **`invoice_customers`** — clientes guardados por restaurante
  - razón social, NIF/CIF/VAT, dirección, CP, ciudad, país, email, teléfono
- **`invoice_series`** — series por restaurante y año
  - prefijo (ej. `QORI`), año, último_numero, tipo (`simplificado` | `completa` | `rectificativa`)
- **`invoices`** — cabecera de factura
  - número (`QORI-2026-000001`), serie_id, tipo, fecha_emision
  - snapshot fiscal restaurante (nombre, CIF, dirección, CP, ciudad, tel)
  - snapshot cliente (todos los datos)
  - session_id, payment_id, table_number, waiter_name (snapshots)
  - base_imponible, total_iva, total
  - método_pago, estado (`emitida` | `rectificada` | `anulada`)
  - rectifies_invoice_id (nullable), rectification_reason
  - cash_session_id, issued_by_user_id, issued_by_waiter_id
- **`invoice_items`** — líneas
  - producto (snapshot nombre), cantidad, precio_unit, tipo_iva (%), base, iva_amount, total
- **`invoice_tax_breakdown`** — desglose IVA por tipo
  - tipo_iva, base, cuota

Reglas:
- GRANTs + RLS por restaurante (admin/manager emiten; waiter según flag del restaurante)
- Numeración atómica vía función `issue_invoice_number(restaurant_id, tipo)` con `SELECT ... FOR UPDATE` — sin saltos ni duplicados
- Trigger que impide `DELETE` y `UPDATE` de campos fiscales una vez emitida
- Añadir `default_vat_rate` a `menu_items` (default 10) y `invoicing_enabled` + `waiters_can_invoice` a `restaurants`

### Frontend

- Nueva ruta `/facturacion` + entrada en sidebar (módulo `invoicing_enabled`)
- **`InvoicesList`** — historial con filtros (fecha, cliente, tipo, estado) y acciones (ver, PDF, imprimir, email, rectificar)
- **`IssueInvoiceDialog`** — flujo:
  1. Tipo (simplificado / completa / rectificativa)
  2. Selector/creador de cliente (autocompletado desde `invoice_customers`)
  3. Previsualización con desglose IVA
  4. Botón Emitir
- **`InvoiceDetailView`** — vista completa + acciones
- Botón **"Emitir factura"** integrado en:
  - `TableSessionView` (mesa cerrada / con pago)
  - `Payments` (historial de pagos)
  - Cierre de caja
- **PDF A4** generado en cliente con `jspdf` + `jspdf-autotable` (plantilla profesional con logo, datos fiscales, líneas, desglose IVA, totales, pie legal)
- **Ticket térmico** vía Local Print Bridge reusando `customerTicketPrint` con plantilla `factura_compacta`

### Permisos
Aplicados vía `usePermissions` + RLS:
- platform_admin / admin / manager: total en su restaurante
- waiter: emitir solo si `restaurants.waiters_can_invoice = true`

---

## FASE 2 — Email + Rectificativas + Caja

- **Edge function `send-invoice-email`** usando Lovable Emails (infra ya disponible si está configurada; si no, se configura primero)
  - Asunto: `Factura {{invoice_number}} - {{restaurant_name}}`
  - PDF adjuntado como base64
- **Flujo de rectificativa**: dialog con motivo (datos cliente / importe / devolución / anulación parcial / otro), genera nueva factura tipo `rectificativa` vinculada y marca la original como `rectificada`
- **Integración con cierre de caja**: nuevo bloque en `CloseCashSession` y `DailyCashReport` con:
  - Nº tickets simplificados, nº facturas completas, nº rectificativas, total facturado

---

## FASE 3 — Preparación fiscal futura

Campos y hooks reservados (no activos, listos para conectar):
- `invoices.verifactu_hash`, `verifactu_chain_prev`, `verifactu_qr_url`
- `invoices.ticketbai_id`, `ticketbai_signature`
- `invoices.digital_signature`, `signature_cert_id`
- Endpoint stub `export-accounting` (CSV/JSON para asesoría)
- Estructura preparada para encadenamiento de hash (Verifactu)

No se llama a ninguna API fiscal todavía — solo dejamos el esquema y los puntos de extensión.

---

## Detalles técnicos

- PDF: `jspdf` + `jspdf-autotable` (cliente, sin servidor)
- Numeración: función SQL `SECURITY DEFINER` con bloqueo de fila en `invoice_series`
- Snapshots fiscales: copiamos a la factura en el momento de emisión (inmutables)
- IVA: calculado a partir del precio con IVA incluido (estilo restauración ES): `base = total / (1 + tipo/100)`
- Cliente PDF se guarda en `invoice_customers` si el usuario marca "Guardar cliente"
- Toda factura emitida queda vinculada a `session_id`, `payment_id`, `cash_session_id`, `restaurant_id`, `issued_by_*`

---

## ¿Empezamos por Fase 1?

Es la base imprescindible (emitir, numerar, PDF, historial, permisos). Sin esto las demás no aportan valor. Confirma y arranco con la migración + UI de la Fase 1.