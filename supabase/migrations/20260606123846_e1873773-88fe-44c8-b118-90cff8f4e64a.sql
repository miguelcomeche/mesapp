
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_active ON public.tables(restaurant_id, active);

-- Detect whether a session has any "real" activity (non-cancelled order items or any payment).
CREATE OR REPLACE FUNCTION public.session_has_real_activity(_session uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.session_id = _session AND oi.status <> 'cancelled'
  ) OR EXISTS (
    SELECT 1 FROM public.payments p WHERE p.session_id = _session
  );
$$;

-- Close ghost sessions for a restaurant. Returns the count closed.
CREATE OR REPLACE FUNCTION public.cleanup_ghost_sessions(_restaurant uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH ghosts AS (
    SELECT ts.id
    FROM public.table_sessions ts
    JOIN public.tables t ON t.id = ts.table_id
    WHERE ts.restaurant_id = _restaurant
      AND ts.status = 'active'
      AND ts.closed_at IS NULL
      AND t.status = 'available'
      AND NOT public.session_has_real_activity(ts.id)
  ), upd AS (
    UPDATE public.table_sessions
       SET status = 'closed', closed_at = now()
     WHERE id IN (SELECT id FROM ghosts)
     RETURNING 1
  )
  SELECT count(*) INTO _count FROM upd;

  RETURN _count;
END;
$$;

-- Safe table delete: closes ghost sessions, then either soft-deletes
-- (sets active=false) when history exists, or hard-deletes when clean.
CREATE OR REPLACE FUNCTION public.delete_table_safe(_table uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _restaurant uuid;
  _status text;
  _blocking record;
  _history int;
BEGIN
  SELECT restaurant_id, status::text INTO _restaurant, _status
    FROM public.tables WHERE id = _table;
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'Mesa no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 1) Auto-close ghost sessions for this table specifically.
  UPDATE public.table_sessions ts
     SET status = 'closed', closed_at = now()
   WHERE ts.table_id = _table
     AND ts.status = 'active'
     AND ts.closed_at IS NULL
     AND NOT public.session_has_real_activity(ts.id);

  -- 2) Look for any remaining truly-open session.
  SELECT ts.id, ts.status::text AS status, ts.started_at AS opened_at, ts.table_id
    INTO _blocking
    FROM public.table_sessions ts
   WHERE ts.table_id = _table
     AND ts.status = 'active'
     AND ts.closed_at IS NULL
   LIMIT 1;

  IF _blocking.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'action', 'blocked',
      'reason', 'open_session',
      'session', jsonb_build_object(
        'id', _blocking.id,
        'status', _blocking.status,
        'opened_at', _blocking.opened_at,
        'table_id', _blocking.table_id
      )
    );
  END IF;

  -- 3) Check for any history (closed sessions or reservations).
  SELECT
    (SELECT count(*) FROM public.table_sessions WHERE table_id = _table)
    + (SELECT count(*) FROM public.reservations WHERE table_id = _table)
    INTO _history;

  IF _history > 0 THEN
    UPDATE public.tables
       SET active = false,
           status = 'available',
           group_id = NULL
     WHERE id = _table;
    RETURN jsonb_build_object('action', 'deactivated', 'table_id', _table);
  END IF;

  DELETE FROM public.tables WHERE id = _table;
  RETURN jsonb_build_object('action', 'deleted', 'table_id', _table);
END;
$$;

GRANT EXECUTE ON FUNCTION public.session_has_real_activity(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_ghost_sessions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_table_safe(uuid) TO authenticated, service_role;
