// Database types for Mesapp
// These types match the Supabase schema

export type UserRole = 'admin' | 'manager' | 'waiter';
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'needs_attention';
export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
export type SessionStatus = 'active' | 'billing' | 'closed';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderItemStatus = 'pending' | 'sent' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'split';
export type OrderCourse = 'unassigned' | 'primeros' | 'segundos' | 'postres';
export type OrderStation = 'kitchen' | 'bar';

export interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  restaurant_id: string | null;
  created_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: UserRole;
}

export interface Table {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  section: string;
  position_x: number | null;
  position_y: number | null;
  restaurant_id: string;
  created_at: string;
}

export interface Reservation {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  scheduled_time: string;
  table_id: string | null;
  status: ReservationStatus;
  notes: string | null;
  external_source: string | null;
  external_id: string | null;
  restaurant_id: string;
  created_at: string;
  // Joined data
  table?: Table;
}

export interface TableSession {
  id: string;
  table_id: string;
  reservation_id: string | null;
  guest_count: number;
  started_at: string;
  closed_at: string | null;
  status: SessionStatus;
  waiter_id: string | null;
  total_amount: number;
  restaurant_id: string;
  // Joined data
  table?: Table;
  reservation?: Reservation;
  orders?: Order[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  subcategory: string | null;
  display_order: number;
  available: boolean;
  image_url: string | null;
  restaurant_id: string;
  created_at: string;
}

export interface Order {
  id: string;
  session_id: string;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  prepared_at: string | null;
  served_at: string | null;
  // Joined data
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  modifiers: string[] | null;
  notes: string | null;
  status: OrderItemStatus;
  course: OrderCourse;
  station: OrderStation;
  sent_at: string | null;
  created_at: string;
  // Joined data
  menu_item?: MenuItem;
}

export interface KitchenTicket {
  id: string;
  session_id: string;
  station: OrderStation;
  course: OrderCourse | null;
  created_at: string;
  created_by: string | null;
  status: OrderItemStatus;
  restaurant_id: string;
  // Joined data
  items?: TicketItem[];
  session?: TableSession;
}

export interface TicketItem {
  id: string;
  ticket_id: string;
  order_item_id: string;
  created_at: string;
  // Joined data
  order_item?: OrderItem;
}

export interface Payment {
  id: string;
  session_id: string;
  amount: number;
  method: PaymentMethod;
  tip: number | null;
  processed_at: string;
}

export interface ModifierGroup {
  id: string;
  name: string;
  applicable_categories: string[];
  restaurant_id: string;
  display_order: number;
  created_at: string;
  modifiers?: Modifier[];
}

export interface Modifier {
  id: string;
  modifier_group_id: string;
  name: string;
  price_adjustment: number;
  display_order: number;
  available: boolean;
  created_at: string;
}

// Status labels in Spanish
export const STATUS_LABELS = {
  reservation: {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    seated: 'Sentado',
    completed: 'Completada',
    cancelled: 'Cancelada',
    no_show: 'No show',
  },
  table: {
    available: 'Disponible',
    occupied: 'Ocupada',
    reserved: 'Reservada',
    needs_attention: 'Atención',
  },
  session: {
    active: 'Activo',
    billing: 'Facturando',
    closed: 'Cerrado',
  },
  order: {
    pending: 'Pendiente',
    preparing: 'Preparando',
    ready: 'Listo',
    served: 'Servido',
    cancelled: 'Cancelado',
  },
  orderItem: {
    pending: 'Pendiente',
    sent: 'Enviado',
    preparing: 'Preparando',
    ready: 'Listo',
    served: 'Servido',
    cancelled: 'Cancelado',
  },
  course: {
    unassigned: 'Sin asignar',
    primeros: 'Primeros',
    segundos: 'Segundos',
    postres: 'Postres',
  },
  station: {
    kitchen: 'Cocina',
    bar: 'Barra',
  },
  payment: {
    cash: 'Efectivo',
    card: 'Tarjeta',
    split: 'Dividido',
  },
} as const;
