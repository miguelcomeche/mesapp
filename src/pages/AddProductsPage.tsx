import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ArrowLeft, 
  Plus, 
  Search, 
  ShoppingCart,
  Settings2,
  Users,
  Receipt,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useOrders, useMenuItems, usePayments } from '@/hooks/useRestaurantData';
import { useModifiers } from '@/hooks/useModifiers';
import { supabase } from '@/integrations/supabase/client';
import { TableSession, MenuItem, ModifierGroup, Modifier, OrderItem } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import ModifierEditDialog from '@/components/session/ModifierEditDialog';
import { CommandPanel } from '@/components/session/CommandPanel';
import { useCategorySettings } from '@/hooks/useCategorySettings';
import { useMarchar } from '@/hooks/useKitchenTickets';
import { enqueuePrintJob } from '@/lib/printQueue';

export interface SelectedModifier {
  modifier: Modifier;
  groupName: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
  modifiers?: SelectedModifier[];
  modifierPriceAdjustment?: number;
}

export default function AddProductsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  // Use the active tenant (currently selected restaurant), not the user's profile
  // restaurant_id — platform admins switching restaurants need the active one.
  const restaurantId = tenant?.restaurant_id ?? null;
  const { toast } = useToast();

  const [session, setSession] = useState<TableSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Modifier dialog state
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [modifierDialogMode, setModifierDialogMode] = useState<'extras' | 'sin' | 'all'>('all');
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [existingOrderItemModifiers, setExistingOrderItemModifiers] = useState<SelectedModifier[] | undefined>(undefined);
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [targetOrderItemId, setTargetOrderItemId] = useState<string | null>(null);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);

  const { orders, createOrder, fetchOrders } = useOrders(sessionId);
  const { payments } = usePayments(sessionId);
  const { menuItems } = useMenuItems(restaurantId);
  const { modifierGroups } = useModifiers(restaurantId);
  const { settings: categorySettings, isAutoMarchar, getAutoMarcharStation } = useCategorySettings(restaurantId);
  const { user } = useAuth();
  const marchar = useMarchar(sessionId || null, restaurantId, user?.id || null);

  const activeCategories = useMemo(
    () => categorySettings
      .filter(category => category.active !== false)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.category_name.localeCompare(b.category_name, 'es')),
    [categorySettings]
  );

  // Debug — synchronization between Carta and selector
  useEffect(() => {
    console.info('[AddProducts] activeRestaurant.id =', restaurantId);
    console.info('[AddProducts] loaded categories count =', activeCategories.length);
    console.info('[AddProducts] loaded products count =', menuItems.length);
    console.table(menuItems.map(i => ({
      id: i.id,
      name: i.name,
      product_restaurant_id: i.restaurant_id,
      product_category_id: i.category_id,
      category: i.category,
    })));
    const mismatched = menuItems.filter(i => i.restaurant_id !== restaurantId);
    if (mismatched.length) console.warn('[AddProducts] products with mismatched restaurant_id:', mismatched.length);
  }, [restaurantId, menuItems, activeCategories]);

  // Get all order items flattened
  const allOrderItems: OrderItem[] = orders.flatMap(o => (o.items || []) as OrderItem[]);

  // Fetch session data
  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) return;

      const { data, error } = await supabase
        .from('table_sessions')
        .select('*, table:tables(*), reservation:reservations(*)')
        .eq('id', sessionId)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Error', description: 'No se pudo cargar el servicio.', variant: 'destructive' });
        navigate('/floor');
        return;
      }

      setSession(data as TableSession);
      setIsLoading(false);
    };

    fetchSession();
  }, [sessionId, navigate, toast]);

  // Get unique categories
  const categories = useMemo(() => activeCategories.map(category => category.category_name), [activeCategories]);

  // Get subcategories dynamically for the selected Carta category
  const subcategories = useMemo(() => 
    selectedCategory
      ? [...new Set(menuItems.filter(item => item.category === selectedCategory && item.subcategory).map(item => item.subcategory!))]
      : [],
    [selectedCategory, menuItems]
  );

  // Filter items
  const filteredItems = useMemo(() => 
    menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const matchesSubcategory = !selectedSubcategory || item.subcategory === selectedSubcategory;
      return matchesSearch && matchesCategory && matchesSubcategory;
    }).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
    [menuItems, search, selectedCategory, selectedSubcategory]
  );

  // Get applicable modifier groups for a category
  const getModifiersForCategory = useCallback((category: string): ModifierGroup[] => {
    return modifierGroups.filter(group =>
      group.applicable_categories?.includes(category)
    );
  }, [modifierGroups]);

  // Check if item has applicable modifiers
  const hasModifiers = useCallback((item: MenuItem): boolean => {
    const groups = getModifiersForCategory(item.category);
    return groups.length > 0 && groups.some(g => (g.modifiers?.length || 0) > 0);
  }, [getModifiersForCategory]);

  // Check if item has specific group types
  const hasExtrasModifiers = useCallback((item: MenuItem): boolean => {
    const groups = getModifiersForCategory(item.category);
    return groups.some(g =>
      (g.name.toLowerCase().includes('extra') || g.name.toLowerCase().includes('con')) &&
      (g.modifiers?.length || 0) > 0
    );
  }, [getModifiersForCategory]);

  const hasSinModifiers = useCallback((item: MenuItem): boolean => {
    const groups = getModifiersForCategory(item.category);
    return groups.some(g =>
      g.name.toLowerCase().includes('sin') &&
      (g.modifiers?.length || 0) > 0
    );
  }, [getModifiersForCategory]);

  // Add item directly to cart
  const handleItemClick = (item: MenuItem) => {
    addToCart(item);
  };

  // Open modifier dialog
  const openOrderItemModifierDialog = (item: MenuItem, mode: 'extras' | 'sin' | 'all') => {
    const candidates = allOrderItems.filter(oi => oi.menu_item_id === item.id);
    const sorted = candidates
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const latest = sorted[sorted.length - 1];

    const applicableGroups = getModifiersForCategory(item.category);

    if (!latest) {
      // DRAFT MODE: No existing order item, will create one on confirm
      setEditingCartIndex(null);
      setTargetOrderItemId(null);
      setExistingOrderItemModifiers([]);
      setSelectedMenuItem(item);
      setModifierDialogMode(mode);
      setIsDraftMode(true);
      setModifierDialogOpen(true);
      return;
    }

    // EDIT MODE: Existing order item found
    const modifierLookup = new Map<string, { modifier: Modifier; groupName: string }>();
    for (const group of applicableGroups) {
      for (const mod of group.modifiers || []) {
        modifierLookup.set(mod.id, { modifier: mod, groupName: group.name });
      }
    }

    const filterGroup =
      mode === 'extras' ? 'EXTRAS_CON' : mode === 'sin' ? 'SIN' : null;

    const existing = (latest.order_item_modifiers || [])
      .filter((row) => (filterGroup ? row.modifier_group === filterGroup : true))
      .map((row) => modifierLookup.get(row.modifier_id))
      .filter((x): x is { modifier: Modifier; groupName: string } => Boolean(x))
      .map((x) => ({ modifier: x.modifier, groupName: x.groupName }));

    setEditingCartIndex(null);
    setTargetOrderItemId(latest.id);
    setExistingOrderItemModifiers(existing);
    setSelectedMenuItem(item);
    setModifierDialogMode(mode);
    setIsDraftMode(false);
    setModifierDialogOpen(true);
  };

  const handleModifierConfirm = async (selectedModifiers: SelectedModifier[]) => {
    if (!selectedMenuItem || !sessionId) return;

    // DRAFT MODE: Add to cart with modifiers
    if (isDraftMode) {
      const modifierPriceAdjustment = selectedModifiers.reduce(
        (sum, m) => sum + Number(m.modifier.price_adjustment),
        0
      );

      setCart(prev => [
        ...prev,
        {
          menuItem: selectedMenuItem,
          quantity: 1,
          modifiers: selectedModifiers.length > 0 ? selectedModifiers : undefined,
          modifierPriceAdjustment: modifierPriceAdjustment > 0 ? modifierPriceAdjustment : undefined,
        },
      ]);

      toast({ title: 'Producto añadido', description: `${selectedMenuItem.name} añadido a la selección.` });
      setIsDraftMode(false);
      setSelectedMenuItem(null);
      return;
    }

    // EDIT FLOW: Persist to existing order item
    if (targetOrderItemId) {
      await applyOrderItemModifiers({
        orderItemId: targetOrderItemId,
        mode: modifierDialogMode,
        selectedModifiers,
      });
      setTargetOrderItemId(null);
      setExistingOrderItemModifiers(undefined);
      return;
    }

    // CART FLOW: Update pending item in cart
    if (editingCartIndex !== null) {
      const modifierPriceAdjustment = selectedModifiers.reduce(
        (sum, sm) => sum + Number(sm.modifier.price_adjustment),
        0
      );

      setCart(prev => prev.map((item, index) =>
        index === editingCartIndex
          ? {
              ...item,
              modifiers: selectedModifiers.length > 0 ? selectedModifiers : undefined,
              modifierPriceAdjustment: modifierPriceAdjustment > 0 ? modifierPriceAdjustment : undefined
            }
          : item
      ));

      setEditingCartIndex(null);
    }
  };

  const applyOrderItemModifiers = async (params: {
    orderItemId: string;
    mode: 'extras' | 'sin' | 'all';
    selectedModifiers: SelectedModifier[];
  }) => {
    const { orderItemId, mode, selectedModifiers } = params;

    const getIsSin = (groupName: string) => {
      const lower = groupName.toLowerCase();
      return lower.includes('sin') || lower.includes('quitar');
    };

    const extrasSelected =
      mode === 'sin'
        ? []
        : selectedModifiers.filter((m) => !getIsSin(m.groupName));

    const sinSelected =
      mode === 'extras'
        ? []
        : selectedModifiers.filter((m) => getIsSin(m.groupName));

    const persistGroup = async (group: 'EXTRAS_CON' | 'SIN', mods: SelectedModifier[]) => {
      const { error: delError } = await supabase
        .from('order_item_modifiers')
        .delete()
        .eq('order_item_id', orderItemId)
        .eq('modifier_group', group);

      if (delError) throw delError;

      if (mods.length === 0) return;

      const inserts = mods.map((m) => ({
        order_item_id: orderItemId,
        modifier_id: m.modifier.id,
        modifier_group: group,
        name: m.modifier.name,
        price: group === 'SIN' ? 0 : Number(m.modifier.price_adjustment),
      }));

      const { error: insError } = await supabase
        .from('order_item_modifiers')
        .insert(inserts);

      if (insError) throw insError;
    };

    try {
      if (mode === 'extras') {
        await persistGroup('EXTRAS_CON', extrasSelected);
      } else if (mode === 'sin') {
        await persistGroup('SIN', sinSelected);
      } else {
        await persistGroup('EXTRAS_CON', extrasSelected);
        await persistGroup('SIN', sinSelected);
      }

      // Recalculate unit_price = base_unit_price + SUM(extras)
      const { data: oi, error: oiError } = await supabase
        .from('order_items')
        .select('base_unit_price')
        .eq('id', orderItemId)
        .single();

      if (oiError) throw oiError;

      const { data: extrasRows, error: extrasError } = await supabase
        .from('order_item_modifiers')
        .select('price')
        .eq('order_item_id', orderItemId)
        .eq('modifier_group', 'EXTRAS_CON');

      if (extrasError) throw extrasError;

      const extrasSum = (extrasRows || []).reduce((sum, row) => sum + Number((row as any).price), 0);
      const base = Number((oi as any).base_unit_price || 0);

      const { error: upError } = await supabase
        .from('order_items')
        .update({ unit_price: base + extrasSum })
        .eq('id', orderItemId);

      if (upError) throw upError;

      await recalculateAndPersistSessionTotal();
      await fetchOrders();

      toast({ title: 'Modificadores guardados', description: 'Los cambios se han aplicado al pedido.' });
    } catch (e: any) {
      console.error('Error applying modifiers:', e);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los modificadores.',
        variant: 'destructive',
      });
    }
  };

  const recalculateAndPersistSessionTotal = async () => {
    if (!sessionId) return;

    const { data, error } = await supabase
      .from('order_items')
      .select('unit_price, quantity, status, orders!inner(session_id)')
      .eq('orders.session_id', sessionId);

    if (error) {
      console.error('Error recalculating session total:', error);
      return;
    }

    const total = (data as any[])
      .filter((row) => row.status !== 'cancelled')
      .reduce((sum, row) => sum + Number(row.unit_price) * Number(row.quantity), 0);

    await supabase
      .from('table_sessions')
      .update({ total_amount: total })
      .eq('id', sessionId);
  };

  const addToCart = (menuItem: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(
        item => item.menuItem.id === menuItem.id && !item.modifiers
      );
      if (existing) {
        return prev.map(item =>
          item === existing
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => {
      const item = prev[index];
      if (item && item.quantity > 1) {
        return prev.map((cartItem, i) =>
          i === index
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        );
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeCartItemCompletely = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const incrementCartItem = (index: number) => {
    setCart(prev =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const getCartQuantity = (menuItemId: string) => {
    return cart
      .filter(item => item.menuItem.id === menuItemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => {
    const basePrice = Number(item.menuItem.price);
    const modifierAdjustment = item.modifierPriceAdjustment || 0;
    return sum + ((basePrice + modifierAdjustment) * item.quantity);
  }, 0);

  // Determine station based on category
  const getStation = (menuItem: { category: string }): 'kitchen' | 'bar' => {
    const bebidasCategories = ['Bebidas', 'Aguas y refrescos', 'Cerveza', 'Vino', 'Café', 'Licores'];
    return bebidasCategories.some(c => menuItem.category.toLowerCase().includes(c.toLowerCase()))
      ? 'bar'
      : 'kitchen';
  };

  const handleConfirm = async () => {
    if (cart.length === 0 || !sessionId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      let activeOrder = orders.find(o => o.status === 'pending');

      if (!activeOrder) {
        const newOrder = await createOrder(sessionId);
        if (!newOrder) {
          setIsSubmitting(false);
          return;
        }
        activeOrder = newOrder;
      }

      // Track items that need auto-marchar tickets
      type AutoEntry = { orderItemId: string; cart: CartItem };
      const autoBarEntries: AutoEntry[] = [];
      const autoKitchenEntries: AutoEntry[] = [];

      for (const item of cart) {
        // Separate extras and sin modifiers
        const extrasMods = item.modifiers?.filter(m => {
          const groupLower = m.groupName.toLowerCase();
          return groupLower.includes('extras') || groupLower.includes('con');
        }) || [];

        const sinMods = item.modifiers?.filter(m => {
          const groupLower = m.groupName.toLowerCase();
          return groupLower.includes('sin') || groupLower.includes('quitar');
        }) || [];

        // Calculate modifier price adjustment (only extras add price)
        const modifierPriceAdjustment = extrasMods.reduce(
          (sum, m) => sum + Number(m.modifier.price_adjustment),
          0
        );

        const basePrice = Number(item.menuItem.price);
        const adjustedPrice = basePrice + modifierPriceAdjustment;
        const station = getStation(item.menuItem);

        // Build notes for display
        let notes = item.notes || '';
        if (item.modifiers && item.modifiers.length > 0) {
          const modifierLabels = item.modifiers.map(m => {
            const price = Number(m.modifier.price_adjustment);
            const groupLower = m.groupName.toLowerCase();
            const isSin = groupLower.includes('sin') || groupLower.includes('quitar');
            if (isSin) {
              return `Sin ${m.modifier.name}`;
            }
            if (price > 0) {
              return `+ ${m.modifier.name} (+${price.toFixed(2)}€)`;
            }
            return `+ ${m.modifier.name}`;
          }).join(', ');
          notes = notes ? `${modifierLabels}. ${notes}` : modifierLabels;
        }

        // Determine if this category should auto-marchar
        const autoStation = getAutoMarcharStation(item.menuItem.category);
        const shouldAutoMarchar = !!autoStation;
        const finalStation = shouldAutoMarchar ? autoStation : station;
        const finalStatus = shouldAutoMarchar ? 'sent' : 'pending';

        // Insert order item
        const { data: orderItemData, error } = await supabase
          .from('order_items')
          .insert({
            order_id: activeOrder.id,
            menu_item_id: item.menuItem.id,
            quantity: item.quantity,
            unit_price: adjustedPrice,
            base_unit_price: basePrice,
            notes: notes || null,
            modifiers: item.modifiers?.map(m => m.modifier.id) || null,
            status: finalStatus,
            station: finalStation,
            course: 'unassigned',
            sent_at: shouldAutoMarchar ? new Date().toISOString() : null,
          })
          .select('id')
          .single();

        if (error || !orderItemData) {
          toast({ title: 'Error', description: 'No se pudo añadir el producto.', variant: 'destructive' });
          continue;
        }

        // Track auto-marchar items for ticket creation
        if (shouldAutoMarchar) {
          if (autoStation === 'bar') {
            autoBarEntries.push({ orderItemId: orderItemData.id, cart: item });
          } else {
            autoKitchenEntries.push({ orderItemId: orderItemData.id, cart: item });
          }
        }

        // Insert modifiers into join table
        const orderItemId = orderItemData.id;

        const modifierInserts = [
          ...extrasMods.map(m => ({
            order_item_id: orderItemId,
            modifier_id: m.modifier.id,
            modifier_group: 'EXTRAS_CON' as const,
            name: m.modifier.name,
            price: Number(m.modifier.price_adjustment),
          })),
          ...sinMods.map(m => ({
            order_item_id: orderItemId,
            modifier_id: m.modifier.id,
            modifier_group: 'SIN' as const,
            name: m.modifier.name,
            price: 0,
          })),
        ];

        if (modifierInserts.length > 0) {
          const { error: modError } = await supabase
            .from('order_item_modifiers')
            .insert(modifierInserts);

          if (modError) {
            console.error('Error inserting modifiers:', modError);
          }
        }
      }

      // Create tickets for auto-marchar items
      const tableLabel = session?.table?.number ? `Mesa ${session.table.number}` : 'Mesa';

      const buildPrintItems = (entries: AutoEntry[]) =>
        entries.map((e) => {
          const mods = (e.cart.modifiers || []).map((m) => {
            const groupLower = m.groupName.toLowerCase();
            const isSin = groupLower.includes('sin') || groupLower.includes('quitar');
            const price = Number(m.modifier.price_adjustment);
            if (isSin) return `Sin ${m.modifier.name}`;
            if (price > 0) return `+ ${m.modifier.name} (+${price.toFixed(2)}€)`;
            return `+ ${m.modifier.name}`;
          });
          if (e.cart.notes) mods.push(e.cart.notes);
          return {
            qty: e.cart.quantity,
            name: e.cart.menuItem.name,
            modifiers: mods,
            price: 0,
          };
        });

      if (autoBarEntries.length > 0) {
        const { data: barTicket, error: barTicketError } = await supabase
          .from('kitchen_tickets')
          .insert({
            session_id: sessionId,
            station: 'bar',
            created_by: user?.id || null,
            restaurant_id: restaurantId!,
            status: 'sent',
          })
          .select()
          .single();

        if (!barTicketError && barTicket) {
          await supabase.from('ticket_items').insert(
            autoBarEntries.map(e => ({ ticket_id: barTicket.id, order_item_id: e.orderItemId }))
          );
          try {
            await enqueuePrintJob({
              restaurantId: restaurantId!,
              destination: 'barra',
              sessionId,
              content: {
                table: tableLabel,
                order_ref: `#${barTicket.id.slice(0, 8)}`,
                items: buildPrintItems(autoBarEntries),
                total: 0,
                note: 'Auto-marchar',
              },
            });
          } catch (e) {
            console.error('[printQueue] auto-marchar bar enqueue failed', e);
          }
        }
      }

      if (autoKitchenEntries.length > 0) {
        const { data: kitchenTicket, error: kitchenTicketError } = await supabase
          .from('kitchen_tickets')
          .insert({
            session_id: sessionId,
            station: 'kitchen',
            course: 'postres',
            created_by: user?.id || null,
            restaurant_id: restaurantId!,
            status: 'sent',
          })
          .select()
          .single();

        if (!kitchenTicketError && kitchenTicket) {
          await supabase.from('ticket_items').insert(
            autoKitchenEntries.map(e => ({ ticket_id: kitchenTicket.id, order_item_id: e.orderItemId }))
          );
          try {
            await enqueuePrintJob({
              restaurantId: restaurantId!,
              destination: 'cocina',
              sessionId,
              content: {
                table: tableLabel,
                order_ref: `#${kitchenTicket.id.slice(0, 8)}`,
                items: buildPrintItems(autoKitchenEntries),
                total: 0,
                note: 'Auto-marchar',
              },
            });
          } catch (e) {
            console.error('[printQueue] auto-marchar kitchen enqueue failed', e);
          }
        }
      }

      await recalculateAndPersistSessionTotal();
      toast({ title: 'Productos añadidos', description: `${totalItems} producto(s) añadido(s) al pedido.` });
      navigate(`/session/${sessionId}`);
    } catch (e) {
      console.error('Error confirming products:', e);
      toast({ title: 'Error', description: 'No se pudieron añadir los productos.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategoryClick = (category: string | null) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
  };

  const handleMobileConfirm = async () => {
    setIsMobileDrawerOpen(false);
    await handleConfirm();
  };

  // Payment info
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const pending = session ? Number(session.total_amount) - totalPaid : 0;

  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Sticky Header */}
      <header className="shrink-0 bg-background/95 backdrop-blur border-b border-border z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/session/${sessionId}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-semibold">
                  Mesa {session.table?.number}
                </Badge>
                <span className="text-muted-foreground hidden sm:inline">
                  <Users className="inline h-3 w-3 mr-1" />
                  {session.guest_count}
                </span>
              </div>

              <div className="hidden md:flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <Receipt className="h-3 w-3 text-muted-foreground" />
                  <span>{Number(session.total_amount).toFixed(2)}€</span>
                </div>
                <div className="flex items-center gap-1 text-green-500">
                  <CreditCard className="h-3 w-3" />
                  <span>{totalPaid.toFixed(2)}€</span>
                </div>
                {pending > 0.01 && (
                  <div className="flex items-center gap-1 text-destructive">
                    <span>Pdte: {pending.toFixed(2)}€</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - 80/20 Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Catalog (80%) */}
        <div className="flex-1 flex flex-col overflow-hidden lg:w-4/5">
          {/* Search and Categories */}
          <div className="shrink-0 px-4 py-3 border-b border-border bg-background">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 flex-wrap mt-3">
              <Badge
                variant={selectedCategory === null ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleCategoryClick(null)}
              >
                Todos
              </Badge>
              {categories.map(category => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleCategoryClick(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>

            {/* Subcategories */}
            {subcategories.length > 0 && (
              <div className="flex gap-2 flex-wrap pl-4 border-l-2 border-primary/30 mt-2">
                <Badge
                  variant={selectedSubcategory === null ? 'secondary' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedSubcategory(null)}
                >
                  Todas
                </Badge>
                {subcategories.map(sub => (
                  <Badge
                    key={sub}
                    variant={selectedSubcategory === sub ? 'secondary' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setSelectedSubcategory(sub)}
                  >
                    {sub}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {selectedCategory
                    ? 'No hay productos en esta categoría.'
                    : menuItems.length === 0
                      ? 'No hay productos disponibles. Crea productos desde Carta.'
                      : 'No hay productos que coincidan con la búsqueda.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredItems.map(item => {
                  const quantity = getCartQuantity(item.id);
                  const itemHasModifiers = hasModifiers(item);
                  const showExtras = hasExtrasModifiers(item);
                  const showSin = hasSinModifiers(item);

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border transition-all ${
                        quantity > 0
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => handleItemClick(item)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.subcategory ? `${item.category} › ${item.subcategory}` : item.category}
                            </p>
                          </div>
                          {quantity > 0 && (
                            <Badge className="ml-2 shrink-0">{quantity}</Badge>
                          )}
                        </div>
                        <p className="font-semibold text-primary">
                          {Number(item.price).toFixed(2)}€
                        </p>
                      </div>

                      {/* Modifier buttons */}
                      {itemHasModifiers && (
                        <div className="flex gap-1 mt-2 pt-2 border-t border-border/50">
                          {showExtras && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOrderItemModifierDialog(item, 'extras');
                              }}
                            >
                              + Con
                            </Button>
                          )}
                          {showSin && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOrderItemModifierDialog(item, 'sin');
                              }}
                            >
                              – Sin
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              openOrderItemModifierDialog(item, 'all');
                            }}
                          >
                            <Settings2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile Footer - Sticky button to open drawer */}
          <div className="shrink-0 lg:hidden border-t border-border bg-background p-4">
            <Button
              className="w-full gap-2"
              size="lg"
              variant={cart.length > 0 ? 'default' : 'outline'}
              onClick={() => setIsMobileDrawerOpen(true)}
            >
              <ShoppingCart className="h-4 w-4" />
              {cart.length === 0 ? (
                'Comanda (0)'
              ) : (
                `Comanda (${totalItems}) · ${totalAmount.toFixed(2)}€`
              )}
            </Button>
          </div>
        </div>

        {/* Right Column - Command Panel (20%) - Hidden on mobile */}
        <aside className="hidden lg:flex w-80 xl:w-96 border-l border-border flex-col bg-muted/30">
          <CommandPanel
            cart={cart}
            totalItems={totalItems}
            totalAmount={totalAmount}
            isSubmitting={isSubmitting}
            onRemoveFromCart={removeFromCart}
            onRemoveCartItemCompletely={removeCartItemCompletely}
            onIncrementCartItem={incrementCartItem}
            onConfirm={handleConfirm}
            autoMarcharCategories={categorySettings
              .filter(s => s.auto_marchar_enabled && s.auto_marchar_station)
              .map(s => ({ category: s.category_name, station: s.auto_marchar_station! }))}
          />
        </aside>
      </div>

      {/* Mobile Command Drawer */}
      <Sheet open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Comanda actual</SheetTitle>
          </SheetHeader>
          <CommandPanel
            cart={cart}
            totalItems={totalItems}
            totalAmount={totalAmount}
            isSubmitting={isSubmitting}
            onRemoveFromCart={removeFromCart}
            onRemoveCartItemCompletely={removeCartItemCompletely}
            onIncrementCartItem={incrementCartItem}
            onConfirm={handleMobileConfirm}
            autoMarcharCategories={categorySettings
              .filter(s => s.auto_marchar_enabled && s.auto_marchar_station)
              .map(s => ({ category: s.category_name, station: s.auto_marchar_station! }))}
          />
        </SheetContent>
      </Sheet>

      {/* Modifier Dialog */}
      <ModifierEditDialog
        open={modifierDialogOpen}
        onOpenChange={(open) => {
          setModifierDialogOpen(open);
          if (!open) {
            setEditingCartIndex(null);
            setTargetOrderItemId(null);
            setExistingOrderItemModifiers(undefined);
            setIsDraftMode(false);
          }
        }}
        menuItem={selectedMenuItem}
        modifierGroups={selectedMenuItem ? getModifiersForCategory(selectedMenuItem.category) : []}
        mode={modifierDialogMode}
        isDraftMode={isDraftMode}
        existingModifiers={
          targetOrderItemId
            ? existingOrderItemModifiers
            : editingCartIndex !== null
              ? cart[editingCartIndex]?.modifiers
              : isDraftMode
                ? []
                : undefined
        }
        onConfirm={handleModifierConfirm}
      />
    </div>
  );
}
