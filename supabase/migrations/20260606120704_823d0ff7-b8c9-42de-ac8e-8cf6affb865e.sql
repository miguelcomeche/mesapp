
-- 1. Extend public.tables with capacity range, visual size, rotation and group membership
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS min_capacity     integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_capacity     integer,
  ADD COLUMN IF NOT EXISTS width            integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS height           integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS rotation         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS group_id         uuid;

-- Backfill max_capacity from current capacity
UPDATE public.tables SET max_capacity = capacity WHERE max_capacity IS NULL;
ALTER TABLE public.tables ALTER COLUMN max_capacity SET NOT NULL;
ALTER TABLE public.tables ALTER COLUMN max_capacity SET DEFAULT 1;

ALTER TABLE public.tables
  DROP CONSTRAINT IF EXISTS tables_capacity_range_chk;
ALTER TABLE public.tables
  ADD CONSTRAINT tables_capacity_range_chk
  CHECK (min_capacity >= 1 AND capacity >= min_capacity AND max_capacity >= capacity AND max_capacity <= 50);

-- 2. table_groups
CREATE TABLE IF NOT EXISTS public.table_groups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name              text NOT NULL DEFAULT '',
  min_capacity      integer NOT NULL DEFAULT 1,
  default_capacity  integer NOT NULL DEFAULT 1,
  max_capacity      integer NOT NULL DEFAULT 1,
  zone              text,
  active_session_id uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT table_groups_capacity_chk CHECK (default_capacity <= 50)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_groups TO authenticated;
GRANT ALL ON public.table_groups TO service_role;

ALTER TABLE public.table_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "table_groups_select" ON public.table_groups;
CREATE POLICY "table_groups_select" ON public.table_groups
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.is_restaurant_member(auth.uid(), restaurant_id)
  );

DROP POLICY IF EXISTS "table_groups_write" ON public.table_groups;
CREATE POLICY "table_groups_write" ON public.table_groups
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  );

-- FK after table_groups exists
ALTER TABLE public.tables
  DROP CONSTRAINT IF EXISTS tables_group_id_fkey;
ALTER TABLE public.tables
  ADD CONSTRAINT tables_group_id_fkey FOREIGN KEY (group_id)
    REFERENCES public.table_groups(id) ON DELETE SET NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS table_groups_touch ON public.table_groups;
CREATE TRIGGER table_groups_touch
  BEFORE UPDATE ON public.table_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. table_sessions.group_id
ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.table_sessions
  DROP CONSTRAINT IF EXISTS table_sessions_group_id_fkey;
ALTER TABLE public.table_sessions
  ADD CONSTRAINT table_sessions_group_id_fkey FOREIGN KEY (group_id)
    REFERENCES public.table_groups(id) ON DELETE SET NULL;

-- 4. Recalc group name + capacities when membership or capacities change
CREATE OR REPLACE FUNCTION public.recalc_table_group(_group uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _min  int;
  _def  int;
  _max  int;
BEGIN
  SELECT string_agg(number, '+' ORDER BY number),
         COALESCE(SUM(min_capacity), 0),
         COALESCE(SUM(capacity), 0),
         COALESCE(SUM(max_capacity), 0)
    INTO _name, _min, _def, _max
    FROM public.tables
   WHERE group_id = _group;

  IF _name IS NULL THEN
    -- No members left: delete the group
    DELETE FROM public.table_groups WHERE id = _group;
    RETURN;
  END IF;

  UPDATE public.table_groups
     SET name = _name,
         min_capacity = GREATEST(1, _min),
         default_capacity = LEAST(50, GREATEST(1, _def)),
         max_capacity = LEAST(50, GREATEST(1, _max)),
         updated_at = now()
   WHERE id = _group;
END;
$$;

CREATE OR REPLACE FUNCTION public.tables_group_recalc_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.group_id IS NOT NULL THEN PERFORM public.recalc_table_group(NEW.group_id); END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      IF OLD.group_id IS NOT NULL THEN PERFORM public.recalc_table_group(OLD.group_id); END IF;
      IF NEW.group_id IS NOT NULL THEN PERFORM public.recalc_table_group(NEW.group_id); END IF;
    ELSIF NEW.group_id IS NOT NULL AND (
      NEW.capacity <> OLD.capacity
      OR NEW.min_capacity <> OLD.min_capacity
      OR NEW.max_capacity <> OLD.max_capacity
      OR NEW.number <> OLD.number
    ) THEN
      PERFORM public.recalc_table_group(NEW.group_id);
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.group_id IS NOT NULL THEN PERFORM public.recalc_table_group(OLD.group_id); END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tables_group_recalc ON public.tables;
CREATE TRIGGER tables_group_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.tables_group_recalc_trg();

-- 5. RPC: combine_tables
CREATE OR REPLACE FUNCTION public.combine_tables(_restaurant uuid, _table_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _zone text;
  _already int;
  _open int;
  _new_group uuid;
  _total int;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF array_length(_table_ids, 1) IS NULL OR array_length(_table_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Selecciona al menos dos mesas' USING ERRCODE = 'P0001';
  END IF;

  -- All tables must belong to same restaurant and same zone, no existing group, no active session
  SELECT count(DISTINCT section) INTO _already
    FROM public.tables WHERE id = ANY(_table_ids) AND restaurant_id = _restaurant;
  IF _already <> 1 THEN
    RAISE EXCEPTION 'Las mesas deben pertenecer a la misma zona' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO _already
    FROM public.tables WHERE id = ANY(_table_ids) AND restaurant_id = _restaurant AND group_id IS NOT NULL;
  IF _already > 0 THEN
    RAISE EXCEPTION 'Alguna mesa ya pertenece a un grupo' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO _open
    FROM public.table_sessions ts
   WHERE ts.table_id = ANY(_table_ids) AND ts.status <> 'closed';
  IF _open > 0 THEN
    RAISE EXCEPTION 'No se pueden combinar mesas con sesiones abiertas' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(capacity), 0) INTO _total
    FROM public.tables WHERE id = ANY(_table_ids);
  IF _total > 50 THEN
    RAISE EXCEPTION 'La capacidad combinada supera el máximo de 50' USING ERRCODE = 'P0001';
  END IF;

  SELECT section INTO _zone FROM public.tables WHERE id = _table_ids[1];

  INSERT INTO public.table_groups (restaurant_id, zone)
    VALUES (_restaurant, _zone)
    RETURNING id INTO _new_group;

  UPDATE public.tables SET group_id = _new_group
   WHERE id = ANY(_table_ids) AND restaurant_id = _restaurant;

  PERFORM public.recalc_table_group(_new_group);
  RETURN _new_group;
END;
$$;

REVOKE ALL ON FUNCTION public.combine_tables(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.combine_tables(uuid, uuid[]) TO authenticated;

-- 6. RPC: split_table_group
CREATE OR REPLACE FUNCTION public.split_table_group(_group uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _restaurant uuid;
  _open int;
BEGIN
  SELECT restaurant_id INTO _restaurant FROM public.table_groups WHERE id = _group;
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO _open FROM public.table_sessions
   WHERE group_id = _group AND status <> 'closed';
  IF _open > 0 THEN
    RAISE EXCEPTION 'No se puede separar un grupo con sesión abierta' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.tables SET group_id = NULL WHERE group_id = _group;
  DELETE FROM public.table_groups WHERE id = _group;
END;
$$;

REVOKE ALL ON FUNCTION public.split_table_group(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.split_table_group(uuid) TO authenticated;
