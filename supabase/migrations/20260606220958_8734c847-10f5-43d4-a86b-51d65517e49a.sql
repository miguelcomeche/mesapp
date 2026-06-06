
CREATE TABLE public.payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  quantity_paid numeric(10,3) NOT NULL CHECK (quantity_paid > 0),
  amount_paid numeric(10,2) NOT NULL CHECK (amount_paid >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_items_payment_idx ON public.payment_items(payment_id);
CREATE INDEX payment_items_order_item_idx ON public.payment_items(order_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_items TO authenticated;
GRANT ALL ON public.payment_items TO service_role;

ALTER TABLE public.payment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage all payment items"
  ON public.payment_items FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Staff can manage payment items"
  ON public.payment_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.table_sessions ts ON ts.id = p.session_id
    WHERE p.id = payment_items.payment_id
      AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.table_sessions ts ON ts.id = p.session_id
    WHERE p.id = payment_items.payment_id
      AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_items;
