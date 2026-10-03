ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name_snapshot text,
  ADD COLUMN IF NOT EXISTS vat_rate_snapshot numeric;

CREATE OR REPLACE FUNCTION public.order_items_fill_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.product_name_snapshot IS NULL OR NEW.vat_rate_snapshot IS NULL THEN
    SELECT COALESCE(NEW.product_name_snapshot, m.name), COALESCE(NEW.vat_rate_snapshot, m.vat_rate)
      INTO NEW.product_name_snapshot, NEW.vat_rate_snapshot
      FROM public.menu_items m WHERE m.id = NEW.menu_item_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_order_items_snapshot ON public.order_items;
CREATE TRIGGER trg_order_items_snapshot BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.order_items_fill_snapshot();

UPDATE public.order_items oi SET product_name_snapshot = m.name, vat_rate_snapshot = m.vat_rate
  FROM public.menu_items m WHERE m.id = oi.menu_item_id AND oi.vat_rate_snapshot IS NULL;

ALTER TABLE public.table_sessions ADD COLUMN IF NOT EXISTS ticket_number integer;
CREATE OR REPLACE FUNCTION public.table_sessions_assign_ticket_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'closed' AND NEW.ticket_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('ticket_' || NEW.restaurant_id::text));
    SELECT COALESCE(max(ticket_number),0)+1 INTO NEW.ticket_number
      FROM public.table_sessions WHERE restaurant_id = NEW.restaurant_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_table_sessions_ticket_number ON public.table_sessions;
CREATE TRIGGER trg_table_sessions_ticket_number BEFORE INSERT OR UPDATE OF status ON public.table_sessions
FOR EACH ROW EXECUTE FUNCTION public.table_sessions_assign_ticket_number();

WITH n AS (
  SELECT id, row_number() OVER (PARTITION BY restaurant_id ORDER BY closed_at, started_at) rn
  FROM public.table_sessions WHERE status = 'closed' AND ticket_number IS NULL
) UPDATE public.table_sessions ts SET ticket_number = n.rn FROM n WHERE n.id = ts.id;

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS production_start_date date;

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  payment_id uuid NOT NULL REFERENCES public.payments(id),
  session_id uuid REFERENCES public.table_sessions(id),
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'cash',
  reason text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refunds read" ON public.refunds FOR SELECT TO authenticated USING (public.can_access_restaurant(restaurant_id));
CREATE POLICY "refunds insert" ON public.refunds FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'platform_admin')
  OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager'));

CREATE TABLE public.daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  closing_date date NOT NULL,
  summary jsonb NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.daily_closings TO authenticated;
GRANT ALL ON public.daily_closings TO service_role;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closings read" ON public.daily_closings FOR SELECT TO authenticated USING (public.can_access_restaurant(restaurant_id));
CREATE POLICY "closings insert" ON public.daily_closings FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'platform_admin')
  OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager'));

-- Protect production fiscal history from deletion
CREATE OR REPLACE FUNCTION public.block_production_fiscal_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _type restaurant_type; _start date; _ts timestamptz;
BEGIN
  SELECT type, production_start_date INTO _type, _start FROM public.restaurants WHERE id = OLD.restaurant_id;
  IF _type = 'production' THEN
    _ts := CASE TG_TABLE_NAME
      WHEN 'payments' THEN (to_jsonb(OLD)->>'processed_at')::timestamptz
      WHEN 'invoices' THEN (to_jsonb(OLD)->>'issued_at')::timestamptz
      ELSE (to_jsonb(OLD)->>'started_at')::timestamptz END;
    IF _start IS NULL OR _ts >= _start::timestamptz THEN
      RAISE EXCEPTION 'Restaurante en Producción: no se pueden borrar datos fiscales reales' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_block_prod_delete ON public.payments;
CREATE TRIGGER trg_block_prod_delete BEFORE DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.block_production_fiscal_delete();
DROP TRIGGER IF EXISTS trg_block_prod_delete ON public.invoices;
CREATE TRIGGER trg_block_prod_delete BEFORE DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.block_production_fiscal_delete();
DROP TRIGGER IF EXISTS trg_block_prod_delete ON public.table_sessions;
CREATE TRIGGER trg_block_prod_delete BEFORE DELETE ON public.table_sessions FOR EACH ROW EXECUTE FUNCTION public.block_production_fiscal_delete();

