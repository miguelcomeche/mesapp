
CREATE OR REPLACE FUNCTION public.wipe_restaurant_floor(_restaurant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sessions_closed int := 0;
  _elements_deleted int := 0;
  _tables_deleted int := 0;
  _tables_deactivated int := 0;
  _zones_deleted int := 0;
  _tbl record;
  _res jsonb;
BEGIN
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'restaurant required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 1) Close all open sessions for this restaurant (ghost or not)
  WITH upd AS (
    UPDATE public.table_sessions
       SET status = 'closed', closed_at = COALESCE(closed_at, now())
     WHERE restaurant_id = _restaurant
       AND status <> 'closed'
     RETURNING 1
  )
  SELECT count(*) INTO _sessions_closed FROM upd;

  -- 2) Reset tables: clear group assignment so groups can be removed cleanly
  UPDATE public.tables SET group_id = NULL, status = 'available'
   WHERE restaurant_id = _restaurant;
  DELETE FROM public.table_groups WHERE restaurant_id = _restaurant;

  -- 3) Delete floor plan visual elements
  WITH del AS (
    DELETE FROM public.floor_plan_elements
     WHERE restaurant_id = _restaurant
     RETURNING 1
  )
  SELECT count(*) INTO _elements_deleted FROM del;

  -- 4) Delete or deactivate tables based on history
  FOR _tbl IN
    SELECT id FROM public.tables WHERE restaurant_id = _restaurant
  LOOP
    IF EXISTS (SELECT 1 FROM public.table_sessions WHERE table_id = _tbl.id)
       OR EXISTS (SELECT 1 FROM public.reservations WHERE table_id = _tbl.id) THEN
      UPDATE public.tables
         SET active = false, status = 'available', group_id = NULL
       WHERE id = _tbl.id;
      _tables_deactivated := _tables_deactivated + 1;
    ELSE
      DELETE FROM public.tables WHERE id = _tbl.id;
      _tables_deleted := _tables_deleted + 1;
    END IF;
  END LOOP;

  -- 5) Delete zones (only those with no remaining references; deactivated tables still reference section name -> deactivate zones instead)
  -- Try delete first; if a zone still has references (because of deactivated tables), deactivate it instead.
  WITH zone_list AS (
    SELECT id, name FROM public.zones WHERE restaurant_id = _restaurant
  )
  SELECT count(*) INTO _zones_deleted FROM zone_list;

  -- Deactivate zones that still have referenced tables (kept for history)
  UPDATE public.zones z SET active = false
   WHERE z.restaurant_id = _restaurant
     AND EXISTS (
       SELECT 1 FROM public.tables t
        WHERE t.restaurant_id = _restaurant AND t.section = z.name
     );

  -- Delete the rest
  DELETE FROM public.zones z
   WHERE z.restaurant_id = _restaurant
     AND NOT EXISTS (
       SELECT 1 FROM public.tables t
        WHERE t.restaurant_id = _restaurant AND t.section = z.name
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.floor_plan_elements e
        WHERE e.restaurant_id = _restaurant AND e.zone = z.name
     );

  _res := jsonb_build_object(
    'sessions_closed', _sessions_closed,
    'elements_deleted', _elements_deleted,
    'tables_deleted', _tables_deleted,
    'tables_deactivated', _tables_deactivated,
    'zones_processed', _zones_deleted
  );
  RETURN _res;
END;
$$;
