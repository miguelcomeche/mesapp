import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Role = 'restaurant_admin' | 'manager' | 'waiter';
type Status = 'active' | 'inactive';

interface Body {
  name: string;
  email: string;
  password: string;
  role: Role;
  status?: Status;
  restaurant_id: string;
  waiter_pin?: string | null;
}

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
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return bad('No autenticado', 401);
    const callerId = userRes.user.id;

    const body = (await req.json()) as Body;
    if (!body?.email || !body?.password || !body?.name || !body?.role || !body?.restaurant_id) {
      return bad('Faltan campos requeridos');
    }
    if (body.password.length < 8) return bad('La contraseña debe tener al menos 8 caracteres');
    if (!['restaurant_admin', 'manager', 'waiter'].includes(body.role)) return bad('Rol inválido');
    const pin = body.waiter_pin ? String(body.waiter_pin).trim() : null;
    if (pin && !/^\d{4,8}$/.test(pin)) return bad('El PIN debe tener entre 4 y 8 dígitos');

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    // Permission check
    const { data: isPlatform } = await admin.rpc('has_role', { _user_id: callerId, _role: 'platform_admin' });
    const { data: isRestAdmin } = await admin.rpc('has_restaurant_role', {
      _user: callerId,
      _restaurant: body.restaurant_id,
      _role: 'restaurant_admin',
    });
    if (!isPlatform && !isRestAdmin) return bad('No tienes permisos para gestionar usuarios', 403);

    // Find or create auth user
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === body.email.toLowerCase());
    if (existing) {
      userId = existing.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { name: body.name },
      });
      if (createErr || !created.user) return bad(createErr?.message ?? 'Error al crear usuario');
      userId = created.user.id;
    }

    // Upsert profile
    await admin.from('profiles').upsert(
      { id: userId, email: body.email, name: body.name, restaurant_id: body.restaurant_id },
      { onConflict: 'id' },
    );

    // Upsert membership
    const { error: muErr } = await admin
      .from('restaurant_users')
      .upsert(
        {
          user_id: userId,
          restaurant_id: body.restaurant_id,
          role: body.role,
          status: body.status ?? 'active',
          waiter_pin: pin,
        },
        { onConflict: 'user_id,restaurant_id' },
      );
    if (muErr) return bad(muErr.message);

    // Mirror legacy global role for compatibility
    const legacy = body.role === 'restaurant_admin' ? 'admin' : body.role;
    await admin.from('user_roles').delete().eq('user_id', userId);
    await admin.from('user_roles').insert({ user_id: userId, role: legacy });

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
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