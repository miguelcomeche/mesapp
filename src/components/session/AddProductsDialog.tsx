import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Minus, Search, ShoppingCart, Settings2 } from 'lucide-react';
import { MenuItem, ModifierGroup, Modifier } from '@/types/database';
import ModifierEditDialog from './ModifierEditDialog';

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

interface AddProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItems: MenuItem[];
  modifierGroups?: ModifierGroup[];
  onConfirm: (items: CartItem[]) => void;
}

export default function AddProductsDialog({
  open,
  onOpenChange,
  menuItems,
  modifierGroups = [],
  onConfirm,
}: AddProductsDialogProps) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [modifierDialogMode, setModifierDialogMode] = useState<'extras' | 'sin' | 'all'>('all');
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);

  // Get unique categories
  const categories = [...new Set(menuItems.map(item => item.category))];
  
  // Get subcategories for Bebidas
  const subcategories = selectedCategory === 'Bebidas' 
    ? [...new Set(menuItems.filter(item => item.category === 'Bebidas' && item.subcategory).map(item => item.subcategory!))]
    : [];

  // Filter items
  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const matchesSubcategory = !selectedSubcategory || item.subcategory === selectedSubcategory;
    return matchesSearch && matchesCategory && matchesSubcategory;
  }).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  // Get applicable modifier groups for a category
  const getModifiersForCategory = (category: string): ModifierGroup[] => {
    return modifierGroups.filter(group => 
      group.applicable_categories?.includes(category)
    );
  };

  // Check if an item has available modifiers
  const hasModifiers = (item: MenuItem): boolean => {
    return getModifiersForCategory(item.category).length > 0;
  };

  // Check if item is a pizza (category "Pizzas")
  const isPizza = (item: MenuItem): boolean => {
    return item.category === 'Pizzas';
  };

  // Always add directly on click, never open popup
  const handleItemClick = (item: MenuItem) => {
    addToCart(item);
  };

  // Open modifier dialog for a specific mode
  const openModifierDialog = (item: MenuItem, mode: 'extras' | 'sin' | 'all', cartIndex?: number) => {
    // Find if there's an existing cart item for this product without modifiers
    if (cartIndex !== undefined) {
      setEditingCartIndex(cartIndex);
    } else {
      // Find the latest cart item for this menu item
      const existingIndex = cart.findIndex(ci => ci.menuItem.id === item.id);
      if (existingIndex === -1) {
        // No item in cart yet - show message
        return;
      }
      setEditingCartIndex(existingIndex);
    }
    setSelectedMenuItem(item);
    setModifierDialogMode(mode);
    setModifierDialogOpen(true);
  };

  const handleModifierConfirm = (selectedModifiers: SelectedModifier[]) => {
    if (editingCartIndex === null || !selectedMenuItem) return;
    const modifierPriceAdjustment = selectedModifiers.reduce(
      (sum, sm) => sum + Number(sm.modifier.price_adjustment), 
      0
    );
    
    // Update the existing cart item with modifiers
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
  };

  // Get count of cart items for a specific menu item
  const getCartItemsForProduct = (menuItemId: string): { index: number; item: CartItem }[] => {
    return cart
      .map((item, index) => ({ index, item }))
      .filter(({ item }) => item.menuItem.id === menuItemId);
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

  const handleConfirm = () => {
    if (cart.length > 0) {
      onConfirm(cart);
      setCart([]);
      setSearch('');
      setSelectedCategory(null);
    }
  };

  const handleClose = () => {
    setCart([]);
    setSearch('');
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    onOpenChange(false);
  };
  
  const handleCategoryClick = (category: string | null) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
  };

  const getCartItemLabel = (item: CartItem) => {
    let label = item.menuItem.name;
    if (item.modifiers && item.modifiers.length > 0) {
      const modifierNames = item.modifiers.map(m => m.modifier.name).join(', ');
      label += ` (${modifierNames})`;
    }
    return label;
  };

  const getCartItemPrice = (item: CartItem) => {
    const basePrice = Number(item.menuItem.price);
    const modifierAdjustment = item.modifierPriceAdjustment || 0;
    return (basePrice + modifierAdjustment) * item.quantity;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Añadir productos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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
            <div className="flex gap-2 flex-wrap">
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

            {/* Subcategories for Bebidas */}
            {subcategories.length > 0 && (
              <div className="flex gap-2 flex-wrap pl-4 border-l-2 border-primary/30">
                <Badge
                  variant={selectedSubcategory === null ? 'secondary' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedSubcategory(null)}
                >
                  Todas las bebidas
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

            {/* Products Grid */}
            <ScrollArea className="h-[300px]">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay productos disponibles
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredItems.map(item => {
                    const quantity = getCartQuantity(item.id);
                    const itemIsPizza = isPizza(item);
                    const cartItemsForProduct = getCartItemsForProduct(item.id);
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
                            <div className="flex-1">
                              <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.subcategory ? `${item.category} › ${item.subcategory}` : item.category}
                              </p>
                            </div>
                            {quantity > 0 && (
                              <Badge className="ml-2">{quantity}</Badge>
                            )}
                          </div>
                          <p className="font-semibold text-primary">
                            {Number(item.price).toFixed(2)}€
                          </p>
                        </div>
                        
                        {/* Pizza modifier buttons */}
                        {itemIsPizza && (
                          <div className="flex gap-1 mt-2 pt-2 border-t border-border/50">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (cartItemsForProduct.length === 0) {
                                  addToCart(item);
                                  // After adding, open dialog for newest item
                                  setTimeout(() => {
                                    setSelectedMenuItem(item);
                                    setModifierDialogMode('extras');
                                    setEditingCartIndex(cart.length); // Will be the new index
                                    setModifierDialogOpen(true);
                                  }, 0);
                                } else {
                                  openModifierDialog(item, 'extras', cartItemsForProduct[cartItemsForProduct.length - 1].index);
                                }
                              }}
                            >
                              + Extras
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (cartItemsForProduct.length === 0) {
                                  addToCart(item);
                                  setTimeout(() => {
                                    setSelectedMenuItem(item);
                                    setModifierDialogMode('sin');
                                    setEditingCartIndex(cart.length);
                                    setModifierDialogOpen(true);
                                  }, 0);
                                } else {
                                  openModifierDialog(item, 'sin', cartItemsForProduct[cartItemsForProduct.length - 1].index);
                                }
                              }}
                            >
                              – Sin
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (cartItemsForProduct.length === 0) {
                                  addToCart(item);
                                  setTimeout(() => {
                                    setSelectedMenuItem(item);
                                    setModifierDialogMode('all');
                                    setEditingCartIndex(cart.length);
                                    setModifierDialogOpen(true);
                                  }, 0);
                                } else {
                                  openModifierDialog(item, 'all', cartItemsForProduct[cartItemsForProduct.length - 1].index);
                                }
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
            </ScrollArea>

            {/* Cart Summary */}
            {cart.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    <span className="font-medium">{totalItems} productos</span>
                  </div>
                  <span className="font-bold text-lg">{totalAmount.toFixed(2)}€</span>
                </div>
                
                <div className="space-y-2">
                  {cart.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-1">
                      <span className="text-sm flex-1 line-clamp-1">{getCartItemLabel(item)}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromCart(index);
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            incrementCartItem(index);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="w-16 text-right font-medium">
                          {getCartItemPrice(item).toFixed(2)}€
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={cart.length === 0}>
              Confirmar ({totalItems} productos)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModifierEditDialog
        open={modifierDialogOpen}
        onOpenChange={(open) => {
          setModifierDialogOpen(open);
          if (!open) setEditingCartIndex(null);
        }}
        menuItem={selectedMenuItem}
        modifierGroups={selectedMenuItem ? getModifiersForCategory(selectedMenuItem.category) : []}
        mode={modifierDialogMode}
        existingModifiers={editingCartIndex !== null ? cart[editingCartIndex]?.modifiers : undefined}
        onConfirm={handleModifierConfirm}
      />
    </>
  );
}
