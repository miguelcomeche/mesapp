import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CashSession {
  id: string;
  restaurant_id: string;
  register_id: string;
  status: 'open' | 'closed';
  opened_by: string;
  opened_by_name: string | null;
  opened_at: string;
  opening_amount: number;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
  expected_amount: number | null;
  counted_amount: number | null;
  difference: number | null;
  cash_sales: number;
  card_sales: number;
  other_sales: number;
  tips_cash: number;
  tips_card: number;
  cash_in_total: number;
  cash_out_total: number;
  denominations: Record<string, number> | null;
  signature: string | null;
  signed_by_name: string | null;
  notes: string | null;
}

export interface CashSummary {
  opening_amount: number;
  cash_sales: number;
  card_sales: number;
  other_sales: number;
  tips_cash: number;
  tips_card: number;
  cash_in_total: number;
  cash_out_total: number;
  total_sales: number;
  expected_amount: number;
}

export function useCurrentCashSession() {
  const { restaurantId } = useAuth();
  const [session, setSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error) setSession((data as any) ?? null);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`cash-sessions-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_sessions', filter: `restaurant_id=eq.${restaurantId}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, refresh]);

  return { session, loading, refresh };
}

export async function openCashSession(restaurantId: string, openingAmount: number, notes?: string) {
  const { data, error } = await (supabase.rpc as any)('open_cash_session', {
    _restaurant: restaurantId,
    _register: null,
    _opening_amount: openingAmount,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data as CashSession;
}

export async function closeCashSession(args: {
  sessionId: string;
  countedAmount: number;
  denominations?: Record<string, number> | null;
  signature?: string | null;
  signedByName?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await (supabase.rpc as any)('close_cash_session', {
    _session: args.sessionId,
    _counted_amount: args.countedAmount,
    _denominations: args.denominations ?? null,
    _signature: args.signature ?? null,
    _signed_by_name: args.signedByName ?? null,
    _notes: args.notes ?? null,
  });
  if (error) throw error;
  return data as CashSession;
}

export async function registerCashMovement(args: {
  sessionId: string;
  type: 'in' | 'out';
  amount: number;
  reason: string;
  notes?: string | null;
}) {
  const { data, error } = await (supabase.rpc as any)('register_cash_movement', {
    _session: args.sessionId,
    _type: args.type,
    _amount: args.amount,
    _reason: args.reason,
    _notes: args.notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function voidPayment(paymentId: string, reason: string) {
  const { data, error } = await (supabase.rpc as any)('void_payment', {
    _payment: paymentId,
    _reason: reason,
  });
  if (error) throw error;
  return data;
}

export function useCashSummary(sessionId: string | null | undefined) {
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setSummary(null);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)('cash_session_summary', { _session: sessionId });
    if (!error) setSummary(data as CashSummary);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`cash-summary-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `cash_session_id=eq.${sessionId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements', filter: `session_id=eq.${sessionId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, refresh]);

  return { summary, loading, refresh };
}

export function useCashMovements(sessionId: string | null | undefined) {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setMovements([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    setMovements((data as any[]) || []);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`cash-movements-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements', filter: `session_id=eq.${sessionId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, refresh]);

  return { movements, loading, refresh };
}

export function useCashHistory() {
  const { restaurantId } = useAuth();
  const [items, setItems] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(200);
    setItems((data as any[]) || []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, refresh };
}