## Módulo Caja & Pagos Profesional

Construir un sistema completo de caja para hostelería sobre el módulo actual de Pagos, manteniendo el diseño visual de Mesapp y preparado para multi-restaurante / multi-caja / integración fiscal futura.

---

### 1. Arquitectura de datos (nueva migración)

Nuevas tablas en `public`, todas con `restaurant_id`, RLS por rol, GRANTs estándar y triggers `updated_at`.

**`cash_registers`** (preparado para múltiples cajas/turnos)
- `restaurant_id`, `name` (ej. "Caja Principal"), `active`
- Default: una caja "Principal" por restaurante (trigger al crear restaurante)

**`cash_sessions`** (apertura/cierre = un turno)
- `restaurant_id`, `register_id`, `status` (`open`/`closed`)
- `opened_by` (uuid), `opened_at`, `opening_amount`
- `closed_by`, `closed_at`, `expected_amount`, `counted_amount`, `difference`
- `cash_sales`, `card_sales`, `other_sales`, `tips_cash`, `tips_card`
- `cash_in_total`, `cash_out_total`
- `denominations` jsonb (arqueo: {500:0, 200:0, ...})
- `signature` text (base64 firma digital), `signed_by_name`
- `notes`
- Único parcial: solo una `open` por `register_id`

**`cash_movements`** (entradas/salidas de efectivo)
- `restaurant_id`, `session_id`, `type` (`in`/`out`)
- `amount`, `reason`, `notes`, `created_by`, `created_at`

**`payment_voids`** (anulaciones — auditoría)
- `restaurant_id`, `payment_id`, `voided_by`, `voided_at`, `reason`

**Extensiones a tablas existentes:**
- `payments`: añadir `cash_session_id`, `tip_amount`, `voided` boolean
- `payments`: ya tiene `method`, `discount_amount` → reutilizar
- Mantener historial intacto (`payments` nunca se borra; soft-void)

**RPC functions (SECURITY DEFINER):**
- `open_cash_session(_restaurant, _register, _opening_amount, _notes)` — valida que no exista otra abierta, valida rol (admin/manager).
- `close_cash_session(_session, _counted_amount, _denominations jsonb, _signature, _signed_by_name, _notes)` — calcula totales agregando `payments` y `cash_movements` ligados a la sesión, escribe snapshot, marca `closed`.
- `register_cash_movement(_session, _type, _amount, _reason, _notes)`.
- `void_payment(_payment, _reason)`.
- `current_cash_session(_restaurant)` → devuelve sesión abierta o NULL.
- `cash_session_summary(_session)` → totales en vivo (sin cerrar) para la pantalla de cierre y arqueo.

**Permisos (en RPC):**
- Abrir/cerrar caja: `platform_admin`, `restaurant_admin`, `manager`.
- Movimientos / arqueo / firma: igual.
- Cobros: cualquier rol activo (ya existe).
- Anulaciones / descuentos: `platform_admin`, `restaurant_admin`, `manager`.

**Bloqueo de cobros sin caja abierta:**
- Trigger `BEFORE INSERT` en `payments` que exige una `cash_session` abierta del restaurante y la asigna automáticamente a `cash_session_id`.
- Mensaje: `Debe abrir una caja antes de comenzar a operar.`

---

### 2. Rutas y navegación

Sustituir el módulo "Pagos" actual por **"Caja"** en el sidebar (mismo icono o `Wallet`).

```
/caja                → Dashboard (resumen de sesión + KPIs del día)
/caja/apertura       → Apertura de caja
/caja/cierre         → Cierre + arqueo + firma
/caja/movimientos    → Entradas/salidas
/caja/historial      → Cierres anteriores con filtros
/caja/diario         → Diario de caja (informe imprimible)
```

Pagos por mesa siguen viviendo en el flujo de Comandas/Mesas (no cambia).

---

### 3. Componentes UI (mismo design system, tokens HSL, shadcn)

