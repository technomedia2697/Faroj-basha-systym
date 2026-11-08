import assert from 'node:assert/strict';
import { test } from 'node:test';
import { printInvoice } from '../src/utils/printInvoice.js';

test('printInvoice opens a regular tab with a manual print button and schedules printing', () => {
  let writtenDocument = '';
  let scheduledDelay;
  let printed = false;
  let focused = false;
  let openedUrl;
  const printWindow = {
    closed: false,
    document: {
      open() {},
      write(content) {
        writtenDocument = content;
      },
      close() {},
    },
    focus() {
      focused = true;
    },
    print() {
      printed = true;
    },
    setTimeout(callback, delay) {
      scheduledDelay = delay;
      callback();
    },
  };
  globalThis.window = {
    open(url, target) {
      openedUrl = { url, target };
      return printWindow;
    },
  };

  assert.equal(printInvoice({
    order_number: 'A-1',
    customer_name: '<Customer>',
    items: [],
    subtotal: 0,
    total: 0,
  }), true);
  assert.deepEqual(openedUrl, { url: '', target: '_blank' });
  assert.match(writtenDocument, /طباعة الفاتورة/);
  assert.match(writtenDocument, /&lt;Customer&gt;/);
  assert.equal(scheduledDelay, 500);
  assert.equal(focused, true);
  assert.equal(printed, true);
});

test('printInvoice uses the pre-opened tab and reports when popups are blocked', () => {
  let opened = false;
  globalThis.window = {
    open() {
      opened = true;
      return null;
    },
  };

  assert.equal(printInvoice({ order_number: 'A-2', items: [] }), false);
  assert.equal(opened, true);
});
