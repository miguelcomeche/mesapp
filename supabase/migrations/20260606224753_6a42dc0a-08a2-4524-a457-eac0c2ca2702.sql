
-- Fix floor plan visibility: managers/waiters linked via restaurant_users were
-- blocked because tables/table_sessions SELECT relied on profiles.restaurant_id only.

-- TABLES
DROP POLICY IF EXISTS "Users can view tables in their restaurant" ON public.tables;
DROP POLICY IF EXISTS "Staff can update table status" ON public.tables;
DROP POLICY IF EXISTS "Managers and admins can manage tables" ON public.tables;

CREATE POLICY "Members view tables"
  ON public.tables FOR SELECT
  USING (
    has_role(auth.uid(), 'platform_admin')
    OR is_restaurant_member(auth.uid(), restaurant_id)
    OR restaurant_id = get_user_restaurant_id(auth.uid())
  );

CREATE POLICY "Staff update table status"
  ON public.tables FOR UPDATE
  USING (
    has_role(auth.uid(), 'platform_admin')
    OR is_restaurant_member(auth.uid(), restaurant_id)
    OR restaurant_id = get_user_restaurant_id(auth.uid())
  );

CREATE POLICY "Admins manage tables"
  ON public.tables FOR ALL
  USING (
    has_role(auth.uid(), 'platform_admin')
    OR has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'platform_admin')
    OR has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  );

-- TABLE SESSIONS
DROP POLICY IF EXISTS "Users can view sessions in their restaurant" ON public.table_sessions;
DROP POLICY IF EXISTS "Staff can manage sessions" ON public.table_sessions;

CREATE POLICY "Members view sessions"
  ON public.table_sessions FOR SELECT
  USING (
    has_role(auth.uid(), 'platform_admin')
    OR is_restaurant_member(auth.uid(), restaurant_id)
    OR restaurant_id = get_user_restaurant_id(auth.uid())
  );

CREATE POLICY "Members manage sessions"
  ON public.table_sessions FOR ALL
  USING (
    has_role(auth.uid(), 'platform_admin')
    OR is_restaurant_member(auth.uid(), restaurant_id)
    OR restaurant_id = get_user_restaurant_id(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'platform_admin')
    OR is_restaurant_member(auth.uid(), restaurant_id)
    OR restaurant_id = get_user_restaurant_id(auth.uid())
  );
