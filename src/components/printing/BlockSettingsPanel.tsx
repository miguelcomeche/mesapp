import { TicketBlock } from '@/types/tickets';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function BlockSettingsPanel({
  block,
  onChange,
}: {
  block: TicketBlock | null;
  onChange: (settings: any) => void;
}) {
  if (!block) {
    return <p className="text-xs text-muted-foreground">Selecciona un bloque para editar sus ajustes.</p>;
  }
  const s: any = block.settings || {};
  const update = (patch: any) => onChange({ ...s, ...patch });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Alineación</Label>
          <Select value={s.align ?? 'left'} onValueChange={(v) => update({ align: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Izquierda</SelectItem>
              <SelectItem value="center">Centro</SelectItem>
              <SelectItem value="right">Derecha</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tamaño</Label>
          <Select value={s.font_size ?? 'normal'} onValueChange={(v) => update({ font_size: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Pequeño</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="large">Grande</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Negrita</Label>
          <div className="h-8 flex items-center">
            <Switch checked={!!s.bold} onCheckedChange={(v) => update({ bold: v })} />
          </div>
        </div>
      </div>

      {(block.type === 'text' || block.type === 'footer') && (
        <div className="space-y-1">
          <Label className="text-xs">Contenido</Label>
          <Textarea
            value={s.content ?? ''}
            onChange={(e) => update({ content: e.target.value })}
            rows={3}
            placeholder="Texto. Puedes usar variables como {{restaurant_name}}"
          />
        </div>
      )}

      {block.type === 'logo' && (
        <div className="space-y-1">
          <Label className="text-xs">Ancho (% del ticket)</Label>
          <Input
            type="number"
            min={20}
            max={100}
            value={s.width_pct ?? 60}
            onChange={(e) => update({ width_pct: Number(e.target.value) })}
          />
        </div>
      )}

      {block.type === 'order_items' && (
        <div className="grid grid-cols-1 gap-2">
          <label className="flex items-center justify-between text-xs">
            Mostrar precios <Switch checked={s.show_prices !== false} onCheckedChange={(v) => update({ show_prices: v })} />
          </label>
          <label className="flex items-center justify-between text-xs">
            Mostrar modificadores <Switch checked={s.show_modifiers !== false} onCheckedChange={(v) => update({ show_modifiers: v })} />
          </label>
          <label className="flex items-center justify-between text-xs">
            Mostrar notas <Switch checked={!!s.show_notes} onCheckedChange={(v) => update({ show_notes: v })} />
          </label>
        </div>
      )}

      {block.type === 'totals' && (
        <div className="grid grid-cols-1 gap-2">
          <label className="flex items-center justify-between text-xs">
            Mostrar subtotal <Switch checked={s.show_subtotal !== false} onCheckedChange={(v) => update({ show_subtotal: v })} />
          </label>
          <label className="flex items-center justify-between text-xs">
            Mostrar impuestos <Switch checked={s.show_tax !== false} onCheckedChange={(v) => update({ show_tax: v })} />
          </label>
        </div>
      )}

      {block.type === 'qr' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de QR</Label>
            <Select value={s.qr_type ?? 'google_reviews'} onValueChange={(v) => update({ qr_type: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google_reviews">Google Reviews</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="website">Sitio web</SelectItem>
                <SelectItem value="custom">URL personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input value={s.url ?? ''} onChange={(e) => update({ url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Texto bajo el QR</Label>
            <Input value={s.caption ?? ''} onChange={(e) => update({ caption: e.target.value })} />
          </div>
        </div>
      )}

      {block.type === 'barcode' && (
        <div className="space-y-1">
          <Label className="text-xs">Valor</Label>
          <Input value={s.value ?? ''} onChange={(e) => update({ value: e.target.value })} placeholder="{{ticket_number}}" />
        </div>
      )}
    </div>
  );
}