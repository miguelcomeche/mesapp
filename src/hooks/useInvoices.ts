import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  type: 'simplificado' | 'completa' | 'rectificativa';
  status: 'emitida' | 'rectificada' | 'anulada';
  issued_at: string;
  customer_legal_name: string | null;
  customer_tax_id: string | null;
  total: number;
  payment_method: string | null;
};

export function useInvoices(restaurantId: string | null) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    if (!restaurantId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select(
        'id,invoice_number,type,status,issued_at,customer_legal_name,customer_tax_id,total,payment_method'
      )
      .eq('restaurant_id', restaurantId)
      .order('issued_at', { ascending: false })
      .limit(500);
    if (!error && data) setInvoices(data as unknown as InvoiceRow[]);
    setIsLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return { invoices, isLoading, refresh: fetchInvoices };
}

export async function fetchInvoiceFull(invoiceId: string) {
  const [{ data: inv }, { data: items }, { data: br }] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle(),
    supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('position', { ascending: true }),
    supabase
      .from('invoice_tax_breakdown')
      .select('vat_rate,base_amount,tax_amount')
      .eq('invoice_id', invoiceId),
  ]);
  if (!inv) return null;
  let rectifiedNumber: string | null = null;
  if ((inv as any).rectifies_invoice_id) {
    const { data: orig } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('id', (inv as any).rectifies_invoice_id)
      .maybeSingle();
    rectifiedNumber = (orig as any)?.invoice_number ?? null;
  }
  return {
    invoice: inv as any,
    items: (items || []) as any[],
    breakdown: (br || []) as { vat_rate: number; base_amount: number; tax_amount: number }[],
    rectifies_invoice_number: rectifiedNumber,
  };
}