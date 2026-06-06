import { TicketKind } from '@/types/tickets';

export interface TicketContext {
  restaurant_name: string;
  restaurant_address: string;
  restaurant_city: string;
  restaurant_postal_code: string;
  restaurant_country: string;
  restaurant_phone: string;
  restaurant_email: string;
  restaurant_tax_id: string;
  restaurant_logo: string;
  restaurant_logo_url?: string;
  restaurant_google_reviews_url?: string;
  restaurant_instagram_url?: string;
  restaurant_website?: string;
  table_name: string;
  waiter_name: string;
  ticket_number: string;
  date_time: string;
  order_items: Array<{ name: string; quantity: number; price: number; modifiers?: string[]; notes?: string }>;
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string;
  currency: string;
}

export interface RestaurantOverride {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_id?: string | null;
  logo_url?: string | null;
  currency?: string | null;
}

export function mockContext(kind: TicketKind, restaurantName?: string, restaurant?: RestaurantOverride | null): TicketContext {
  const items: TicketContext['order_items'] =
    kind === 'kitchen'
      ? [
          { name: 'Lomo Saltado', quantity: 2, price: 18, modifiers: ['Sin cebolla'], notes: 'Punto de cocción medio' },
          { name: 'Anticuchos', quantity: 1, price: 12 },
        ]
      : kind === 'bar'
      ? [
          { name: 'Pisco Sour', quantity: 2, price: 9 },
          { name: 'Chilcano', quantity: 1, price: 8, modifiers: ['Doble'] },
        ]
      : [
          { name: 'Ceviche Clásico', quantity: 1, price: 16 },
          { name: 'Lomo Saltado', quantity: 2, price: 18 },
          { name: 'Pisco Sour', quantity: 2, price: 9 },
        ];
  const subtotal = items.reduce((s: number, i) => s + i.price * i.quantity, 0);
  const tax = +(subtotal * 0.1).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);
  const logoUrl = restaurant?.logo_url ?? '';
  return {
    restaurant_name: restaurant?.name ?? restaurantName ?? '',
    restaurant_address: restaurant?.address ?? '',
    restaurant_city: restaurant?.city ?? '',
    restaurant_postal_code: restaurant?.postal_code ?? '',
    restaurant_country: restaurant?.country ?? '',
    restaurant_phone: restaurant?.phone ?? '',
    restaurant_email: restaurant?.email ?? '',
    restaurant_tax_id: restaurant?.tax_id ?? '',
    restaurant_logo: logoUrl,
    restaurant_logo_url: logoUrl || undefined,
    table_name: 'Mesa 5',
    waiter_name: 'María',
    ticket_number: '000123',
    date_time: new Date().toLocaleString('es-ES'),
    order_items: items,
    subtotal,
    tax,
    total,
    payment_method: 'Tarjeta',
    currency: restaurant?.currency ?? '€',
  };
}

export function resolveQrUrl(qrType: string | undefined, custom: string | undefined, ctx: TicketContext): string {
  switch (qrType) {
    case 'google_reviews':
      return ctx.restaurant_google_reviews_url || custom || 'https://google.com';
    case 'instagram':
      return ctx.restaurant_instagram_url || custom || 'https://instagram.com';
    case 'website':
      return ctx.restaurant_website || custom || 'https://example.com';
    default:
      return custom || 'https://mesapp.app';
  }
}

export function substitute(text: string, ctx: TicketContext): string {
  if (!text) return '';
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = (ctx as any)[key];
    return v == null ? '' : String(v);
  });
}