
-- Platform admin bypass policies for tenant-scoped tables
-- Additive permissive policies; existing policies remain unchanged.

-- profiles: allow platform admins to view/update all profiles
CREATE POLICY "Platform admins view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- tables
CREATE POLICY "Platform admins manage all tables"
  ON public.tables FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- table_sessions
CREATE POLICY "Platform admins manage all sessions"
  ON public.table_sessions FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- orders
CREATE POLICY "Platform admins manage all orders"
  ON public.orders FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- order_items
CREATE POLICY "Platform admins manage all order items"
  ON public.order_items FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- order_item_modifiers
CREATE POLICY "Platform admins manage all order item modifiers"
  ON public.order_item_modifiers FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- payments
CREATE POLICY "Platform admins manage all payments"
  ON public.payments FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- menu_items
CREATE POLICY "Platform admins manage all menu items"
  ON public.menu_items FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- modifier_groups
CREATE POLICY "Platform admins manage all modifier groups"
  ON public.modifier_groups FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- modifiers
CREATE POLICY "Platform admins manage all modifiers"
  ON public.modifiers FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- kitchen_tickets
CREATE POLICY "Platform admins manage all kitchen tickets"
  ON public.kitchen_tickets FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- ticket_items
CREATE POLICY "Platform admins manage all ticket items"
  ON public.ticket_items FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- reservations
CREATE POLICY "Platform admins manage all reservations"
  ON public.reservations FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- category_settings
CREATE POLICY "Platform admins manage all category settings"
  ON public.category_settings FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
