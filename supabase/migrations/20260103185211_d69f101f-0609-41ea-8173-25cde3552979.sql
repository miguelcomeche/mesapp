-- Robust per-OrderItem modifier persistence (join table)

-- 1) Track base price separately so unit_price can include extras
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS base_unit_price numeric NOT NULL DEFAULT 0;

-- Backfill base price for existing rows
UPDATE public.order_items
SET base_unit_price = unit_price
WHERE base_unit_price = 0;

-- 2) Order item modifiers join table
CREATE TABLE IF NOT EXISTS public.order_item_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  modifier_id uuid NOT NULL REFERENCES public.modifiers(id),
  modifier_group text NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_item_modifiers_group_chk CHECK (modifier_group IN ('EXTRAS_CON','SIN'))
);

-- Prevent duplicates per order item + modifier + group
CREATE UNIQUE INDEX IF NOT EXISTS order_item_modifiers_unique
ON public.order_item_modifiers(order_item_id, modifier_id, modifier_group);

CREATE INDEX IF NOT EXISTS order_item_modifiers_order_item_id_idx
ON public.order_item_modifiers(order_item_id);

-- 3) Enable RLS
ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;

-- 4) Policies: allow staff in same restaurant to view/manage
DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_item_modifiers'
      AND policyname = 'Users can view order item modifiers'
  ) THEN
    CREATE POLICY "Users can view order item modifiers"
    ON public.order_item_modifiers
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        JOIN public.table_sessions ts ON ts.id = o.session_id
        WHERE oi.id = order_item_modifiers.order_item_id
          AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
      )
    );
  END IF;

  -- ALL (insert/update/delete)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_item_modifiers'
      AND policyname = 'Staff can manage order item modifiers'
  ) THEN
    CREATE POLICY "Staff can manage order item modifiers"
    ON public.order_item_modifiers
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        JOIN public.table_sessions ts ON ts.id = o.session_id
        WHERE oi.id = order_item_modifiers.order_item_id
          AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        JOIN public.table_sessions ts ON ts.id = o.session_id
        WHERE oi.id = order_item_modifiers.order_item_id
          AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
      )
    );
  END IF;
END $$;