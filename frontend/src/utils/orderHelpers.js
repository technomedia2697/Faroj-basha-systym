const CUSTOMER_STORAGE_KEY = 'demoCustomers';

export function getTaxRate() {
  try {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const taxRate = Number(settings.taxRate);
    return Number.isFinite(taxRate) && taxRate >= 0 ? taxRate : 14;
  } catch {
    return 14;
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
  const discount = subtotal * Number(discountPercent || 0) / 100;
  const taxableSubtotal = subtotal - discount;
  const tax = taxableSubtotal * Number(taxRate || 0) / 100;
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
