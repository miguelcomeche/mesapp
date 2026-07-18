-- 1) Column uses_kds
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS uses_kds boolean NOT NULL DEFAULT true;

-- 2) RPC to clear closed tickets (marks items as served, never deletes)
CREATE OR REPLACE FUNCTION public.clear_closed_kitchen_tickets(_restaurant uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'restaurant required' USING ERRCODE='P0001';
  END IF;
  IF NOT (
    public.has_role(auth.uid(),'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  UPDATE public.order_items oi
     SET status = 'served',
         served_at = COALESCE(oi.served_at, now())
    FROM public.orders o
    JOIN public.table_sessions ts ON ts.id = o.session_id
   WHERE oi.order_id = o.id
     AND ts.restaurant_id = _restaurant
     AND ts.status = 'closed'
     AND oi.status IN ('pending','sent','preparing','ready');

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

-- 3) Trigger: auto-serve when restaurant does not use KDS
CREATE OR REPLACE FUNCTION public.order_items_auto_serve_when_no_kds()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _uses_kds boolean;
BEGIN
  IF NEW.status NOT IN ('pending','sent') THEN
    RETURN NEW;
  END IF;
  SELECT r.uses_kds INTO _uses_kds
    FROM public.orders o
    JOIN public.table_sessions ts ON ts.id = o.session_id
    JOIN public.restaurants r ON r.id = ts.restaurant_id
   WHERE o.id = NEW.order_id;
  IF _uses_kds IS FALSE THEN
    NEW.status := 'served';
    IF NEW.served_at IS NULL THEN
      NEW.served_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_items_auto_serve_no_kds ON public.order_items;
CREATE TRIGGER trg_order_items_auto_serve_no_kds
BEFORE INSERT OR UPDATE OF status ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.order_items_auto_serve_when_no_kds();