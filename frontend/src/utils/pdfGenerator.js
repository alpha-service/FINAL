import jsPDF from "jspdf";
import "jspdf-autotable";

// Company info
const COMPANY = {
  name: "ALPHA&CO",
  subtitle: "BOUWMATERIALEN & DESIGN",
  address: "Ninoofsesteenweg 77-79",
  city: "1700 Dilbeek, Belgique",
  vat: "BE 1028.386.674",
  phone: "+32 (0)2/1111/111",
  email: "info@alphanco.be",
  hours: "Lun-Sam 07:00-18:00"
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
    doc.rect(margin, y, pageWidth - margin * 2, 25, "F");
    
    doc.setTextColor(...navyBlue);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Client / Klant:", margin + 5, y + 8);
    
    doc.setFont("helvetica", "normal");
    const customerName = customer?.name || sale.customer_name || "Client comptoir";
    doc.text(customerName, margin + 5, y + 15);
    
    if (customer?.vat_number) {
      doc.text(`TVA: ${customer.vat_number}`, margin + 5, y + 21);
    }
    if (customer?.phone) {
      doc.text(customer.phone, pageWidth - margin - 5, y + 15, { align: "right" });
    }
    
    y += 30;
  }

  y += 5;

  // Items table
  const tableData = sale.items.map(item => {
    let lineSubtotal = item.qty * item.unit_price;
    if (item.discount_type === "percent") {
      lineSubtotal -= lineSubtotal * (item.discount_value / 100);
    } else if (item.discount_type === "fixed") {
      lineSubtotal -= item.discount_value;
    }
    
    return [
      item.sku,
      item.name,
      item.qty.toString(),
      `€${item.unit_price.toFixed(2)}`,
      item.discount_value > 0 
        ? (item.discount_type === "percent" ? `${item.discount_value}%` : `€${item.discount_value}`)
        : "-",
      `€${lineSubtotal.toFixed(2)}`
    ];
  });

  doc.autoTable({
    startY: y,
    head: [[
      "SKU",
      "Description",
      "Qté",
      "Prix unit.",
      "Remise",
      "Total"
    ]],
    body: tableData,
    theme: "plain",
    headStyles: {
      fillColor: navyBlue,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 30, 30]
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: 25, halign: "right" }
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    }
  });

  y = doc.lastAutoTable.finalY + 10;

  // Totals section
  const totalsX = pageWidth - margin - 70;
  const totalsWidth = 70;

  doc.setFillColor(247, 250, 252);
  doc.rect(totalsX, y, totalsWidth, 35, "F");

  doc.setTextColor(...gray);
  doc.setFontSize(9);

  // Global discount if any
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
    y += 5;
  }

  doc.text("Sous-total HT:", totalsX + 5, y + 7);
  doc.text(`€${sale.subtotal.toFixed(2)}`, totalsX + totalsWidth - 5, y + 7, { align: "right" });

  doc.text("TVA (21%):", totalsX + 5, y + 14);
  doc.text(`€${sale.vat_total.toFixed(2)}`, totalsX + totalsWidth - 5, y + 14, { align: "right" });

  // Total
  doc.setFillColor(...orange);
  doc.rect(totalsX, y + 20, totalsWidth, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL TTC:", totalsX + 5, y + 28);
  doc.text(`€${sale.total.toFixed(2)}`, totalsX + totalsWidth - 5, y + 28, { align: "right" });

  y += 40;

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
    
    y += 15 + (sale.payments.length * 5);
  }

  // Status watermark for unpaid
  if (sale.status === "unpaid" || sale.status === "partially_paid") {
    doc.setTextColor(255, 100, 100);
    doc.setFontSize(60);
    doc.setFont("helvetica", "bold");
    doc.text("IMPAYÉ", pageWidth / 2, 150, {
      align: "center",
      angle: 45,
      opacity: 0.3
    });
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
  // Same as receipt but with more formal invoice format
  return generateReceiptPDF(sale, customer);
};
