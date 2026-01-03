-- Create course enum
CREATE TYPE public.order_course AS ENUM ('unassigned', 'primeros', 'segundos', 'postres');

-- Create station enum
CREATE TYPE public.order_station AS ENUM ('kitchen', 'bar');

-- Add new columns to order_items
ALTER TABLE public.order_items 
ADD COLUMN course public.order_course NOT NULL DEFAULT 'unassigned',
ADD COLUMN station public.order_station NOT NULL DEFAULT 'kitchen',
ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;

-- Create kitchen_tickets table
CREATE TABLE public.kitchen_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  station public.order_station NOT NULL,
  course public.order_course,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  status public.order_item_status NOT NULL DEFAULT 'sent',
  restaurant_id UUID NOT NULL
);

-- Create ticket_items join table
CREATE TABLE public.ticket_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.kitchen_tickets(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for kitchen_tickets
CREATE POLICY "Users can view tickets in their restaurant"
ON public.kitchen_tickets FOR SELECT
USING (restaurant_id = get_user_restaurant_id(auth.uid()));

CREATE POLICY "Staff can manage tickets"
ON public.kitchen_tickets FOR ALL
USING (restaurant_id = get_user_restaurant_id(auth.uid()));

-- RLS policies for ticket_items
CREATE POLICY "Users can view ticket items"
ON public.ticket_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM kitchen_tickets kt
  WHERE kt.id = ticket_items.ticket_id
  AND kt.restaurant_id = get_user_restaurant_id(auth.uid())
));

CREATE POLICY "Staff can manage ticket items"
ON public.ticket_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM kitchen_tickets kt
  WHERE kt.id = ticket_items.ticket_id
  AND kt.restaurant_id = get_user_restaurant_id(auth.uid())
));

-- Enable realtime for kitchen_tickets
ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_items;