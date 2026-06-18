import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useInvoices, fetchInvoiceFull, InvoiceRow } from '@/hooks/useInvoices';
import { fmtEUR, fmtDate } from '@/lib/invoiceCalc';
import { downloadInvoicePdf, printInvoicePdf, InvoicePdfData } from '@/lib/invoicePdf';
import IssueInvoiceDialog, { IssueInvoiceContext } from '@/components/invoicing/IssueInvoiceDialog';
import { Download, Printer, FileText, RefreshCw, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TYPE_BADGE: Record<string, string> = {
  simplificado: 'bg-secondary',
  completa: 'bg-primary/20 text-primary',
  rectificativa: 'bg-amber-500/20 text-amber-700',
};

function toPdfData(inv: any, items: any[], breakdown: any[], rectifies?: string | null): InvoicePdfData {
  return {
    invoice_number: inv.invoice_number,
    type: inv.type,
    issued_at: inv.issued_at,
    rest_commercial_name: inv.rest_commercial_name,
    rest_legal_name: inv.rest_legal_name,
    rest_tax_id: inv.rest_tax_id,
    rest_address: inv.rest_address,
    rest_postal_code: inv.rest_postal_code,
    rest_city: inv.rest_city,
    rest_country: inv.rest_country,
    rest_phone: inv.rest_phone,
    customer_legal_name: inv.customer_legal_name,
    customer_tax_id: inv.customer_tax_id,
    customer_address: inv.customer_address,
    customer_postal_code: inv.customer_postal_code,
    customer_city: inv.customer_city,
    customer_country: inv.customer_country,
    customer_email: inv.customer_email,
    customer_phone: inv.customer_phone,
    table_number: inv.table_number,
    waiter_name: inv.waiter_name,
    payment_method: inv.payment_method,
    subtotal: Number(inv.subtotal),
    tax_total: Number(inv.tax_total),
    total: Number(inv.total),
    rectifies_invoice_number: rectifies || null,
    rectification_reason: inv.rectification_reason,
    items: items.map((it) => ({
      product_name: it.product_name,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      vat_rate: Number(it.vat_rate),
      base_amount: Number(it.base_amount),
      tax_amount: Number(it.tax_amount),
      total_amount: Number(it.total_amount),
    })),
    breakdown: breakdown.map((b) => ({
      vat_rate: Number(b.vat_rate),
      base_amount: Number(b.base_amount),
      tax_amount: Number(b.tax_amount),
    })),
  };
}

export default function Invoicing() {
  const { restaurantId } = useAuth();
  const { toast } = useToast();
  const { invoices, isLoading, refresh } = useInvoices(restaurantId);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueCtx, setIssueCtx] = useState<IssueInvoiceContext>({});

  const doPdf = async (id: string, mode: 'pdf' | 'print') => {
    const full = await fetchInvoiceFull(id);
    if (!full) return;
    const data = toPdfData(full.invoice, full.items, full.breakdown, full.rectifies_invoice_number);
    if (mode === 'pdf') downloadInvoicePdf(data);
    else printInvoicePdf(data);
  };

  const openRectify = async (inv: InvoiceRow) => {
    const full = await fetchInvoiceFull(inv.id);
    if (!full) return;
    setIssueCtx({
      default_type: 'rectificativa',
      rectifies_invoice_id: inv.id,
      session_id: (full.invoice as any).session_id,
      payment_id: (full.invoice as any).payment_id,
      cash_session_id: (full.invoice as any).cash_session_id,
      table_number: (full.invoice as any).table_number,
      waiter_name: (full.invoice as any).waiter_name,
      payment_method: (full.invoice as any).payment_method,
      initial_lines: full.items.map((it: any) => ({
        product_name: it.product_name,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        vat_rate: Number(it.vat_rate),
      })),
    });
    setIssueOpen(true);
  };

  return (
    <MainLayout title="Facturación">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Facturación</h1>
            <p className="text-muted-foreground text-sm">
              Histórico de facturas y tickets emitidos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refrescar
            </Button>
            <Button onClick={() => { setIssueCtx({}); setIssueOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nueva factura
            </Button>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3">Nº</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">NIF/CIF</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Pago</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>
              )}
              {!isLoading && invoices.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No hay facturas emitidas todavía.</td></tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="p-3 font-mono">{inv.invoice_number}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${TYPE_BADGE[inv.type] || ''}`}>
                      {inv.type}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{fmtDate(inv.issued_at)}</td>
                  <td className="p-3">{inv.customer_legal_name || '—'}</td>
                  <td className="p-3">{inv.customer_tax_id || '—'}</td>
                  <td className="p-3 text-right font-medium">{fmtEUR(Number(inv.total))}</td>
                  <td className="p-3">
                    <Badge variant={inv.status === 'emitida' ? 'default' : 'secondary'}>{inv.status}</Badge>
                  </td>
                  <td className="p-3">{inv.payment_method || '—'}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => doPdf(inv.id, 'pdf')}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => doPdf(inv.id, 'print')}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      {inv.type !== 'rectificativa' && inv.status === 'emitida' && (
                        <Button size="sm" variant="ghost" onClick={() => openRectify(inv)} title="Crear rectificativa">
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <IssueInvoiceDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        context={issueCtx}
        onIssued={() => refresh()}
      />
    </MainLayout>
  );
}