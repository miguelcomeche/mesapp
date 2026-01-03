import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MenuItem, ModifierGroup, Modifier } from '@/types/database';

interface SelectedModifier {
  modifier: Modifier;
  groupName: string;
}

interface ModifierSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItem: MenuItem | null;
  modifierGroups: ModifierGroup[];
  onConfirm: (menuItem: MenuItem, selectedModifiers: SelectedModifier[]) => void;
}

export default function ModifierSelectionDialog({
  open,
  onOpenChange,
  menuItem,
  modifierGroups,
  onConfirm,
}: ModifierSelectionDialogProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);

  const handleModifierToggle = (modifier: Modifier, groupName: string, checked: boolean) => {
    if (checked) {
      setSelectedModifiers(prev => [...prev, { modifier, groupName }]);
    } else {
      setSelectedModifiers(prev => 
        prev.filter(sm => sm.modifier.id !== modifier.id)
      );
    }
  };

  const isModifierSelected = (modifierId: string) => {
    return selectedModifiers.some(sm => sm.modifier.id === modifierId);
  };

  const totalPriceAdjustment = selectedModifiers.reduce(
    (sum, sm) => sum + Number(sm.modifier.price_adjustment), 
    0
  );

  const handleConfirm = () => {
    if (menuItem) {
      onConfirm(menuItem, selectedModifiers);
      setSelectedModifiers([]);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setSelectedModifiers([]);
    onOpenChange(false);
  };

  if (!menuItem) return null;

  const basePrice = Number(menuItem.price);
  const finalPrice = basePrice + totalPriceAdjustment;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{menuItem.name}</span>
            <Badge variant="secondary" className="text-lg">
              {finalPrice.toFixed(2)}€
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {modifierGroups.map(group => (
            <div key={group.id} className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                {group.name}
              </h4>
              <div className="space-y-2">
                {group.modifiers?.map(modifier => {
                  const isSelected = isModifierSelected(modifier.id);
                  const priceAdjustment = Number(modifier.price_adjustment);
                  
                  return (
                    <div
                      key={modifier.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleModifierToggle(modifier, group.name, !isSelected)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => 
                            handleModifierToggle(modifier, group.name, !!checked)
                          }
                        />
                        <Label className="cursor-pointer">{modifier.name}</Label>
                      </div>
                      {priceAdjustment > 0 && (
                        <span className="text-sm font-medium text-primary">
                          +{priceAdjustment.toFixed(2)}€
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {modifierGroups.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No hay modificadores disponibles para este producto.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {selectedModifiers.length > 0 && (
              <span>
                {selectedModifiers.length} modificador{selectedModifiers.length !== 1 ? 'es' : ''} seleccionado{selectedModifiers.length !== 1 ? 's' : ''}
                {totalPriceAdjustment > 0 && ` (+${totalPriceAdjustment.toFixed(2)}€)`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>
              Añadir al pedido
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
