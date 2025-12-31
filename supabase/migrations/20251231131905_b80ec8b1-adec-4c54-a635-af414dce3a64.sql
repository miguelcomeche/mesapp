-- Create enum types for statuses
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'waiter');
CREATE TYPE public.table_status AS ENUM ('available', 'occupied', 'reserved', 'needs_attention');
CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.session_status AS ENUM ('active', 'billing', 'closed');
CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'ready', 'served', 'cancelled');
CREATE TYPE public.order_item_status AS ENUM ('pending', 'sent', 'preparing', 'ready', 'served', 'cancelled');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'split');

-- Create restaurants table
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  restaurant_id UUID REFERENCES public.restaurants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'waiter',
  UNIQUE (user_id, role)
);

-- Create tables (restaurant tables)
CREATE TABLE public.tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  status table_status NOT NULL DEFAULT 'available',
  section TEXT NOT NULL DEFAULT 'Principal',
  position_x INTEGER,
  position_y INTEGER,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reservations table
CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_email TEXT,
  party_size INTEGER NOT NULL DEFAULT 2,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  table_id UUID REFERENCES public.tables(id),
  status reservation_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  external_source TEXT,
  external_id TEXT,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table_sessions table
CREATE TABLE public.table_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.tables(id),
  reservation_id UUID REFERENCES public.reservations(id),
  guest_count INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status session_status NOT NULL DEFAULT 'active',
  waiter_id UUID REFERENCES auth.users(id),
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE
);

-- Create menu_items table
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  available BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  status order_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  prepared_at TIMESTAMP WITH TIME ZONE,
  served_at TIMESTAMP WITH TIME ZONE
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  modifiers TEXT[],
  notes TEXT,
  status order_item_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method payment_method NOT NULL DEFAULT 'card',
  tip DECIMAL(10,2),
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's restaurant_id
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- RLS Policies for restaurants
CREATE POLICY "Users can view their restaurant" ON public.restaurants
  FOR SELECT USING (
    id = public.get_user_restaurant_id(auth.uid())
  );

CREATE POLICY "Admins can manage restaurants" ON public.restaurants
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their restaurant" ON public.profiles
  FOR SELECT USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
  );

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for tables
CREATE POLICY "Users can view tables in their restaurant" ON public.tables
  FOR SELECT USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
  );

CREATE POLICY "Managers and admins can manage tables" ON public.tables
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Staff can update table status" ON public.tables
  FOR UPDATE USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
  );

-- RLS Policies for reservations
CREATE POLICY "Users can view reservations in their restaurant" ON public.reservations
  FOR SELECT USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
  );

CREATE POLICY "Staff can manage reservations" ON public.reservations
  FOR ALL USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
  );

-- RLS Policies for table_sessions
CREATE POLICY "Users can view sessions in their restaurant" ON public.table_sessions
  FOR SELECT USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
  );

CREATE POLICY "Staff can manage sessions" ON public.table_sessions
  FOR ALL USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
  );

-- RLS Policies for menu_items
CREATE POLICY "Users can view menu items in their restaurant" ON public.menu_items
  FOR SELECT USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
  );

CREATE POLICY "Managers can manage menu items" ON public.menu_items
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );

-- RLS Policies for orders
CREATE POLICY "Users can view orders in their restaurant" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.table_sessions ts
      WHERE ts.id = orders.session_id
      AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
    )
  );

CREATE POLICY "Staff can manage orders" ON public.orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.table_sessions ts
      WHERE ts.id = orders.session_id
      AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
    )
  );

-- RLS Policies for order_items
CREATE POLICY "Users can view order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.table_sessions ts ON ts.id = o.session_id
      WHERE o.id = order_items.order_id
      AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
    )
  );

CREATE POLICY "Staff can manage order items" ON public.order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.table_sessions ts ON ts.id = o.session_id
      WHERE o.id = order_items.order_id
      AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
    )
  );

-- RLS Policies for payments
CREATE POLICY "Users can view payments in their restaurant" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.table_sessions ts
      WHERE ts.id = payments.session_id
      AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
    )
  );

CREATE POLICY "Staff can manage payments" ON public.payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.table_sessions ts
      WHERE ts.id = payments.session_id
      AND ts.restaurant_id = public.get_user_restaurant_id(auth.uid())
    )
  );

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data ->> 'name', new.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'waiter');
  
  RETURN new;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update table session total
CREATE OR REPLACE FUNCTION public.update_session_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  session_id_val UUID;
  new_total DECIMAL(10,2);
BEGIN
  -- Get the session_id from the order
  SELECT o.session_id INTO session_id_val
  FROM public.orders o
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Calculate new total
  SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) INTO new_total
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.session_id = session_id_val
  AND oi.status != 'cancelled';
  
  -- Update session total
  UPDATE public.table_sessions
  SET total_amount = new_total
  WHERE id = session_id_val;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to auto-update session totals
CREATE TRIGGER update_session_total_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_session_total();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;