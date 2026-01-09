import { ChevronUp, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import CartCompact from './CartCompact';

export default function CartDrawer({ 
  open,
  onOpenChange,
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
  return (
    <>
      {/* Bottom Bar (Always Visible) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-300 shadow-lg z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Cart Icon + Count */}
            <button
              onClick={() => onOpenChange(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="relative">
                <ShoppingCart className="w-6 h-6 text-brand-navy" />
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </div>
              <div className="text-left">
                <div className="text-xs text-slate-500">Articles</div>
                <div className="font-semibold">{cart.length}</div>
              </div>
            </button>

            {/* Total */}
            <div className="flex-1 flex items-center justify-center gap-6">
              <div className="text-left">
                <div className="text-xs text-slate-500">Sous-total HT</div>
                <div className="font-mono font-semibold">€{subtotal.toFixed(2)}</div>
              </div>
              <div className="text-left">
                <div className="text-xs text-slate-500">TVA</div>
                <div className="font-mono font-semibold">€{vatTotal.toFixed(2)}</div>
              </div>
              <div className="text-left">
                <div className="text-xs text-brand-navy">TOTAL TTC</div>
                <div className="text-2xl font-bold text-brand-navy font-mono">
                  €{total.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Pay Button */}
            <Button
              className="h-14 px-12 text-lg font-bold bg-brand-orange hover:bg-brand-orange/90 shadow-lg"
              onClick={onPay}
              disabled={cart.length === 0}
            >
              PAYER
            </Button>

            {/* Open Drawer Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-14 px-4"
              onClick={() => onOpenChange(true)}
            >
              <ChevronUp className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Drawer */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[80vh] p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle>Panier</SheetTitle>
          </SheetHeader>
          <div className="h-full">
            <CartCompact
              cart={cart}
              onUpdateQty={onUpdateQty}
              onRemoveItem={onRemoveItem}
              onPriceClick={onPriceClick}
              subtotal={subtotal}
              vatTotal={vatTotal}
              total={total}
              onPay={onPay}
              highlightedItemId={highlightedItemId}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
