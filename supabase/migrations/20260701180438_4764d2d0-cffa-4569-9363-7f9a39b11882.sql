
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_complimentary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS complimentary_original_unit_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS complimentary_reason text,
  ADD COLUMN IF NOT EXISTS complimentary_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS complimentary_by_waiter_id uuid,
  ADD COLUMN IF NOT EXISTS complimentary_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_order_item_complimentary(_item uuid, _reason text DEFAULT NULL, _waiter uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  _is_comp boolean;
  _role text;
  _paid_count int;
BEGIN
  SELECT ts.restaurant_id, ts.id, o.id, oi.menu_item_id, mi.name,
         oi.quantity, oi.unit_price, oi.status::text, oi.deleted_at, oi.is_complimentary
    INTO _restaurant, _session, _order, _menu_item, _name, _qty, _price, _status, _deleted_at, _is_comp
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.table_sessions ts ON ts.id = o.session_id
    LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
   WHERE oi.id = _item;

  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF _status = 'cancelled' OR _deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Producto anulado o eliminado' USING ERRCODE = 'P0001';
  END IF;
  IF _is_comp THEN
    RETURN jsonb_build_object('action','noop','id',_item);
  END IF;

  _role := public.resolve_caller_role(_restaurant);
  IF _role IS NULL OR _role = 'waiter' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO _paid_count
    FROM public.payment_items pi
    JOIN public.payments p ON p.id = pi.payment_id
   WHERE pi.order_item_id = _item AND NOT COALESCE(p.voided, false);
  IF _paid_count > 0 THEN
    RAISE EXCEPTION 'ALREADY_PAID' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.order_items SET
    is_complimentary = true,
    complimentary_original_unit_price = unit_price,
    complimentary_reason = _reason,
    complimentary_by_user_id = auth.uid(),
    complimentary_by_waiter_id = _waiter,
    complimentary_at = now(),
    unit_price = 0
   WHERE id = _item;

  INSERT INTO public.order_item_audit_logs (
    restaurant_id, table_session_id, order_id, order_item_id, menu_item_id,
    product_name_snapshot, quantity_snapshot, unit_price_snapshot,
    action_type, reason, performed_by_user_id, performed_by_waiter_id, performed_by_role
  ) VALUES (
    _restaurant, _session, _order, _item, _menu_item,
    _name, _qty, _price,
    'complimentary', _reason, auth.uid(), _waiter, _role
  );

  RETURN jsonb_build_object('action','complimentary','id',_item);
END;
$$;

CREATE OR REPLACE FUNCTION public.unmark_order_item_complimentary(_item uuid, _waiter uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _restaurant uuid;
  _session uuid;
  _order uuid;
  _menu_item uuid;
  _name text;
  _qty numeric;
  _orig numeric;
  _is_comp boolean;
  _role text;
BEGIN
  SELECT ts.restaurant_id, ts.id, o.id, oi.menu_item_id, mi.name,
         oi.quantity, oi.complimentary_original_unit_price, oi.is_complimentary
    INTO _restaurant, _session, _order, _menu_item, _name, _qty, _orig, _is_comp
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.table_sessions ts ON ts.id = o.session_id
    LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
   WHERE oi.id = _item;

  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT COALESCE(_is_comp, false) THEN
    RETURN jsonb_build_object('action','noop','id',_item);
  END IF;

  _role := public.resolve_caller_role(_restaurant);
  IF _role IS NULL OR _role = 'waiter' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.order_items SET
    is_complimentary = false,
    unit_price = COALESCE(_orig, unit_price),
    complimentary_original_unit_price = NULL,
    complimentary_reason = NULL,
    complimentary_by_user_id = NULL,
    complimentary_by_waiter_id = NULL,
    complimentary_at = NULL
   WHERE id = _item;

  INSERT INTO public.order_item_audit_logs (
    restaurant_id, table_session_id, order_id, order_item_id, menu_item_id,
    product_name_snapshot, quantity_snapshot, unit_price_snapshot,
    action_type, reason, performed_by_user_id, performed_by_waiter_id, performed_by_role
  ) VALUES (
    _restaurant, _session, _order, _item, _menu_item,
    _name, _qty, COALESCE(_orig, 0),
    'complimentary_removed', NULL, auth.uid(), _waiter, _role
  );

  RETURN jsonb_build_object('action','complimentary_removed','id',_item);
END;
$$;
