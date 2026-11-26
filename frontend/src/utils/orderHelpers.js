const CUSTOMER_STORAGE_KEY = 'demoCustomers';

// The tax rate lives in the database (set by the admin in Settings, same on every device).
// This browser keeps a copy of the last rate the server gave it, only so screens have a value before the
// request returns. The server recomputes tax on every order, so this copy is never what is charged.
const TAX_CACHE_KEY = 'serverTaxRate';

export function getTaxRate() {
  try {
    const taxRate = Number(localStorage.getItem(TAX_CACHE_KEY));
    return localStorage.getItem(TAX_CACHE_KEY) !== null && Number.isFinite(taxRate) && taxRate >= 0 ? taxRate : 0;
  } catch {
    return 0;
  }
}

export function cacheTaxRate(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value < 0) return;
  try {
    const changed = String(value) !== localStorage.getItem(TAX_CACHE_KEY);
    localStorage.setItem(TAX_CACHE_KEY, String(value));
    if (changed) window.dispatchEvent(new Event('taxRateChanged'));
  } catch {
    // storage unavailable: the query result still drives the screen
  }
}

export function getDefaultDeliveryFee() {
  try {
    const fee = Number(JSON.parse(localStorage.getItem('appSettings') || '{}').deliveryFeeDefault);
    return Number.isFinite(fee) && fee >= 0 ? fee : 0;
  } catch {
    return 0;
  }
}

export function getStoredCustomers() {
  try {
    const customers = JSON.parse(localStorage.getItem(CUSTOMER_STORAGE_KEY) || '[]');
    return Array.isArray(customers) ? customers : [];
  } catch {
    return [];
  }
}

export function normalizePhone(phone) {
  return String(phone || '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\D/g, '');
}

export function calculateOrderTotals(items, discountPercent, taxRate, deliveryFee = 0) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const safeDiscountPercent = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const discount = subtotal * safeDiscountPercent / 100;
  const taxableSubtotal = subtotal - discount;
  const tax = taxableSubtotal * Math.max(0, Number(taxRate) || 0) / 100;
  const delivery = Number(deliveryFee || 0);

  return {
    subtotal,
    discount,
    tax,
    delivery,
    total: taxableSubtotal + tax + delivery,
  };
}

export function getPaymentMethodLabel(paymentMethod) {
  if (paymentMethod === 'cash') return 'نقد';
  if (paymentMethod === 'card') return 'فيزا';
  if (paymentMethod === 'instapay') return 'انستاباي';
  return String(paymentMethod || '').trim() || 'غير محدد';
}

export function saveOrderCustomer(order) {
  const phone = String(order.customer_phone || '').trim();
  if (!order.customer_name?.trim() || !normalizePhone(phone)) {
    return { pointsEarned: 0, pointsBalance: 0, customer: null };
  }

  const customers = getStoredCustomers();
  const normalizedPhone = normalizePhone(phone);
  const existing = customers.find((customer) => normalizePhone(customer.phone) === normalizedPhone);
  const customer = {
    id: existing?.id || window.crypto.randomUUID(),
    name: order.customer_name.trim(),
    phone,
    address: order.customer_address?.trim() || existing?.address || '',
    notes: existing?.notes || '',
    nextFollowUp: existing?.nextFollowUp || '',
    loyaltyPoints: (Number(existing?.loyaltyPoints) || 0) + 1,
    orderCount: (Number(existing?.orderCount) || 0) + 1,
    totalSpent: (Number(existing?.totalSpent) || 0) + Number(order.total || 0),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  const updatedCustomers = existing
    ? customers.map((item) => item.id === existing.id ? { ...item, ...customer } : item)
    : [customer, ...customers];

  localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(updatedCustomers));
  window.dispatchEvent(new Event('customersUpdated'));
  return { pointsEarned: 1, pointsBalance: customer.loyaltyPoints, customer };
}
