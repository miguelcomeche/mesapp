import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  user_id: string;
  restaurant_id: string;
  mode: 'unlink' | 'hard';
}

function res(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return res({ error: 'No autenticado' }, 401);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return res({ error: 'No autenticado' }, 401);
    const callerId = userRes.user.id;

    const body = (await req.json()) as Body;
    if (!body?.user_id || !body?.restaurant_id || !body?.mode) {
      return res({ error: 'Faltan campos requeridos' }, 400);
    }

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: isPlatform } = await admin.rpc('has_role', { _user_id: callerId, _role: 'platform_admin' });
    const { data: isRestAdmin } = await admin.rpc('has_restaurant_role', {
      _user: callerId, _restaurant: body.restaurant_id, _role: 'restaurant_admin',
    });
    if (!isPlatform && !isRestAdmin) return res({ error: 'No tienes permisos para gestionar usuarios' }, 403);
    if (callerId === body.user_id) return res({ error: 'No puedes eliminar tu propio usuario' }, 400);

    // Always unlink from this restaurant first.
    const { error: unlinkErr } = await admin
      .from('restaurant_users')
      .delete()
      .eq('user_id', body.user_id)
      .eq('restaurant_id', body.restaurant_id);
    if (unlinkErr) return res({ error: unlinkErr.message }, 400);

    if (body.mode === 'unlink') {
      return res({ success: true, mode: 'unlink' });
    }

    // Hard delete only if no remaining restaurant links.
    const { count: remaining, error: countErr } = await admin
      .from('restaurant_users')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', body.user_id);
    if (countErr) return res({ error: countErr.message }, 400);
    if ((remaining ?? 0) > 0) {
      return res({
        error: 'Este usuario está vinculado a otros restaurantes. Se ha desvinculado de este restaurante, pero no puede eliminarse definitivamente.',
        code: 'USER_STILL_LINKED',
      }, 409);
    }

    await admin.from('user_roles').delete().eq('user_id', body.user_id);
    await admin.from('profiles').delete().eq('id', body.user_id);
    const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id);
    if (delErr) return res({ error: delErr.message }, 400);

    return res({ success: true, mode: 'hard' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    return res({ error: msg }, 500);
  }
});