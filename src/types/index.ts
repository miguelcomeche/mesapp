// Core types for Mesapp

export type UserRole = 'admin' | 'manager' | 'waiter';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  restaurantId: string;
  avatarUrl?: string;
  createdAt: Date;
}

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'needs_attention';

export interface Table {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  section: string;
  positionX?: number;
  positionY?: number;
  restaurantId: string;
}

export interface Reservation {
  id: string;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  partySize: number;
  scheduledTime: Date;
  tableId?: string;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  externalSource?: string; // e.g., 'CoverManager', 'Restoo'
  externalId?: string;
  restaurantId: string;
  createdAt: Date;
}

export type SessionStatus = 'active' | 'billing' | 'closed';

export interface TableSession {
  id: string;
  tableId: string;
  reservationId?: string;
  guestCount: number;
  startedAt: Date;
  closedAt?: Date;
  status: SessionStatus;
  waiterId: string;
  totalAmount: number;
  restaurantId: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface Order {
  id: string;
  sessionId: string;
  items: OrderItem[];
  status: OrderStatus;
  notes?: string;
  createdAt: Date;
  preparedAt?: Date;
  servedAt?: Date;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  modifiers?: string[];
  notes?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  available: boolean;
  imageUrl?: string;
  restaurantId: string;
}

export type PaymentMethod = 'cash' | 'card' | 'split';

export interface Payment {
  id: string;
  sessionId: string;
  amount: number;
  method: PaymentMethod;
  tip?: number;
  processedAt: Date;
}

export interface Restaurant {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  timezone: string;
  currency: string;
  createdAt: Date;
}

// Dashboard metrics
export interface DashboardMetrics {
  tablesAvailable: number;
  tablesOccupied: number;
  pendingReservations: number;
  activeOrders: number;
  todayRevenue: number;
  averageTableTime: number; // in minutes
}
