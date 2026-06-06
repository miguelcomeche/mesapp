import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useTicketTemplates } from '@/hooks/useTicketTemplates';
import { KIND_LABELS, TicketBlock, TicketKind, TicketTemplate, newBlock } from '@/types/tickets';
import { BlockPalette } from '@/components/printing/BlockPalette';
import { BlockEditorCanvas } from '@/components/printing/BlockEditorCanvas';
import { BlockSettingsPanel } from '@/components/printing/BlockSettingsPanel';
import { ThermalPreview } from '@/components/printing/ThermalPreview';
import { TemplateToolbar } from '@/components/printing/TemplateToolbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { renderToCommands } from '@/lib/ticketRender';
import { mockContext } from '@/lib/ticketMockData';
import { useToast } from '@/hooks/use-toast';

const KINDS: TicketKind[] = ['customer', 'kitchen', 'bar', 'delivery'];

export default function TicketDesigner() {
  const { restaurantId } = useAuth();
  const { tenant } = useTenant();
  const { templates, isLoading, saveTemplate, resetTemplate, duplicateTemplate } = useTicketTemplates(restaurantId);
  const [activeKind, setActiveKind] = useState<TicketKind>('customer');
  const [draft, setDraft] = useState<TicketTemplate | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();

  const current = useMemo(() => templates.find((t) => t.kind === activeKind) || null, [templates, activeKind]);

  useEffect(() => {
    if (current) setDraft(current);
  }, [current?.id, current?.updated_at]);

  if (isLoading || !draft) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const updateDraft = (patch: Partial<TicketTemplate>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const addBlock = (type: any) => {
    const blk = newBlock(type);
    updateDraft({ blocks: [...draft.blocks, blk] });
    setSelectedBlockId(blk.id);
  };

  const reorder = (ids: string[]) => {
    const next = ids.map((id) => draft.blocks.find((b) => b.id === id)!).filter(Boolean) as TicketBlock[];
    updateDraft({ blocks: next });
  };

  const deleteBlock = (id: string) => {
    updateDraft({ blocks: draft.blocks.filter((b) => b.id !== id) });
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const duplicateBlock = (id: string) => {
    const idx = draft.blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const src = draft.blocks[idx];
    const copy: TicketBlock = { ...src, id: Math.random().toString(36).slice(2, 10), settings: { ...(src.settings || {}) } };
    const next = [...draft.blocks];
    next.splice(idx + 1, 0, copy);
    updateDraft({ blocks: next });
  };

  const updateBlockSettings = (settings: any) => {
    if (!selectedBlockId) return;
    updateDraft({
      blocks: draft.blocks.map((b) => (b.id === selectedBlockId ? { ...b, settings } : b)),
    });
  };

  const onSave = async () => {
    setSaving(true);
    await saveTemplate(draft);
    setSaving(false);
  };

  const onReset = async () => {
    const fresh = await resetTemplate(activeKind);
    if (fresh) setDraft(fresh);
  };

  const onTestPrint = () => {
    const commands = renderToCommands(draft, mockContext(draft.kind, tenant?.name));
    // eslint-disable-next-line no-console
    console.log('[TicketDesigner] ePOS-ready commands', commands);
    toast({ title: 'Imprimir prueba', description: 'Comandos generados en la consola. Integración Epson ePOS próximamente.' });
    window.print();
  };

  const selectedBlock = draft.blocks.find((b) => b.id === selectedBlockId) || null;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diseñador de Tickets</h1>
          <p className="text-muted-foreground mt-1">Crea y personaliza los tickets de tu restaurante.</p>
        </div>

        <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as TicketKind)}>
          <TabsList>
            {KINDS.map((k) => (
              <TabsTrigger key={k} value={k}>{KIND_LABELS[k]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <TemplateToolbar
          template={draft}
          onChange={updateDraft}
          onSave={onSave}
          onDuplicate={() => duplicateTemplate(activeKind)}
          onReset={onReset}
          onPreview={() => setPreviewOpen(true)}
          onTestPrint={onTestPrint}
          saving={saving}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_340px] gap-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <BlockPalette onAdd={addBlock} />
          </div>

          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <h3 className="text-sm font-semibold">Diseño</h3>
            <BlockEditorCanvas
              blocks={draft.blocks}
              selectedId={selectedBlockId}
              onSelect={setSelectedBlockId}
              onReorder={reorder}
              onDelete={deleteBlock}
              onDuplicate={duplicateBlock}
            />
            <div className="pt-2 border-t border-border">
              <h4 className="text-sm font-semibold mb-2">Ajustes del bloque</h4>
              <BlockSettingsPanel block={selectedBlock} onChange={updateBlockSettings} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <h3 className="text-sm font-semibold mb-3 text-center">Vista previa ({draft.paper_width}mm)</h3>
            <ThermalPreview template={draft} restaurantName={tenant?.name} />
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vista previa — {KIND_LABELS[draft.kind]}</DialogTitle></DialogHeader>
          <ThermalPreview template={draft} restaurantName={tenant?.name} />
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}