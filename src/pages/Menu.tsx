import { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PermissionGuard from '@/components/auth/PermissionGuard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
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
  Plus, 
  Pencil, 
  Trash2, 
  Pizza, 
  Search,
  ChevronUp,
  ChevronDown,
  FolderTree,
  Package,
  Sliders
} from 'lucide-react';
import { MenuItem, ModifierGroup, Modifier } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

interface Category {
  name: string;
  subcategories: string[];
  active: boolean;
  displayOrder: number;
}

const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Antipasti', subcategories: [], active: true, displayOrder: 0 },
  { name: 'Ensaladas', subcategories: [], active: true, displayOrder: 1 },
  { name: 'Pasta', subcategories: [], active: true, displayOrder: 2 },
  { name: 'Pizzas', subcategories: [], active: true, displayOrder: 3 },
  { name: 'Bebidas', subcategories: ['Aguas y refrescos', 'Cerveza', 'Vino', 'Café', 'Licores'], active: true, displayOrder: 4 },
];

export default function Menu() {
  const { canEditMenu, canViewMenu, isOwner } = usePermissions();
  const { restaurantId } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('categories');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
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
  const [deletingItem, setDeletingItem] = useState<{ type: 'product' | 'category' | 'modifierGroup' | 'modifier'; item: any } | null>(null);
  
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
    
    // Fetch menu items
    const { data: items, error: itemsError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category')
      .order('display_order');
    
    if (itemsError) {
      toast({ title: 'Error', description: 'No se pudo cargar el menú', variant: 'destructive' });
    } else {
      setMenuItems(items as MenuItem[]);
      
      // Extract categories from items and merge with defaults
      const categoryMap = new Map<string, Set<string>>();
      items.forEach(item => {
        if (!categoryMap.has(item.category)) {
          categoryMap.set(item.category, new Set());
        }
        if (item.subcategory) {
          categoryMap.get(item.category)?.add(item.subcategory);
        }
      });
      
      // Merge with default categories
      const mergedCategories = [...DEFAULT_CATEGORIES];
      categoryMap.forEach((subs, name) => {
        const existing = mergedCategories.find(c => c.name === name);
        if (existing) {
          const allSubs = new Set([...existing.subcategories, ...subs]);
          existing.subcategories = Array.from(allSubs);
        } else {
          mergedCategories.push({
            name,
            subcategories: Array.from(subs),
            active: true,
            displayOrder: mergedCategories.length,
          });
        }
      });
      setCategories(mergedCategories);
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
    
    const { error } = await supabase
      .from('menu_items')
      .update({ available: !product.available })
      .eq('id', product.id);
    
    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
      return;
    }
    fetchData();
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
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    const { type, item } = deletingItem;

    try {
      if (type === 'product') {
        await supabase.from('menu_items').delete().eq('id', item.id);
        toast({ title: 'Producto eliminado' });
      } else if (type === 'modifierGroup') {
        await supabase.from('modifier_groups').delete().eq('id', item.id);
        toast({ title: 'Grupo eliminado' });
      } else if (type === 'modifier') {
        await supabase.from('modifiers').delete().eq('id', item.id);
        toast({ title: 'Modificador eliminado' });
      } else if (type === 'category') {
        setCategories(prev => prev.filter(c => c.name !== item.name));
        toast({ title: 'Categoría eliminada' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }

    setDeleteDialogOpen(false);
    setDeletingItem(null);
    fetchData();
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
                                <Badge key={sub} variant="outline" className="text-xs">
                                  {sub}
                                </Badge>
                              ))}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingItem({ type: 'category', item: category });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
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
                {filteredProducts.map(item => (
                  <Card key={item.id} className={`p-4 ${!item.available ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{item.name}</h3>
                          {!item.available && (
                            <Badge variant="destructive" className="text-xs">Inactivo</Badge>
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
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.available}
                            onCheckedChange={() => handleToggleProductAvailable(item)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {item.available ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenProductDialog(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingItem({ type: 'product', item });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <Pizza className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay productos</p>
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
                  <p className="text-muted-foreground">No hay grupos de modificadores</p>
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

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer.
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
