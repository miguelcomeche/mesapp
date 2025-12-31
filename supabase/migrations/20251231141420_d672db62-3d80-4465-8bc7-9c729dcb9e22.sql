
-- Add subcategory column to menu_items for hierarchical categories
ALTER TABLE public.menu_items ADD COLUMN subcategory text;

-- Add display_order for sorting within categories
ALTER TABLE public.menu_items ADD COLUMN display_order integer DEFAULT 0;
