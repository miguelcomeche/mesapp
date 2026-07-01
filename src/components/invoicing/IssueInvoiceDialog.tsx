import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { computeInvoice, fmtEUR, VAT_RATES, InvoiceLineInput } from '@/lib/invoiceCalc';
import { issueInvoice } from '@/lib/issueInvoice';
import { downloadInvoicePdf, printInvoicePdf, InvoicePdfData } from '@/lib/invoicePdf';
import { enqueueInvoiceThermalPrint } from '@/lib/invoiceThermalPrint';

type LineDraft = InvoiceLineInput;

export type IssueInvoiceContext = {
  session_id?: string | null;
  payment_id?: string | null;
  cash_session_id?: string | null;
  table_number?: string | null;
  waiter_name?: string | null;
  payment_method?: string | null;
  initial_lines?: LineDraft[];
  default_type?: 'simplificado' | 'completa' | 'rectificativa';
  rectifies_invoice_id?: string | null;
};

export function IssueInvoiceDialog({
  open,
  onOpenChange,
  context,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  context: IssueInvoiceContext;
  onIssued?: (invoiceId: string) => void;
}) {
  const { user, restaurantId } = useAuth();
  const { toast } = useToast();

  const [type, setType] = useState<'simplificado' | 'completa' | 'rectificativa'>(
    context.default_type || 'completa'
  );
  const [lines, setLines] = useState<LineDraft[]>(context.initial_lines || []);
  const [busy, setBusy] = useState(false);

  // customer fields
  const [cLegal, setCLegal] = useState('');
  const [cTax, setCTax] = useState('');
  const [cAddr, setCAddr] = useState('');
  const [cCP, setCCP] = useState('');
  const [cCity, setCCity] = useState('');
  const [cCountry, setCCountry] = useState('ES');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [saveCustomer, setSaveCustomer] = useState(true);
  const [rectReason, setRectReason] = useState<
    'datos_cliente' | 'importe' | 'devolucion' | 'anulacion_parcial' | 'otro'
  >('otro');
  const [rectNotes, setRectNotes] = useState('');

  const [savedCustomers, setSavedCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !restaurantId) return;
    setType(context.default_type || 'completa');
    setLines(context.initial_lines || []);
    supabase
      .from('invoice_customers')
      .select('id,legal_name,tax_id,address,postal_code,city,country,email,phone')
      .eq('restaurant_id', restaurantId)
      .order('legal_name', { ascending: true })
      .limit(100)
      .then(({ data }) => setSavedCustomers((data as any[]) || []));
  }, [open, restaurantId, context.default_type, context.initial_lines]);

  const { totals } = useMemo(() => computeInvoice(lines), [lines]);

  const pickCustomer = (id: string) => {
    const c = savedCustomers.find((x) => x.id === id);
    if (!c) return;
    setCLegal(c.legal_name || '');
    setCTax(c.tax_id || '');
    setCAddr(c.address || '');
    setCCP(c.postal_code || '');
    setCCity(c.city || '');
    setCCountry(c.country || 'ES');
    setCEmail(c.email || '');
    setCPhone(c.phone || '');
    setSaveCustomer(false);
  };

  const updateLine = (idx: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));
  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { product_name: '', quantity: 1, unit_price: 0, vat_rate: 10 },
    ]);

  const handleIssue = async (after: 'pdf' | 'print' | 'none') => {
    if (!restaurantId) return;
    if (type === 'completa' && !cLegal.trim()) {
      toast({ title: 'Falta cliente', description: 'Razón social obligatoria.', variant: 'destructive' });
      return;
    }
    if (lines.length === 0 || lines.some((l) => !l.product_name.trim())) {
      toast({ title: 'Líneas inválidas', description: 'Añade al menos un producto.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const inv = await issueInvoice({
        restaurant_id: restaurantId,
        type,
        session_id: context.session_id ?? null,
        payment_id: context.payment_id ?? null,
        cash_session_id: context.cash_session_id ?? null,
        table_number: context.table_number ?? null,
        waiter_name: context.waiter_name ?? null,
        issued_by_user_id: user?.id ?? null,
        payment_method: context.payment_method ?? null,
        rectifies_invoice_id: context.rectifies_invoice_id ?? null,
        rectification_reason: type === 'rectificativa' ? rectReason : null,
        rectification_notes: type === 'rectificativa' ? rectNotes : null,
        customer:
          type === 'simplificado'
            ? null
            : {
                legal_name: cLegal,
                tax_id: cTax,
                address: cAddr,
                postal_code: cCP,
                city: cCity,
                country: cCountry,
                email: cEmail,
                phone: cPhone,
                save: saveCustomer,
              },
        lines,
      });

      const pdfData: InvoicePdfData = {
        invoice_number: inv.invoice_number,
        type,
        issued_at: new Date().toISOString(),
        rest_commercial_name: null,
        rest_legal_name: null,
        rest_tax_id: null,
        rest_address: null,
        rest_postal_code: null,
        rest_city: null,
        rest_country: null,
        rest_phone: null,
        customer_legal_name: cLegal,
        customer_tax_id: cTax,
        customer_address: cAddr,
        customer_postal_code: cCP,
        customer_city: cCity,
        customer_country: cCountry,
        customer_email: cEmail,
        customer_phone: cPhone,
        table_number: context.table_number ?? null,
        waiter_name: context.waiter_name ?? null,
        payment_method: context.payment_method ?? null,
        subtotal: totals.subtotal,
        tax_total: totals.tax_total,
        total: totals.total,
        items: computeInvoice(lines).lines,
        breakdown: totals.breakdown,
      };
      // Pull fiscal snapshot
      const { data: r } = await supabase
        .from('restaurants')
        .select('commercial_name,legal_name,tax_id,address,postal_code,city,country,phone,name')
        .eq('id', restaurantId)
        .maybeSingle();
      const rr = (r as any) || {};
      pdfData.rest_commercial_name = rr.commercial_name || rr.name;
      pdfData.rest_legal_name = rr.legal_name;
      pdfData.rest_tax_id = rr.tax_id;
      pdfData.rest_address = rr.address;
      pdfData.rest_postal_code = rr.postal_code;
      pdfData.rest_city = rr.city;
      pdfData.rest_country = rr.country;
      pdfData.rest_phone = rr.phone;

      if (after === 'pdf') downloadInvoicePdf(pdfData);
      else if (after === 'print') printInvoicePdf(pdfData);

      // Also enqueue the invoice to the thermal printer (Raspberry Pi) via
      // print_jobs, using the same mechanism as the customer ticket.
      try {
        const { error: qErr } = await enqueueInvoiceThermalPrint(
          restaurantId,
          {
            restaurant: {
              commercial_name: pdfData.rest_commercial_name,
              legal_name: pdfData.rest_legal_name,
              tax_id: pdfData.rest_tax_id,
              address: pdfData.rest_address,
              postal_code: pdfData.rest_postal_code,
              city: pdfData.rest_city,
              country: pdfData.rest_country,
              phone: pdfData.rest_phone,
            },
            invoice: {
              number: inv.invoice_number,
              type,
              issued_at: pdfData.issued_at,
              payment_method: context.payment_method ?? null,
              table_number: context.table_number ?? null,
              waiter_name: context.waiter_name ?? null,
            },
            customer:
              type === 'simplificado'
                ? null
                : {
                    legal_name: cLegal,
                    tax_id: cTax,
                    address: cAddr,
                    postal_code: cCP,
                    city: cCity,
                    country: cCountry,
                  },
            items: pdfData.items.map((it) => ({
              product_name: it.product_name,
              quantity: Number(it.quantity),
              unit_price: Number(it.unit_price),
              vat_rate: Number(it.vat_rate),
              total_amount: Number(it.total_amount),
            })),
            breakdown: pdfData.breakdown,
            totals: {
              subtotal: pdfData.subtotal,
              tax_total: pdfData.tax_total,
              total: pdfData.total,
            },
          },
          { sessionId: context.session_id ?? null },
        );
        if (qErr) {
          console.error('[IssueInvoiceDialog] enqueue thermal error', qErr);
        }
      } catch (e) {
        console.error('[IssueInvoiceDialog] enqueue thermal failed', e);
      }

      toast({ title: 'Factura emitida', description: inv.invoice_number });
      onIssued?.(inv.id);
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: 'Error al emitir factura',
        description: e?.message || 'No se pudo emitir',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emitir factura</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de documento</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simplificado">Ticket simplificado</SelectItem>
                  <SelectItem value="completa">Factura completa</SelectItem>
                  <SelectItem value="rectificativa">Factura rectificativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type !== 'simplificado' && savedCustomers.length > 0 && (
              <div>
                <Label>Cliente guardado</Label>
                <Select onValueChange={pickCustomer}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {savedCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.legal_name} {c.tax_id ? `· ${c.tax_id}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {type !== 'simplificado' && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="font-medium text-sm">Datos del cliente</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Razón social *</Label><Input value={cLegal} onChange={(e) => setCLegal(e.target.value)} /></div>
                <div><Label>NIF/CIF/VAT</Label><Input value={cTax} onChange={(e) => setCTax(e.target.value)} /></div>
                <div className="col-span-2"><Label>Dirección</Label><Input value={cAddr} onChange={(e) => setCAddr(e.target.value)} /></div>
                <div><Label>Código postal</Label><Input value={cCP} onChange={(e) => setCCP(e.target.value)} /></div>
                <div><Label>Ciudad</Label><Input value={cCity} onChange={(e) => setCCity(e.target.value)} /></div>
                <div><Label>País</Label><Input value={cCountry} onChange={(e) => setCCountry(e.target.value)} /></div>
                <div><Label>Email</Label><Input value={cEmail} onChange={(e) => setCEmail(e.target.value)} /></div>
                <div><Label>Teléfono</Label><Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={saveCustomer} onCheckedChange={(v) => setSaveCustomer(Boolean(v))} />
                Guardar cliente para futuras facturas
              </label>
            </div>
          )}

          {type === 'rectificativa' && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="font-medium text-sm">Motivo de rectificación</div>
              <Select value={rectReason} onValueChange={(v) => setRectReason(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="datos_cliente">Error datos cliente</SelectItem>
                  <SelectItem value="importe">Error importe</SelectItem>
                  <SelectItem value="devolucion">Devolución</SelectItem>
                  <SelectItem value="anulacion_parcial">Anulación parcial</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Notas (opcional)" value={rectNotes} onChange={(e) => setRectNotes(e.target.value)} />
            </div>
          )}

          <div className="rounded-md border">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground border-b">
              <div className="col-span-5">Descripción</div>
              <div className="col-span-1 text-right">Cant.</div>
              <div className="col-span-2 text-right">Precio</div>
              <div className="col-span-2 text-right">IVA</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
            {lines.map((l, idx) => {
              const total = (Number(l.unit_price) || 0) * (Number(l.quantity) || 0);
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b last:border-b-0">
                  <Input className="col-span-5 h-8" value={l.product_name}
                    onChange={(e) => updateLine(idx, { product_name: e.target.value })} />
                  <Input className="col-span-1 h-8 text-right" type="number" min={0} step="0.01"
                    value={l.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })} />
                  <Input className="col-span-2 h-8 text-right" type="number" min={0} step="0.01"
                    value={l.unit_price}
                    onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) })} />
                  <div className="col-span-2">
                    <Select value={String(l.vat_rate)} onValueChange={(v) => updateLine(idx, { vat_rate: Number(v) })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VAT_RATES.map((r) => (
                          <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 text-right text-sm flex items-center justify-end gap-2">
                    {fmtEUR(total)}
                    <button className="text-destructive text-xs" onClick={() => removeLine(idx)}>×</button>
                  </div>
                </div>
              );
            })}
            <div className="p-2">
              <Button variant="outline" size="sm" onClick={addLine}>+ Añadir línea</Button>
            </div>
          </div>

          <div className="rounded-md bg-muted/30 p-3 space-y-1 text-sm">
            {totals.breakdown.map((b) => (
              <div key={b.vat_rate} className="flex justify-between">
                <span>Base {b.vat_rate}%</span><span>{fmtEUR(b.base_amount)}</span>
              </div>
            ))}
            {totals.breakdown.map((b) => (
              <div key={`t${b.vat_rate}`} className="flex justify-between text-muted-foreground">
                <span>IVA {b.vat_rate}%</span><span>{fmtEUR(b.tax_amount)}</span>
              </div>
            ))}
            <div className="flex justify-between"><span>Base imponible</span><span>{fmtEUR(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span>Total IVA</span><span>{fmtEUR(totals.tax_total)}</span></div>
            <div className="flex justify-between font-semibold text-base border-t pt-1 mt-1"><span>TOTAL</span><span>{fmtEUR(totals.total)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button variant="outline" onClick={() => handleIssue('none')} disabled={busy}>Emitir</Button>
          <Button variant="outline" onClick={() => handleIssue('pdf')} disabled={busy}>Emitir y descargar PDF</Button>
          <Button onClick={() => handleIssue('print')} disabled={busy}>Emitir e imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default IssueInvoiceDialog;