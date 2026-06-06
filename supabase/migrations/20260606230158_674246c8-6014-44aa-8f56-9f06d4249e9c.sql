CREATE TABLE public.ticket_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('customer','kitchen','bar','delivery')),
  name text NOT NULL,
  paper_width smallint NOT NULL DEFAULT 80 CHECK (paper_width IN (58, 80)),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_templates TO authenticated;
GRANT ALL ON public.ticket_templates TO service_role;

ALTER TABLE public.ticket_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_templates_select"
  ON public.ticket_templates FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.is_restaurant_member(auth.uid(), restaurant_id)
  );

CREATE POLICY "ticket_templates_write"
  ON public.ticket_templates FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  );

CREATE TRIGGER ticket_templates_touch
  BEFORE UPDATE ON public.ticket_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();