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

interface Body {
  source_restaurant_id: string;
  target_restaurant_id: string;
  include: {
    categories?: boolean; // categories live as text on menu_items, copied with products
    products?: boolean;
    modifiers?: boolean;
    tables?: boolean;
    settings?: boolean; // restaurant_modules + category_settings
  };
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

    const body = (await req.json()) as Body;
    if (!body?.source_restaurant_id || !body?.target_restaurant_id) return bad('Faltan parámetros');
    if (body.source_restaurant_id === body.target_restaurant_id) return bad('Origen y destino deben ser distintos');

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: isPlatform } = await admin.rpc('has_role', { _user_id: userRes.user.id, _role: 'platform_admin' });
    if (!isPlatform) return bad('Solo el administrador de la plataforma puede importar configuración', 403);

    const src = body.source_restaurant_id;
    const tgt = body.target_restaurant_id;
    const inc = body.include ?? {};
    const summary: Record<string, number> = {};

    // Settings: restaurant_modules + category_settings
    if (inc.settings) {
      const { data: srcMods } = await admin.from('restaurant_modules').select('*').eq('restaurant_id', src).maybeSingle();
      if (srcMods) {
        const { id: _id, created_at: _c, updated_at: _u, restaurant_id: _r, ...rest } = srcMods as any;
        await admin.from('restaurant_modules').upsert({ ...rest, restaurant_id: tgt }, { onConflict: 'restaurant_id' });
      }
      const { data: cs } = await admin.from('category_settings').select('*').eq('restaurant_id', src);
      if (cs?.length) {
        const rows = cs.map((c: any) => ({
          category_name: c.category_name,
          auto_marchar_enabled: c.auto_marchar_enabled,
          auto_marchar_station: c.auto_marchar_station,
          restaurant_id: tgt,
        }));
        await admin.from('category_settings').insert(rows);
        summary.category_settings = rows.length;
      }
    }

    // Tables
    if (inc.tables) {
      const { data: ts } = await admin.from('tables').select('*').eq('restaurant_id', src);
      if (ts?.length) {
        const rows = ts.map((t: any) => ({
          restaurant_id: tgt,
          number: t.number,
          section: t.section,
          capacity: t.capacity,
          position_x: t.position_x,
          position_y: t.position_y,
          status: 'available',
        }));
        await admin.from('tables').insert(rows);
        summary.tables = rows.length;
      }
    }

    // Products (categories travel with products as text column)
    if (inc.products || inc.categories) {
      const { data: items } = await admin.from('menu_items').select('*').eq('restaurant_id', src);
      if (items?.length) {
        const rows = items.map((m: any) => ({
          restaurant_id: tgt,
          name: m.name,
          description: m.description,
          category: m.category,
          subcategory: m.subcategory,
          price: m.price,
          image_url: m.image_url,
          available: m.available,
          display_order: m.display_order,
        }));
        await admin.from('menu_items').insert(rows);
        summary.menu_items = rows.length;
      }
    }

    // Modifiers (groups + options)
    if (inc.modifiers) {
      const { data: groups } = await admin.from('modifier_groups').select('*').eq('restaurant_id', src);
      if (groups?.length) {
        let copied = 0;
        for (const g of groups as any[]) {
          const { data: newG } = await admin
            .from('modifier_groups')
            .insert({
              restaurant_id: tgt,
              name: g.name,
              applicable_categories: g.applicable_categories,
              display_order: g.display_order,
            })
            .select('id')
            .single();
          if (newG) {
            const { data: mods } = await admin.from('modifiers').select('*').eq('modifier_group_id', g.id);
            if (mods?.length) {
              await admin.from('modifiers').insert(
                mods.map((m: any) => ({
                  modifier_group_id: newG.id,
                  name: m.name,
                  price_adjustment: m.price_adjustment,
                  available: m.available,
                  display_order: m.display_order,
                })),
              );
            }
            copied++;
          }
        }
        summary.modifier_groups = copied;
      }
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Error desconocido', 500);
  }
});