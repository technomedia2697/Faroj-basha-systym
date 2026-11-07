import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { calculateOrderTotals, getDefaultDeliveryFee, getPaymentMethodLabel, getTaxRate, normalizePhone, saveOrderCustomer } from '../src/utils/orderHelpers.js';
import Order from '../server/src/models/Order.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
};
globalThis.window = {
  crypto: { randomUUID: () => 'new-customer-id' },
  dispatchEvent: () => {},
};

beforeEach(() => storage.clear());

test('a configured zero tax rate stays zero', () => {
  storage.set('appSettings', JSON.stringify({ taxRate: 0 }));
  assert.equal(getTaxRate(), 0);
});

test('default delivery fee and totals use the same percentage calculations', () => {
  storage.set('appSettings', JSON.stringify({ deliveryFeeDefault: 15 }));
  assert.equal(getDefaultDeliveryFee(), 15);
  assert.deepEqual(calculateOrderTotals([{ price: 100, quantity: 2 }], 10, 0, getDefaultDeliveryFee()), {
    subtotal: 200,
    discount: 20,
    tax: 0,
    delivery: 15,
    total: 195,
  });
});

test('payment methods keep preset names and arbitrary manual labels', async () => {
  assert.equal(getPaymentMethodLabel('cash'), 'نقد');
  assert.equal(getPaymentMethodLabel('card'), 'فيزا');
  assert.equal(getPaymentMethodLabel('instapay'), 'انستاباي');
  assert.equal(getPaymentMethodLabel('محفظة إلكترونية'), 'محفظة إلكترونية');

  const order = new Order({ customer_name: 'Test', total: 0, payment_method: 'محفظة إلكترونية' });
  await order.validate();
  assert.equal(order.payment_method, 'محفظة إلكترونية');

  const invalidOrder = new Order({ customer_name: 'Test', total: 0, payment_method: 'x'.repeat(81) });
  await assert.rejects(invalidOrder.validate(), /payment_method/);
});

test('phone normalization handles Arabic numerals and formatting', () => {
  assert.equal(normalizePhone('+٢٠ ١٢٣-٤٥٦'), '20123456');
});

test('saving an order updates the customer with the same normalized phone', () => {
  storage.set('demoCustomers', JSON.stringify([{
    id: 'existing-id',
    name: 'Customer',
    phone: '0123 456',
    address: 'Old address',
    notes: 'Keep this note',
    nextFollowUp: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  }]));

  const firstReward = saveOrderCustomer({
    customer_name: 'Updated customer',
    customer_phone: '٠١٢٣٤٥٦',
    customer_address: 'New address',
  });
  const secondReward = saveOrderCustomer({
    customer_name: 'Updated customer',
    customer_phone: '٠١٢٣٤٥٦',
  });

  const customers = JSON.parse(storage.get('demoCustomers'));
  assert.equal(customers.length, 1);
  assert.equal(customers[0].id, 'existing-id');
  assert.equal(customers[0].name, 'Updated customer');
  assert.equal(customers[0].address, 'New address');
  assert.equal(customers[0].notes, 'Keep this note');
  assert.equal(firstReward.pointsEarned, 1);
  assert.equal(secondReward.pointsBalance, 2);
  assert.equal(customers[0].loyaltyPoints, 2);
});
