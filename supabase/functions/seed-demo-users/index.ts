import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DemoUser {
  email: string
  password: string
  name: string
  role: 'admin' | 'manager' | 'waiter'
}

const demoUsers: DemoUser[] = [
  { email: 'admin@mesapp.com', password: 'admin123', name: 'Administrador Demo', role: 'admin' },
  { email: 'manager@mesapp.com', password: 'manager123', name: 'Gerente Demo', role: 'manager' },
  { email: 'waiter@mesapp.com', password: 'waiter123', name: 'Camarero Demo', role: 'waiter' },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // First, ensure a demo restaurant exists
    let restaurantId: string
    
    const { data: existingRestaurant } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('name', 'Restaurante Demo')
      .maybeSingle()
    
    if (existingRestaurant) {
      restaurantId = existingRestaurant.id
    } else {
      const { data: newRestaurant, error: restaurantError } = await supabaseAdmin
        .from('restaurants')
        .insert({
          name: 'Restaurante Demo',
          address: 'Calle Principal 123, Madrid',
          phone: '+34 912 345 678',
          currency: 'EUR',
          timezone: 'Europe/Madrid',
        })
        .select('id')
        .single()
      
      if (restaurantError) throw restaurantError
      restaurantId = newRestaurant.id

      // Create demo tables
      const tables = []
      for (let i = 1; i <= 12; i++) {
        tables.push({
          restaurant_id: restaurantId,
          number: `${i}`,
          section: i <= 4 ? 'Terraza' : i <= 8 ? 'Sala Principal' : 'Privado',
          capacity: i <= 4 ? 4 : i <= 8 ? 6 : 8,
          status: 'available' as const,
        })
      }
      await supabaseAdmin.from('tables').insert(tables)

      // Create demo menu items
      const menuItems = [
        { restaurant_id: restaurantId, name: 'Ensalada César', category: 'Entrantes', price: 9.50, description: 'Lechuga romana, parmesano, croutons y salsa césar' },
        { restaurant_id: restaurantId, name: 'Gazpacho Andaluz', category: 'Entrantes', price: 7.00, description: 'Sopa fría de tomate tradicional' },
        { restaurant_id: restaurantId, name: 'Croquetas de Jamón', category: 'Entrantes', price: 10.00, description: '6 unidades caseras' },
        { restaurant_id: restaurantId, name: 'Entrecot de Ternera', category: 'Principales', price: 22.00, description: 'Con patatas panaderas y pimientos' },
        { restaurant_id: restaurantId, name: 'Lubina a la Plancha', category: 'Principales', price: 18.50, description: 'Con verduras al vapor' },
        { restaurant_id: restaurantId, name: 'Paella Valenciana', category: 'Principales', price: 16.00, description: 'Arroz con pollo y verduras (mín. 2 personas)' },
        { restaurant_id: restaurantId, name: 'Tarta de Queso', category: 'Postres', price: 6.50, description: 'Estilo vasco con coulis de frutos rojos' },
        { restaurant_id: restaurantId, name: 'Tiramisú', category: 'Postres', price: 6.00, description: 'Receta tradicional italiana' },
        { restaurant_id: restaurantId, name: 'Café Solo', category: 'Bebidas', price: 1.80, description: '' },
        { restaurant_id: restaurantId, name: 'Agua Mineral', category: 'Bebidas', price: 2.50, description: '500ml' },
        { restaurant_id: restaurantId, name: 'Vino Tinto Rioja', category: 'Bebidas', price: 4.50, description: 'Copa' },
        { restaurant_id: restaurantId, name: 'Cerveza', category: 'Bebidas', price: 3.00, description: 'Caña 330ml' },
      ]
      await supabaseAdmin.from('menu_items').insert(menuItems)
    }

    const results = []

    for (const demoUser of demoUsers) {
      // Check if user already exists in auth
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === demoUser.email)
      
      let userId: string

      if (existingUser) {
        userId = existingUser.id
        // Update password to ensure it matches
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: demoUser.password,
          email_confirm: true,
        })
        results.push({ email: demoUser.email, status: 'updated' })
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: demoUser.email,
          password: demoUser.password,
          email_confirm: true,
          user_metadata: { name: demoUser.name },
        })
        
        if (createError) {
          results.push({ email: demoUser.email, status: 'error', error: createError.message })
          continue
        }
        
        userId = newUser.user.id
        results.push({ email: demoUser.email, status: 'created' })
      }

      // Update profile with restaurant_id
      await supabaseAdmin
        .from('profiles')
        .update({ restaurant_id: restaurantId })
        .eq('id', userId)

      // Ensure correct role exists
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
      
      await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: demoUser.role })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        restaurantId,
        message: 'Demo users seeded successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error seeding demo users:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