-- Single ledger data source
CREATE OR REPLACE FUNCTION public.sales_ledger(_restaurant uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r restaurants; _f timestamptz := _from;
BEGIN
  IF NOT public.can_access_restaurant(_restaurant) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  SELECT * INTO _r FROM restaurants WHERE id = _restaurant;
  IF _r.type = 'production' AND _r.production_start_date IS NOT NULL THEN
    _f := greatest(_from, _r.production_start_date::timestamptz);
  END IF;
  RETURN jsonb_build_object(
    'restaurant', jsonb_build_object('name',_r.name,'commercial_name',_r.commercial_name,'legal_name',_r.legal_name,
       'tax_id',_r.tax_id,'address',_r.address,'postal_code',_r.postal_code,'city',_r.city,'province',_r.province,
       'type',_r.type,'production_start_date',_r.production_start_date),
    'from', _f, 'to', _to,
    'tickets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', ts.id, 'ticket_number', ts.ticket_number, 'closed_at', ts.closed_at, 'started_at', ts.started_at,
        'table', t.number, 'waiter', w.name, 'guests', ts.guest_count,
        'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'name', COALESCE(oi.product_name_snapshot, m.name), 'qty', oi.quantity, 'unit_price', oi.unit_price,
            'vat', COALESCE(oi.vat_rate_snapshot, m.vat_rate, 10), 'status', oi.status,
            'complimentary', oi.is_complimentary, 'deleted', oi.deleted_at IS NOT NULL))
          FROM orders o JOIN order_items oi ON oi.order_id = o.id LEFT JOIN menu_items m ON m.id = oi.menu_item_id
          WHERE o.session_id = ts.id), '[]'::jsonb)
      ) ORDER BY ts.closed_at)
      FROM table_sessions ts LEFT JOIN tables t ON t.id = ts.table_id LEFT JOIN waiters w ON w.id = ts.closed_by_waiter_id
      WHERE ts.restaurant_id = _restaurant AND ts.status = 'closed' AND ts.closed_at >= _f AND ts.closed_at <= _to), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'session_id', p.session_id, 'amount', p.amount, 'tip', COALESCE(p.tip,0), 'method', p.method,
        'discount', p.discount_amount, 'voided', p.voided, 'processed_at', p.processed_at,
        'void_reason', (SELECT v.reason FROM payment_voids v WHERE v.payment_id = p.id LIMIT 1)) ORDER BY p.processed_at)
      FROM payments p JOIN table_sessions ts ON ts.id = p.session_id
      WHERE ts.restaurant_id = _restaurant AND ts.status = 'closed' AND ts.closed_at >= _f AND ts.closed_at <= _to), '[]'::jsonb),
    'refunds', COALESCE((SELECT jsonb_agg(to_jsonb(rf) ORDER BY rf.created_at) FROM refunds rf
      JOIN table_sessions ts ON ts.id = rf.session_id
      WHERE rf.restaurant_id = _restaurant AND ts.closed_at >= _f AND ts.closed_at <= _to), '[]'::jsonb),
    'invoices', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'invoice_number', i.invoice_number,
        'issued_at', i.issued_at, 'customer', i.customer_legal_name, 'tax_id', i.customer_tax_id, 'session_id', i.session_id,
        'subtotal', i.subtotal, 'tax_total', i.tax_total, 'total', i.total, 'type', i.type, 'status', i.status) ORDER BY i.issued_at)
      FROM invoices i WHERE i.restaurant_id = _restaurant AND i.issued_at >= _f AND i.issued_at <= _to), '[]'::jsonb),
    'cash_sessions', COALESCE((SELECT jsonb_agg(to_jsonb(cs) - 'signature' ORDER BY cs.opened_at) FROM cash_sessions cs
      WHERE cs.restaurant_id = _restaurant AND cs.opened_at >= _f AND cs.opened_at <= _to), '[]'::jsonb)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.sales_ledger(uuid, timestamptz, timestamptz) TO authenticated;