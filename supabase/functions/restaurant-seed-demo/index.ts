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

    const { restaurant_id } = await req.json();
    if (!restaurant_id) return bad('Falta restaurant_id');

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: isPlatform } = await admin.rpc('has_role', { _user_id: userRes.user.id, _role: 'platform_admin' });
    if (!isPlatform) return bad('Solo el administrador de la plataforma puede cargar datos demo', 403);

    const { data: r } = await admin.from('restaurants').select('id,type').eq('id', restaurant_id).maybeSingle();
    if (!r) return bad('Restaurante no encontrado', 404);
    if (r.type !== 'demo') return bad('Solo restaurantes de tipo DEMO pueden cargar datos demo', 400);

    // Demo tables
    const tables: any[] = [];
    for (let i = 1; i <= 12; i++) {
      tables.push({
        restaurant_id,
        number: `${i}`,
        section: i <= 4 ? 'Terraza' : 'Interior',
        capacity: i <= 4 ? 4 : 6,
        status: 'available',
      });
    }
    await admin.from('tables').insert(tables);

    // Demo menu items
    const menu = [
      { name: 'Ensalada César', category: 'Entrantes', price: 9.5, description: 'Lechuga, parmesano, croutons' },
      { name: 'Croquetas de Jamón', category: 'Entrantes', price: 10, description: '6 unidades caseras' },
      { name: 'Entrecot de Ternera', category: 'Principales', price: 22, description: 'Con patatas' },
      { name: 'Lubina a la Plancha', category: 'Principales', price: 18.5, description: 'Con verduras' },
      { name: 'Tarta de Queso', category: 'Postres', price: 6.5, description: 'Estilo vasco' },
      { name: 'Tiramisú', category: 'Postres', price: 6, description: 'Receta italiana' },
      { name: 'Café Solo', category: 'Bebidas', price: 1.8, description: '' },
      { name: 'Agua Mineral', category: 'Bebidas', price: 2.5, description: '500ml' },
      { name: 'Vino Tinto', category: 'Bebidas', price: 4.5, description: 'Copa' },
      { name: 'Cerveza', category: 'Bebidas', price: 3, description: 'Caña 330ml' },
    ].map((m) => ({ ...m, restaurant_id, available: true }));
    await admin.from('menu_items').insert(menu);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Error desconocido', 500);
  }
});