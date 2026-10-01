import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";
import QRCode from "qrcode";

type InvoiceData = {
  invoiceId: string;
  orderRef: string;
  orderDate: string;
  paymentMethod: string;
  paymentStatus: string;
  currency: string;
  orderUrl: string;
  customer: { name: string; email: string; phone: string };
  site: {
    SITE_NAME: string;
    SITE_WEBSITE: string;
    SITE_EMAIL: string;
    SITE_PHONE: string;
    SITE_ADDRESS: string;
  };
  items: { name: string; sku: string; quantity: number; price: number }[];
  subtotal: number;
  delivery: number;
  tax: number;
  discount: number;
  couponCode?: string | null;
  grandTotal: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 38;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
// Keep all flowing content above the footer, on every page.
const CONTENT_BOTTOM = 78;
const INK = rgb(0.1, 0.15, 0.23);
const MUTED = rgb(0.38, 0.43, 0.5);
const BORDER = rgb(0.85, 0.88, 0.92);
const PALE = rgb(0.96, 0.97, 0.99);
const WHITE = rgb(1, 1, 1);

export async function createInvoicePdf(data: InvoiceData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`Invoice ${data.invoiceId}`);
  pdf.setAuthor(data.site.SITE_NAME);
  pdf.setSubject(`Order ${data.orderRef}`);

  const qr = await pdf.embedPng(await QRCode.toBuffer(data.orderUrl, {
    errorCorrectionLevel: "M", margin: 1, width: 256,
  }));
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursor = PAGE_HEIGHT - MARGIN;

  const text = (value: string, x: number, y: number, size = 9,
    strong = false, color: RGB = INK) => {
    page.drawText(value, { x, y, size, font: strong ? bold : regular, color });
  };
  const rightText = (value: string, right: number, y: number, size = 9,
    strong = false, color: RGB = INK) => {
    const font = strong ? bold : regular;
    text(value, right - font.widthOfTextAtSize(value, size), y, size, strong, color);
  };
  const rule = (y: number) => page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.6, color: BORDER,
  });
  const box = (top: number, height: number, fill = WHITE) => {
    page.drawRectangle({ x: MARGIN, y: top - height, width: CONTENT_WIDTH,
      height, color: fill, borderColor: BORDER, borderWidth: 0.5 });
  };
  // Split long unbroken values as well as ordinary words (especially SKUs).
  const wrap = (value: string, width: number, size = 9, strong = false) => {
    const font = strong ? bold : regular;
    const result: string[] = [];
    let current = "";
    for (const word of (value.trim() || "—").split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) result.push(current);
      current = "";
      for (const character of word) {
        if (current && font.widthOfTextAtSize(current + character, size) > width) {
          result.push(current);
          current = "";
        }
        current += character;
      }
    }
    if (current) result.push(current);
    return result;
  };
  const lines = (values: string[], x: number, y: number, size = 9,
    strong = false, color = INK, lineHeight = 12) => {
    values.forEach((value, index) => text(value, x, y - index * lineHeight, size, strong, color));
  };
  const amount = (value: number) => value.toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    lines(wrap(data.site.SITE_NAME, CONTENT_WIDTH * 0.55, 11, true),
      MARGIN, PAGE_HEIGHT - MARGIN, 11, true);
    rightText(`INVOICE ${data.invoiceId}`, PAGE_WIDTH - MARGIN,
      PAGE_HEIGHT - MARGIN, 9, true);
    rightText(`Order ${data.orderRef}  |  ${data.orderDate}`, PAGE_WIDTH - MARGIN,
      PAGE_HEIGHT - MARGIN - 15, 8, false, MUTED);
    const brandHeight = wrap(data.site.SITE_NAME, CONTENT_WIDTH * 0.55, 11, true).length * 12;
    cursor = PAGE_HEIGHT - MARGIN - Math.max(brandHeight, 28) - 12;
    rule(cursor);
    cursor -= 22;
  };
  const ensureSpace = (height: number) => {
    if (cursor - height < CONTENT_BOTTOM) newPage();
  };
  const section = (title: string) => {
    text(title, MARGIN, cursor, 11, true);
    cursor -= 18;
  };

  const brand = wrap(data.site.SITE_NAME, 310, 20, true);
  lines(brand, MARGIN, cursor, 20, true, INK, 24);
  // Larger branding needs a larger line height than body text.
  cursor -= (brand.length - 1) * 24 + 28;
  lines(wrap(data.site.SITE_WEBSITE, 310, 9), MARGIN, cursor, 9, false, MUTED);
  rightText("INVOICE", PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN, 22, true);
  rightText(data.invoiceId, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 22, 9, true);
  cursor -= wrap(data.site.SITE_WEBSITE, 310, 9).length * 12 + 14;
  rule(cursor);
  cursor -= 22;

  const detailsTop = cursor;
  for (const value of [data.site.SITE_ADDRESS, data.site.SITE_EMAIL, data.site.SITE_PHONE]) {
    const wrapped = wrap(value, 280, 9);
    lines(wrapped, MARGIN, cursor, 9, false, MUTED);
    cursor -= wrapped.length * 12 + 3;
  }
  const metadata = [
    `Order: ${data.orderRef}`, `Date: ${data.orderDate}`,
    `Payment: ${data.paymentMethod}`, `Status: ${data.paymentStatus}`,
  ].flatMap(value => wrap(value, 195, 9));
  metadata.forEach((value, index) => rightText(value, PAGE_WIDTH - MARGIN,
    detailsTop - index * 12, 9, false, MUTED));
  const qrTop = detailsTop - metadata.length * 12 - 8;
  page.drawImage(qr, { x: PAGE_WIDTH - MARGIN - 56, y: qrTop - 56, width: 56, height: 56 });
  rightText("Scan to view order", PAGE_WIDTH - MARGIN, qrTop - 68, 7, false, MUTED);
  cursor = Math.min(cursor, qrTop - 68) - 24;

  const customerWidths = [CONTENT_WIDTH * 0.34, CONTENT_WIDTH * 0.4, CONTENT_WIDTH * 0.26];
  const customerValues = [data.customer.name, data.customer.email, data.customer.phone]
    .map((value, index) => wrap(value, customerWidths[index] - 20));
  const customerHeight = Math.max(...customerValues.map(value => value.length)) * 12 + 16;
  ensureSpace(18 + 23 + customerHeight + 24);
  section("Bill to");
  box(cursor, 23, PALE);
  let customerX = MARGIN;
  ["Customer", "Email address", "Contact number"].forEach((label, index) => {
    text(label, customerX + 10, cursor - 15, 8, true, MUTED);
    customerX += customerWidths[index];
  });
  cursor -= 23;
  box(cursor, customerHeight);
  customerX = MARGIN;
  customerValues.forEach((value, index) => {
    lines(value, customerX + 10, cursor - 16);
    customerX += customerWidths[index];
  });
  cursor -= customerHeight + 24;

  const widths = [215, 92, 36, 88, CONTENT_WIDTH - 431];
  const positions = widths.map((_, index) => MARGIN + widths.slice(0, index).reduce((a, b) => a + b, 0));
  const itemHeader = (continued = false) => {
    section(continued ? "Order items · continued" : `Order items (${data.items.length})`);
    box(cursor, 32, INK);
    ["Product", "SKU", "Qty", "Unit price", "Line total"].forEach((label, index) => {
      text(label, positions[index] + 8, cursor - 13, 8, true, WHITE);
      if (index >= 3) text(data.currency, positions[index] + 8, cursor - 25, 7, false, WHITE);
    });
    cursor -= 32;
  };
  ensureSpace(50 + 28);
  itemHeader();
  data.items.forEach((item, itemIndex) => {
    const cells = [item.name, item.sku, String(item.quantity), amount(item.price), amount(item.price * item.quantity)]
      .map((value, index) => wrap(value, widths[index] - 16, index === 1 ? 8 : 9));
    const count = Math.max(...cells.map(value => value.length));
    const rowHeight = Math.max(28, count * 12 + 16);
    // Ordinary rows move intact. An exceptionally long row can continue over pages.
    if (cursor - rowHeight < CONTENT_BOTTOM) {
      newPage();
      itemHeader(true);
    }
    let offset = 0;
    while (offset < count) {
      const capacity = Math.floor((cursor - CONTENT_BOTTOM - 16) / 12);
      if (capacity < 1) {
        newPage();
        itemHeader(true);
        continue;
      }
      const length = Math.min(count - offset, capacity);
      const height = Math.max(28, length * 12 + 16);
      box(cursor, height, itemIndex % 2 ? PALE : WHITE);
      cells.forEach((values, index) => {
        values.slice(offset, offset + length).forEach((value, lineIndex) => {
          const y = cursor - 17 - lineIndex * 12;
          if (index >= 2) rightText(value, positions[index] + widths[index] - 8, y, 9);
          else text(value, positions[index] + 8, y, index === 1 ? 8 : 9,
            false, index === 1 ? MUTED : INK);
        });
      });
      cursor -= height;
      offset += length;
      if (offset < count) {
        newPage();
        itemHeader(true);
      }
    }
  });
  if (!data.items.length) {
    box(cursor, 28);
    text("No items found", MARGIN + 8, cursor - 18, 9, false, MUTED);
    cursor -= 28;
  }

  const summary = [
    { label: "Items subtotal", value: data.subtotal },
    { label: "Delivery", value: data.delivery },
    { label: "Tax", value: data.tax },
    ...(data.discount > 0 ? [{ label: data.couponCode ? `Discount (${data.couponCode})` : "Discount", value: -data.discount }] : []),
  ].map(row => ({ ...row, wrapped: wrap(row.label, CONTENT_WIDTH - 170, 9) }));
  const summaryHeight = summary.reduce((sum, row) => sum + Math.max(26, row.wrapped.length * 12 + 14), 0);
  // Move the complete payment summary and grand total together to a fresh page.
  ensureSpace(24 + 18 + summaryHeight + 38 + 28);
  cursor -= 24;
  section("Payment summary");
  for (const row of summary) {
    const height = Math.max(26, row.wrapped.length * 12 + 14);
    box(cursor, height);
    lines(row.wrapped, MARGIN + 10, cursor - 17, 9, false, MUTED);
    rightText(amount(row.value), PAGE_WIDTH - MARGIN - 10, cursor - 17, 9);
    cursor -= height;
  }
  box(cursor, 38, INK);
  text(`TOTAL (${data.currency})`, MARGIN + 10, cursor - 24, 11, true, WHITE);
  rightText(amount(data.grandTotal), PAGE_WIDTH - MARGIN - 10, cursor - 24, 13, true, WHITE);
  cursor -= 56;
  text("Thank you for your order.", MARGIN, cursor, 9, false, MUTED);

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    page = current;
    rule(58);
    const footer = wrap(`${data.site.SITE_NAME} · ${data.site.SITE_EMAIL}`, CONTENT_WIDTH - 110, 7.5);
    lines(footer.slice(0, 2), MARGIN, 44, 7.5, false, MUTED);
    rightText(`Page ${index + 1} of ${pages.length}`, PAGE_WIDTH - MARGIN, 44, 8, false, MUTED);
    text(data.invoiceId, MARGIN, 18, 7, false, MUTED);
  });
  return pdf.save();
}
