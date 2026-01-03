-- Create modifier_groups table
CREATE TABLE public.modifier_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  applicable_categories TEXT[] NOT NULL DEFAULT '{}',
  restaurant_id UUID NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create modifiers table
CREATE TABLE public.modifiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_adjustment NUMERIC(10,2) NOT NULL DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;

-- RLS policies for modifier_groups
CREATE POLICY "Users can view modifier groups in their restaurant"
ON public.modifier_groups
FOR SELECT
USING (restaurant_id = get_user_restaurant_id(auth.uid()));

CREATE POLICY "Managers can manage modifier groups"
ON public.modifier_groups
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'manager'::user_role));

-- RLS policies for modifiers
CREATE POLICY "Users can view modifiers"
ON public.modifiers
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.modifier_groups mg
  WHERE mg.id = modifiers.modifier_group_id
  AND mg.restaurant_id = get_user_restaurant_id(auth.uid())
));

CREATE POLICY "Managers can manage modifiers"
ON public.modifiers
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.modifier_groups mg
  WHERE mg.id = modifiers.modifier_group_id
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'manager'::user_role))
));

-- Create index for faster lookups
CREATE INDEX idx_modifiers_group_id ON public.modifiers(modifier_group_id);
CREATE INDEX idx_modifier_groups_restaurant ON public.modifier_groups(restaurant_id);