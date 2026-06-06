import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditCard, Banknote, Users, ListChecks, Percent, AlertCircle, User } from 'lucide-react';
import { PaymentMethod, OrderItem } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

type SplitMode = 'full' | 'guests' | 'items';

interface PersonPayment {
  amount: string;
  method: PaymentMethod;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  paidAmount: number;
  guestCount?: number;
  orderItems?: OrderItem[];
  paidQuantityByItem?: Record<string, number>;
  onConfirm: (payments: Array<{
    amount: number;
    method: PaymentMethod;
    tip?: number;
    discount?: number;
    items?: Array<{ order_item_id: string; quantity: number; amount: number }>;
  }>) => void;
}

export default function PaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  paidAmount,
  guestCount = 1,
  orderItems = [],
  paidQuantityByItem = {},
  onConfirm,
}: PaymentDialogProps) {
  const { hasRole } = useAuth();
  const remaining = totalAmount - paidAmount;
  
  const [amount, setAmount] = useState(remaining.toString());
  const [tip, setTip] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [splitMode, setSplitMode] = useState<SplitMode>('full');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  
  // Per-person payment tracking
  const [personPayments, setPersonPayments] = useState<PersonPayment[]>([]);

  // Initialize person payments when guestCount or remaining changes
  useEffect(() => {
    if (splitMode === 'guests') {
      const suggestedPerPerson = remaining / guestCount;
      setPersonPayments(
        Array.from({ length: guestCount }, () => ({
          amount: suggestedPerPerson.toFixed(2),
          method: 'card' as PaymentMethod
        }))
      );
    }
  }, [guestCount, remaining, splitMode]);

  // Check if user can apply discounts (only admin or manager)
  const canApplyDiscount = hasRole(['admin', 'manager']);

  // Only items with remaining (unpaid) quantity are eligible
  const unpaidItems = useMemo(() => {
    return orderItems
      .map(item => {
        const paid = paidQuantityByItem[item.id] || 0;
        const remainingQty = Math.max(0, item.quantity - paid);
        return { item, remainingQty };
      })
      .filter(x => x.remainingQty > 0.001);
  }, [orderItems, paidQuantityByItem]);

  // Calculate amount based on split mode
  const calculatedAmount = useMemo(() => {
    switch (splitMode) {
      case 'guests':
        // For guests mode, we don't use this - we use personPayments
        return remaining;
      case 'items':
        const itemsTotal = unpaidItems
          .filter(x => selectedItems.includes(x.item.id))
          .reduce((sum, x) => sum + (Number(x.item.unit_price) * x.remainingQty), 0);
        return Math.min(itemsTotal, remaining);
      default:
        return remaining;
    }
  }, [splitMode, remaining, unpaidItems, selectedItems]);

  // Calculate discount
  const discountValue = useMemo(() => {
    if (!canApplyDiscount) return 0;
    if (discountType === 'percent') {
      const percent = parseFloat(discountPercent) || 0;
      return (calculatedAmount * percent) / 100;
    }
    return parseFloat(discountAmount) || 0;
  }, [discountType, discountPercent, discountAmount, calculatedAmount, canApplyDiscount]);

  // Final amount after discount (for non-guests modes)
  const finalAmount = Math.max(0, calculatedAmount - discountValue);

  // Total of all person payments
  const totalPersonPayments = useMemo(() => {
    return personPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [personPayments]);

  // Validation for person payments
  const personPaymentsValid = useMemo(() => {
    if (splitMode !== 'guests') return true;
    
    // All amounts must be >= 0
    const allValid = personPayments.every(p => (parseFloat(p.amount) || 0) >= 0);
    // Total must not exceed remaining
    const notExceeding = totalPersonPayments <= remaining + 0.01; // Small tolerance for rounding
    // At least some amount
    const hasAmount = totalPersonPayments > 0;
    
    return allValid && notExceeding && hasAmount;
  }, [personPayments, totalPersonPayments, remaining, splitMode]);

  const personPaymentsExceedError = useMemo(() => {
    if (splitMode !== 'guests') return false;
    return totalPersonPayments > remaining + 0.01;
  }, [totalPersonPayments, remaining, splitMode]);

  const handleSplitModeChange = (mode: SplitMode) => {
    setSplitMode(mode);
    setSelectedItems([]);
    
    if (mode === 'guests') {
      const suggestedPerPerson = remaining / guestCount;
      setPersonPayments(
        Array.from({ length: guestCount }, () => ({
          amount: suggestedPerPerson.toFixed(2),
          method: 'card' as PaymentMethod
        }))
      );
    } else {
      setPersonPayments([]);
    }
  };

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handlePersonAmountChange = (index: number, value: string) => {
    setPersonPayments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], amount: value };
      return updated;
    });
  };

  const handlePersonMethodChange = (index: number, value: PaymentMethod) => {
    setPersonPayments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], method: value };
      return updated;
    });
  };

  const handleConfirm = () => {
    if (splitMode === 'guests') {
      // Create multiple payments, one per person with amount > 0
      const payments = personPayments
        .filter(p => (parseFloat(p.amount) || 0) > 0)
        .map(p => ({
          amount: parseFloat(p.amount) || 0,
          method: p.method,
          tip: undefined,
          discount: undefined
        }));
      
      if (payments.length === 0) return;
      onConfirm(payments);
    } else {
      // In 'items' mode, always use the computed finalAmount (selected items - discount),
      // never the free-form `amount` input (which holds the full remaining and would
      // incorrectly close the table). In 'full' mode, honor the user-edited amount.
      const paymentAmount = splitMode === 'items'
        ? finalAmount
        : (parseFloat(amount) || finalAmount);
      const tipAmount = parseFloat(tip) || undefined;
      
      if (paymentAmount <= 0) return;

      let items: Array<{ order_item_id: string; quantity: number; amount: number }> | undefined;
      if (splitMode === 'items') {
        items = unpaidItems
          .filter(x => selectedItems.includes(x.item.id))
          .map(x => ({
            order_item_id: x.item.id,
            quantity: x.remainingQty,
            amount: Number(x.item.unit_price) * x.remainingQty,
          }));
      }

      onConfirm([{
        amount: paymentAmount,
        method,
        tip: tipAmount,
        discount: discountValue > 0 ? discountValue : undefined,
        items,
      }]);
    }
    
    resetForm();
  };

  const resetForm = () => {
    setAmount(remaining.toString());
    setTip('');
    setMethod('card');
    setSplitMode('full');
    setSelectedItems([]);
    setDiscountPercent('');
    setDiscountAmount('');
    setPersonPayments([]);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Update amount when remaining changes
  useEffect(() => {
    if (splitMode === 'full') {
      setAmount(remaining.toFixed(2));
    }
  }, [remaining, splitMode]);

  const quickAmounts = [
    { label: 'Total', value: remaining },
    { label: '50%', value: remaining / 2 },
    { label: '33%', value: remaining / 3 },
    { label: '25%', value: remaining / 4 },
  ].filter(a => a.value > 0);

  const isConfirmDisabled = splitMode === 'guests' 
    ? !personPaymentsValid 
    : finalAmount <= 0;

  const confirmButtonText = splitMode === 'guests'
    ? `Registrar ${totalPersonPayments.toFixed(2)}€`
    : `Registrar ${finalAmount.toFixed(2)}€`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Summary */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total cuenta</span>
                <span className="font-medium">{totalAmount.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ya pagado</span>
                <span className="font-medium">{paidAmount.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-medium">Pendiente</span>
                <span className="font-bold text-lg">{remaining.toFixed(2)}€</span>
              </div>
            </div>

            {/* Split Mode Tabs */}
            <div className="space-y-3">
              <Label>Modo de pago</Label>
              <Tabs value={splitMode} onValueChange={(v) => handleSplitModeChange(v as SplitMode)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="full" className="gap-2">
                    <CreditCard className="h-4 w-4" />
                    Completo
                  </TabsTrigger>
                  <TabsTrigger value="guests" className="gap-2">
                    <Users className="h-4 w-4" />
                    Por personas
                  </TabsTrigger>
                  <TabsTrigger value="items" className="gap-2">
                    <ListChecks className="h-4 w-4" />
                    Por productos
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="full" className="pt-4">
                  <div className="flex gap-2 flex-wrap">
                    {quickAmounts.map(quick => (
                      <Button
                        key={quick.label}
                        variant={parseFloat(amount) === quick.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAmount(quick.value.toFixed(2))}
                      >
                        {quick.label} ({quick.value.toFixed(2)}€)
                      </Button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="guests" className="pt-4 space-y-4">
                  <div className="text-sm text-muted-foreground">
                    {guestCount} comensales • Sugerido: {(remaining / guestCount).toFixed(2)}€ por persona
                  </div>
                  
                  {/* Per-person inputs */}
                  <div className="space-y-3">
                    {personPayments.map((personPayment, index) => (
                      <div key={index} className="p-3 rounded-lg border bg-card space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-full bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-sm">Persona {index + 1}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Importe</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={personPayment.amount}
                                onChange={(e) => handlePersonAmountChange(index, e.target.value)}
                                className="pr-6"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Método</Label>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant={personPayment.method === 'card' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 gap-1"
                                onClick={() => handlePersonMethodChange(index, 'card')}
                              >
                                <CreditCard className="h-3 w-3" />
                                Tarjeta
                              </Button>
                              <Button
                                type="button"
                                variant={personPayment.method === 'cash' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 gap-1"
                                onClick={() => handlePersonMethodChange(index, 'cash')}
                              >
                                <Banknote className="h-3 w-3" />
                                Efectivo
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Running total */}
                  <div className={`p-3 rounded-lg text-center ${personPaymentsExceedError ? 'bg-destructive/10 border border-destructive/50' : 'bg-primary/10'}`}>
                    <div className="flex items-center justify-center gap-2">
                      {personPaymentsExceedError && <AlertCircle className="h-4 w-4 text-destructive" />}
                      <span className="text-sm text-muted-foreground">Total introducido:</span>
                      <span className={`font-bold text-lg ${personPaymentsExceedError ? 'text-destructive' : ''}`}>
                        {totalPersonPayments.toFixed(2)}€
                      </span>
                      <span className="text-sm text-muted-foreground">/ Pendiente:</span>
                      <span className="font-medium">{remaining.toFixed(2)}€</span>
                    </div>
                    {personPaymentsExceedError && (
                      <p className="text-sm text-destructive mt-2">
                        El importe total supera el pendiente.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="items" className="pt-4 space-y-4">
                  {orderItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay productos para seleccionar
                    </p>
                  ) : unpaidItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Todos los productos están pagados.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {unpaidItems.map(({ item, remainingQty }) => {
                          const itemTotal = Number(item.unit_price) * remainingQty;
                          const isSelected = selectedItems.includes(item.id);
                          const partial = remainingQty < item.quantity;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'border-primary bg-primary/5' 
                                  : 'border-border hover:border-primary/50'
                              }`}
                              onClick={() => handleItemToggle(item.id)}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox checked={isSelected} />
                                <div>
                                  <p className="font-medium text-sm">
                                    {remainingQty}x {item.menu_item?.name || 'Producto'}
                                    {partial && (
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        (de {item.quantity})
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <span className="font-medium">{itemTotal.toFixed(2)}€</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="p-3 rounded-lg bg-primary/10 text-center">
                        <span className="text-sm text-muted-foreground">Seleccionado: </span>
                        <span className="font-bold text-lg">
                          {unpaidItems
                            .filter(x => selectedItems.includes(x.item.id))
                            .reduce((sum, x) => sum + (Number(x.item.unit_price) * x.remainingQty), 0)
                            .toFixed(2)}€
                        </span>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Discount Section - Only visible for non-guests modes and managers */}
            {splitMode !== 'guests' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Descuento
                  </Label>
                  {!canApplyDiscount && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Solo gerentes
                    </Badge>
                  )}
                </div>
                
                {canApplyDiscount ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        variant={discountType === 'percent' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setDiscountType('percent');
                          setDiscountAmount('');
                        }}
                      >
                        Porcentaje %
                      </Button>
                      <Button
                        variant={discountType === 'amount' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setDiscountType('amount');
                          setDiscountPercent('');
                        }}
                      >
                        Importe fijo €
                      </Button>
                    </div>
                    
                    {discountType === 'percent' ? (
                      <div className="flex gap-2">
                        {[5, 10, 15, 20].map(percent => (
                          <Button
                            key={percent}
                            variant={discountPercent === percent.toString() ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setDiscountPercent(percent.toString())}
                          >
                            {percent}%
                          </Button>
                        ))}
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={discountPercent}
                            onChange={(e) => setDiscountPercent(e.target.value)}
                            placeholder="Otro"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          placeholder="0.00"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      </div>
                    )}
                    
                    {discountValue > 0 && (
                      <div className="p-2 rounded bg-green-500/10 text-green-700 text-sm text-center">
                        Descuento aplicado: -{discountValue.toFixed(2)}€
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Solo los encargados y gerentes pueden aplicar descuentos.
                  </p>
                )}
              </div>
            )}

            {/* Amount input - only for full and items modes */}
            {splitMode !== 'guests' && (
              <div className="space-y-2">
                <Label htmlFor="amount">Importe a pagar</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={splitMode === 'items' ? calculatedAmount.toFixed(2) : amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pr-8 text-lg font-bold"
                    readOnly={splitMode === 'items'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                </div>
              </div>
            )}

            {/* Tip - only for non-guests modes */}
            {splitMode !== 'guests' && (
              <div className="space-y-2">
                <Label htmlFor="tip">Propina (opcional)</Label>
                <div className="relative">
                  <Input
                    id="tip"
                    type="number"
                    step="0.01"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    placeholder="0.00"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                </div>
              </div>
            )}

            {/* Payment method - only for full and items modes */}
            {splitMode !== 'guests' && (
              <div className="space-y-3">
                <Label>Método de pago</Label>
                <RadioGroup
                  value={method}
                  onValueChange={(value) => setMethod(value as PaymentMethod)}
                  className="grid grid-cols-2 gap-3"
                >
                  <div>
                    <RadioGroupItem value="card" id="card" className="peer sr-only" />
                    <Label
                      htmlFor="card"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <CreditCard className="mb-2 h-6 w-6" />
                      <span className="text-sm font-medium">Tarjeta</span>
                    </Label>
                  </div>
                  
                  <div>
                    <RadioGroupItem value="cash" id="cash" className="peer sr-only" />
                    <Label
                      htmlFor="cash"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <Banknote className="mb-2 h-6 w-6" />
                      <span className="text-sm font-medium">Efectivo</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isConfirmDisabled}
          >
            {confirmButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
