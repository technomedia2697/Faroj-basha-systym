// Order numbers restart at 1 every Cairo day, so a number is only meaningful together with its day.
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });

export const cairoToday = () => fmt.format(new Date());

export function orderDay(order) {
  if (order?.order_day) return order.order_day;
  const raw = order?.createdAt || order?.created_at;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? fmt.format(date) : '';
}

// Lower-cased text the order search matches against: "2026-11-26 #5 5".
export const orderRefText = (order) => `${orderDay(order)} #${order?.order_number} ${order?.order_number}`.toLowerCase();
