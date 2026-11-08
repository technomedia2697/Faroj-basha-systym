import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { printInvoice } from '../src/utils/printInvoice.js';

test('printInvoice opens a regular tab with paper controls and a CSP-safe print handler', () => {
  let writtenDocument = '';
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
  assert.match(writtenDocument, /حراري 58 مم/);
  assert.match(writtenDocument, /حراري 80 مم/);
  assert.match(writtenDocument, /A4/);
  assert.match(writtenDocument, /حسب إعدادات الطابعة/);
  assert.match(writtenDocument, /src="\/print-invoice-window\.js"/);
  assert.doesNotMatch(writtenDocument, /onclick=/);
  assert.match(writtenDocument, /طباعة \/ اختيار الطابعة/);
  assert.match(writtenDocument, /&lt;Customer&gt;/);
  assert.equal(focused, true);
});

test('print dialog handler uses a direct click and supports each paper size', async () => {
  const handler = await readFile(new URL('../public/print-invoice-window.js', import.meta.url), 'utf8');
  const control = (properties = {}) => ({
    listeners: {},
    addEventListener(type, callback) {
      this.listeners[type] = callback;
    },
    ...properties,
  });
  const elements = new Map([
    ['paper-size', control({ value: '80mm' })],
    ['print-page-size', control({ textContent: '' })],
    ['print-invoice', control()],
    ['print-status', control({ textContent: '' })],
  ]);
  const body = { dataset: {} };
  let printCalls = 0;
  runInNewContext(handler, {
    document: {
      body,
      getElementById: (id) => elements.get(id),
    },
    window: {
      focus() {},
      print() {
        printCalls += 1;
      },
    },
    console,
  });

  assert.match(handler, /printButton\.addEventListener\('click'/);
  assert.match(handler, /window\.print\(\)/);
  assert.match(handler, /58mm auto/);
  assert.match(handler, /80mm auto/);
  assert.match(handler, /A4 portrait/);
  assert.match(handler, /size: auto/);
  assert.equal(elements.get('print-page-size').textContent, '@page { size: 80mm auto; margin: 3mm; }');
  assert.equal(body.dataset.paperSize, '80mm');

  elements.get('paper-size').value = '58mm';
  elements.get('paper-size').listeners.change();
  assert.equal(elements.get('print-page-size').textContent, '@page { size: 58mm auto; margin: 2mm; }');
  assert.equal(body.dataset.paperSize, '58mm');

  elements.get('paper-size').value = 'a4';
  elements.get('paper-size').listeners.change();
  assert.equal(elements.get('print-page-size').textContent, '@page { size: A4 portrait; margin: 8mm; }');
  assert.equal(body.dataset.paperSize, 'a4');

  elements.get('paper-size').value = 'printer';
  elements.get('paper-size').listeners.change();
  assert.equal(body.dataset.paperSize, 'printer');
  elements.get('print-invoice').listeners.click();
  assert.equal(printCalls, 1);
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
