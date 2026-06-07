ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS commercial_name text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS website text;