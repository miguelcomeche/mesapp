import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DatePreset, DateRange, rangeFromPreset } from '@/lib/analytics';
import { CalendarIcon, Download } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'last7', label: 'Últimos 7 días' },
  { id: 'last30', label: 'Últimos 30 días' },
  { id: 'thisMonth', label: 'Este mes' },
  { id: 'lastMonth', label: 'Mes anterior' },
  { id: 'thisYear', label: 'Este año' },
];

interface Props {
  preset: DatePreset;
  range: DateRange;
  onChange: (preset: DatePreset, range: DateRange) => void;
  rightSlot?: React.ReactNode;
}

export function AnalyticsFilters({ preset, range, onChange, rightSlot }: Props) {
  const [custom, setCustom] = useState<{ from?: Date; to?: Date }>({ from: range.from, to: range.to });

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            variant={preset === p.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(p.id, rangeFromPreset(p.id))}
          >
            {p.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={preset === 'custom' ? 'default' : 'outline'} size="sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {preset === 'custom'
                ? `${format(range.from, 'd MMM', { locale: es })} – ${format(range.to, 'd MMM yyyy', { locale: es })}`
                : 'Personalizado'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: custom.from, to: custom.to }}
              onSelect={(r) => {
                setCustom({ from: r?.from, to: r?.to });
                if (r?.from && r?.to) {
                  onChange('custom', rangeFromPreset('custom', { from: r.from, to: r.to }));
                }
              }}
              numberOfMonths={2}
              locale={es}
            />
          </PopoverContent>
        </Popover>

        <div className={cn('ml-auto flex items-center gap-2')}>{rightSlot}</div>
      </div>
    </div>
  );
}