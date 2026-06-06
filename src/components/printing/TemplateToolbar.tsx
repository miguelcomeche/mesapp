import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Save, Copy, RotateCcw, Eye, Printer } from 'lucide-react';
import { TicketTemplate } from '@/types/tickets';

export function TemplateToolbar({
  template,
  onChange,
  onSave,
  onDuplicate,
  onReset,
  onPreview,
  onTestPrint,
  saving,
}: {
  template: TicketTemplate;
  onChange: (patch: Partial<TicketTemplate>) => void;
  onSave: () => void;
  onDuplicate: () => void;
  onReset: () => void;
  onPreview: () => void;
  onTestPrint: () => void;
  saving: boolean;
}) {
  const s = template.settings || {};
  return (
    <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="space-y-1">
        <Label className="text-xs">Ancho papel</Label>
        <Select
          value={String(template.paper_width)}
          onValueChange={(v) => onChange({ paper_width: Number(v) as 58 | 80 })}
        >
          <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="58">58 mm</SelectItem>
            <SelectItem value="80">80 mm</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tamaño base</Label>
        <Select
          value={s.font_size ?? 'normal'}
          onValueChange={(v) => onChange({ settings: { ...s, font_size: v as any } })}
        >
          <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Pequeño</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="large">Grande</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Alineación base</Label>
        <Select
          value={s.align ?? 'left'}
          onValueChange={(v) => onChange({ settings: { ...s, align: v as any } })}
        >
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Izquierda</SelectItem>
            <SelectItem value="center">Centro</SelectItem>
            <SelectItem value="right">Derecha</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onPreview}><Eye className="w-4 h-4 mr-2" />Vista previa</Button>
        <Button variant="outline" size="sm" onClick={onTestPrint}><Printer className="w-4 h-4 mr-2" />Imprimir prueba</Button>
        <Button variant="outline" size="sm" onClick={onDuplicate}><Copy className="w-4 h-4 mr-2" />Duplicar</Button>
        <Button variant="outline" size="sm" onClick={onReset}><RotateCcw className="w-4 h-4 mr-2" />Restaurar</Button>
        <Button size="sm" onClick={onSave} disabled={saving}><Save className="w-4 h-4 mr-2" />Guardar</Button>
      </div>
    </div>
  );
}