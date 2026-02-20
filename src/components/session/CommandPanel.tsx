import { Button } from '@/components/ui/button';
import { ShoppingCart, Trash2, Minus, Plus, Zap } from 'lucide-react';
import type { CartItem, SelectedModifier } from '@/pages/AddProductsPage';

interface CommandPanelProps {
  cart: CartItem[];
  totalItems: number;
  totalAmount: number;
  isSubmitting: boolean;
  onRemoveFromCart: (index: number) => void;
  onRemoveCartItemCompletely: (index: number) => void;
  onIncrementCartItem: (index: number) => void;
  onConfirm: () => void;
  autoMarcharCategories?: { category: string; station: string }[];
}

export function CommandPanel({
  cart,
  totalItems,
  totalAmount,
  isSubmitting,
  onRemoveFromCart,
  onRemoveCartItemCompletely,
  onIncrementCartItem,
  onConfirm,
  autoMarcharCategories = [],
}: CommandPanelProps) {
  const getCartItemLabel = (item: CartItem) => {
    return item.menuItem.name;
  };

  const getCartItemModifiers = (item: CartItem) => {
    if (!item.modifiers || item.modifiers.length === 0) return null;
    return item.modifiers.map(m => m.modifier.name).join(', ');
  };

  const getCartItemPrice = (item: CartItem) => {
    const basePrice = Number(item.menuItem.price);
    const modifierAdjustment = item.modifierPriceAdjustment || 0;
    return (basePrice + modifierAdjustment) * item.quantity;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel Header */}
      <div className="shrink-0 p-4 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Comanda actual</h2>
        </div>
        {cart.length > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            {totalItems} producto{totalItems !== 1 ? 's' : ''} seleccionado{totalItems !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Cart Items - Scrollable */}
      <div 
        className="flex-1 overflow-y-auto p-4 overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {cart.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin productos seleccionados</p>
            <p className="text-xs mt-1">Toca un producto para añadirlo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item, index) => (
              <div 
                key={index} 
                className="bg-background rounded-lg border border-border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2">
                      {getCartItemLabel(item)}
                    </p>
                    {getCartItemModifiers(item) && (
                      <p className="text-xs text-primary mt-0.5 line-clamp-2">
                        {getCartItemModifiers(item)}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-primary mt-1">
                      {getCartItemPrice(item).toFixed(2)}€
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveCartItemCompletely(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onRemoveFromCart(index)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-semibold">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onIncrementCartItem(index)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel Footer - Sticky */}
      <div className="shrink-0 border-t border-border bg-background p-4">
        {cart.length > 0 && (
          <div className="flex items-center justify-between mb-3 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-bold text-lg">{totalAmount.toFixed(2)}€</span>
          </div>
        )}
        {cart.length > 0 && autoMarcharCategories.length > 0 && (() => {
          const matchingCategories = autoMarcharCategories.filter(ac =>
            cart.some(item => item.menuItem.category === ac.category)
          );
          if (matchingCategories.length === 0) return null;
          const labels = matchingCategories.map(ac => {
            const stationLabel = ac.station === 'bar' ? 'barra' : 'cocina';
            return `${ac.category.toLowerCase()} a ${stationLabel}`;
          });
          return (
            <div className="flex items-start gap-2 mb-3 p-2 rounded-md bg-primary/10 text-xs text-primary">
              <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Al confirmar, se enviarán automáticamente {labels.join(' y ')}.</span>
            </div>
          );
        })()}
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={onConfirm}
          disabled={cart.length === 0 || isSubmitting}
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
          ) : (
            <>
              <Plus className="h-4 w-4" />
              {cart.length === 0
                ? 'Selecciona productos'
                : `Añadir ${totalItems} producto${totalItems > 1 ? 's' : ''}`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
