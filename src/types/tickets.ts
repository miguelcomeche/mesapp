export type TicketKind = 'customer' | 'kitchen' | 'bar' | 'delivery';

export type BlockType =
  | 'logo'
  | 'text'
  | 'separator'
  | 'restaurant_info'
  | 'table_info'
  | 'waiter_info'
  | 'datetime'
  | 'ticket_number'
  | 'order_items'
  | 'totals'
  | 'payment_method'
  | 'qr'
  | 'barcode'
  | 'footer';

export type Align = 'left' | 'center' | 'right';
export type FontSize = 'small' | 'normal' | 'large';

export interface BaseBlockSettings {
  align?: Align;
  bold?: boolean;
  font_size?: FontSize;
}

export interface TextBlockSettings extends BaseBlockSettings {
  content?: string;
}

export interface QrBlockSettings extends BaseBlockSettings {
  qr_type?: 'google_reviews' | 'instagram' | 'website' | 'custom';
  url?: string;
  caption?: string;
}

export interface BarcodeBlockSettings extends BaseBlockSettings {
  value?: string;
}

export interface OrderItemsSettings extends BaseBlockSettings {
  show_prices?: boolean;
  show_modifiers?: boolean;
  show_notes?: boolean;
}

export interface TotalsSettings extends BaseBlockSettings {
  show_subtotal?: boolean;
  show_tax?: boolean;
}

export interface LogoSettings extends BaseBlockSettings {
  width_pct?: number;
}

export type BlockSettings =
  | BaseBlockSettings
  | TextBlockSettings
  | QrBlockSettings
  | BarcodeBlockSettings
  | OrderItemsSettings
  | TotalsSettings
  | LogoSettings;

export interface TicketBlock {
  id: string;
  type: BlockType;
  settings: BlockSettings;
}

export interface TemplateSettings {
  font_size?: FontSize;
  align?: Align;
  bold?: boolean;
  show_logo?: boolean;
  show_prices?: boolean;
}

export interface TicketTemplate {
  id: string;
  restaurant_id: string;
  kind: TicketKind;
  name: string;
  paper_width: 58 | 80;
  settings: TemplateSettings;
  blocks: TicketBlock[];
  is_default: boolean;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  logo: 'Logo',
  text: 'Texto',
  separator: 'Línea separadora',
  restaurant_info: 'Datos restaurante',
  table_info: 'Datos mesa',
  waiter_info: 'Datos camarero',
  datetime: 'Fecha y hora',
  ticket_number: 'Número ticket',
  order_items: 'Productos',
  totals: 'Totales',
  payment_method: 'Método de pago',
  qr: 'QR',
  barcode: 'Código barras',
  footer: 'Pie de ticket',
};

export const KIND_LABELS: Record<TicketKind, string> = {
  customer: 'Ticket Cliente',
  kitchen: 'Ticket Cocina',
  bar: 'Ticket Barra',
  delivery: 'Ticket Delivery',
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function b(type: BlockType, settings: BlockSettings = {}): TicketBlock {
  return { id: uid(), type, settings };
}

export function defaultBlocksFor(kind: TicketKind): TicketBlock[] {
  switch (kind) {
    case 'customer':
      return [
        b('logo', { align: 'center', width_pct: 60 } as LogoSettings),
        b('restaurant_info', { align: 'center' }),
        b('separator', {}),
        b('ticket_number', { align: 'center', bold: true }),
        b('datetime', { align: 'center' }),
        b('table_info', { align: 'left' }),
        b('waiter_info', { align: 'left' }),
        b('separator', {}),
        b('order_items', { show_prices: true, show_modifiers: true } as OrderItemsSettings),
        b('separator', {}),
        b('totals', { show_subtotal: true, show_tax: true, align: 'right' } as TotalsSettings),
        b('payment_method', { align: 'right' }),
        b('separator', {}),
        b('text', { content: '¡Gracias por su visita!', align: 'center', bold: true } as TextBlockSettings),
        b('qr', { qr_type: 'google_reviews', caption: 'Valóranos en Google', align: 'center' } as QrBlockSettings),
        b('footer', { content: 'mesapp.app', align: 'center' } as TextBlockSettings),
      ];
    case 'kitchen':
      return [
        b('text', { content: '*** COCINA ***', align: 'center', bold: true, font_size: 'large' } as TextBlockSettings),
        b('ticket_number', { align: 'center', bold: true }),
        b('datetime', { align: 'center' }),
        b('table_info', { align: 'left', bold: true }),
        b('waiter_info', { align: 'left' }),
        b('separator', {}),
        b('order_items', { show_prices: false, show_modifiers: true, show_notes: true } as OrderItemsSettings),
        b('separator', {}),
      ];
    case 'bar':
      return [
        b('text', { content: '*** BARRA ***', align: 'center', bold: true, font_size: 'large' } as TextBlockSettings),
        b('ticket_number', { align: 'center', bold: true }),
        b('datetime', { align: 'center' }),
        b('table_info', { align: 'left', bold: true }),
        b('waiter_info', { align: 'left' }),
        b('separator', {}),
        b('order_items', { show_prices: false, show_modifiers: true, show_notes: true } as OrderItemsSettings),
        b('separator', {}),
      ];
    case 'delivery':
      return [
        b('logo', { align: 'center', width_pct: 60 } as LogoSettings),
        b('restaurant_info', { align: 'center' }),
        b('separator', {}),
        b('text', { content: 'PEDIDO DELIVERY', align: 'center', bold: true } as TextBlockSettings),
        b('ticket_number', { align: 'center' }),
        b('datetime', { align: 'center' }),
        b('separator', {}),
        b('order_items', { show_prices: true, show_modifiers: true } as OrderItemsSettings),
        b('separator', {}),
        b('totals', { show_subtotal: true, show_tax: true, align: 'right' } as TotalsSettings),
        b('payment_method', { align: 'right' }),
        b('separator', {}),
        b('barcode', { value: '{{ticket_number}}', align: 'center' } as BarcodeBlockSettings),
        b('footer', { content: '¡Gracias por su pedido!', align: 'center' } as TextBlockSettings),
      ];
  }
}

export function defaultTemplateSettings(): TemplateSettings {
  return { font_size: 'normal', align: 'left', bold: false, show_logo: true, show_prices: true };
}

export function newBlock(type: BlockType): TicketBlock {
  return b(type, {});
}