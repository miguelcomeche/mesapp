import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Ledger } from './ledger';
import { downloadFile, formatEUR, toCSV } from './analytics';

const EUR = '#,##0.00 "€";-#,##0.00 "€"';
const toDate = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmtDay = (k: string) => k.split('-').reverse().join('/');
const restName = (l: Ledger) => l.raw.restaurant.commercial_name || l.raw.restaurant.name || '';

export async function exportLedgerXlsx(l: Ledger, period: string, filename: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mesapp';
  const sheet = (name: string, cols: Array<[string, number, ('eur' | 'date' | 'datetime' | 'pct')?]>, rows: any[][], totalsRow?: any[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = cols.map(([h, w]) => ({ header: h, width: w }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    if (totalsRow) { const tr = ws.addRow(totalsRow); tr.font = { bold: true }; }
    cols.forEach(([, , f], i) => {
      const c = ws.getColumn(i + 1);
      if (f === 'eur') c.numFmt = EUR;
      if (f === 'date') c.numFmt = 'dd/mm/yyyy';
      if (f === 'datetime') c.numFmt = 'dd/mm/yyyy hh:mm';
      if (f === 'pct') c.numFmt = '0"%"';
    });
    return ws;
  };
  const r = l.raw.restaurant;
  const t = l.totals;
  sheet('RESUMEN', [['Concepto', 30], ['Valor', 22]], [
    ['Restaurante', restName(l)], ['Razón social', r.legal_name ?? ''], ['CIF/NIF', r.tax_id ?? ''], ['Periodo', period],
    ['Nº tickets', t.tickets], ['Ventas brutas', t.gross], ['Descuentos', t.discount], ['Devoluciones', t.refunds],
    ['Ventas netas', t.net], ['Base imponible', t.base], ['IVA', t.vat], ['Total facturado', t.net],
    ['Efectivo', t.cash], ['Tarjeta', t.card], ['Otros', t.other], ['Total cobrado', t.collected], ['Diferencia', t.diff],
  ]).getColumn(2).numFmt = EUR;
  sheet('VENTAS DIARIAS', [['Fecha', 12, 'date'], ['Nº tickets', 10], ['Base imponible', 15, 'eur'], ['IVA', 12, 'eur'], ['Total facturado', 15, 'eur'], ['Efectivo', 12, 'eur'], ['Tarjeta', 12, 'eur'], ['Otros', 12, 'eur'], ['Total cobrado', 15, 'eur'], ['Diferencia', 12, 'eur']],
    l.days.map((d) => [toDate(d.date), d.tickets, d.base, d.vat, d.net, d.cash, d.card, d.other, d.collected, d.diff]),
    ['TOTAL', t.tickets, t.base, t.vat, t.net, t.cash, t.card, t.other, t.collected, t.diff]);
  sheet('TICKETS', [['Restaurante', 16], ['Fecha', 12, 'date'], ['Hora', 8], ['Ticket', 10], ['ID venta', 38], ['Mesa', 8], ['Camarero', 14], ['Bruto', 12, 'eur'], ['Descuentos', 12, 'eur'], ['Base imponible', 14, 'eur'], ['IVA', 12, 'eur'], ['Total', 12, 'eur'], ['Efectivo', 12, 'eur'], ['Tarjeta', 12, 'eur'], ['Otros', 12, 'eur'], ['Devolución', 12, 'eur'], ['Estado', 16], ['Factura', 18]],
    l.tickets.map((x) => [restName(l), toDate(x.date), x.closedAt.toTimeString().slice(0, 5), x.number, x.id, x.table, x.waiter, x.gross, x.discount, x.base, x.vat, x.net, x.cash, x.card, x.other, x.refunds, x.status, x.invoice?.number ?? '']));
  const ivaRows: any[][] = [];
  l.days.forEach((d) => d.vatRows.forEach((v) => ivaRows.push([toDate(d.date), v.rate, v.base, v.vat, v.total])));
  const ivaWs = sheet('IVA', [['Fecha', 12, 'date'], ['Tipo IVA', 10, 'pct'], ['Base imponible', 15, 'eur'], ['Cuota IVA', 14, 'eur'], ['Total', 14, 'eur']], ivaRows);
  ivaWs.addRow([]);
  ivaWs.addRow(['RESUMEN PERIODO']).font = { bold: true };
  l.vat.forEach((v) => { const rr = ivaWs.addRow(['', v.rate, v.base, v.vat, v.total]); rr.font = { bold: true }; });
  sheet('MÉTODOS DE PAGO', [['Fecha/hora', 18, 'datetime'], ['Ticket', 10], ['Método', 12], ['Importe', 12, 'eur'], ['Estado', 12], ['Referencia', 30]],
    l.paymentLines.map((p) => [p.date, p.ticket, p.method, p.amount, p.status, p.reference]));
  sheet('FACTURAS', [['Nº factura', 18], ['Fecha emisión', 14, 'date'], ['Cliente', 26], ['NIF/CIF', 14], ['Ticket origen', 12], ['Base imponible', 14, 'eur'], ['IVA', 12, 'eur'], ['Total', 12, 'eur'], ['Tipo', 14], ['Estado', 12]],
    l.raw.invoices.map((i) => [i.invoice_number, new Date(i.issued_at), i.customer ?? '', i.tax_id ?? '', l.tickets.find((x) => x.id === i.session_id)?.number ?? '', Number(i.subtotal), Number(i.tax_total), Number(i.total), i.type, i.status]));
  sheet('DEVOLUCIONES', [['Fecha', 18, 'datetime'], ['Ticket', 10], ['Tipo', 14], ['Método', 12], ['Importe', 12, 'eur'], ['Motivo', 30]],
    l.refundLines.map((x) => [x.date, x.ticket, x.kind, x.method, x.amount, x.reason]));
  sheet('CAJA', [['Apertura', 18, 'datetime'], ['Cierre', 18, 'datetime'], ['Fondo inicial', 14, 'eur'], ['Ventas efectivo', 14, 'eur'], ['Entradas', 12, 'eur'], ['Salidas', 12, 'eur'], ['Esperado', 12, 'eur'], ['Contado', 12, 'eur'], ['Diferencia', 12, 'eur'], ['Estado', 10]],
    l.raw.cash_sessions.map((c) => [new Date(c.opened_at), c.closed_at ? new Date(c.closed_at) : null, Number(c.opening_amount), Number(c.cash_sales), Number(c.cash_in_total), Number(c.cash_out_total), c.expected_amount != null ? Number(c.expected_amount) : null, c.counted_amount != null ? Number(c.counted_amount) : null, c.difference != null ? Number(c.difference) : null, c.status]));
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${filename}.xlsx`; a.click(); URL.revokeObjectURL(url);
}

export function exportLedgerCsv(l: Ledger, filename: string) {
  const rows = l.days.map((d) => ({
    Fecha: fmtDay(d.date), Tickets: d.tickets, Base_imponible: d.base.toFixed(2), IVA: d.vat.toFixed(2), Total_facturado: d.net.toFixed(2),
    Efectivo: d.cash.toFixed(2), Tarjeta: d.card.toFixed(2), Otros: d.other.toFixed(2), Total_cobrado: d.collected.toFixed(2), Diferencia: d.diff.toFixed(2),
  }));
  downloadFile(`${filename}.csv`, '\uFEFF' + toCSV(rows));
}

export function exportLedgerPdf(l: Ledger, period: string, filename: string) {
  const doc = new jsPDF();
  const r = l.raw.restaurant;
  const t = l.totals;
  doc.setFontSize(10); doc.text('MESAPP', 14, 14);
  doc.setFontSize(16); doc.text('INFORME DE FACTURACIÓN', 14, 22);
  doc.setFontSize(10);
  [`Restaurante: ${restName(l)}`, `Razón social: ${r.legal_name ?? '—'}`, `CIF: ${r.tax_id ?? '—'}`, `Periodo: ${period}`].forEach((s, i) => doc.text(s, 14, 30 + i * 5));
  let y = 52;
  const sec = (title: string, head: string[], body: any[][]) => {
    doc.setFontSize(12); doc.text(title, 14, y);
    autoTable(doc, { startY: y + 2, head: [head], body, styles: { fontSize: 8 }, headStyles: { fillColor: [40, 40, 40] } });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 260) { doc.addPage(); y = 20; }
  };
  sec('Resumen', ['Concepto', 'Importe'], [
    ['Nº tickets', String(t.tickets)], ['Ventas brutas', formatEUR(t.gross)], ['Descuentos', formatEUR(t.discount)], ['Devoluciones', formatEUR(t.refunds)],
    ['Ventas netas', formatEUR(t.net)], ['Base imponible', formatEUR(t.base)], ['IVA', formatEUR(t.vat)], ['Total facturado', formatEUR(t.net)],
  ]);
  sec('Desglose IVA', ['IVA', 'Base imponible', 'Cuota IVA', 'Total'], l.vat.map((v) => [`${v.rate}%`, formatEUR(v.base), formatEUR(v.vat), formatEUR(v.total)]));
  sec('Métodos de pago', ['Método', 'Importe'], [['Efectivo', formatEUR(t.cash)], ['Tarjeta', formatEUR(t.card)], ['Otros', formatEUR(t.other)], ['Total cobrado', formatEUR(t.collected)]]);
  sec('Ventas por día', ['Fecha', 'Tickets', 'Base', 'IVA', 'Total', 'Efectivo', 'Tarjeta', 'Otros', 'Dif.'],
    [...l.days.map((d) => [fmtDay(d.date), d.tickets, formatEUR(d.base), formatEUR(d.vat), formatEUR(d.net), formatEUR(d.cash), formatEUR(d.card), formatEUR(d.other), formatEUR(d.diff)]),
     ['TOTAL', t.tickets, formatEUR(t.base), formatEUR(t.vat), formatEUR(t.net), formatEUR(t.cash), formatEUR(t.card), formatEUR(t.other), formatEUR(t.diff)]]);
  sec('Devoluciones / rectificaciones', ['Fecha', 'Ticket', 'Tipo', 'Importe', 'Motivo'], [
    ...l.refundLines.map((x) => [x.date.toLocaleDateString('es-ES'), x.ticket, x.kind, formatEUR(x.amount), x.reason]),
    ...l.raw.invoices.filter((i) => i.type === 'rectificativa').map((i) => [new Date(i.issued_at).toLocaleDateString('es-ES'), i.invoice_number, 'Rectificativa', formatEUR(Number(i.total)), '']),
  ]);
  sec('Conciliación', ['Concepto', 'Importe'], [['Total ventas', formatEUR(t.net)], ['Total cobros', formatEUR(t.collected)], ['Diferencia', formatEUR(t.diff)]]);
  doc.setFontSize(8);
  doc.text(`Generado por Mesapp — ${new Date().toLocaleString('es-ES')}`, 14, 290);
  doc.save(`${filename}.pdf`);
}
