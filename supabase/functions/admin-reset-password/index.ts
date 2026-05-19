import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
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
    if (!authHeader.startsWith('Bearer ')) return bad('No autenticado', 401);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return bad('No autenticado', 401);
    const callerId = userRes.user.id;

    const { user_id, restaurant_id, password, platform } = await req.json();
    if (!user_id || !password) return bad('Faltan campos requeridos');
    if (password.length < 8) return bad('La contraseña debe tener al menos 8 caracteres');

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: isPlatform } = await admin.rpc('has_role', { _user_id: callerId, _role: 'platform_admin' });

    if (platform || !restaurant_id) {
      if (!isPlatform) return bad('No tienes permisos', 403);
    } else {
      const { data: isRestAdmin } = await admin.rpc('has_restaurant_role', {
        _user: callerId, _restaurant: restaurant_id, _role: 'restaurant_admin',
      });
      if (!isPlatform && !isRestAdmin) return bad('No tienes permisos para gestionar usuarios', 403);
      const { data: membership } = await admin
        .from('restaurant_users').select('user_id')
        .eq('user_id', user_id).eq('restaurant_id', restaurant_id).maybeSingle();
      if (!membership) return bad('El usuario no pertenece a este restaurante', 403);
    }

    const { error } = await admin.auth.admin.updateUserById(user_id, { password });
    if (error) return bad(error.message);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});