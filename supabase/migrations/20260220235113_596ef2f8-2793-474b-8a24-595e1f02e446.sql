
-- Create category_settings table for auto-marchar configuration
CREATE TABLE public.category_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  auto_marchar_enabled boolean NOT NULL DEFAULT false,
  auto_marchar_station text CHECK (auto_marchar_station IN ('bar', 'kitchen')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, category_name)
);

-- Enable RLS
ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view category settings in their restaurant"
ON public.category_settings
FOR SELECT
USING (restaurant_id = get_user_restaurant_id(auth.uid()));

CREATE POLICY "Admins can manage category settings"
ON public.category_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Seed defaults for Santa Chiara Blanquerna
INSERT INTO public.category_settings (restaurant_id, category_name, auto_marchar_enabled, auto_marchar_station)
VALUES 
  ('649971b5-5f98-47ca-88a2-bc166e029c3c', 'Bebidas', true, 'bar'),
  ('649971b5-5f98-47ca-88a2-bc166e029c3c', 'Postres', true, 'kitchen');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_settings;
