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
import { Plus, Minus, Search, ShoppingCart, X } from 'lucide-react';
import { MenuItem } from '@/types/database';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

interface AddProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItems: MenuItem[];
  onConfirm: (items: CartItem[]) => void;
}

export default function AddProductsDialog({
  open,
  onOpenChange,
  menuItems,
  onConfirm,
}: AddProductsDialogProps) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  // Get unique categories (excluding Bebidas subcategories from main list)
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

  const addToCart = (menuItem: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map(item =>
          item.menuItem.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.menuItem.id === menuItemId);
      if (existing && existing.quantity > 1) {
        return prev.map(item =>
          item.menuItem.id === menuItemId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter(item => item.menuItem.id !== menuItemId);
    });
  };

  const getCartQuantity = (menuItemId: string) => {
    return cart.find(item => item.menuItem.id === menuItemId)?.quantity || 0;
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + (Number(item.menuItem.price) * item.quantity), 0);

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

  return (
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
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        quantity > 0 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => addToCart(item)}
                    >
                      <div className="flex justify-between items-start mb-2">
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
                {cart.map(item => (
                  <div key={item.menuItem.id} className="flex items-center justify-between py-1">
                    <span className="text-sm">{item.menuItem.name}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(item.menuItem.id);
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
                          addToCart(item.menuItem);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="w-16 text-right font-medium">
                        {(Number(item.menuItem.price) * item.quantity).toFixed(2)}€
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
  );
}
