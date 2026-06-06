
-- 1) Extend order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS cancelled_by_waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_by_waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

-- 2) Restaurant settings
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS waiters_can_cancel_items boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_cancellation_reason boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS print_cancellation_ticket boolean NOT NULL DEFAULT true;

-- 3) Audit log table
CREATE TABLE IF NOT EXISTS public.order_item_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_session_id uuid,
  order_id uuid,
  order_item_id uuid,
  menu_item_id uuid,
  product_name_snapshot text,
  quantity_snapshot numeric,
  unit_price_snapshot numeric,
  action_type text NOT NULL CHECK (action_type IN ('created','deleted','cancelled','restored','modified')),
  reason text,
  performed_by_user_id uuid,
  performed_by_waiter_id uuid,
  performed_by_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_item_audit_logs_restaurant_created_idx
  ON public.order_item_audit_logs (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_item_audit_logs_item_idx
  ON public.order_item_audit_logs (order_item_id);
CREATE INDEX IF NOT EXISTS order_item_audit_logs_session_idx
  ON public.order_item_audit_logs (table_session_id);

GRANT SELECT ON public.order_item_audit_logs TO authenticated;
GRANT ALL ON public.order_item_audit_logs TO service_role;

ALTER TABLE public.order_item_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins view all audit logs" ON public.order_item_audit_logs;
CREATE POLICY "Platform admins view all audit logs"
  ON public.order_item_audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'));

DROP POLICY IF EXISTS "Restaurant admins and managers view own audit logs" ON public.order_item_audit_logs;
CREATE POLICY "Restaurant admins and managers view own audit logs"
  ON public.order_item_audit_logs FOR SELECT
  TO authenticated
  USING (
    public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  );

-- No INSERT/UPDATE/DELETE policies for non-service roles: writes only via SECURITY DEFINER RPCs.

-- 4) Update session total to exclude soft-deleted items
CREATE OR REPLACE FUNCTION public.update_session_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  session_id_val UUID;
  new_total DECIMAL(10,2);
BEGIN
  SELECT o.session_id INTO session_id_val
  FROM public.orders o
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) INTO new_total
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.session_id = session_id_val
    AND oi.status <> 'cancelled'
    AND oi.deleted_at IS NULL;

  UPDATE public.table_sessions
  SET total_amount = new_total
  WHERE id = session_id_val;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 5) Helper: resolve caller role label for a restaurant
CREATE OR REPLACE FUNCTION public.resolve_caller_role(_restaurant uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'platform_admin') THEN 'platform_admin'
    WHEN public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin') THEN 'restaurant_admin'
    WHEN public.has_restaurant_role(auth.uid(), _restaurant, 'manager') THEN 'manager'
    WHEN public.has_restaurant_role(auth.uid(), _restaurant, 'waiter') THEN 'waiter'
    ELSE NULL
  END;
$$;

