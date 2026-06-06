import { TicketKind } from '@/types/tickets';

export interface TicketContext {
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
  restaurant_tax_id: string;
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

export function mockContext(kind: TicketKind, restaurantName = 'Mesapp Demo'): TicketContext {
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
  return {
    restaurant_name: restaurantName,
    restaurant_address: 'Calle Mayor 12, Madrid',
    restaurant_phone: '+34 910 000 000',
    restaurant_tax_id: 'B-12345678',
    table_name: 'Mesa 5',
    waiter_name: 'María',
    ticket_number: '000123',
    date_time: new Date().toLocaleString('es-ES'),
    order_items: items,
    subtotal,
    tax,
    total,
    payment_method: 'Tarjeta',
    currency: '€',
    restaurant_google_reviews_url: 'https://g.page/r/example/review',
    restaurant_instagram_url: 'https://instagram.com/mesapp',
    restaurant_website: 'https://mesapp.app',
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