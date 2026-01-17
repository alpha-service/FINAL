/**
 * ThermalReceipt - 80mm Thermal Receipt Printer Format
 * Width: 80mm (302px at 96dpi, 72mm printable area)
 * Optimized for ESC/POS compatible thermal printers
 */
import { forwardRef } from 'react';

const ThermalReceipt = forwardRef(({ document }, ref) => {
  if (!document) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-BE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const items = document.items || [];
  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const discountTotal = items.reduce((sum, item) => {
    const lineTotal = item.unit_price * item.quantity;
    return sum + (lineTotal * (item.discount_percent || 0) / 100);
  }, 0);
  const total = document.total || (subtotal - discountTotal);
  const paid = document.paid_total || 0;
  const remaining = total - paid;

  return (
    <div 
      ref={ref}
      className="thermal-receipt bg-white text-black font-mono"
      style={{
        width: '80mm',
        maxWidth: '80mm',
        padding: '4mm',
        fontSize: '11px',
        lineHeight: '1.3',
        fontFamily: "'Courier New', Courier, monospace"
      }}
    >
      {/* Header */}
      <div className="text-center border-b border-dashed border-black pb-2 mb-2">
        <div className="text-lg font-bold">ALPHA&CO</div>
        <div className="text-xs">BOUWMATERIALEN & DESIGN</div>
        <div className="text-xs mt-1">
          Ninoofsesteenweg 77-79<br />
          1700 Dilbeek, Belgique<br />
          Tél: +32 2 449 81 22<br />
          TVA: BE 1028.386.674
        </div>
      </div>

      {/* Document Info */}
      <div className="border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between">
          <span className="font-bold">
            {document.doc_type === 'receipt' ? 'TICKET DE CAISSE' : 
             document.doc_type === 'invoice' ? 'FACTURE' :
             document.doc_type === 'quote' ? 'DEVIS' :
             document.doc_type === 'credit_note' ? 'AVOIR' :
             document.doc_type === 'proforma' ? 'PROFORMA' :
             document.doc_type === 'delivery_note' ? 'BON LIVRAISON' : 'DOCUMENT'}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span>N°: {document.number}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>{formatDate(document.date)}</span>
          <span>{formatTime(document.date)}</span>
        </div>
        {document.cashier && (
          <div className="text-xs">Caissier: {document.cashier}</div>
        )}
      </div>

      {/* Customer Info (if present) */}
      {document.customer && (
        <div className="border-b border-dashed border-black pb-2 mb-2 text-xs">
          <div className="font-bold">Client:</div>
          <div>{document.customer.name}</div>
          {document.customer.vat_number && (
            <div>TVA: {document.customer.vat_number}</div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between font-bold text-xs border-b border-black pb-1 mb-1">
          <span>Article</span>
          <span>Montant</span>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="mb-1">
            <div className="truncate text-xs font-medium">{item.name}</div>
            <div className="flex justify-between text-xs">
              <span>{item.quantity} x €{item.unit_price.toFixed(2)}</span>
              <span>€{(item.quantity * item.unit_price).toFixed(2)}</span>
            </div>
            {item.discount_percent > 0 && (
              <div className="flex justify-between text-xs text-gray-600">
                <span>Remise -{item.discount_percent}%</span>
                <span>-€{((item.quantity * item.unit_price * item.discount_percent / 100)).toFixed(2)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between text-xs">
          <span>Sous-total:</span>
          <span>€{subtotal.toFixed(2)}</span>
        </div>
        {discountTotal > 0 && (
          <div className="flex justify-between text-xs">
            <span>Remises:</span>
            <span>-€{discountTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span>TVA (21%):</span>
          <span>€{(total * 0.21 / 1.21).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t border-black">
          <span>TOTAL:</span>
          <span>€{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Info */}
      {document.payments && document.payments.length > 0 && (
        <div className="border-b border-dashed border-black pb-2 mb-2 text-xs">
          <div className="font-bold">Paiements:</div>
          {document.payments.map((payment, idx) => (
            <div key={idx} className="flex justify-between">
              <span>
                {payment.method === 'cash' ? 'Espèces' :
                 payment.method === 'card' ? 'Carte' :
                 payment.method === 'bank_transfer' ? 'Virement' :
                 payment.method === 'credit' ? 'Crédit' : payment.method}
              </span>
              <span>€{payment.amount.toFixed(2)}</span>
            </div>
          ))}
          {remaining > 0 && (
            <div className="flex justify-between font-bold mt-1">
              <span>Reste à payer:</span>
              <span>€{remaining.toFixed(2)}</span>
            </div>
          )}
          {remaining < 0 && (
            <div className="flex justify-between font-bold mt-1">
              <span>Monnaie rendue:</span>
              <span>€{Math.abs(remaining).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs">
        <div className="mb-2">
          --------------------------------
        </div>
        <div>Merci de votre visite!</div>
        <div>Bedankt voor uw bezoek!</div>
        <div className="mt-2 text-xs opacity-75">
          www.alphaco.be
        </div>
        <div className="mt-2">
          {/* Barcode placeholder */}
          <div className="font-mono text-xs tracking-wider">
            {document.number}
          </div>
        </div>
      </div>
    </div>
  );
});

ThermalReceipt.displayName = 'ThermalReceipt';

export default ThermalReceipt;
