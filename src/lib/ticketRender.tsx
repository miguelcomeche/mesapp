import { QRCodeSVG } from 'qrcode.react';
import { TicketBlock, TicketTemplate, QrBlockSettings, TextBlockSettings, OrderItemsSettings, TotalsSettings, LogoSettings, BarcodeBlockSettings } from '@/types/tickets';
import { TicketContext, resolveQrUrl, substitute } from './ticketMockData';

function alignClass(a?: string) {
  return a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left';
}
function sizeClass(s?: string) {
  return s === 'large' ? 'text-base' : s === 'small' ? 'text-[10px]' : 'text-xs';
}

function fmt(n: number, currency: string) {
  return `${n.toFixed(2)} ${currency}`;
}

function BlockView({ block, ctx, template }: { block: TicketBlock; ctx: TicketContext; template: TicketTemplate }) {
  const s: any = block.settings || {};
  const cls = `${alignClass(s.align ?? template.settings.align)} ${sizeClass(s.font_size ?? template.settings.font_size)} ${s.bold || template.settings.bold ? 'font-bold' : ''}`;

  switch (block.type) {
    case 'logo':
      if (template.settings.show_logo === false) return null;
      return (
        <div className={alignClass(s.align)}>
          {ctx.restaurant_logo_url ? (
            <img src={ctx.restaurant_logo_url} alt="logo" style={{ width: `${(s as LogoSettings).width_pct ?? 60}%`, margin: '0 auto', filter: 'grayscale(1) contrast(1.4)' }} />
          ) : (
            <div className="inline-block border border-dashed border-black/40 px-3 py-2 text-[10px] uppercase tracking-wider">Logo</div>
          )}
        </div>
      );
    case 'text': {
      const tx = (s as TextBlockSettings).content ?? '';
      return <div className={cls}>{substitute(tx, ctx)}</div>;
    }
    case 'separator':
      return <div className="border-t border-dashed border-black/60 my-1" />;
    case 'restaurant_info': {
      const cityLine = [ctx.restaurant_postal_code, ctx.restaurant_city].filter(Boolean).join(' ');
      return (
        <div className={cls}>
          {ctx.restaurant_name && <div className="font-bold">{ctx.restaurant_name}</div>}
          {ctx.restaurant_address && <div>{ctx.restaurant_address}</div>}
          {cityLine && <div>{cityLine}</div>}
          {ctx.restaurant_country && <div>{ctx.restaurant_country}</div>}
          {ctx.restaurant_phone && <div>{ctx.restaurant_phone}</div>}
          {ctx.restaurant_email && <div>{ctx.restaurant_email}</div>}
          {ctx.restaurant_tax_id && <div>CIF: {ctx.restaurant_tax_id}</div>}
        </div>
      );
    }
    case 'table_info':
      return <div className={cls}>{ctx.table_name}</div>;
    case 'waiter_info':
      return <div className={cls}>Camarero: {ctx.waiter_name}</div>;
    case 'datetime':
      return <div className={cls}>{ctx.date_time}</div>;
    case 'ticket_number':
      return <div className={cls}>Ticket #{ctx.ticket_number}</div>;
    case 'order_items': {
      const os = s as OrderItemsSettings;
      const showPrices = os.show_prices !== false && template.settings.show_prices !== false;
      return (
        <div className={sizeClass(s.font_size ?? template.settings.font_size)}>
          {ctx.order_items.map((it, idx) => (
            <div key={idx} className="mb-1">
              <div className="flex justify-between gap-2">
                <span>{it.quantity} x {it.name}</span>
                {showPrices && <span>{fmt(it.price * it.quantity, ctx.currency)}</span>}
              </div>
              {os.show_modifiers !== false && it.modifiers?.map((m, i) => (
                <div key={i} className="pl-3 italic opacity-80">+ {m}</div>
              ))}
              {os.show_notes && it.notes && (
                <div className="pl-3 italic opacity-80">» {it.notes}</div>
              )}
            </div>
          ))}
        </div>
      );
    }
    case 'totals': {
      const ts = s as TotalsSettings;
      return (
        <div className={cls}>
          {ts.show_subtotal !== false && (
            <div className="flex justify-between"><span>Subtotal</span><span>{fmt(ctx.subtotal, ctx.currency)}</span></div>
          )}
          {ts.show_tax !== false && (
            <div className="flex justify-between"><span>IVA</span><span>{fmt(ctx.tax, ctx.currency)}</span></div>
          )}
          <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>{fmt(ctx.total, ctx.currency)}</span></div>
        </div>
      );
    }
    case 'payment_method':
      return <div className={cls}>Pago: {ctx.payment_method}</div>;
    case 'qr': {
      const qs = s as QrBlockSettings;
      const url = resolveQrUrl(qs.qr_type, qs.url, ctx);
      return (
        <div className={alignClass(s.align)}>
          <div className="inline-block bg-white p-1">
            <QRCodeSVG value={url} size={96} />
          </div>
          {qs.caption && <div className={cls}>{qs.caption}</div>}
        </div>
      );
    }
    case 'barcode': {
      const bs = s as BarcodeBlockSettings;
      const v = substitute(bs.value || ctx.ticket_number, ctx);
      return (
        <div className={alignClass(s.align)}>
          <div className="inline-block">
            <div className="font-mono tracking-[0.2em] text-lg leading-none">||| | || ||| | ||</div>
            <div className="text-[10px] mt-0.5">{v}</div>
          </div>
        </div>
      );
    }
    case 'footer': {
      const tx = (s as TextBlockSettings).content ?? '';
      return <div className={`${cls} mt-1`}>{substitute(tx, ctx)}</div>;
    }
    default:
      return null;
  }
}

