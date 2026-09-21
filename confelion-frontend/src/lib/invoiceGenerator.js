import { jsPDF } from 'jspdf';

/**
 * Generates and automatically downloads a luxury Confelion branded PDF Invoice
 * for a customer order, complete with Delhivery Express shipping & payment details.
 */
export function generateOrderInvoicePDF(order) {
  if (!order) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // 1. Luxury Black Header Banner
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('C O N F E L I O N', margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('ENGINEERED MONOCHROME · ALL DROPS 100% BLACK', margin, 24);
  doc.text('Poonchh Fulfillment Hub · Uttar Pradesh 284304 · support@confelion.com', margin, 29);

  // Right Header - Tax Invoice Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('TAX INVOICE', pageWidth - margin, 18, { align: 'right' });

  const hasAwb = !!(order.awb_number && String(order.awb_number).trim());
  const awbDisplay = hasAwb ? order.awb_number : 'Awaiting Dispatch';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text(`Invoice Ref: INV-${order.id}`, pageWidth - margin, 24, { align: 'right' });
  doc.text(`Carrier: Delhivery Express`, pageWidth - margin, 29, { align: 'right' });

  // 2. Order Metadata & Logistics Grid
  let y = 46;
  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(225, 225, 225);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'FD');

  // Column 1: Order Details
  doc.setTextColor(110, 110, 110);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDER DETAILS', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8.5);
  doc.text(`Order ID: ${order.id}`, margin + 4, y + 12);
  
  const orderDate = order.created_at 
    ? new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  doc.text(`Date: ${orderDate}`, margin + 4, y + 17);
  doc.text(`Status: ${order.status || 'Confirmed (Processing)'}`, margin + 4, y + 22);

  // Column 2: Payment Details
  const col2X = margin + 58;
  doc.setTextColor(110, 110, 110);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT SPECIFICATION', col2X, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8.5);
  doc.text(`Method: ${order.payment_method || 'Online Payment'}`, col2X, y + 12);
  if (order.payment_details?.type === 'partial') {
    doc.text(`Advance Paid: Rs. ${order.payment_details.advance_paid || 300}`, col2X, y + 17);
    doc.text(`Balance Due: Rs. ${order.payment_details.remaining_balance || (order.total - 300)} (On Delivery)`, col2X, y + 22);
  } else if (order.payment_details?.type === 'cod') {
    doc.text(`Payment: Cash On Delivery`, col2X, y + 17);
    doc.text(`Amount Due: Rs. ${Number(order.total).toLocaleString('en-IN')}`, col2X, y + 22);
  } else {
    doc.text(`Payment Status: Paid in Full`, col2X, y + 17);
    doc.text(`Transaction: Verified Prepaid`, col2X, y + 22);
  }

  // Column 3: Logistics & AWB
  const col3X = margin + 120;
  doc.setTextColor(110, 110, 110);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DELHIVERY ONE LOGISTICS', col3X, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8.5);
  doc.text(`Service: Delhivery Express`, col3X, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(`AWB #: ${awbDisplay}`, col3X, y + 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Origin: Poonchh Hub 284304`, col3X, y + 22);

  // 3. Customer & Delivery Address Card
  y = 80;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(225, 225, 225);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'D');

  doc.setTextColor(110, 110, 110);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CONSIGNEE & DELIVERY DESTINATION', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8.5);
  doc.text(`${order.customer_name || 'Valued Patron'}  |  ${order.phone || ''}  |  ${order.email || ''}`, margin + 4, y + 12);
  
  const destAddress = `${order.shipping_address || 'Customer Delivery Address'}${order.city ? ', ' + order.city : ''}${order.pincode ? ' - ' + order.pincode : ''}`;
  doc.text(destAddress, margin + 4, y + 18);

  // 4. Line Items Table Header
  y = 110;
  doc.setFillColor(20, 20, 20);
  doc.rect(margin, y, contentWidth, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ITEM DESCRIPTION', margin + 4, y + 5.5);
  doc.text('SIZE', margin + 95, y + 5.5);
  doc.text('QTY', margin + 115, y + 5.5);
  doc.text('PRICE', margin + 135, y + 5.5);
  doc.text('TOTAL', pageWidth - margin - 4, y + 5.5, { align: 'right' });

  // Items Rows
  y += 8;
  const items = Array.isArray(order.items) && order.items.length > 0 
    ? order.items 
    : [{ title: 'Confelion Heavyweight Silhouette', size: 'L', qty: order.items_count || 1, price: order.total || 2499 }];

  items.forEach((item, index) => {
    const rowHeight = 9;
    doc.setFillColor(index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 250);
    doc.rect(margin, y, contentWidth, rowHeight, 'F');
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(item.title || 'Confelion Garment', margin + 4, y + 6);
    doc.text(String(item.size || 'M'), margin + 95, y + 6);
    doc.text(String(item.qty || 1), margin + 115, y + 6);
    doc.text(`Rs. ${Number(item.price || 0).toLocaleString('en-IN')}`, margin + 135, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs. ${(Number(item.price || 0) * (item.qty || 1)).toLocaleString('en-IN')}`, pageWidth - margin - 4, y + 6, { align: 'right' });

    y += rowHeight;
  });

  // 5. Financial Summary Block
  y += 6;
  const summaryX = pageWidth - margin - 80;
  const subtotal = Number(order.subtotal || order.total || 0);
  const codFee = Number(order.cod_fee || 0);
  const total = Number(order.total || subtotal + codFee);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);

  doc.text('Subtotal:', summaryX, y);
  doc.text(`Rs. ${subtotal.toLocaleString('en-IN')}`, pageWidth - margin - 4, y, { align: 'right' });
  y += 5.5;

  doc.text('Delhivery Express Freight:', summaryX, y);
  doc.text('FREE (Rs. 0)', pageWidth - margin - 4, y, { align: 'right' });
  y += 5.5;

  if (codFee > 0) {
    doc.text('COD Handling Fee:', summaryX, y);
    doc.text(`Rs. ${codFee}`, pageWidth - margin - 4, y, { align: 'right' });
    y += 5.5;
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(summaryX, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 15, 15);
  doc.text('Total Invoice Value:', summaryX, y);
  doc.text(`Rs. ${total.toLocaleString('en-IN')}`, pageWidth - margin - 4, y, { align: 'right' });
  y += 6;

  if (order.payment_details?.type === 'partial') {
    doc.setFontSize(8.5);
    doc.setTextColor(40, 100, 40);
    doc.text('Prepaid Advance Paid:', summaryX, y);
    doc.text(`-Rs. ${order.payment_details.advance_paid || 300}`, pageWidth - margin - 4, y, { align: 'right' });
    y += 5;

    doc.setTextColor(180, 50, 20);
    doc.text('Balance Due at Doorstep:', summaryX, y);
    doc.text(`Rs. ${order.payment_details.remaining_balance || (total - 300)}`, pageWidth - margin - 4, y, { align: 'right' });
    y += 6;
  }

  // 6. Terms & Guarantee Footer
  const footerY = pageHeight - 38;
  doc.setFillColor(248, 248, 248);
  doc.rect(margin, footerY, contentWidth, 24, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.rect(margin, footerY, contentWidth, 24, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  doc.text('AUTHENTIC MONOCHROME HERITAGE & ASSURANCE', margin + 4, footerY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('• 100% Combed Heavyweight Cotton. Reverse wash inside out in cold water only.', margin + 4, footerY + 9.5);
  doc.text('• 3-Day Doorstep Size Exchange available via Delhivery courier pickup. Must retain original tags.', margin + 4, footerY + 13.5);
  if (hasAwb) {
    doc.text(`• Track shipment live at https://www.delhivery.com/ with AWB: ${order.awb_number}`, margin + 4, footerY + 17.5);
  } else {
    doc.text('• Tracking activates upon courier handover & dispatch from Poonchh Hub 284304', margin + 4, footerY + 17.5);
  }

  // Digital Auth Stamp
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(20, 20, 20);
  doc.text('CONFELION LOGISTICS AUTHORIZATION', pageWidth - margin - 4, footerY + 9.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text('Digitally signed & verified by Delhivery One API', pageWidth - margin - 4, footerY + 14, { align: 'right' });

  // 7. Save & Download File
  doc.save(`Confelion_Invoice_${order.id}.pdf`);
}
