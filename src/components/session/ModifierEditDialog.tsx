import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MenuItem, ModifierGroup, Modifier } from '@/types/database';
import { cn } from '@/lib/utils';

interface SelectedModifier {
  modifier: Modifier;
  groupName: string;
}

interface ModifierEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItem: MenuItem | null;
  modifierGroups: ModifierGroup[];
  mode: 'extras' | 'sin' | 'all';
  existingModifiers?: SelectedModifier[];
  onConfirm: (selectedModifiers: SelectedModifier[]) => void | Promise<void>;
}

export default function ModifierEditDialog({
  open,
  onOpenChange,
  menuItem,
  modifierGroups,
  mode,
  existingModifiers = [],
  onConfirm,
}: ModifierEditDialogProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);

  // Initialize with existing modifiers when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedModifiers(existingModifiers);
    }
  }, [open, existingModifiers]);

  // Filter groups based on mode
  const filteredGroups = modifierGroups.filter(group => {
    if (mode === 'extras') {
      return group.name.toLowerCase().includes('extras') || group.name.toLowerCase().includes('con');
    }
    if (mode === 'sin') {
      return group.name.toLowerCase().includes('sin') || group.name.toLowerCase().includes('quitar');
    }
    return true; // 'all' mode shows everything
  });

  const handleModifierToggle = (modifier: Modifier, groupName: string) => {
    const isSelected = selectedModifiers.some(sm => sm.modifier.id === modifier.id);
    
    if (isSelected) {
      setSelectedModifiers(prev => 
        prev.filter(sm => sm.modifier.id !== modifier.id)
      );
    } else {
      setSelectedModifiers(prev => [...prev, { modifier, groupName }]);
    }
  };

  const isModifierSelected = (modifierId: string) => {
    return selectedModifiers.some(sm => sm.modifier.id === modifierId);
  };

  const totalPriceAdjustment = selectedModifiers.reduce(
    (sum, sm) => sum + Number(sm.modifier.price_adjustment), 
    0
  );

  const handleConfirm = async () => {
    await onConfirm(selectedModifiers);
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!menuItem) return null;

  const getDialogTitle = () => {
    if (mode === 'extras') return 'Extras (Con)';
    if (mode === 'sin') return 'Quitar ingredientes (Sin)';
    return 'Modificar';
  };

  const formatEuro = (value: number) =>
    Number(value).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-4 pointer-events-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base flex items-center justify-between">
            <span>{menuItem.name}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {getDialogTitle()}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[50vh] overflow-y-auto pointer-events-auto">
          {filteredGroups.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              No hay modificadores disponibles.
            </p>
          ) : (
            filteredGroups.map(group => (
              <div key={group.id} className="space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                  {group.name}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pointer-events-auto">
                  {group.modifiers?.map(modifier => {
                    const isSelected = isModifierSelected(modifier.id);
                    const priceAdjustment = Number(modifier.price_adjustment);
                    
                    return (
                      <button
                        key={modifier.id}
                        type="button"
                        className={cn(
                          "px-2 py-1.5 text-xs rounded-md border transition-colors text-left cursor-pointer pointer-events-auto",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                          isSelected 
                            ? "border-primary bg-primary text-primary-foreground" 
                            : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleModifierToggle(modifier, group.name);
                        }}
                      >
                        <span className="block truncate">{modifier.name}</span>
                        {priceAdjustment > 0 && (
                          <span className={cn(
                            "text-[10px]",
                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            +{formatEuro(priceAdjustment)}€
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="flex-row gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} className="flex-1" size="sm">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="flex-1" size="sm">
            Aplicar
            {totalPriceAdjustment > 0 && ` (+${formatEuro(totalPriceAdjustment)}€)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
