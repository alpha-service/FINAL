import jsPDF from "jspdf";

// Company info
const COMPANY = {
  name: "ALPHA&CO",
  subtitle: "BOUWMATERIALEN & DESIGN",
  address: "Ninoofsesteenweg 77-79",
  city: "1700 Dilbeek, Belgique",
  vat: "BE 1028.386.674",
  phone: "+32 2 449 81 22",
  email: "info@alphaco.be",
  hours: "Lu-Ve 08:00-17:30, Sa 09:00-13:00"
};

export const generateReceiptPDF = (sale, customer = null) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Colors
  const navyBlue = [26, 54, 93];
  const orange = [255, 107, 53];
  const gray = [100, 116, 139];

  // Header background
  doc.setFillColor(...navyBlue);
  doc.rect(0, 0, pageWidth, 45, "F");

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY.name, margin, y + 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(COMPANY.subtitle, margin, y + 20);

  // Company info right side
  doc.setFontSize(8);
  doc.text([
    COMPANY.address,
    COMPANY.city,
    `TVA: ${COMPANY.vat}`,
    COMPANY.phone
  ], pageWidth - margin, y + 8, { align: "right" });

  y = 55;

  // Document type and number
  doc.setTextColor(...navyBlue);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const docType = sale.status === "paid" ? "FACTURE / FACTUUR" : "TICKET DE CAISSE / KASSABON";
  doc.text(docType, margin, y);

  doc.setFontSize(12);
  doc.setTextColor(...gray);
  doc.text(`N° ${sale.number}`, margin, y + 8);

  // Date
  const saleDate = new Date(sale.created_at);
  const dateStr = saleDate.toLocaleDateString("fr-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  doc.text(dateStr, pageWidth - margin, y + 8, { align: "right" });

  y += 20;

  // Customer info if available
  if (customer || sale.customer_name) {
    doc.setFillColor(247, 250, 252);
    doc.rect(margin, y, pageWidth - margin * 2, 20, "F");
    
    doc.setTextColor(...navyBlue);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Client / Klant:", margin + 5, y + 8);
    
    doc.setFont("helvetica", "normal");
    const customerName = customer?.name || sale.customer_name || "Client comptoir";
    doc.text(customerName, margin + 5, y + 14);
    
    y += 25;
  }

  y += 5;

  // Table Header
  doc.setFillColor(...navyBlue);
  doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  
  doc.text("SKU", margin + 3, y + 5.5);
  doc.text("Description", margin + 35, y + 5.5);
  doc.text("Qté", margin + 100, y + 5.5);
  doc.text("Prix", margin + 120, y + 5.5);
  doc.text("Total", pageWidth - margin - 3, y + 5.5, { align: "right" });
  
  y += 10;

  // Table rows
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  
  sale.items.forEach((item, idx) => {
    // Alternate row color
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 1, pageWidth - margin * 2, 8, "F");
    }
    
    let lineSubtotal = item.qty * item.unit_price;
    if (item.discount_type === "percent") {
      lineSubtotal -= lineSubtotal * (item.discount_value / 100);
    } else if (item.discount_type === "fixed") {
      lineSubtotal -= item.discount_value;
    }
    
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(8);
    doc.text(item.sku.substring(0, 15), margin + 3, y + 4);
    doc.text(item.name.substring(0, 30), margin + 35, y + 4);
    doc.text(item.qty.toString(), margin + 100, y + 4);
    doc.text(`€${item.unit_price.toFixed(2)}`, margin + 120, y + 4);
    doc.text(`€${lineSubtotal.toFixed(2)}`, pageWidth - margin - 3, y + 4, { align: "right" });
    
    y += 8;
  });

  y += 10;

  // Totals section
  const totalsX = pageWidth - margin - 70;
  const totalsWidth = 70;

  doc.setFillColor(247, 250, 252);
  doc.rect(totalsX, y, totalsWidth, 35, "F");

  doc.setTextColor(...gray);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Global discount if any
  let yOffset = 0;
  if (sale.global_discount_value > 0) {
    doc.text("Remise globale:", totalsX + 5, y + 7);
    doc.text(
      sale.global_discount_type === "percent" 
        ? `-${sale.global_discount_value}%` 
        : `-€${sale.global_discount_value.toFixed(2)}`,
      totalsX + totalsWidth - 5,
      y + 7,
      { align: "right" }
    );
    yOffset = 5;
  }

  doc.text("Sous-total HT:", totalsX + 5, y + 7 + yOffset);
  doc.text(`€${sale.subtotal.toFixed(2)}`, totalsX + totalsWidth - 5, y + 7 + yOffset, { align: "right" });

  doc.text("TVA (21%):", totalsX + 5, y + 14 + yOffset);
  doc.text(`€${sale.vat_total.toFixed(2)}`, totalsX + totalsWidth - 5, y + 14 + yOffset, { align: "right" });

  // Total
  doc.setFillColor(...orange);
  doc.rect(totalsX, y + 20 + yOffset, totalsWidth, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL TTC:", totalsX + 5, y + 28 + yOffset);
  doc.text(`€${sale.total.toFixed(2)}`, totalsX + totalsWidth - 5, y + 28 + yOffset, { align: "right" });

  y += 45 + yOffset;

  // Payment info
  if (sale.payments && sale.payments.length > 0) {
    doc.setTextColor(...navyBlue);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Paiement / Betaling:", margin, y);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    
    sale.payments.forEach((payment, idx) => {
      const methodLabel = {
        cash: "Espèces / Cash",
        card: "Carte / Kaart",
        bank_transfer: "Virement / Overschrijving"
      }[payment.method] || payment.method;
      
      doc.text(`${methodLabel}: €${payment.amount.toFixed(2)}`, margin, y + 7 + (idx * 5));
    });
  }

  // Status watermark for unpaid
  if (sale.status === "unpaid" || sale.status === "partially_paid") {
    doc.setTextColor(255, 100, 100);
    doc.setFontSize(60);
    doc.setFont("helvetica", "bold");
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.3 }));
    doc.text("IMPAYÉ", pageWidth / 2, 150, { align: "center", angle: 45 });
    doc.restoreGraphicsState();
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(...navyBlue);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${COMPANY.name} - ${COMPANY.address}, ${COMPANY.city} - TVA: ${COMPANY.vat}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );
  doc.text(
    `${COMPANY.email} - ${COMPANY.phone} - ${COMPANY.hours}`,
    pageWidth / 2,
    footerY + 5,
    { align: "center" }
  );

  // Save the PDF
  doc.save(`${sale.number}-receipt.pdf`);
  
  return doc;
};

export const generateInvoicePDF = (sale, customer) => {
  return generateReceiptPDF(sale, customer);
};
