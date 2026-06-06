import { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PermissionGuard from '@/components/auth/PermissionGuard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Pizza, 
  Search,
  ChevronUp,
  ChevronDown,
  FolderTree,
  Package,
  Sliders,
  Power,
  PowerOff,
  Info,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { MenuItem, ModifierGroup, Modifier } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useCategorySettings } from '@/hooks/useCategorySettings';
import { useProductionStations } from '@/hooks/useProductionStations';

interface Category {
  name: string;
  subcategories: string[];
  active: boolean;
  displayOrder: number;
}

export default function Menu() {
  const { canEditMenu, canViewMenu, isOwner, isManager } = usePermissions();
  const { hasRole } = useAuth();
  const { tenant } = useTenant();
  // Always scope Carta to the currently selected restaurant (tenant), not the
  // user's profile.restaurant_id — Platform Admin's profile may point elsewhere.
  const restaurantId = tenant?.restaurant_id ?? null;
  const isPlatformAdmin = hasRole('platform_admin');
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('categories');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [wipeDialogOpen, setWipeDialogOpen] = useState(false);
  const [wipeBusy, setWipeBusy] = useState(false);
  const { settings: categorySettingsList, getSettingForCategory, upsertSetting } = useCategorySettings(restaurantId);
  const { stations: productionStations } = useProductionStations(restaurantId);
  const { setCategoryStation } = useCategorySettings(restaurantId);

  // Track which products have sales history (cannot be deleted)
  const [productsWithSales, setProductsWithSales] = useState<Set<string>>(new Set());
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('all');
  
  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [modifierGroupDialogOpen, setModifierGroupDialogOpen] = useState(false);
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Editing states
  const [editingProduct, setEditingProduct] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingModifierGroup, setEditingModifierGroup] = useState<ModifierGroup | null>(null);
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: 'product' | 'category' | 'subcategory' | 'modifierGroup' | 'modifier'; item: any; parentCategory?: string } | null>(null);
  const [categoryMoveDialogOpen, setCategoryMoveDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ category: Category; isSubcategory: boolean; parentCategory?: string } | null>(null);
  const [moveTargetCategory, setMoveTargetCategory] = useState<string>('');
  
  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    subcategory: '',
    available: true,
  });
  
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    active: true,
  });
  
  const [subcategoryForm, setSubcategoryForm] = useState({
    name: '',
    parentCategory: 'Bebidas',
  });
  
  const [modifierGroupForm, setModifierGroupForm] = useState({
    name: '',
    applicableCategories: [] as string[],
  });
  
  const [modifierForm, setModifierForm] = useState({
    name: '',
    priceAdjustment: '',
    available: true,
    groupId: '',
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    if (!restaurantId) return;
    setIsLoading(true);
    
    // Fetch menu items (only active=true; deactivated rows are kept for history)
    const { data: items, error: itemsError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('active', true)
      .order('category')
      .order('display_order');
    
    if (itemsError) {
      toast({ title: 'Error', description: 'No se pudo cargar el menú', variant: 'destructive' });
    } else {
      setMenuItems(items as MenuItem[]);
      
      // Derive categories purely from the data (no hardcoded defaults).
      const categoryMap = new Map<string, Set<string>>();
      items.forEach(item => {
        if (!categoryMap.has(item.category)) {
          categoryMap.set(item.category, new Set());
        }
        if (item.subcategory) {
          categoryMap.get(item.category)?.add(item.subcategory);
        }
      });
      const derived: Category[] = Array.from(categoryMap.entries())
        .map(([name, subs], idx) => ({
          name,
          subcategories: Array.from(subs),
          active: true,
          displayOrder: idx,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
      setCategories(derived);
      
      // Check which products have been used in orders
      if (items.length > 0) {
        const itemIds = items.map(i => i.id);
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('menu_item_id')
          .in('menu_item_id', itemIds);
        
        if (orderItems) {
          const usedIds = new Set(orderItems.map(oi => oi.menu_item_id));
          setProductsWithSales(usedIds);
        }
      } else {
        setProductsWithSales(new Set());
      }
    }
    
    // Fetch modifier groups
    const { data: groups, error: groupsError } = await supabase
      .from('modifier_groups')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order');
    
    if (!groupsError && groups) {
      const groupIds = groups.map(g => g.id);
      if (groupIds.length > 0) {
        const { data: modifiers } = await supabase
          .from('modifiers')
          .select('*')
          .in('modifier_group_id', groupIds)
          .order('display_order');
        
        const groupsWithModifiers: ModifierGroup[] = groups.map(group => ({
          ...group,
          modifiers: modifiers?.filter(m => m.modifier_group_id === group.id) || [],
        }));
        setModifierGroups(groupsWithModifiers);
      } else {
        setModifierGroups([]);
      }
    }
    
    setIsLoading(false);
  };

  // ============ CATEGORIES ============
  const handleMoveCategoryOrder = (index: number, direction: 'up' | 'down') => {
    if (!canEditMenu) return;
    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCategories.length) return;
    
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];
    newCategories.forEach((cat, i) => cat.displayOrder = i);
    setCategories(newCategories);
  };

  const handleSaveCategory = () => {
    if (!categoryForm.name.trim()) {
      toast({ title: 'Error', description: 'El nombre es obligatorio', variant: 'destructive' });
      return;
    }
    
    if (editingCategory) {
      setCategories(prev => prev.map(c => 
        c.name === editingCategory.name 
          ? { ...c, name: categoryForm.name.trim(), active: categoryForm.active }
          : c
      ));
    } else {
      setCategories(prev => [...prev, {
        name: categoryForm.name.trim(),
        subcategories: [],
        active: categoryForm.active,
        displayOrder: prev.length,
      }]);
    }
    
    setCategoryDialogOpen(false);
    setCategoryForm({ name: '', active: true });
    setEditingCategory(null);
    toast({ title: 'Categoría guardada' });
  };

  const handleAddSubcategory = () => {
    if (!subcategoryForm.name.trim()) return;
    
    setCategories(prev => prev.map(c => 
      c.name === subcategoryForm.parentCategory
        ? { ...c, subcategories: [...c.subcategories, subcategoryForm.name.trim()] }
        : c
    ));
    
    setSubcategoryDialogOpen(false);
    setSubcategoryForm({ name: '', parentCategory: 'Bebidas' });
    toast({ title: 'Subcategoría añadida' });
  };

  // ============ PRODUCTS ============
  const handleOpenProductDialog = (product?: MenuItem) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        category: product.category,
        subcategory: product.subcategory || '',
        available: product.available,
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        price: '',
        category: filterCategory !== 'all' ? filterCategory : '',
        subcategory: '',
        available: true,
      });
    }
    setProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!restaurantId || !productForm.name || !productForm.price || !productForm.category) {
      toast({ title: 'Error', description: 'Completa los campos obligatorios', variant: 'destructive' });
      return;
    }

    const productData = {
      name: productForm.name.trim(),
      description: productForm.description.trim() || null,
      price: parseFloat(productForm.price),
      category: productForm.category.trim(),
      subcategory: productForm.subcategory.trim() || null,
      available: productForm.available,
      restaurant_id: restaurantId,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from('menu_items')
        .update(productData)
        .eq('id', editingProduct.id);
      
      if (error) {
        toast({ title: 'Error', description: 'No se pudo actualizar el producto', variant: 'destructive' });
        return;
      }
      toast({ title: 'Producto actualizado' });
    } else {
      const { error } = await supabase
        .from('menu_items')
        .insert(productData);
      
      if (error) {
        toast({ title: 'Error', description: 'No se pudo crear el producto', variant: 'destructive' });
        return;
      }
      toast({ title: 'Producto creado' });
    }

    setProductDialogOpen(false);
    setEditingProduct(null);
    fetchData();
  };

  const handleToggleProductAvailable = async (product: MenuItem) => {
    if (!canEditMenu) return;
    
    const newStatus = !product.available;
    const { error } = await supabase
      .from('menu_items')
      .update({ available: newStatus })
      .eq('id', product.id);
    
    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
      return;
    }
    
    toast({ 
      title: newStatus ? 'Producto activado' : 'Producto desactivado',
      description: newStatus 
        ? `"${product.name}" ahora está disponible para venta.`
        : `"${product.name}" ya no aparece en el sistema de pedidos.`
    });
    fetchData();
  };

  // Check if a product can be deleted (never used in orders)
  const canDeleteProduct = (productId: string): boolean => {
    // Platform admin and restaurant admin can always trigger delete;
    // backend RPC will deactivate (instead of hard-delete) if there's history.
    return isOwner;
  };

  // Handle product delete attempt
  const handleDeleteProductAttempt = (product: MenuItem) => {
    if (!isOwner) {
      toast({ 
        title: 'Sin permisos', 
        description: 'Solo el propietario puede eliminar productos.', 
        variant: 'destructive' 
      });
      return;
    }
    
    setDeletingItem({ type: 'product', item: product });
    setDeleteDialogOpen(true);
  };

  // ============ MODIFIERS ============
  const handleOpenModifierGroupDialog = (group?: ModifierGroup) => {
    if (group) {
      setEditingModifierGroup(group);
      setModifierGroupForm({
        name: group.name,
        applicableCategories: group.applicable_categories || [],
      });
    } else {
      setEditingModifierGroup(null);
      setModifierGroupForm({
        name: '',
        applicableCategories: [],
      });
    }
    setModifierGroupDialogOpen(true);
  };

  const handleSaveModifierGroup = async () => {
    if (!restaurantId || !modifierGroupForm.name.trim()) {
      toast({ title: 'Error', description: 'El nombre es obligatorio', variant: 'destructive' });
      return;
    }

    const groupData = {
      name: modifierGroupForm.name.trim(),
      applicable_categories: modifierGroupForm.applicableCategories,
      restaurant_id: restaurantId,
    };

    if (editingModifierGroup) {
      const { error } = await supabase
        .from('modifier_groups')
        .update(groupData)
        .eq('id', editingModifierGroup.id);
      
      if (error) {
        toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
        return;
      }
      toast({ title: 'Grupo de modificadores actualizado' });
    } else {
      const { error } = await supabase
        .from('modifier_groups')
        .insert(groupData);
      
      if (error) {
        toast({ title: 'Error', description: 'No se pudo crear', variant: 'destructive' });
        return;
      }
      toast({ title: 'Grupo de modificadores creado' });
    }

    setModifierGroupDialogOpen(false);
    setEditingModifierGroup(null);
    fetchData();
  };

  const handleOpenModifierDialog = (groupId: string, modifier?: Modifier) => {
    if (modifier) {
      setEditingModifier(modifier);
      setModifierForm({
        name: modifier.name,
        priceAdjustment: modifier.price_adjustment.toString(),
        available: modifier.available,
        groupId: modifier.modifier_group_id,
      });
    } else {
      setEditingModifier(null);
      setModifierForm({
        name: '',
        priceAdjustment: '0',
        available: true,
        groupId: groupId,
      });
    }
    setModifierDialogOpen(true);
  };

  const handleSaveModifier = async () => {
    if (!modifierForm.name.trim() || !modifierForm.groupId) {
      toast({ title: 'Error', description: 'El nombre es obligatorio', variant: 'destructive' });
      return;
    }

    const modifierData = {
      name: modifierForm.name.trim(),
      price_adjustment: parseFloat(modifierForm.priceAdjustment) || 0,
      available: modifierForm.available,
      modifier_group_id: modifierForm.groupId,
    };

    if (editingModifier) {
      const { error } = await supabase
        .from('modifiers')
        .update(modifierData)
        .eq('id', editingModifier.id);
      
      if (error) {
        toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
        return;
      }
      toast({ title: 'Modificador actualizado' });
    } else {
      const { error } = await supabase
        .from('modifiers')
        .insert(modifierData);
      
      if (error) {
        toast({ title: 'Error', description: 'No se pudo crear', variant: 'destructive' });
        return;
      }
      toast({ title: 'Modificador creado' });
    }

    setModifierDialogOpen(false);
    setEditingModifier(null);
    fetchData();
  };

  // ============ DELETE ============
  
  // Check if a category has products
  const getCategoryProductCount = (categoryName: string) => {
    return menuItems.filter(i => i.category === categoryName).length;
  };

  // Check if a subcategory has products
  const getSubcategoryProductCount = (categoryName: string, subcategoryName: string) => {
    return menuItems.filter(i => i.category === categoryName && i.subcategory === subcategoryName).length;
  };

  // Handle category delete attempt
  const handleDeleteCategory = (category: Category) => {
    if (!isOwner) {
      toast({ title: 'Sin permisos', description: 'Solo el propietario puede eliminar categorías', variant: 'destructive' });
      return;
    }
    
    const productCount = getCategoryProductCount(category.name);
    if (productCount > 0) {
      setCategoryToDelete({ category, isSubcategory: false });
      setMoveTargetCategory('');
      setCategoryMoveDialogOpen(true);
    } else {
      setDeletingItem({ type: 'category', item: category });
      setDeleteDialogOpen(true);
    }
  };

  // Handle subcategory delete attempt
  const handleDeleteSubcategory = (parentCategoryName: string, subcategoryName: string) => {
    if (!isOwner) {
      toast({ title: 'Sin permisos', description: 'Solo el propietario puede eliminar subcategorías', variant: 'destructive' });
      return;
    }
    
    const parentCategory = categories.find(c => c.name === parentCategoryName);
    if (!parentCategory) return;

    const productCount = getSubcategoryProductCount(parentCategoryName, subcategoryName);
    if (productCount > 0) {
      setCategoryToDelete({ 
        category: { ...parentCategory, name: subcategoryName }, 
        isSubcategory: true, 
        parentCategory: parentCategoryName 
      });
      setMoveTargetCategory('');
      setCategoryMoveDialogOpen(true);
    } else {
      setDeletingItem({ type: 'subcategory', item: { name: subcategoryName }, parentCategory: parentCategoryName });
      setDeleteDialogOpen(true);
    }
  };

  // Move products and delete category
  const handleMoveProductsAndDelete = async () => {
    if (!categoryToDelete || !moveTargetCategory) {
      toast({ title: 'Error', description: 'Selecciona una categoría de destino', variant: 'destructive' });
      return;
    }

    try {
      if (categoryToDelete.isSubcategory) {
        // Move products from subcategory to target category/subcategory
        const productsToMove = menuItems.filter(
          i => i.category === categoryToDelete.parentCategory && i.subcategory === categoryToDelete.category.name
        );
        
        for (const product of productsToMove) {
          const [targetCat, targetSub] = moveTargetCategory.includes('|') 
            ? moveTargetCategory.split('|') 
            : [moveTargetCategory, null];
          
          await supabase
            .from('menu_items')
            .update({ category: targetCat, subcategory: targetSub || null })
            .eq('id', product.id);
        }
        
        // Remove subcategory from parent
        setCategories(prev => prev.map(c => 
          c.name === categoryToDelete.parentCategory
            ? { ...c, subcategories: c.subcategories.filter(s => s !== categoryToDelete.category.name) }
            : c
        ));
        
        toast({ title: 'Subcategoría eliminada', description: `${productsToMove.length} productos movidos a ${moveTargetCategory.replace('|', ' › ')}` });
      } else {
        // Move products from category to target category
        const productsToMove = menuItems.filter(i => i.category === categoryToDelete.category.name);
        
        for (const product of productsToMove) {
          const [targetCat, targetSub] = moveTargetCategory.includes('|') 
            ? moveTargetCategory.split('|') 
            : [moveTargetCategory, null];
          
          await supabase
            .from('menu_items')
            .update({ category: targetCat, subcategory: targetSub || null })
            .eq('id', product.id);
        }
        
        // Remove category
        setCategories(prev => prev.filter(c => c.name !== categoryToDelete.category.name));
        
        toast({ title: 'Categoría eliminada', description: `${productsToMove.length} productos movidos a ${moveTargetCategory.replace('|', ' › ')}` });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron mover los productos', variant: 'destructive' });
    }

    setCategoryMoveDialogOpen(false);
    setCategoryToDelete(null);
    setMoveTargetCategory('');
    fetchData();
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    const { type, item, parentCategory } = deletingItem;

    try {
      if (type === 'product') {
        if (!isOwner) {
          toast({ title: 'Sin permisos', description: 'Solo el propietario puede eliminar productos.', variant: 'destructive' });
          setDeleteDialogOpen(false);
          setDeletingItem(null);
          return;
        }
        const { data, error } = await supabase.rpc(
          'delete_menu_item_safe' as never,
          { _item: item.id } as never
        );
        if (error) throw error;
        const action = (data as any)?.action;
        toast({
          title: action === 'deactivated' ? 'Producto desactivado' : 'Producto eliminado',
          description: action === 'deactivated'
            ? 'Tenía ventas previas — se ha desactivado para preservar el historial.'
            : undefined,
        });
      } else if (type === 'modifierGroup') {
        const { data, error } = await supabase.rpc(
          'delete_modifier_group_safe' as never,
          { _group: item.id } as never
        );
        if (error) throw error;
        const action = (data as any)?.action;
        toast({
          title: action === 'deleted' ? 'Grupo eliminado' : 'Grupo parcialmente limpiado',
          description: action !== 'deleted'
            ? 'Algunos modificadores tenían historial y se desactivaron.'
            : undefined,
        });
      } else if (type === 'modifier') {
        const { data, error } = await supabase.rpc(
          'delete_modifier_safe' as never,
          { _modifier: item.id } as never
        );
        if (error) throw error;
        const action = (data as any)?.action;
        toast({
          title: action === 'deactivated' ? 'Modificador desactivado' : 'Modificador eliminado',
        });
      } else if (type === 'category') {
        // Empty category — just remove from category_settings (no products to delete)
        if (restaurantId) {
          await (supabase.from('category_settings') as any)
            .delete()
            .eq('restaurant_id', restaurantId)
            .eq('category', item.name);
        }
        setCategories(prev => prev.filter(c => c.name !== item.name));
        toast({ title: 'Categoría eliminada' });
      } else if (type === 'subcategory' && parentCategory) {
        setCategories(prev => prev.map(c => 
          c.name === parentCategory
            ? { ...c, subcategories: c.subcategories.filter(s => s !== item.name) }
            : c
        ));
        toast({ title: 'Subcategoría eliminada' });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo eliminar',
        variant: 'destructive',
      });
    }

    setDeleteDialogOpen(false);
    setDeletingItem(null);
    fetchData();
  };

  // Delete an entire category along with all its products
  const handleDeleteCategoryWithProducts = async () => {
    if (!categoryToDelete || !restaurantId) return;
    try {
      if (categoryToDelete.isSubcategory) {
        // Delete all products in this parent/subcategory pair
        const targets = menuItems.filter(
          i => i.category === categoryToDelete.parentCategory && i.subcategory === categoryToDelete.category.name
        );
        for (const p of targets) {
          await supabase.rpc('delete_menu_item_safe' as never, { _item: p.id } as never);
        }
        toast({ title: 'Subcategoría y productos eliminados', description: `${targets.length} productos procesados.` });
      } else {
        const { data, error } = await supabase.rpc(
          'delete_category_with_products' as never,
          { _restaurant: restaurantId, _category: categoryToDelete.category.name } as never
        );
        if (error) throw error;
        const d = (data as any) || {};
        toast({
          title: 'Categoría eliminada',
          description: `${d.deleted ?? 0} eliminados, ${d.deactivated ?? 0} desactivados (con historial).`,
        });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo eliminar', variant: 'destructive' });
    }
    setCategoryMoveDialogOpen(false);
    setCategoryToDelete(null);
    setMoveTargetCategory('');
    fetchData();
  };

  // Bulk wipe of the whole carta for the current restaurant
  const handleWipeMenu = async () => {
    if (!restaurantId) return;
    setWipeBusy(true);
    const { data, error } = await supabase.rpc(
      'wipe_restaurant_menu' as never,
      { _restaurant: restaurantId } as never
    );
    setWipeBusy(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    const d = (data as any) || {};
    toast({
      title: 'Carta limpiada',
      description: `Productos: ${d.products_deleted ?? 0} eliminados, ${d.products_deactivated ?? 0} desactivados. Modificadores: ${d.modifiers_deleted ?? 0} eliminados. Grupos: ${d.modifier_groups_removed ?? 0}.`,
    });
    setWipeDialogOpen(false);
    fetchData();
  };

  // Get available target categories for moving products (exclude the one being deleted)
  const getAvailableTargetCategories = () => {
    if (!categoryToDelete) return [];
    
    const targets: { value: string; label: string }[] = [];
    
    categories.forEach(cat => {
      // Skip the category being deleted
      if (!categoryToDelete.isSubcategory && cat.name === categoryToDelete.category.name) return;
      
      // Add the category itself
      targets.push({ value: cat.name, label: cat.name });
      
      // Add subcategories (skip the subcategory being deleted)
      cat.subcategories.forEach(sub => {
        if (categoryToDelete.isSubcategory && 
            categoryToDelete.parentCategory === cat.name && 
            sub === categoryToDelete.category.name) return;
        targets.push({ value: `${cat.name}|${sub}`, label: `${cat.name} › ${sub}` });
      });
    });
    
    return targets;
  };

  // Filter products
  const filteredProducts = menuItems.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesSubcategory = filterSubcategory === 'all' || item.subcategory === filterSubcategory;
    return matchesSearch && matchesCategory && matchesSubcategory;
  });

  const selectedCategoryData = categories.find(c => c.name === filterCategory);

  return (
    <PermissionGuard allowed={canViewMenu}>
      <MainLayout title="Carta">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Gestión de Carta</h1>
              <p className="text-muted-foreground">Administra categorías, productos y modificadores</p>
            </div>
            {(isPlatformAdmin || hasRole('admin')) && (
              <Button
                variant="destructive"
                onClick={() => setWipeDialogOpen(true)}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Limpiar Carta
              </Button>
            )}
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="categories" className="flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Categorías
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Productos
              </TabsTrigger>
              <TabsTrigger value="modifiers" className="flex items-center gap-2">
                <Sliders className="h-4 w-4" />
                Modificadores
              </TabsTrigger>
            </TabsList>

            {/* CATEGORIES TAB */}
            <TabsContent value="categories" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Categorías y Subcategorías</h2>
                {canEditMenu && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSubcategoryDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Subcategoría
                    </Button>
                    <Button onClick={() => {
                      setCategoryForm({ name: '', active: true });
                      setEditingCategory(null);
                      setCategoryDialogOpen(true);
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Categoría
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {categories.map((category, index) => (
                  <Card key={category.name} className={`p-4 ${!category.active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {canEditMenu && (
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveCategoryOrder(index, 'up')}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveCategoryOrder(index, 'down')}
                              disabled={index === categories.length - 1}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{category.name}</h3>
                            <Badge variant="secondary">
                              {menuItems.filter(i => i.category === category.name).length} productos
                            </Badge>
                            {!category.active && <Badge variant="destructive">Inactiva</Badge>}
                          </div>
                          {category.subcategories.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {category.subcategories.map(sub => (
                                <div key={sub} className="flex items-center gap-1 group">
                                  <Badge variant="outline" className="text-xs">
                                    {sub}
                                    <span className="ml-1 text-muted-foreground">
                                      ({getSubcategoryProductCount(category.name, sub)})
                                    </span>
                                  </Badge>
                                  {isOwner && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleDeleteSubcategory(category.name, sub)}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Auto-marchar setting */}
                          {isOwner && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Auto-marchar:</span>
                              <Switch
                                checked={getSettingForCategory(category.name)?.auto_marchar_enabled ?? false}
                                onCheckedChange={(checked) => {
                                  const currentStation = getSettingForCategory(category.name)?.auto_marchar_station || 
                                    (category.name === 'Bebidas' ? 'bar' : 'kitchen');
                                  upsertSetting(category.name, checked, currentStation as 'bar' | 'kitchen');
                                }}
                              />
                              {getSettingForCategory(category.name)?.auto_marchar_enabled && (
                                <Select
                                  value={getSettingForCategory(category.name)?.auto_marchar_station || 'kitchen'}
                                  onValueChange={(value) => {
                                    upsertSetting(category.name, true, value as 'bar' | 'kitchen');
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-24 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="bar">Barra</SelectItem>
                                    <SelectItem value="kitchen">Cocina</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {canEditMenu && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={category.active}
                            onCheckedChange={(checked) => {
                              setCategories(prev => prev.map(c =>
                                c.name === category.name ? { ...c, active: checked } : c
                              ));
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingCategory(category);
                              setCategoryForm({ name: category.name, active: category.active });
                              setCategoryDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCategory(category)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
                {categories.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    Aún no hay categorías creadas.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* PRODUCTS TAB */}
            <TabsContent value="products" className="mt-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar productos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCategoryData?.subcategories.length > 0 && (
                    <Select value={filterSubcategory} onValueChange={setFilterSubcategory}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Subcategoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {selectedCategoryData.subcategories.map(sub => (
                          <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {canEditMenu && (
                  <Button onClick={() => handleOpenProductDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo producto
                  </Button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map(item => {
                  const hasSales = productsWithSales.has(item.id);
                  const canDelete = canDeleteProduct(item.id);
                  
                  return (
                    <Card key={item.id} className={`p-4 ${!item.available ? 'bg-muted/50' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{item.name}</h3>
                            {!item.available && (
                              <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                            )}
                            {hasSales && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <Info className="h-3 w-3" />
                                      Con ventas
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Este producto tiene historial de ventas</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.category}{item.subcategory && ` › ${item.subcategory}`}
                          </p>
                        </div>
                        <span className="font-bold text-primary">{Number(item.price).toFixed(2)}€</span>
                      </div>
                      
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {canEditMenu && (
                        <div className="flex items-center justify-between pt-3 border-t">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={item.available ? "outline" : "default"}
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => handleToggleProductAvailable(item)}
                                >
                                  {item.available ? (
                                    <>
                                      <PowerOff className="h-4 w-4" />
                                      Desactivar
                                    </>
                                  ) : (
                                    <>
                                      <Power className="h-4 w-4" />
                                      Activar
                                    </>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{item.available 
                                  ? 'Desactivar producto (no aparecerá en pedidos)'
                                  : 'Activar producto (disponible para venta)'
                                }</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenProductDialog(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            
                            {isOwner && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteProductAttempt(item)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {hasSales 
                                      ? 'Tiene ventas: se desactivará para preservar el historial.'
                                      : 'Eliminar producto'
                                    }
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <Pizza className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aún no hay productos creados.</p>
                  {canEditMenu && (
                    <Button className="mt-4" onClick={() => handleOpenProductDialog()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Añadir producto
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* MODIFIERS TAB */}
            <TabsContent value="modifiers" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Grupos de Modificadores</h2>
                {canEditMenu && (
                  <Button onClick={() => handleOpenModifierGroupDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo grupo
                  </Button>
                )}
              </div>

              {modifierGroups.length === 0 ? (
                <div className="text-center py-12">
                  <Sliders className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aún no hay modificadores creados.</p>
                  {canEditMenu && (
                    <Button className="mt-4" onClick={() => handleOpenModifierGroupDialog()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear grupo
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {modifierGroups.map(group => (
                    <Card key={group.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{group.name}</h3>
                          {group.applicable_categories && group.applicable_categories.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">Aplica a:</span>
                              {group.applicable_categories.map(cat => (
                                <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {canEditMenu && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenModifierDialog(group.id)}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Modificador
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenModifierGroupDialog(group)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletingItem({ type: 'modifierGroup', item: group });
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      {group.modifiers && group.modifiers.length > 0 ? (
                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {group.modifiers.map(modifier => (
                            <div
                              key={modifier.id}
                              className={`flex items-center justify-between p-2 rounded-lg border ${!modifier.available ? 'opacity-50' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{modifier.name}</span>
                                {modifier.price_adjustment > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{Number(modifier.price_adjustment).toFixed(2)}€
                                  </Badge>
                                )}
                              </div>
                              {canEditMenu && (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleOpenModifierDialog(group.id, modifier)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      setDeletingItem({ type: 'modifier', item: modifier });
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin modificadores</p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* DIALOGS */}
        
        {/* Category Dialog */}
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="catName">Nombre</Label>
                <Input
                  id="catName"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Postres"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={categoryForm.active}
                  onCheckedChange={(checked) => setCategoryForm(prev => ({ ...prev, active: checked }))}
                />
                <Label>Categoría activa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveCategory}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Subcategory Dialog */}
        <Dialog open={subcategoryDialogOpen} onOpenChange={setSubcategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva subcategoría</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Categoría padre</Label>
                <Select 
                  value={subcategoryForm.parentCategory} 
                  onValueChange={(val) => setSubcategoryForm(prev => ({ ...prev, parentCategory: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subName">Nombre de subcategoría</Label>
                <Input
                  id="subName"
                  value={subcategoryForm.name}
                  onChange={(e) => setSubcategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Vino Blanco"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubcategoryDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddSubcategory}>Añadir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Product Dialog */}
        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={productForm.name}
                  onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del producto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={productForm.description}
                  onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción opcional"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio (€) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoría *</Label>
                  <Select 
                    value={productForm.category} 
                    onValueChange={(val) => setProductForm(prev => ({ ...prev, category: val, subcategory: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {categories.find(c => c.name === productForm.category)?.subcategories.length > 0 && (
                <div className="space-y-2">
                  <Label>Subcategoría</Label>
                  <Select 
                    value={productForm.subcategory} 
                    onValueChange={(val) => setProductForm(prev => ({ ...prev, subcategory: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ninguna</SelectItem>
                      {categories.find(c => c.name === productForm.category)?.subcategories.map(sub => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={productForm.available}
                  onCheckedChange={(checked) => setProductForm(prev => ({ ...prev, available: checked }))}
                />
                <Label>Producto activo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProductDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveProduct}>{editingProduct ? 'Guardar' : 'Crear'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modifier Group Dialog */}
        <Dialog open={modifierGroupDialogOpen} onOpenChange={setModifierGroupDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingModifierGroup ? 'Editar grupo' : 'Nuevo grupo de modificadores'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">Nombre del grupo *</Label>
                <Input
                  id="groupName"
                  value={modifierGroupForm.name}
                  onChange={(e) => setModifierGroupForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Extras (Con)"
                />
              </div>
              <div className="space-y-2">
                <Label>Aplicar a categorías</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto">
                  {categories.map(cat => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${cat.name}`}
                        checked={modifierGroupForm.applicableCategories.includes(cat.name)}
                        onCheckedChange={(checked) => {
                          setModifierGroupForm(prev => ({
                            ...prev,
                            applicableCategories: checked
                              ? [...prev.applicableCategories, cat.name]
                              : prev.applicableCategories.filter(c => c !== cat.name)
                          }));
                        }}
                      />
                      <Label htmlFor={`cat-${cat.name}`} className="text-sm cursor-pointer">
                        {cat.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModifierGroupDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveModifierGroup}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modifier Dialog */}
        <Dialog open={modifierDialogOpen} onOpenChange={setModifierDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingModifier ? 'Editar modificador' : 'Nuevo modificador'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modName">Nombre *</Label>
                <Input
                  id="modName"
                  value={modifierForm.name}
                  onChange={(e) => setModifierForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Pepperoni extra"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modPrice">Ajuste de precio (€)</Label>
                <Input
                  id="modPrice"
                  type="number"
                  step="0.01"
                  value={modifierForm.priceAdjustment}
                  onChange={(e) => setModifierForm(prev => ({ ...prev, priceAdjustment: e.target.value }))}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">0 para modificadores sin coste adicional</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={modifierForm.available}
                  onCheckedChange={(checked) => setModifierForm(prev => ({ ...prev, available: checked }))}
                />
                <Label>Disponible</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModifierDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveModifier}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Products Dialog - for categories with products */}
        <AlertDialog open={categoryMoveDialogOpen} onOpenChange={setCategoryMoveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Esta {categoryToDelete?.isSubcategory ? 'subcategoría' : 'categoría'} contiene productos.
              </AlertDialogTitle>
              <AlertDialogDescription>
                {categoryToDelete && (
                  <>
                    <strong>"{categoryToDelete.category.name}"</strong> tiene{' '}
                    {categoryToDelete.isSubcategory 
                      ? getSubcategoryProductCount(categoryToDelete.parentCategory!, categoryToDelete.category.name)
                      : getCategoryProductCount(categoryToDelete.category.name)
                    } productos. Mueve los productos a otra categoría o elimina todo.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label className="mb-2 block">Mover productos a:</Label>
              <Select value={moveTargetCategory} onValueChange={setMoveTargetCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar destino" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableTargetCategories().map(target => (
                    <SelectItem key={target.value} value={target.value}>
                      {target.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setCategoryMoveDialogOpen(false);
                setCategoryToDelete(null);
              }}>
                Cancelar
              </AlertDialogCancel>
              {(isPlatformAdmin || hasRole('admin')) && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteCategoryWithProducts}
                >
                  Eliminar categoría y productos
                </Button>
              )}
              <AlertDialogAction 
                onClick={handleMoveProductsAndDelete} 
                disabled={!moveTargetCategory}
                className="bg-destructive text-destructive-foreground"
              >
                Mover y eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk wipe Carta */}
        <AlertDialog open={wipeDialogOpen} onOpenChange={setWipeDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpiar toda la Carta</AlertDialogTitle>
              <AlertDialogDescription>
                Esto eliminará <strong>todos</strong> los productos, modificadores y grupos
                de modificadores del restaurante <strong>{tenant?.name}</strong>.
                Los productos con historial de ventas se desactivarán para preservar
                los tickets antiguos. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={wipeBusy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleWipeMenu(); }}
                disabled={wipeBusy}
                className="bg-destructive text-destructive-foreground"
              >
                {wipeBusy ? 'Limpiando…' : 'Sí, limpiar la Carta'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
              <AlertDialogDescription>
                {deletingItem?.type === 'category' && (
                  <>Esta categoría no tiene productos. ¿Eliminar <strong>"{deletingItem.item.name}"</strong>?</>
                )}
                {deletingItem?.type === 'subcategory' && (
                  <>Esta subcategoría no tiene productos. ¿Eliminar <strong>"{deletingItem.item.name}"</strong>?</>
                )}
                {deletingItem?.type === 'product' && (
                  <>
                    ¿Eliminar permanentemente el producto <strong>"{deletingItem.item.name}"</strong>? 
                    <br /><br />
                    <span className="text-destructive font-medium">Esta acción no se puede deshacer.</span>
                  </>
                )}
                {deletingItem?.type === 'modifierGroup' && (
                  <>¿Eliminar el grupo <strong>"{deletingItem.item.name}"</strong> y todos sus modificadores?</>
                )}
                {deletingItem?.type === 'modifier' && (
                  <>¿Eliminar el modificador <strong>"{deletingItem.item.name}"</strong>?</>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MainLayout>
    </PermissionGuard>
  );
}
