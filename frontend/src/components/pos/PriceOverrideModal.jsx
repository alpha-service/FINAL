import { useState } from 'react';
import { X, Delete } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PriceOverrideModal({ 
  open, 
  onClose, 
  item, 
  onConfirm,
  canOverridePrice = true // TODO: Integrate with actual permission system
}) {
  const [newPrice, setNewPrice] = useState(item?.unit_price?.toString() || '');

  const handleNumberClick = (num) => {
    setNewPrice(prev => prev + num);
  };

  const handleDecimal = () => {
    if (!newPrice.includes('.')) {
      setNewPrice(prev => prev + '.');
    }
  };

  const handleBackspace = () => {
    setNewPrice(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setNewPrice('');
  };

  const handleConfirm = () => {
    if (!canOverridePrice) {
      toast.error("Vous n'avez pas la permission de modifier les prix");
      return;
    }

    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
      toast.error("Prix invalide");
      return;
    }

    const overrideData = {
      itemId: item.product_id,
      oldPrice: item.unit_price,
      newPrice: price,
      timestamp: new Date().toISOString(),
      userId: 'current_user', // TODO: Get from auth context
      reason: 'manual_override'
    };

    onConfirm(price, overrideData);
    onClose();
  };

  if (!item) return null;

  const numberPad = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['0', '.', 'C']
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le prix</DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Info */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-sm font-medium text-slate-700">{item.name}</div>
            <div className="text-xs text-slate-500 mt-1">
              Prix actuel: €{item.unit_price?.toFixed(2)}
            </div>
          </div>

          {/* Price Display */}
          <div className="p-4 bg-white border-2 border-slate-300 rounded-lg">
            <div className="text-3xl font-bold text-center font-mono">
              €{newPrice || '0'}
            </div>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-2">
            {numberPad.map((row, rowIdx) => (
              row.map((btn, btnIdx) => (
                <Button
                  key={`${rowIdx}-${btnIdx}`}
                  variant="outline"
                  className="h-14 text-xl font-semibold"
                  onClick={() => {
                    if (btn === 'C') handleClear();
                    else if (btn === '.') handleDecimal();
                    else handleNumberClick(btn);
                  }}
                >
                  {btn === 'C' ? <Delete className="w-5 h-5" /> : btn}
                </Button>
              ))
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleBackspace}
            >
              ⌫ Effacer
            </Button>
            <Button
              className="flex-1 bg-brand-orange hover:bg-brand-orange/90"
              onClick={handleConfirm}
              disabled={!newPrice || !canOverridePrice}
            >
              Confirmer
            </Button>
          </div>

          {!canOverridePrice && (
            <div className="text-xs text-red-600 text-center">
              Permission requise pour modifier les prix
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