-- 6) cancel_order_item
CREATE OR REPLACE FUNCTION public.cancel_order_item(_item uuid, _reason text, _waiter uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _restaurant uuid;
  _session uuid;
  _order uuid;
  _menu_item uuid;
  _name text;
  _qty numeric;
  _price numeric;
  _status text;
  _deleted_at timestamptz;
  _role text;
  _paid_count int;
  _waiters_can_cancel boolean;
  _require_reason boolean;
BEGIN
  SELECT ts.restaurant_id, ts.id, o.id, oi.menu_item_id, mi.name,
         oi.quantity, oi.unit_price, oi.status::text, oi.deleted_at
    INTO _restaurant, _session, _order, _menu_item, _name, _qty, _price, _status, _deleted_at
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.table_sessions ts ON ts.id = o.session_id
    LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
    WHERE oi.id = _item;

  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF _status = 'cancelled' OR _deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Producto ya anulado o eliminado' USING ERRCODE = 'P0001';
  END IF;

  _role := public.resolve_caller_role(_restaurant);
  IF _role IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT waiters_can_cancel_items, require_cancellation_reason
    INTO _waiters_can_cancel, _require_reason
    FROM public.restaurants WHERE id = _restaurant;

  IF _role = 'waiter' AND NOT COALESCE(_waiters_can_cancel, true) THEN
    RAISE EXCEPTION 'Los camareros no pueden anular productos' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(_require_reason, true) AND (_reason IS NULL OR length(btrim(_reason)) = 0) THEN
    RAISE EXCEPTION 'Motivo requerido' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO _paid_count
    FROM public.payment_items pi
    JOIN public.payments p ON p.id = pi.payment_id
   WHERE pi.order_item_id = _item AND NOT COALESCE(p.voided, false);

  IF _paid_count > 0 THEN
    RAISE EXCEPTION 'ALREADY_PAID' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.order_items SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by_user_id = auth.uid(),
    cancelled_by_waiter_id = _waiter,
    cancellation_reason = _reason
   WHERE id = _item;

  INSERT INTO public.order_item_audit_logs (
    restaurant_id, table_session_id, order_id, order_item_id, menu_item_id,
    product_name_snapshot, quantity_snapshot, unit_price_snapshot,
    action_type, reason, performed_by_user_id, performed_by_waiter_id, performed_by_role
  ) VALUES (
    _restaurant, _session, _order, _item, _menu_item,
    _name, _qty, _price,
    'cancelled', _reason, auth.uid(), _waiter, _role
  );

  RETURN jsonb_build_object('action','cancelled','id',_item);
END;
$$;

-- 7) delete_order_item (soft delete; only pending, not on any ticket, not paid)
CREATE OR REPLACE FUNCTION public.delete_order_item(_item uuid, _reason text, _waiter uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _restaurant uuid;
  _session uuid;
  _order uuid;
  _menu_item uuid;
  _name text;
  _qty numeric;
  _price numeric;
  _status text;
  _sent_at timestamptz;
  _deleted_at timestamptz;
  _role text;
  _paid_count int;
  _ticket_count int;
BEGIN
  SELECT ts.restaurant_id, ts.id, o.id, oi.menu_item_id, mi.name,
         oi.quantity, oi.unit_price, oi.status::text, oi.sent_at, oi.deleted_at
    INTO _restaurant, _session, _order, _menu_item, _name, _qty, _price, _status, _sent_at, _deleted_at
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.table_sessions ts ON ts.id = o.session_id
    LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
    WHERE oi.id = _item;

  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF _deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Producto ya eliminado' USING ERRCODE = 'P0001';
  END IF;

  _role := public.resolve_caller_role(_restaurant);
  IF _role IS NULL OR _role = 'waiter' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Only pending items, never sent, no kitchen tickets, no payments
  IF _status <> 'pending' OR _sent_at IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_SENT' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO _ticket_count FROM public.ticket_items WHERE order_item_id = _item;
  IF _ticket_count > 0 THEN
    RAISE EXCEPTION 'ALREADY_SENT' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO _paid_count
    FROM public.payment_items pi
    JOIN public.payments p ON p.id = pi.payment_id
   WHERE pi.order_item_id = _item AND NOT COALESCE(p.voided, false);
  IF _paid_count > 0 THEN
    RAISE EXCEPTION 'ALREADY_PAID' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.order_items SET
    deleted_at = now(),
    deleted_by_user_id = auth.uid(),
    deleted_by_waiter_id = _waiter,
    deletion_reason = _reason,
    status = 'cancelled'  -- exclude from totals via existing trigger filter
   WHERE id = _item;

  INSERT INTO public.order_item_audit_logs (
    restaurant_id, table_session_id, order_id, order_item_id, menu_item_id,
    product_name_snapshot, quantity_snapshot, unit_price_snapshot,
    action_type, reason, performed_by_user_id, performed_by_waiter_id, performed_by_role
  ) VALUES (
    _restaurant, _session, _order, _item, _menu_item,
    _name, _qty, _price,
    'deleted', _reason, auth.uid(), _waiter, _role
  );

  RETURN jsonb_build_object('action','deleted','id',_item);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_order_item(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_order_item(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_caller_role(uuid) TO authenticated;
