import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/hooks/use-toast';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface DayRow {
  day_of_week: number;
  closed: boolean;
  lunch_open: string | null;
  lunch_close: string | null;
  dinner_open: string | null;
  dinner_close: string | null;
}

interface SpecialDay {
  id?: string;
  date: string;
  closed: boolean;
  lunch_open: string | null;
  lunch_close: string | null;
  dinner_open: string | null;
  dinner_close: string | null;
  note: string | null;
}

interface ReservationSettings {
  default_duration_minutes: number;
  buffer_minutes: number;
  max_online_party_size: number;
  max_lead_days: number;
  min_lead_minutes: number;
}

const defaultDay = (d: number): DayRow => ({
  day_of_week: d, closed: false,
  lunch_open: '13:00', lunch_close: '16:00',
  dinner_open: '20:00', dinner_close: '23:30',
});

export default function HoursSettings() {
  const { tenant } = useTenant();
  const rid = tenant?.restaurant_id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<DayRow[]>([]);
  const [special, setSpecial] = useState<SpecialDay[]>([]);
  const [reservation, setReservation] = useState<ReservationSettings>({
    default_duration_minutes: 90, buffer_minutes: 15,
    max_online_party_size: 8, max_lead_days: 60, min_lead_minutes: 60,
  });

  const load = async () => {
    if (!rid) return;
    setLoading(true);
    const { data: h } = await supabase.from('restaurant_hours' as any).select('*').eq('restaurant_id', rid);
    const { data: s } = await supabase.from('restaurant_special_days' as any).select('*').eq('restaurant_id', rid).order('date');
    const { data: r } = await supabase.from('restaurant_reservation_settings' as any).select('*').eq('restaurant_id', rid).maybeSingle();

    const byDay = new Map<number, any>();
    (h as any[] ?? []).forEach(row => byDay.set(row.day_of_week, row));
    setDays([0,1,2,3,4,5,6].map(d => byDay.get(d) ?? defaultDay(d)));
    setSpecial((s as any[]) ?? []);
    if (r) setReservation(r as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  const updateDay = (idx: number, patch: Partial<DayRow>) => {
    setDays(d => d.map((row, i) => i === idx ? { ...row, ...patch } : row));
  };

  const addSpecial = () => {
    setSpecial(s => [...s, {
      date: new Date().toISOString().slice(0, 10),
      closed: true, lunch_open: null, lunch_close: null,
      dinner_open: null, dinner_close: null, note: '',
    }]);
  };

  const removeSpecial = async (idx: number) => {
    const item = special[idx];
    if (item.id) {
      await supabase.from('restaurant_special_days' as any).delete().eq('id', item.id);
    }
    setSpecial(s => s.filter((_, i) => i !== idx));
  };

  const updateSpecial = (idx: number, patch: Partial<SpecialDay>) => {
    setSpecial(s => s.map((row, i) => i === idx ? { ...row, ...patch } : row));
  };

  const save = async () => {
    if (!rid) return;
    setSaving(true);
    try {
      // Hours upsert per day
      for (const d of days) {
        const row = { ...d, restaurant_id: rid };
        await supabase.from('restaurant_hours' as any)
          .upsert(row as any, { onConflict: 'restaurant_id,day_of_week' });
      }
      // Special days upsert
      for (const sd of special) {
        const row = { ...sd, restaurant_id: rid };
        await supabase.from('restaurant_special_days' as any)
          .upsert(row as any, { onConflict: 'restaurant_id,date' });
      }
      // Reservation settings
      await supabase.from('restaurant_reservation_settings' as any)
        .upsert({ ...reservation, restaurant_id: rid } as any, { onConflict: 'restaurant_id' });
      toast({ title: 'Horarios guardados' });
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) {
    return <MainLayout><div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Horarios</h1>
          <p className="text-sm text-muted-foreground">Configura los horarios de apertura y reservas</p>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                <TableHead>Cerrado</TableHead>
                <TableHead>Comida</TableHead>
                <TableHead>Cena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d, i) => (
                <TableRow key={d.day_of_week}>
                  <TableCell className="font-medium">{DAYS[d.day_of_week]}</TableCell>
                  <TableCell><Switch checked={d.closed} onCheckedChange={v => updateDay(i, { closed: v })} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input type="time" value={d.lunch_open ?? ''} onChange={e => updateDay(i, { lunch_open: e.target.value || null })} disabled={d.closed} className="w-28"/>
                      <span>—</span>
                      <Input type="time" value={d.lunch_close ?? ''} onChange={e => updateDay(i, { lunch_close: e.target.value || null })} disabled={d.closed} className="w-28"/>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input type="time" value={d.dinner_open ?? ''} onChange={e => updateDay(i, { dinner_open: e.target.value || null })} disabled={d.closed} className="w-28"/>
                      <span>—</span>
                      <Input type="time" value={d.dinner_close ?? ''} onChange={e => updateDay(i, { dinner_close: e.target.value || null })} disabled={d.closed} className="w-28"/>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Días especiales</h2>
            <Button size="sm" variant="outline" onClick={addSpecial}><Plus className="w-4 h-4 mr-2"/>Añadir</Button>
          </div>
          {special.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin días especiales</p>
          ) : (
            <div className="space-y-2">
              {special.map((sd, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center border border-border rounded-md p-2">
                  <Input type="date" className="col-span-2" value={sd.date} onChange={e => updateSpecial(i, { date: e.target.value })}/>
                  <div className="col-span-2 flex items-center gap-2">
                    <Switch checked={sd.closed} onCheckedChange={v => updateSpecial(i, { closed: v })}/>
                    <span className="text-xs">Cerrado</span>
                  </div>
                  <Input type="time" className="col-span-1" placeholder="Comida" value={sd.lunch_open ?? ''} onChange={e => updateSpecial(i, { lunch_open: e.target.value || null })} disabled={sd.closed}/>
                  <Input type="time" className="col-span-1" value={sd.lunch_close ?? ''} onChange={e => updateSpecial(i, { lunch_close: e.target.value || null })} disabled={sd.closed}/>
                  <Input type="time" className="col-span-1" value={sd.dinner_open ?? ''} onChange={e => updateSpecial(i, { dinner_open: e.target.value || null })} disabled={sd.closed}/>
                  <Input type="time" className="col-span-1" value={sd.dinner_close ?? ''} onChange={e => updateSpecial(i, { dinner_close: e.target.value || null })} disabled={sd.closed}/>
                  <Input className="col-span-3" placeholder="Nota" value={sd.note ?? ''} onChange={e => updateSpecial(i, { note: e.target.value })}/>
                  <Button size="sm" variant="ghost" className="col-span-1" onClick={() => removeSpecial(i)}><Trash2 className="w-4 h-4"/></Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Configuración de reservas</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Duración estándar mesa (min)</Label><Input type="number" value={reservation.default_duration_minutes} onChange={e => setReservation({...reservation, default_duration_minutes: +e.target.value})}/></div>
            <div className="space-y-2"><Label>Buffer entre reservas (min)</Label><Input type="number" value={reservation.buffer_minutes} onChange={e => setReservation({...reservation, buffer_minutes: +e.target.value})}/></div>
            <div className="space-y-2"><Label>Máximo personas online</Label><Input type="number" value={reservation.max_online_party_size} onChange={e => setReservation({...reservation, max_online_party_size: +e.target.value})}/></div>
            <div className="space-y-2"><Label>Antelación máxima reserva (días)</Label><Input type="number" value={reservation.max_lead_days} onChange={e => setReservation({...reservation, max_lead_days: +e.target.value})}/></div>
            <div className="space-y-2"><Label>Antelación mínima reserva (min)</Label><Input type="number" value={reservation.min_lead_minutes} onChange={e => setReservation({...reservation, min_lead_minutes: +e.target.value})}/></div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
        </div>
      </div>
    </MainLayout>
  );
}