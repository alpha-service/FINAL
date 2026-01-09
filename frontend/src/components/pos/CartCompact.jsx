import { Plus, Minus, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useEffect, useRef } from 'react';

export default function CartCompact({ 
  cart, 
  onUpdateQty, 
  onRemoveItem, 
  onPriceClick,
  subtotal,
  vatTotal,
  total,
  onPay,
  highlightedItemId 
}) {
  const cartRef = useRef(null);

  // Scroll to highlighted item
  useEffect(() => {
    if (highlightedItemId && cartRef.current) {
      const element = document.getElementById(`cart-item-${highlightedItemId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [highlightedItemId]);

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg">Panier</h2>
          <Badge variant="outline">{cart.length} article(s)</Badge>
        </div>
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1 px-4" ref={cartRef}>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500">Panier vide</p>
          </div>
        ) : (
          <div className="space-y-2 py-3">
            {cart.map((item) => (
              <div
                key={item.product_id}
                id={`cart-item-${item.product_id}`}
                className={`
                  border rounded-lg p-3 transition-all duration-700
                  ${highlightedItemId === item.product_id 
                    ? 'bg-brand-orange/10 border-brand-orange shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-slate-300'}
                `}
              >
                {/* Item Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{item.sku}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onRemoveItem(item.product_id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Item Controls */}
                <div className="flex items-center justify-between">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onUpdateQty(item.product_id, Math.max(1, item.qty - 1))}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <div className="w-10 text-center font-medium text-sm">{item.qty}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onUpdateQty(item.product_id, item.qty + 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <button
                      onClick={() => onPriceClick(item)}
                      className="text-sm font-mono font-semibold hover:text-brand-orange transition-colors cursor-pointer"
                    >
                      €{item.unit_price.toFixed(2)}
                    </button>
                    {item.priceOverridden && (
                      <Badge className="ml-1 text-xs bg-amber-100 text-amber-800">
                        Modifié
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Discount */}
                {item.discount_value > 0 && (
                  <div className="mt-2 text-xs text-green-600">
                    Remise: {item.discount_type === 'percent' 
                      ? `${item.discount_value}%` 
                      : `€${item.discount_value.toFixed(2)}`}
                  </div>
                )}

                {/* Line Total */}
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-500">Total ligne</span>
                  <span className="font-bold text-brand-navy">
                    €{(item.qty * item.unit_price * (1 - (item.discount_value || 0) / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer - Sticky Totals + Pay Button */}
      <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-3">
        {/* Totals */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Sous-total HT</span>
            <span className="font-mono">€{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">TVA (21%)</span>
            <span className="font-mono">€{vatTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-300">
            <span className="font-bold text-brand-navy">TOTAL TTC</span>
            <span className="text-2xl font-bold text-brand-navy font-mono">
              €{total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Pay Button */}
        <Button
          className="w-full h-16 text-xl font-bold bg-brand-orange hover:bg-brand-orange/90 shadow-lg"
          onClick={onPay}
          disabled={cart.length === 0}
        >
          PAYER
        </Button>
      </div>
    </div>
  );
}
