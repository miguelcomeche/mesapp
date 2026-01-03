import { useState, useEffect } from 'react';
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
import { Plus, Pencil, Trash2, Pizza, GripVertical } from 'lucide-react';
import { MenuItem } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

interface Category {
  name: string;
  subcategories: string[];
}

export default function MenuSettings() {
  const { canEditMenu, canAccessSettings } = usePermissions();
  const { restaurantId } = useAuth();
  const { toast } = useToast();
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MenuItem | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<MenuItem | null>(null);
  
  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    subcategory: '',
    available: true,
  });
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');

  useEffect(() => {
    fetchMenuItems();
  }, [restaurantId]);

  const fetchMenuItems = async () => {
    if (!restaurantId) return;
    
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category')
      .order('display_order');
    
    if (error) {
      toast({ title: 'Error', description: 'No se pudo cargar el menú', variant: 'destructive' });
      return;
    }
    
    setMenuItems(data as MenuItem[]);
    
    // Extract categories and subcategories
    const categoryMap = new Map<string, Set<string>>();
    data.forEach(item => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, new Set());
      }
      if (item.subcategory) {
        categoryMap.get(item.category)?.add(item.subcategory);
      }
    });
    
    const cats: Category[] = Array.from(categoryMap.entries()).map(([name, subs]) => ({
      name,
      subcategories: Array.from(subs),
    }));
    
    setCategories(cats);
    if (cats.length > 0 && !selectedCategory) {
      setSelectedCategory(cats[0].name);
    }
    setIsLoading(false);
  };

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
        category: selectedCategory || '',
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
      toast({ title: 'Producto actualizado', description: `${productForm.name} ha sido actualizado.` });
    } else {
      const { error } = await supabase
        .from('menu_items')
        .insert(productData);
      
      if (error) {
        toast({ title: 'Error', description: 'No se pudo crear el producto', variant: 'destructive' });
        return;
      }
      toast({ title: 'Producto creado', description: `${productForm.name} ha sido añadido al menú.` });
    }

    setProductDialogOpen(false);
    fetchMenuItems();
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;

    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', deletingProduct.id);
    
    if (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el producto', variant: 'destructive' });
      return;
    }

    toast({ title: 'Producto eliminado', description: `${deletingProduct.name} ha sido eliminado.` });
    setDeleteDialogOpen(false);
    setDeletingProduct(null);
    fetchMenuItems();
  };

  const handleToggleAvailable = async (product: MenuItem) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ available: !product.available })
      .eq('id', product.id);
    
    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar el producto', variant: 'destructive' });
      return;
    }

    fetchMenuItems();
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    
    // Just add it to local state - it will be created when a product uses it
    setCategories(prev => [...prev, { name: newCategory.trim(), subcategories: [] }]);
    setSelectedCategory(newCategory.trim());
    setNewCategory('');
    setCategoryDialogOpen(false);
  };

  const filteredItems = selectedCategory 
    ? menuItems.filter(item => item.category === selectedCategory)
    : menuItems;

  return (
    <PermissionGuard allowed={canAccessSettings}>
      <MainLayout title="Configuración de Menú">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Gestión del Menú</h1>
              <p className="text-muted-foreground">Administra categorías, productos y precios</p>
            </div>
            {canEditMenu && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva categoría
                </Button>
                <Button onClick={() => handleOpenProductDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo producto
                </Button>
              </div>
            )}
          </div>

          {/* Categories Tabs */}
          <Tabs value={selectedCategory || undefined} onValueChange={setSelectedCategory}>
            <TabsList className="flex-wrap h-auto gap-1">
              {categories.map(cat => (
                <TabsTrigger key={cat.name} value={cat.name}>
                  {cat.name}
                  <Badge variant="secondary" className="ml-2">
                    {menuItems.filter(i => i.category === cat.name).length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map(cat => (
              <TabsContent key={cat.name} value={cat.name} className="mt-6">
                {/* Subcategories */}
                {cat.subcategories.length > 0 && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <Badge variant="outline">Subcategorías:</Badge>
                    {cat.subcategories.map(sub => (
                      <Badge key={sub} variant="secondary">{sub}</Badge>
                    ))}
                  </div>
                )}

                {/* Products Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredItems.map(item => (
                    <Card key={item.id} className={`p-4 ${!item.available ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{item.name}</h3>
                            {!item.available && (
                              <Badge variant="destructive" className="text-xs">Inactivo</Badge>
                            )}
                          </div>
                          {item.subcategory && (
                            <p className="text-xs text-muted-foreground">{item.subcategory}</p>
                          )}
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
                              onCheckedChange={() => handleToggleAvailable(item)}
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
                                setDeletingProduct(item);
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

                {filteredItems.length === 0 && (
                  <div className="text-center py-12">
                    <Pizza className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay productos en esta categoría</p>
                    {canEditMenu && (
                      <Button className="mt-4" onClick={() => handleOpenProductDialog()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Añadir producto
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Product Dialog */}
        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Editar producto' : 'Nuevo producto'}
              </DialogTitle>
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
                <Input
                  id="description"
                  value={productForm.description}
                  onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción opcional"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio *</Label>
                  <div className="relative">
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={productForm.price}
                      onChange={(e) => setProductForm(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="0.00"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría *</Label>
                  <Input
                    id="category"
                    value={productForm.category}
                    onChange={(e) => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Ej: Pizzas"
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map(cat => (
                      <option key={cat.name} value={cat.name} />
                    ))}
                  </datalist>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategoría</Label>
                <Input
                  id="subcategory"
                  value={productForm.subcategory}
                  onChange={(e) => setProductForm(prev => ({ ...prev, subcategory: e.target.value }))}
                  placeholder="Subcategoría opcional"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={productForm.available}
                  onCheckedChange={(checked) => setProductForm(prev => ({ ...prev, available: checked }))}
                />
                <Label>Producto activo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProduct}>
                {editingProduct ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva categoría</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newCategory">Nombre de la categoría</Label>
                <Input
                  id="newCategory"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Ej: Postres"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddCategory}>
                Crear categoría
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El producto "{deletingProduct?.name}" será eliminado permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MainLayout>
    </PermissionGuard>
  );
}
