import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, UtensilsCrossed } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserRestaurant {
  restaurant_id: string;
  name: string;
  slug: string;
  role: 'restaurant_admin' | 'manager' | 'waiter';
  status: 'active' | 'inactive';
}

export default function SelectRestaurant() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<UserRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const choose = async (restaurantId: string) => {
    if (!user) return;
    await supabase.from('profiles').update({ restaurant_id: restaurantId }).eq('id', user.id);
    navigate('/dashboard');
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      // Platform admins have access to all restaurants
      if (hasRole('platform_admin')) {
        // Platform admins do not need a profile.restaurant_id link.
        // If no active tenant slug is stored, pick the first restaurant for context.
        const stored = localStorage.getItem('tenantSlug');
        if (!stored) {
          const { data: all } = await supabase.from('restaurants').select('slug').order('name').limit(1);
          const first = (all as any[])?.[0];
          if (first?.slug) localStorage.setItem('tenantSlug', first.slug);
        }
        navigate('/dashboard');
        return;
      }
      const { data } = await supabase.rpc('get_user_restaurants' as any, { _user: user.id } as any);
      const list = ((data as any[]) ?? []).filter((r) => r.status === 'active') as UserRestaurant[];
      if (list.length === 1) {
        await choose(list[0].restaurant_id);
        return;
      }
      setItems(list);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="p-8 text-center max-w-md">
          <p className="text-muted-foreground">Tu cuenta no está asociada a ningún restaurante. Contacta con un administrador.</p>
          <Button variant="outline" className="mt-4" onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}>Cerrar sesión</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Selecciona un restaurante</h1>
          <p className="text-sm text-muted-foreground">Tienes acceso a varios restaurantes</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((r) => (
            <Card key={r.restaurant_id} className="p-6 hover:border-primary cursor-pointer transition" onClick={() => choose(r.restaurant_id)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{r.role.replace('_', ' ')}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}