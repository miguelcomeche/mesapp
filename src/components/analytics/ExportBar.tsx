import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileDown, Printer } from 'lucide-react';
import { downloadFile, toCSV } from '@/lib/analytics';

interface Props {
  filenameBase: string;
  data: {
    kpis: Record<string, unknown>;
    products: Array<Record<string, unknown>>;
    categories: Array<Record<string, unknown>>;
    tables: Array<Record<string, unknown>>;
    salesByDay: Array<Record<string, unknown>>;
  };
}

export function ExportBar({ filenameBase, data }: Props) {
  const exportCSV = () => {
    const sections = [
      '# KPIs',
      toCSV([data.kpis]),
      '',
      '# Productos',
      toCSV(data.products),
      '',
      '# Categorías',
      toCSV(data.categories),
      '',
      '# Mesas',
      toCSV(data.tables),
      '',
      '# Ventas por día',
      toCSV(data.salesByDay),
    ].join('\n');
    downloadFile(`${filenameBase}.csv`, sections);
  };

  const exportExcel = () => {
    const sheet = toCSV([{ Sección: 'KPIs', ...data.kpis }]) + '\n\n' + toCSV(data.products);
    downloadFile(`${filenameBase}.xls`, sheet, 'application/vnd.ms-excel');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV}>
          <FileDown className="mr-2 h-4 w-4" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel}>
          <FileDown className="mr-2 h-4 w-4" /> Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> PDF (imprimir)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}