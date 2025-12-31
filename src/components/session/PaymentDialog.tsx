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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Banknote, Split } from 'lucide-react';
import { PaymentMethod } from '@/types/database';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  paidAmount: number;
  onConfirm: (amount: number, method: PaymentMethod, tip?: number) => void;
}

export default function PaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  paidAmount,
  onConfirm,
}: PaymentDialogProps) {
  const remaining = totalAmount - paidAmount;
  const [amount, setAmount] = useState(remaining.toString());
  const [tip, setTip] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('card');

  const handleConfirm = () => {
    const paymentAmount = parseFloat(amount) || 0;
    const tipAmount = parseFloat(tip) || undefined;
    
    if (paymentAmount <= 0) return;
    
    onConfirm(paymentAmount, method, tipAmount);
    
    // Reset form
    setAmount(remaining.toString());
    setTip('');
    setMethod('card');
  };

  const handleClose = () => {
    setAmount(remaining.toString());
    setTip('');
    setMethod('card');
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
        </DialogHeader>

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

          {/* Quick amounts */}
          <div className="space-y-2">
            <Label>Importe rápido</Label>
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
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Importe a pagar</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-8"
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
              className="grid grid-cols-3 gap-3"
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
              
              <div>
                <RadioGroupItem value="split" id="split" className="peer sr-only" />
                <Label
                  htmlFor="split"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Split className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Dividido</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!parseFloat(amount) || parseFloat(amount) <= 0}>
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
