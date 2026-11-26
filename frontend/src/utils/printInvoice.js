import { getPaymentMethodLabel } from './orderHelpers.js';

export function printInvoice(order, targetWindow) {
  if (!order) return false;

  const printWindow = targetWindow && !targetWindow.closed
    ? targetWindow
    : window.open('', '_blank');
  if (!printWindow) return false;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
  const money = (value) => `${Number(value || 0).toFixed(2)} ج.م`;
  const date = new Date(order.createdAt || order.created_at || Date.now());
  const dateText = date.toLocaleString('en-GB', { hour12: false }).replace(',', '');
  const items = Array.isArray(order.items) ? order.items : [];
  const orderNumber = String(order.order_number || '-');
  const typeLabel = order.type === 'delivery' ? 'توصيل' : order.type === 'table' ? 'طاولة' : 'استلام من المطعم';
  const tableLabel = order.type === 'table' && order.table_number
    ? `${order.table_number}${order.table_section ? ` - ${order.table_section}` : ''}`
    : '';

  const detailRow = ([label, value]) =>
    `<div class="detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;

  // Customer receipt: prices and totals.
  const customerDetails = [
    ['العميل', order.customer_name || '-'],
    ['الهاتف', order.customer_phone || '-'],
    ['العنوان', order.customer_address || '-'],
    ['نوع الطلب', typeLabel],
    ...(tableLabel ? [['الطاولة', tableLabel]] : []),
    ['طريقة الدفع', getPaymentMethodLabel(order.payment_method)],
  ].map(detailRow).join('');
  const itemMarkup = items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    return `<tr>
      <td class="item-name">${escapeHtml(item.product_name || 'منتج')}</td>
      <td>${escapeHtml(quantity)}</td>
      <td>${escapeHtml(money(price))}</td>
      <td class="item-total">${escapeHtml(money(price * quantity))}</td>
    </tr>`;
  }).join('');
  const totalsMarkup = [
    `<div class="total-row"><span>الإجمالي الفرعي</span><strong>${escapeHtml(money(order.subtotal))}</strong></div>`,
    ...(Number(order.discount) > 0 ? [`<div class="total-row"><span>الخصم</span><strong>-${escapeHtml(money(order.discount))}</strong></div>`] : []),
    ...(Number(order.tax) > 0 ? [`<div class="total-row"><span>${escapeHtml(order.tax_rate != null && order.tax_rate !== '' ? `الضريبة (${order.tax_rate}%)` : 'الضريبة')}</span><strong>${escapeHtml(money(order.tax))}</strong></div>`] : []),
    ...(Number(order.delivery_fee) > 0 ? [`<div class="total-row"><span>رسوم التوصيل</span><strong>${escapeHtml(money(order.delivery_fee))}</strong></div>`] : []),
    `<div class="total-row grand-total"><span>الإجمالي النهائي</span><strong>${escapeHtml(money(order.total))}</strong></div>`,
  ].join('');

  // Kitchen receipt: every order detail, no prices or totals.
  const kitchenDetails = [
    ['نوع الطلب', typeLabel],
    ...(tableLabel ? [['الطاولة', tableLabel]] : []),
    ['العميل', order.customer_name || '-'],
    ...(order.customer_phone ? [['الهاتف', order.customer_phone]] : []),
    ...(order.type === 'delivery' || order.customer_address ? [['العنوان', order.customer_address || '-']] : []),
    ['الوقت', dateText],
  ].map(detailRow).join('');
  const kitchenItems = items.map((item) =>
    `<tr><td class="kitchen-qty">${escapeHtml(Number(item.quantity || 0))} x</td><td class="item-name kitchen-name">${escapeHtml(item.product_name || 'منتج')}</td></tr>`
  ).join('');
  const notesMarkup = order.notes ? `<div class="notes"><strong>ملاحظات:</strong> ${escapeHtml(order.notes)}</div>` : '';
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>فاتورة ${escapeHtml(orderNumber)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0 auto;
            padding: 16px;
            width: min(100%, 380px);
            color: #000;
            background: #f3f4f6;
            font-family: Tahoma, Arial, sans-serif;
            font-size: 14px;
            font-weight: 600;
            line-height: 1.5;
          }
          .receipt { background: #fff; padding: 14px; margin-bottom: 16px; border: 1px solid #d1d5db; }
          .toolbar {
            position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap;
            align-items: center; justify-content: center; gap: 10px; padding: 12px;
            margin: -16px -16px 16px; background: #fff; border-bottom: 1px solid #e5e7eb;
          }
          .toolbar label { display: flex; align-items: center; gap: 8px; font-weight: 700; }
          .toolbar select, .print-button {
            border: 0; border-radius: 8px; padding: 10px 24px; color: #fff;
            background: #374151; font: 700 14px Tahoma, Arial, sans-serif; cursor: pointer;
          }
          .toolbar select { color: #171313; background: #f3f4f6; border: 1px solid #d1d5db; }
          .print-button { background: #b51224; }
          .print-hint { flex-basis: 100%; margin: 0; color: #4b5563; text-align: center; font-size: 12px; font-weight: 400; }
          /* Thermal friendly: pure black on white, no grays, no backgrounds, bold text. */
          @media print {
            html, body { margin: 0; padding: 0; background: #fff; }
            body { font-size: 13px; font-weight: 700; }
            .receipt { padding: 0; margin: 0; border: 0; }
            .toolbar { display: none !important; }
            .receipt + .receipt { break-before: page; page-break-before: always; }
            .brand h1 { font-size: 20px; }
            table { font-size: 12px; }
            tr, .detail, .total-row { break-inside: avoid; }
            body[data-copies="customer"] .receipt-kitchen { display: none; }
            body[data-copies="kitchen"] .receipt-customer { display: none; }
            body[data-copies="customer"] .receipt-customer,
            body[data-copies="kitchen"] .receipt-kitchen { break-before: auto; page-break-before: auto; }
          }
          body[data-copies="customer"] .receipt-kitchen { display: none; }
          body[data-copies="kitchen"] .receipt-customer { display: none; }
          @media print {
            body[data-paper-size="58mm"] { width: 54mm; }
            body[data-paper-size="80mm"] { width: 74mm; }
            body[data-paper-size="a4"] { width: 190mm; }
            body[data-paper-size="printer"] { width: auto; }
          }
          .brand { text-align: center; padding-bottom: 10px; border-bottom: 2px dashed #000; }
          .brand h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .brand p { margin: 4px 0 0; font-size: 14px; font-weight: 700; }
          .order-meta { margin: 4px 0 8px; text-align: center; font-size: 13px; }
          .order-number { text-align: center; margin: 8px 0 0; font-size: 26px; font-weight: 800; overflow-wrap: anywhere; }
          .details { padding: 8px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
          .detail { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; }
          .detail span { flex: 0 0 64px; }
          .detail strong { text-align: left; overflow-wrap: anywhere; font-weight: 800; }
          table { width: 100%; margin: 8px 0; border-collapse: collapse; font-size: 13px; }
          th, td { padding: 5px 2px; border-bottom: 1px solid #000; text-align: center; }
          th { font-size: 12px; font-weight: 800; border-bottom: 2px solid #000; }
          .item-name { text-align: right; overflow-wrap: anywhere; }
          .item-total { font-weight: 800; white-space: nowrap; }
          .kitchen-qty { width: 16%; font-size: 18px; font-weight: 800; white-space: nowrap; }
          .kitchen-name { font-size: 16px; font-weight: 800; }
          .total-row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; }
          .grand-total { margin-top: 6px; padding-top: 6px; border-top: 2px solid #000; font-size: 16px; font-weight: 800; }
          .notes { margin-top: 8px; padding: 6px; border: 2px solid #000; overflow-wrap: anywhere; font-weight: 800; }
          .thanks { margin-top: 12px; padding-top: 8px; border-top: 2px dashed #000; text-align: center; font-weight: 800; }
          .kitchen-count { margin-top: 6px; text-align: center; font-size: 14px; font-weight: 800; }
        </style>
        <style id="print-page-size">@page { size: 80mm auto; margin: 3mm; }</style>
      </head>
      <body data-copies="both">
        <div class="toolbar">
          <label for="paper-size">مقاس الورق
            <select id="paper-size">
              <option value="80mm">حراري 80 مم</option>
              <option value="58mm">حراري 58 مم</option>
              <option value="a4">A4</option>
              <option value="printer">حسب إعدادات الطابعة</option>
            </select>
          </label>
          <label for="copies">النسخ
            <select id="copies">
              <option value="both">فاتورة العميل + إيصال المطبخ</option>
              <option value="customer">فاتورة العميل فقط</option>
              <option value="kitchen">إيصال المطبخ فقط</option>
            </select>
          </label>
          <button class="print-button" id="print-invoice" type="button">طباعة / اختيار الطابعة</button>
          <p class="print-hint" id="print-status" aria-live="polite">اختر المقاس، ثم حدد الطابعة وإعداداتها من نافذة الطباعة. تُطبع نسخة العميل ثم إيصال المطبخ.</p>
        </div>
        <main class="receipt receipt-customer">
          <header class="brand"><h1>فروج باشا</h1><p>فاتورة طلب</p></header>
          <div class="order-number">فاتورة رقم ${escapeHtml(orderNumber)}</div>
          <div class="order-meta"><span dir="ltr">${escapeHtml(dateText)}</span></div>
          <section class="details">${customerDetails}</section>
          <table>
            <thead><tr><th>الصنف</th><th>كمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
            <tbody>${itemMarkup}</tbody>
          </table>
          <section class="totals">${totalsMarkup}</section>
          ${notesMarkup}
          <footer class="thanks">شكراً لطلبكم من فروج باشا</footer>
        </main>
        <main class="receipt receipt-kitchen">
          <header class="brand"><h1>إيصال المطبخ</h1><p>فروج باشا</p></header>
          <div class="order-number">طلب رقم ${escapeHtml(orderNumber)}</div>
          <section class="details">${kitchenDetails}</section>
          <table>
            <thead><tr><th>الكمية</th><th class="item-name">الصنف</th></tr></thead>
            <tbody>${kitchenItems}</tbody>
          </table>
          <div class="kitchen-count">إجمالي القطع: ${escapeHtml(totalQuantity)}</div>
          ${notesMarkup}
        </main>
        <script src="/print-invoice-window.js"></script>
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  return true;
}
