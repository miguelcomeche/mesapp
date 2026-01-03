import { useState, useMemo } from 'react';
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
import { CreditCard, Banknote, Users, ListChecks, Percent, AlertCircle } from 'lucide-react';
import { PaymentMethod, OrderItem } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

type SplitMode = 'full' | 'guests' | 'items';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  paidAmount: number;
  guestCount?: number;
  orderItems?: OrderItem[];
  onConfirm: (amount: number, method: PaymentMethod, tip?: number, discount?: number) => void;
}

export default function PaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  paidAmount,
  guestCount = 1,
  orderItems = [],
  onConfirm,
}: PaymentDialogProps) {
  const { hasRole } = useAuth();
  const remaining = totalAmount - paidAmount;
  
  const [amount, setAmount] = useState(remaining.toString());
  const [tip, setTip] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [splitMode, setSplitMode] = useState<SplitMode>('full');
  const [selectedGuests, setSelectedGuests] = useState(1);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');

  // Check if user can apply discounts (only admin or manager)
  const canApplyDiscount = hasRole(['admin', 'manager']);

  // Calculate amount based on split mode
  const calculatedAmount = useMemo(() => {
    switch (splitMode) {
      case 'guests':
        return remaining / guestCount * selectedGuests;
      case 'items':
        const itemsTotal = orderItems
          .filter(item => selectedItems.includes(item.id))
          .reduce((sum, item) => sum + (Number(item.unit_price) * item.quantity), 0);
        return Math.min(itemsTotal, remaining);
      default:
        return remaining;
    }
  }, [splitMode, remaining, guestCount, selectedGuests, orderItems, selectedItems]);

  // Calculate discount
  const discountValue = useMemo(() => {
    if (!canApplyDiscount) return 0;
    if (discountType === 'percent') {
      const percent = parseFloat(discountPercent) || 0;
      return (calculatedAmount * percent) / 100;
    }
    return parseFloat(discountAmount) || 0;
  }, [discountType, discountPercent, discountAmount, calculatedAmount, canApplyDiscount]);

  // Final amount after discount
  const finalAmount = Math.max(0, calculatedAmount - discountValue);

  // Update amount when calculation changes
  useState(() => {
    setAmount(finalAmount.toFixed(2));
  });

  const handleSplitModeChange = (mode: SplitMode) => {
    setSplitMode(mode);
    setSelectedGuests(1);
    setSelectedItems([]);
  };

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleConfirm = () => {
    const paymentAmount = parseFloat(amount) || finalAmount;
    const tipAmount = parseFloat(tip) || undefined;
    
    if (paymentAmount <= 0) return;
    
    onConfirm(paymentAmount, method, tipAmount, discountValue > 0 ? discountValue : undefined);
    
    // Reset form
    resetForm();
  };

  const resetForm = () => {
    setAmount(remaining.toString());
    setTip('');
    setMethod('card');
    setSplitMode('full');
    setSelectedGuests(1);
    setSelectedItems([]);
    setDiscountPercent('');
    setDiscountAmount('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const quickAmounts = [
    { label: 'Total', value: remaining },
    { label: '50%', value: remaining / 2 },
    { label: '33%', value: remaining / 3 },
    { label: '25%', value: remaining / 4 },
  ].filter(a => a.value > 0);

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
                    {guestCount} comensales • {(remaining / guestCount).toFixed(2)}€ por persona
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: guestCount }, (_, i) => i + 1).map(num => (
                      <Button
                        key={num}
                        variant={selectedGuests === num ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedGuests(num)}
                      >
                        {num} persona{num !== 1 ? 's' : ''}
                      </Button>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 text-center">
                    <span className="text-sm text-muted-foreground">Importe: </span>
                    <span className="font-bold text-lg">
                      {(remaining / guestCount * selectedGuests).toFixed(2)}€
                    </span>
                  </div>
                </TabsContent>

                <TabsContent value="items" className="pt-4 space-y-4">
                  {orderItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay productos para seleccionar
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {orderItems.map(item => {
                          const itemTotal = Number(item.unit_price) * item.quantity;
                          const isSelected = selectedItems.includes(item.id);
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
                                    {item.quantity}x {item.menu_item?.name || 'Producto'}
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
                          {orderItems
                            .filter(item => selectedItems.includes(item.id))
                            .reduce((sum, item) => sum + (Number(item.unit_price) * item.quantity), 0)
                            .toFixed(2)}€
                        </span>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Discount Section - Only visible for managers */}
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

            {/* Amount input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Importe a pagar</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={finalAmount.toFixed(2)}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-8 text-lg font-bold"
                  readOnly={splitMode !== 'full'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
              </div>
            </div>

            {/* Tip */}
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

            {/* Payment method */}
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
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={finalAmount <= 0}
          >
            Registrar {finalAmount.toFixed(2)}€
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