`src/pages/cash/`
- `CashDashboard.tsx` — estado sesión, KPIs (Ventas hoy, semana, ticket medio, mesas cobradas, propinas, diferencia última caja), gráficos (recharts: ventas por hora, por día, métodos de pago).
- `OpenCashSession.tsx` — formulario: fondo inicial, responsable (auto = usuario actual, editable solo admin), notas.
- `CloseCashSession.tsx` — desglose en vivo + arqueo por denominaciones + diferencia + firma (canvas) + confirmar.
- `CashMovements.tsx` — tabla + diálogo nueva entrada/salida.
- `CashHistory.tsx` — listado con filtros (desde/hasta/responsable), export CSV/Excel/PDF.
- `DailyCashReport.tsx` — formato imprimible (Apertura/Ventas/Entradas/Salidas/Propinas/Esperado/Real/Diferencia).

`src/components/cash/`
- `CashStatusBanner.tsx` — banner global "Caja cerrada — abrir caja" cuando no hay sesión abierta.
- `DenominationCounter.tsx` — grid billetes + monedas con totales.
- `SignaturePad.tsx` — canvas firma (lib `react-signature-canvas` o canvas nativo).
- `CashKpiGrid.tsx`, `PaymentMethodPie.tsx`, `SalesByHourChart.tsx`.

`src/hooks/`
- `useCashSession.ts` — sesión abierta + realtime.
- `useCashMovements.ts`.
- `useCashHistory.ts`.
- `useCashSummary.ts` — totales en vivo.

`src/lib/cash.ts` — helpers (formatEuro, sumDenominations, exportCSV/PDF reutilizando `lib/analytics.ts`).

---

### 4. Integración con cobros existentes

- En el modal de pago: añadir campo opcional `tip_amount` separado por método.
- Si no hay sesión abierta → bloquear con toast + CTA "Abrir caja" (el trigger DB es la red de seguridad).
- Cada `payments.insert` queda automáticamente asociado a la sesión activa.
- Botón "Anular cobro" (solo admin/manager) → llama `void_payment`.
- Descuentos: el campo `discount_amount` ya existe; añadir `discount_reason` y selector de motivo (Cortesía/VIP/Incidencia/Promoción/Otro) en el modal de pago. Restringido a admin/manager (ya en memoria).

---

### 5. Exportación

Reutilizar `toCSV` de `src/lib/analytics.ts`. Para PDF: usar window.print con hoja estilada (`@media print`) — mismo enfoque que `ExportBar` actual. Aplicable a Diario, Historial y Movimientos.

---

### 6. Permisos UI

`ProtectedRoute` con matriz:
- `/caja/*` → admin/manager/waiter (waiter ve dashboard read-only + cobros).
- `/caja/apertura`, `/caja/cierre`, `/caja/movimientos` → admin/manager.
- Anulaciones, descuentos, ver historial completo → admin/manager.

---

### 7. Preparado para el futuro

- `cash_registers` permite N cajas por restaurante (UI lista solo "Principal" v1).
- `cash_sessions` ya modela turnos (varios al día).
- Campos `signature`, `signed_by_name` listos para PDF firmado.
- Snapshot inmutable en cierre (los totales se congelan en la fila) para auditoría Verifactu / TicketBAI.
- `payment_voids` + nunca DELETE → trazabilidad completa.

---

### Archivos

**Nuevos**
- `supabase/migrations/<ts>_cash_module.sql`
- `src/pages/cash/{CashDashboard,OpenCashSession,CloseCashSession,CashMovements,CashHistory,DailyCashReport}.tsx`
- `src/components/cash/{CashStatusBanner,DenominationCounter,SignaturePad,CashKpiGrid,PaymentMethodPie,SalesByHourChart}.tsx`
- `src/hooks/{useCashSession,useCashMovements,useCashHistory,useCashSummary}.ts`
- `src/lib/cash.ts`

**Editados**
- `src/App.tsx` — nuevas rutas `/caja/*`, retirar `/payments` antiguo o redirigir.
- `src/components/layout/Sidebar.tsx` — "Pagos" → "Caja".
- Modal de cobro existente — propinas, motivo descuento, bloqueo sin caja.
- `src/integrations/supabase/types.ts` (auto tras migración).

**Dependencias nuevas**
- `react-signature-canvas` (firma). Resto ya disponible (`recharts`, `date-fns`, shadcn).

---

### Plan de ejecución

1. Crear migración (tablas, RLS, GRANTs, RPCs, trigger bloqueo cobros).
2. Hooks + helpers.
3. Páginas Apertura → Dashboard → Cierre/Arqueo → Movimientos → Historial → Diario.
4. Integración en flujo de cobros + banner global.
5. Export + firma + permisos.
