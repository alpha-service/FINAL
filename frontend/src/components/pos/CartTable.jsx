import { Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useRef } from 'react';

export default function CartTable({ 
  cart, 
  onUpdateQty, 
  onRemoveItem, 
  onPriceClick,
  subtotal,
  vatTotal,
  total,
  onPay,
  highlightedItemId,
  selectedItemId,
  onSelectItem
}) {
  const tableRef = useRef(null);

  // Scroll to highlighted item
  useEffect(() => {
    if (highlightedItemId && tableRef.current) {
      const element = document.getElementById(`cart-row-${highlightedItemId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [highlightedItemId]);

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-heading font-bold text-lg">Panier (Table)</h2>
        <Badge variant="outline">{cart.length} article(s)</Badge>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1" ref={tableRef}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="border-b border-slate-200">
              <th className="text-left p-2 font-semibold w-16">#</th>
              <th className="text-left p-2 font-semibold">Article</th>
              <th className="text-center p-2 font-semibold w-20">Qté</th>
              <th className="text-right p-2 font-semibold w-24">P.U.</th>
              <th className="text-right p-2 font-semibold w-24">Total</th>
              <th className="text-center p-2 font-semibold w-16"></th>
            </tr>
          </thead>
          <tbody>
            {cart.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-8 text-slate-500">
                  Panier vide
                </td>
              </tr>
            ) : (
              cart.map((item, index) => {
                const lineTotal = item.qty * item.unit_price * (1 - (item.discount_value || 0) / 100);
                const isSelected = selectedItemId === item.product_id;
                const isHighlighted = highlightedItemId === item.product_id;

                return (
                  <tr
                    key={item.product_id}
                    id={`cart-row-${item.product_id}`}
                    className={`
                      border-b border-slate-100 transition-all duration-700 cursor-pointer
                      ${isHighlighted ? 'bg-brand-orange/10' : ''}
                      ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}
                    `}
                    onClick={() => onSelectItem(item.product_id)}
                  >
                    {/* Index */}
                    <td className="p-2 text-slate-500">{index + 1}</td>

                    {/* Article */}
                    <td className="p-2">
                      <div>
                        <div className="font-medium truncate max-w-xs">{item.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{item.sku}</div>
                        {item.discount_value > 0 && (
                          <div className="text-xs text-green-600 mt-0.5">
                            Remise: {item.discount_type === 'percent' 
                              ? `${item.discount_value}%` 
                              : `€${item.discount_value.toFixed(2)}`}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateQty(item.product_id, Math.max(1, item.qty - 1));
                          }}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <div className="w-8 text-center font-medium">{item.qty}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateQty(item.product_id, item.qty + 1);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>

                    {/* Unit Price */}
                    <td className="p-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPriceClick(item);
                        }}
                        className="font-mono hover:text-brand-orange transition-colors cursor-pointer"
                      >
                        €{item.unit_price.toFixed(2)}
                      </button>
                      {item.priceOverridden && (
                        <Badge className="ml-1 text-xs bg-amber-100 text-amber-800">M</Badge>
                      )}
                    </td>

                    {/* Total */}
                    <td className="p-2 text-right">
                      <span className="font-bold text-brand-navy font-mono">
                        €{lineTotal.toFixed(2)}
                      </span>
                    </td>

                    {/* Delete */}
                    <td className="p-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveItem(item.product_id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScrollArea>

      {/* Footer - Sticky Totals + Pay Button */}
      <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Sous-total HT:</span>
              <span className="font-mono">€{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">TVA (21%):</span>
              <span className="font-mono">€{vatTotal.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 bg-brand-navy text-white rounded-lg">
            <span className="font-bold">TOTAL TTC</span>
            <span className="text-2xl font-bold font-mono">€{total.toFixed(2)}</span>
          </div>
        </div>

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
