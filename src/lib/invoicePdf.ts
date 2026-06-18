import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtEUR, fmtDate } from './invoiceCalc';

export type InvoicePdfData = {
  invoice_number: string;
  type: 'simplificado' | 'completa' | 'rectificativa';
  issued_at: string;
  rest_commercial_name?: string | null;
  rest_legal_name?: string | null;
  rest_tax_id?: string | null;
  rest_address?: string | null;
  rest_postal_code?: string | null;
  rest_city?: string | null;
  rest_country?: string | null;
  rest_phone?: string | null;
  customer_legal_name?: string | null;
  customer_tax_id?: string | null;
  customer_address?: string | null;
  customer_postal_code?: string | null;
  customer_city?: string | null;
  customer_country?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  table_number?: string | null;
  waiter_name?: string | null;
  payment_method?: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  rectifies_invoice_number?: string | null;
  rectification_reason?: string | null;
  items: {
    product_name: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
  }[];
  breakdown: { vat_rate: number; base_amount: number; tax_amount: number }[];
};

const TYPE_LABEL: Record<InvoicePdfData['type'], string> = {
  simplificado: 'TICKET SIMPLIFICADO',
  completa: 'FACTURA',
  rectificativa: 'FACTURA RECTIFICATIVA',
};

export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 15;
  let y = M;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(data.rest_commercial_name || data.rest_legal_name || 'Restaurante', M, y);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(TYPE_LABEL[data.type], W - M, y, { align: 'right' });
  y += 6;

  doc.setFontSize(9);
  const left: string[] = [];
  if (data.rest_legal_name && data.rest_legal_name !== data.rest_commercial_name)
    left.push(data.rest_legal_name);
  if (data.rest_tax_id) left.push(`CIF/NIF: ${data.rest_tax_id}`);
  if (data.rest_address) left.push(data.rest_address);
  const cityLine = [data.rest_postal_code, data.rest_city].filter(Boolean).join(' ');
  if (cityLine) left.push(cityLine);
  if (data.rest_phone) left.push(`Tel: ${data.rest_phone}`);
  doc.text(left, M, y);

  doc.setFont('helvetica', 'bold');
  doc.text(`Nº ${data.invoice_number}`, W - M, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${fmtDate(data.issued_at)}`, W - M, y + 5, { align: 'right' });
  if (data.table_number) doc.text(`Mesa: ${data.table_number}`, W - M, y + 10, { align: 'right' });
  if (data.waiter_name) doc.text(`Atendido por: ${data.waiter_name}`, W - M, y + 15, { align: 'right' });

  y += Math.max(left.length * 4 + 4, 22);

  // Customer
  if (data.type !== 'simplificado' && (data.customer_legal_name || data.customer_tax_id)) {
    doc.setDrawColor(220);
    doc.line(M, y, W - M, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Datos del cliente', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const c: string[] = [];
    if (data.customer_legal_name) c.push(data.customer_legal_name);
    if (data.customer_tax_id) c.push(`CIF/NIF: ${data.customer_tax_id}`);
    if (data.customer_address) c.push(data.customer_address);
    const cc = [data.customer_postal_code, data.customer_city, data.customer_country]
      .filter(Boolean)
      .join(' ');
    if (cc) c.push(cc);
    if (data.customer_email) c.push(data.customer_email);
    if (data.customer_phone) c.push(`Tel: ${data.customer_phone}`);
    doc.text(c, M, y);
    y += c.length * 4 + 4;
  }

  if (data.type === 'rectificativa' && data.rectifies_invoice_number) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Rectifica factura: ${data.rectifies_invoice_number}`, M, y);
    y += 5;
    if (data.rectification_reason) {
      doc.setFont('helvetica', 'normal');
      doc.text(`Motivo: ${data.rectification_reason}`, M, y);
      y += 5;
    }
  }

  // Items table
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['Descripción', 'Cant.', 'Precio', 'IVA', 'Base', 'Total']],
    body: data.items.map((i) => [
      i.product_name,
      String(i.quantity),
      fmtEUR(i.unit_price),
      `${i.vat_rate}%`,
      fmtEUR(i.base_amount),
      fmtEUR(i.total_amount),
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 14 },
      2: { halign: 'right', cellWidth: 22 },
      3: { halign: 'right', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 26 },
    },
  });

  // Totals
  // @ts-ignore lastAutoTable is added by autoTable
  let ty = (doc as any).lastAutoTable.finalY + 6;
  const rightX = W - M;
  const labelX = W - M - 60;

  doc.setFontSize(10);
  for (const b of data.breakdown) {
    doc.text(`Base ${b.vat_rate}%`, labelX, ty);
    doc.text(fmtEUR(b.base_amount), rightX, ty, { align: 'right' });
    ty += 5;
    doc.text(`IVA ${b.vat_rate}%`, labelX, ty);
    doc.text(fmtEUR(b.tax_amount), rightX, ty, { align: 'right' });
    ty += 5;
  }

  doc.setDrawColor(180);
  doc.line(labelX, ty, rightX, ty);
  ty += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Base imponible', labelX, ty);
  doc.text(fmtEUR(data.subtotal), rightX, ty, { align: 'right' });
  ty += 5;
  doc.text('Total IVA', labelX, ty);
  doc.text(fmtEUR(data.tax_total), rightX, ty, { align: 'right' });
  ty += 5;
  doc.setFontSize(12);
  doc.text('TOTAL', labelX, ty);
  doc.text(fmtEUR(data.total), rightX, ty, { align: 'right' });
  ty += 8;

  if (data.payment_method) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Método de pago: ${data.payment_method}`, M, ty);
  }

  // Footer
  const ph = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    'Documento generado por Mesapp. Conserve este justificante.',
    W / 2,
    ph - 10,
    { align: 'center' }
  );

  return doc;
}

export function downloadInvoicePdf(data: InvoicePdfData) {
  const doc = generateInvoicePdf(data);
  doc.save(`${data.invoice_number}.pdf`);
}

export function printInvoicePdf(data: InvoicePdfData) {
  const doc = generateInvoicePdf(data);
  doc.autoPrint();
  const blobUrl = doc.output('bloburl');
  const w = window.open(String(blobUrl), '_blank');
  if (!w) downloadInvoicePdf(data);
}