export function renderBlocks(template: TicketTemplate, ctx: TicketContext) {
  return (
    <div className="font-mono text-black leading-snug space-y-1">
      {template.blocks.map((blk) => (
        <BlockView key={blk.id} block={blk} ctx={ctx} template={template} />
      ))}
    </div>
  );
}

// Normalized command IR for future Epson ePOS adapter
export type TicketCommand =
  | { op: 'text'; value: string; align?: string; bold?: boolean; size?: string }
  | { op: 'separator' }
  | { op: 'image'; url: string; widthPct?: number; align?: string }
  | { op: 'qr'; url: string; align?: string }
  | { op: 'barcode'; value: string; align?: string }
  | { op: 'feed'; lines: number }
  | { op: 'cut' };

export function renderToCommands(template: TicketTemplate, ctx: TicketContext): TicketCommand[] {
  const cmds: TicketCommand[] = [];
  const push = (c: TicketCommand) => cmds.push(c);
  const fmtMoney = (n: number) => `${n.toFixed(2)} ${ctx.currency}`;

  for (const blk of template.blocks) {
    const s: any = blk.settings || {};
    const align = s.align ?? template.settings.align;
    const bold = !!(s.bold || template.settings.bold);
    const size = s.font_size ?? template.settings.font_size;
    switch (blk.type) {
      case 'logo':
        if (template.settings.show_logo !== false && ctx.restaurant_logo_url) {
          push({ op: 'image', url: ctx.restaurant_logo_url, widthPct: s.width_pct ?? 60, align });
        }
        break;
      case 'text':
        push({ op: 'text', value: substitute(s.content ?? '', ctx), align, bold, size });
        break;
      case 'separator':
        push({ op: 'separator' });
        break;
      case 'restaurant_info': {
        const cityLine = [ctx.restaurant_postal_code, ctx.restaurant_city].filter(Boolean).join(' ');
        if (ctx.restaurant_name) push({ op: 'text', value: ctx.restaurant_name, align, bold: true, size });
        if (ctx.restaurant_address) push({ op: 'text', value: ctx.restaurant_address, align, size });
        if (cityLine) push({ op: 'text', value: cityLine, align, size });
        if (ctx.restaurant_country) push({ op: 'text', value: ctx.restaurant_country, align, size });
        if (ctx.restaurant_phone) push({ op: 'text', value: ctx.restaurant_phone, align, size });
        if (ctx.restaurant_email) push({ op: 'text', value: ctx.restaurant_email, align, size });
        if (ctx.restaurant_tax_id) push({ op: 'text', value: `CIF: ${ctx.restaurant_tax_id}`, align, size });
        break;
      }
      case 'table_info':
        push({ op: 'text', value: ctx.table_name, align, bold, size });
        break;
      case 'waiter_info':
        push({ op: 'text', value: `Camarero: ${ctx.waiter_name}`, align, bold, size });
        break;
      case 'datetime':
        push({ op: 'text', value: ctx.date_time, align, bold, size });
        break;
      case 'ticket_number':
        push({ op: 'text', value: `Ticket #${ctx.ticket_number}`, align, bold, size });
        break;
      case 'order_items': {
        const showPrices = s.show_prices !== false && template.settings.show_prices !== false;
        for (const it of ctx.order_items) {
          const line = showPrices
            ? `${it.quantity} x ${it.name}  ${fmtMoney(it.price * it.quantity)}`
            : `${it.quantity} x ${it.name}`;
          push({ op: 'text', value: line, align: 'left', bold, size });
          if (s.show_modifiers !== false) for (const m of it.modifiers ?? []) push({ op: 'text', value: `  + ${m}`, align: 'left', size });
          if (s.show_notes && it.notes) push({ op: 'text', value: `  » ${it.notes}`, align: 'left', size });
        }
        break;
      }
      case 'totals':
        if (s.show_subtotal !== false) push({ op: 'text', value: `Subtotal  ${fmtMoney(ctx.subtotal)}`, align: 'right', size });
        if (s.show_tax !== false) push({ op: 'text', value: `IVA  ${fmtMoney(ctx.tax)}`, align: 'right', size });
        push({ op: 'text', value: `TOTAL  ${fmtMoney(ctx.total)}`, align: 'right', bold: true, size: 'large' });
        break;
      case 'payment_method':
        push({ op: 'text', value: `Pago: ${ctx.payment_method}`, align, bold, size });
        break;
      case 'qr':
        push({ op: 'qr', url: resolveQrUrl(s.qr_type, s.url, ctx), align });
        if (s.caption) push({ op: 'text', value: s.caption, align, size });
        break;
      case 'barcode':
        push({ op: 'barcode', value: substitute(s.value || ctx.ticket_number, ctx), align });
        break;
      case 'footer':
        push({ op: 'text', value: substitute(s.content ?? '', ctx), align, bold, size });
        break;
    }
  }
  push({ op: 'feed', lines: 3 });
  push({ op: 'cut' });
  return cmds;
}