import { FileText, Receipt, FileCheck, FileX, Truck, CreditCard } from "lucide-react";

const DOC_TYPE_CONFIG = {
  quote: { 
    title: "DEVIS / OFFERTE", 
    icon: FileText,
    color: "text-blue-600"
  },
  invoice: { 
    title: "FACTURE / FACTUUR", 
    icon: Receipt,
    color: "text-brand-navy"
  },
  receipt: { 
    title: "TICKET DE CAISSE / KASSABON", 
    icon: Receipt,
    color: "text-green-600"
  },
  credit_note: { 
    title: "NOTE DE CRÉDIT / CREDITNOTA", 
    icon: FileX,
    color: "text-red-600"
  },
  proforma: { 
    title: "FACTURE PROFORMA / PROFORMA", 
    icon: FileCheck,
    color: "text-purple-600"
  },
  delivery_note: { 
    title: "BON DE LIVRAISON / LEVERINGSBON", 
    icon: Truck,
    color: "text-amber-600"
  }
};

const STATUS_WATERMARKS = {
  draft: "BROUILLON / ONTWERP",
  unpaid: "IMPAYÉ / ONBETAALD",
  partially_paid: "PARTIELLEMENT PAYÉ / GEDEELTELIJK BETAALD"
};

export default function DocumentViewer({ document }) {
  const docConfig = DOC_TYPE_CONFIG[document.doc_type] || DOC_TYPE_CONFIG.invoice;
  const showWatermark = ["draft", "unpaid", "partially_paid"].includes(document.status);
  const watermarkText = STATUS_WATERMARKS[document.status];

  // Group VAT lines by rate
  const vatBreakdown = {};
  document.items?.forEach(item => {
    const rate = item.vat_rate || 21;
    if (!vatBreakdown[rate]) {
      vatBreakdown[rate] = { base: 0, vat: 0 };
    }
    const lineTotal = item.line_total || 0;
    const vatAmount = lineTotal * (rate / 100) / (1 + rate / 100);
    const baseAmount = lineTotal - vatAmount;
    vatBreakdown[rate].base += baseAmount;
    vatBreakdown[rate].vat += vatAmount;
  });

  return (
    <div className="document-viewer bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* A4 Container */}
      <div className="relative bg-white shadow-lg mx-auto" style={{ 
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm',
        position: 'relative'
      }}>
        {/* Watermark */}
        {showWatermark && (
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              zIndex: 1,
              opacity: 0.08
            }}
          >
            <div 
              className="font-bold text-red-600"
              style={{
                fontSize: '80px',
                transform: 'rotate(-45deg)',
                lineHeight: '1',
                whiteSpace: 'nowrap'
              }}
            >
              {watermarkText}
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            {/* Company Logo/Name */}
            <div>
              <div 
                className="font-bold text-brand-navy mb-2"
                style={{ 
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: '24px',
                  lineHeight: '1.2'
                }}
              >
                ALPHA&CO
              </div>
              <div className="text-xs text-slate-600 space-y-0.5">
                <div>Bouwmaterialen & Design</div>
                <div>Ninoofsesteenweg 77-79</div>
                <div>1700 Dilbeek, België</div>
                <div>TVA: BE 1028.386.674</div>
              </div>
            </div>

            {/* Document Info */}
            <div className="text-right">
              <div 
                className={`font-bold ${docConfig.color} mb-2`}
                style={{ 
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: '20px'
                }}
              >
                {docConfig.title}
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div><span className="font-medium">N°:</span> {document.number}</div>
                <div><span className="font-medium">Date:</span> {new Date(document.created_at).toLocaleDateString('fr-BE')}</div>
                {document.due_date && (
                  <div><span className="font-medium">Échéance:</span> {new Date(document.due_date).toLocaleDateString('fr-BE')}</div>
                )}
                {document.channel && (
                  <div><span className="font-medium">Canal:</span> {document.channel === 'online' ? '🌐 En ligne' : '🏪 Magasin'}</div>
                )}
              </div>
            </div>
          </div>

          {/* Client Block */}
          {document.customer_name && (
            <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-medium text-slate-500 mb-2">CLIENT / KLANT</div>
              <div className="text-sm">
                <div className="font-bold text-brand-navy mb-1">{document.customer_name}</div>
                {document.customer_address && (
                  <div className="text-slate-600">{document.customer_address}</div>
                )}
                {document.customer_vat && (
                  <div className="text-slate-600 mt-1">TVA: {document.customer_vat}</div>
                )}
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full border-collapse" style={{ fontSize: '11px' }}>
              <thead>
                <tr className="border-b-2 border-brand-navy">
                  <th className="text-left py-2 px-2 font-semibold text-brand-navy">SKU</th>
                  <th className="text-left py-2 px-2 font-semibold text-brand-navy">Description</th>
                  <th className="text-center py-2 px-2 font-semibold text-brand-navy">Qté</th>
                  <th className="text-right py-2 px-2 font-semibold text-brand-navy">P.U.</th>
                  <th className="text-right py-2 px-2 font-semibold text-brand-navy">Rem.</th>
                  <th className="text-right py-2 px-2 font-semibold text-brand-navy">TVA%</th>
                  <th className="text-right py-2 px-2 font-semibold text-brand-navy">Total</th>
                </tr>
              </thead>
              <tbody>
                {document.items?.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                  >
                    <td className="py-2 px-2 font-mono text-xs">{item.sku}</td>
                    <td className="py-2 px-2">{item.name}</td>
                    <td className="py-2 px-2 text-center">{item.qty}</td>
                    <td className="py-2 px-2 text-right">€{Math.abs(item.unit_price).toFixed(2)}</td>
                    <td className="py-2 px-2 text-right">
                      {item.discount_value > 0 ? (
                        item.discount_type === 'percent' ? `${item.discount_value}%` : `€${item.discount_value.toFixed(2)}`
                      ) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right">{item.vat_rate}%</td>
                    <td className="py-2 px-2 text-right font-semibold">€{Math.abs(item.line_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-8">
            <div className="w-80">
              {/* VAT Breakdown */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 mb-3">
                <div className="text-xs font-semibold text-slate-600 mb-2">DÉTAIL TVA / BTW DETAIL</div>
                {Object.entries(vatBreakdown).map(([rate, amounts]) => (
                  <div key={rate} className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Base {rate}%</span>
                    <span className="font-mono">€{amounts.base.toFixed(2)} + €{amounts.vat.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals Card */}
              <div className="bg-brand-navy text-white rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sous-total HT</span>
                  <span className="font-mono">€{(document.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>TVA</span>
                  <span className="font-mono">€{(document.vat_total || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-white/20 pt-2 mt-2"></div>
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL TTC</span>
                  <span className="font-mono">€{(document.total || 0).toFixed(2)}</span>
                </div>
                
                {/* Payment Info */}
                {document.paid_total > 0 && (
                  <>
                    <div className="border-t border-white/20 pt-2 mt-2"></div>
                    <div className="flex justify-between text-sm text-green-300">
                      <span>Payé</span>
                      <span className="font-mono">€{(document.paid_total || 0).toFixed(2)}</span>
                    </div>
                    {(document.total - document.paid_total) > 0.01 && (
                      <div className="flex justify-between text-sm text-amber-300">
                        <span>Reste à payer</span>
                        <span className="font-mono">€{((document.total || 0) - (document.paid_total || 0)).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Payment History */}
          {document.payments?.length > 0 && (
            <div className="mb-8">
              <div className="text-xs font-semibold text-slate-600 mb-2">PAIEMENTS / BETALINGEN</div>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                {document.payments.map((payment, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs mb-1 last:mb-0">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-600">
                        {new Date(payment.created_at).toLocaleDateString('fr-BE')} - {payment.method === 'cash' ? 'Espèces' : payment.method === 'card' ? 'Carte' : 'Virement'}
                      </span>
                    </div>
                    <span className="font-mono font-medium">€{payment.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-300 pt-6 mt-12">
            <div className="text-xs text-slate-600 space-y-2">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium mb-1">Coordonnées bancaires / Bankgegevens:</div>
                  <div>IBAN: BE68 5390 0754 7034</div>
                  <div>BIC: BBRUBEBB</div>
                </div>
                <div className="text-right">
                  <div className="font-medium mb-1">Conditions de paiement:</div>
                  <div>Paiement à {document.payment_terms || '30'} jours</div>
                </div>
              </div>
              
              <div className="text-center text-slate-500 text-xs pt-4 border-t border-slate-200">
                <div className="font-medium">Merci pour votre confiance / Bedankt voor uw vertrouwen</div>
                <div className="mt-1">ALPHA&CO BVBA - TVA BE 1028.386.674 - RPM Bruxelles</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .document-viewer {
            margin: 0;
            padding: 0;
          }
          .document-viewer > div {
            box-shadow: none;
            margin: 0;
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}
