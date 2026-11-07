import { getPaymentMethodLabel } from './orderHelpers';

export function printInvoice(order, targetWindow) {
  if (!order) return false;

  const printWindow = targetWindow && !targetWindow.closed
    ? targetWindow
    : window.open('', '_blank', 'popup,width=420,height=720');
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
  const items = Array.isArray(order.items) ? order.items : [];
  const details = [
    ['العميل', order.customer_name || '-'],
    ['الهاتف', order.customer_phone || '-'],
    ['العنوان', order.customer_address || '-'],
    ['نوع الطلب', order.type === 'delivery' ? 'توصيل' : 'استلام من المطعم'],
    ['طريقة الدفع', getPaymentMethodLabel(order.payment_method)],
  ];
  const detailMarkup = details
    .map(([label, value]) => `<div class="detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join('');
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
    ...(Number(order.tax) > 0 ? [`<div class="total-row"><span>الضريبة</span><strong>${escapeHtml(money(order.tax))}</strong></div>`] : []),
    ...(Number(order.delivery_fee) > 0 ? [`<div class="total-row"><span>رسوم التوصيل</span><strong>${escapeHtml(money(order.delivery_fee))}</strong></div>`] : []),
    `<div class="total-row grand-total"><span>الإجمالي النهائي</span><strong>${escapeHtml(money(order.total))}</strong></div>`,
  ].join('');

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>فاتورة ${escapeHtml(order.order_number || '')}</title>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0 auto;
            padding: 16px;
            width: min(100%, 380px);
            color: #171313;
            background: #f3f4f6;
            font-family: Arial, Tahoma, sans-serif;
            font-size: 13px;
            line-height: 1.55;
          }
          .receipt { background: #fff; padding: 18px; border: 1px solid #e5e7eb; border-radius: 12px; }
          .toolbar { position: sticky; top: 0; z-index: 1; padding: 0 0 12px; text-align: center; }
          .print-button {
            border: 0; border-radius: 8px; padding: 10px 24px; color: #fff;
            background: #b51224; font: 700 15px Arial, Tahoma, sans-serif; cursor: pointer;
          }
          .brand { text-align: center; padding-bottom: 12px; border-bottom: 1px dashed #9ca3af; }
          .brand h1 { margin: 0; font-size: 21px; }
          .brand p { margin: 4px 0 0; color: #4b5563; font-size: 12px; }
          .order-meta { display: flex; justify-content: space-between; gap: 8px; margin: 10px 0; font-size: 12px; }
          .details { padding: 9px 0; border-top: 1px dashed #d1d5db; border-bottom: 1px dashed #d1d5db; }
          .detail { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; }
          .detail span { color: #4b5563; flex: 0 0 68px; }
          .detail strong { text-align: left; overflow-wrap: anywhere; }
          table { width: 100%; margin: 10px 0; border-collapse: collapse; font-size: 11px; }
          th, td { padding: 6px 3px; border-bottom: 1px solid #e5e7eb; text-align: center; }
          th { color: #4b5563; font-size: 10px; }
          .item-name { text-align: right; overflow-wrap: anywhere; }
          .item-total { font-weight: 700; white-space: nowrap; }
          .total-row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; }
          .grand-total { margin-top: 6px; padding-top: 8px; border-top: 1px solid #9ca3af; font-size: 15px; font-weight: 700; }
          .notes { margin-top: 10px; padding: 8px; border-radius: 6px; background: #f3f4f6; overflow-wrap: anywhere; }
          .thanks { margin-top: 14px; padding-top: 10px; border-top: 1px dashed #9ca3af; text-align: center; font-weight: 700; }
          @media print {
            html, body { width: 74mm; margin: 0; padding: 0; background: #fff; }
            body { font-size: 11px; }
            .receipt { padding: 0; border: 0; border-radius: 0; }
            .toolbar { display: none !important; }
            .brand h1 { font-size: 17px; }
            table { font-size: 10px; }
            tr, .detail, .total-row { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar"><button class="print-button" type="button" onclick="window.print()">طباعة الفاتورة</button></div>
        <main class="receipt">
          <header class="brand"><h1>فروج باشا</h1><p>فاتورة طلب</p></header>
          <div class="order-meta">
            <strong>رقم الطلب: ${escapeHtml(order.order_number || '-')}</strong>
            <span>${escapeHtml(date.toLocaleString('ar-EG'))}</span>
          </div>
          <section class="details">${detailMarkup}</section>
          <table>
            <thead><tr><th>الصنف</th><th>كمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
            <tbody>${itemMarkup}</tbody>
          </table>
          <section class="totals">${totalsMarkup}</section>
          ${order.notes ? `<div class="notes"><strong>ملاحظات:</strong> ${escapeHtml(order.notes)}</div>` : ''}
          <footer class="thanks">شكراً لطلبكم من فروج باشا</footer>
        </main>
        <script>window.addEventListener('load', () => { window.focus(); window.setTimeout(() => window.print(), 350); }, { once: true });</script>
      </body>
    </html>`);
  printWindow.document.close();
  return true;
}
