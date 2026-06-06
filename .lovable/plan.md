# Order Item Cancellation & Deletion Audit System

A full, POS-grade flow for removing products from an order with role-based rules, full auditing, KDS synchronization, billing exclusion, restaurant settings, and analytics.

---

## 1. Database changes (single migration)

### 1.1 Extend `order_items`
Add columns (nullable):
- `cancelled_at`, `cancelled_by_user_id` (uuid → profiles), `cancelled_by_waiter_id` (uuid → waiters), `cancellation_reason` (text)
- `deleted_at`, `deleted_by_user_id`, `deleted_by_waiter_id`, `deletion_reason`

Keep existing `status` enum (`pending|sent|preparing|ready|served|cancelled`). Use `status='cancelled'` for Anular. For DELETE, we soft-delete by setting `deleted_at` (item is hidden from UI but rows remain). No new enum value to avoid type churn.

### 1.2 New table `order_item_audit_logs`
Fields: id, restaurant_id, table_session_id, order_id, order_item_id, menu_item_id, product_name_snapshot, quantity_snapshot, unit_price_snapshot, action_type (`created|deleted|cancelled|restored|modified`), reason, performed_by_user_id, performed_by_waiter_id, performed_by_role (text), created_at.

Indexes on (restaurant_id, created_at desc), (order_item_id), (table_session_id).

### 1.3 RLS + grants
- `order_item_audit_logs`: SELECT for platform_admin (all), restaurant_admin/manager (own restaurant). INSERT only via security-definer RPC. No waiter SELECT.
- Standard `GRANT` block for authenticated + service_role.

### 1.4 Security-definer RPCs
- `cancel_order_item(_item uuid, _reason text)` — checks role permissions + restaurant setting `waiters_can_cancel`, validates not paid, sets `status='cancelled'`, `cancelled_*` columns, inserts audit row, marks any kitchen ticket items as cancelled. Returns jsonb result.
- `delete_order_item(_item uuid, _reason text)` — only when item is `pending` AND not on any kitchen ticket AND no payment_items. Sets `deleted_at`, audit row. Waiters blocked.
- Both functions raise `P0001` with code `ALREADY_PAID` if payment_items exist.

### 1.5 Recompute totals
Update `update_session_total` trigger logic to exclude `status='cancelled'` AND `deleted_at IS NOT NULL`. (Currently already excludes `cancelled`; add the `deleted_at IS NULL` filter.)

### 1.6 Restaurant settings
Add to `restaurants`:
- `waiters_can_cancel_items boolean default true`
- `require_cancellation_reason boolean default true`
- `print_cancellation_ticket boolean default true`

---

## 2. Frontend

### 2.1 Hook `useOrderItemActions`
Wraps `cancel_order_item` and `delete_order_item` RPCs. Surfaces errors with friendly Spanish toasts (`ALREADY_PAID` → "Producto ya pagado. Debes hacer una devolución.").

### 2.2 Cancel modal `CancelOrderItemDialog`
- Title: "Anular producto"
- Preset reasons radio list + "Otro" → free text input (required if Otro)
- Cancel/Confirm buttons
- When `require_cancellation_reason=false` and reason not Otro, allow empty.

### 2.3 `OrderItemRow` updates
- If `deleted_at` set → hide entirely
- If `status='cancelled'` → render line-through, muted, "Anulado" badge with tooltip showing reason + who
- Action menu (dropdown) per item:
  - Paid → disabled, tooltip "Producto ya pagado…"
  - Pending & no ticket → "Borrar" (if role allows) + "Anular"
  - Sent/preparing/etc → only "Anular"
  - Hide actions when already cancelled

### 2.4 Permissions
Extend `usePermissions` with:
- `canDeleteOrderItem` (admin/manager/platform_admin)
- `canCancelOrderItem` (always true for admin/manager; waiter only when restaurant setting allows)

### 2.5 KDS / Bar
- `useKitchenTickets` filters out items whose `order_item.status='cancelled'` from the active board, or shows them briefly in a "Anulados" strip.
- TicketItem with cancelled order item → red "ANULADO" badge.

### 2.6 Payments
`PaymentDialog` and selection lists exclude cancelled/deleted items (already partially true via session total).

---

## 3. Restaurant settings UI
In `RestaurantSettings.tsx`, add a "Anulaciones" card with three switches bound to the new restaurant columns. Restaurant_admin + platform_admin can edit.

---

## 4. Analytics
New section "Anulaciones y borrados" in `Analytics.tsx`:
- KPIs: total items cancelled, total value cancelled, total items deleted, total value deleted
- Tables: by user, by waiter, by reason, top cancelled products
- Reuses current date range filter.
Source: `order_item_audit_logs` joined with `order_items`/`menu_items`/`profiles`/`waiters`.

Cash close (`CloseCashSession` / `DailyCashReport`): add line "Anulaciones: X items · Y€" using audit logs scoped to the cash session window.

---

## 5. Kitchen cancellation ticket
When `print_cancellation_ticket=true` and item was already on a kitchen/bar ticket, enqueue a print job (stub via existing printers infrastructure — render `ANULACIÓN / Mesa X / qty product / Motivo: reason`). If no print backend exists yet, just emit a toast/log; leaves hook for ePOS integration.

---

## 6. Acceptance tests (manual)
The five tests in the request map to:
1. Manager deletes pending item → audit row `deleted`, total recalculated.
2. Waiter cancels sent item with reason → audit row `cancelled`, removed from total, KDS shows cancelled.
3. Cancel paid item → RPC raises ALREADY_PAID, friendly toast.
4. Analytics → cancellation rows appear under user/waiter breakdown.
5. Cash close → cancellation totals appear.

---

## Technical notes

- All mutations go through SECURITY DEFINER RPCs so RLS stays tight and auditing is atomic.
- We soft-delete (`deleted_at`) rather than hard-delete so historical references (kitchen ticket joins, audit) remain valid.
- `performed_by_role` is derived inside the RPC by checking `has_role` / `has_restaurant_role` in priority order: platform_admin → restaurant_admin → manager → waiter.
- Waiter actions resolve `performed_by_waiter_id` from the active waiter passed via existing client patterns (Active Waiter context already feeds RPC calls elsewhere; we'll accept an optional `_waiter uuid` parameter).
- No schema changes to enums; future-proofed for `deleted` status by relying on `deleted_at` column.
