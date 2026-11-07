import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Order from '../server/src/models/Order.js';
import { connectDatabase } from '../server/src/db.js';

const testSecret = 'isolated-test-secret-with-at-least-32-characters';
process.env.JWT_SECRET = testSecret;

const { default: app } = await import('../server/src/app.js');
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

const createToken = (role) => jwt.sign(
  { id: 'test-user', email: 'test@example.invalid', role },
  testSecret,
  { expiresIn: '5m' }
);

test('health endpoint is available without a database connection', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('database connection requires an explicit URI and does not fall back to localhost', async () => {
  const configuredUri = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  try {
    await assert.rejects(connectDatabase(), /MONGODB_URI must be configured/);
    assert.equal(mongoose.connection.readyState, 0);
  } finally {
    if (configuredUri) process.env.MONGODB_URI = configuredUri;
  }
});

test('new orders receive a server-generated unique display number', async () => {
  const order = new Order({ customer_name: 'Test', total: 0 });
  await order.validate();
  assert.match(order.order_number, /^ORD-[A-Z0-9]+-[A-F0-9]{6}$/);
});

test('order request validation runs before any database operation', async () => {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createToken('staff')}`,
    },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
});

test('invalid idempotency keys are rejected before database access', async () => {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createToken('staff')}`,
      'Idempotency-Key': 'short',
    },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
});

test('registration rejects requests without an administrator token', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'new-staff@example.invalid',
      password: 'strong-test-password',
      name: 'Test Staff',
    }),
  });

  assert.equal(response.status, 401);
});

test('staff tokens cannot register additional users', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createToken('staff')}`,
    },
    body: JSON.stringify({
      email: 'new-staff@example.invalid',
      password: 'strong-test-password',
      name: 'Test Staff',
    }),
  });

  assert.equal(response.status, 403);
});

test('staff tokens cannot create production records', async () => {
  const response = await fetch(`${baseUrl}/api/production/produce`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createToken('staff')}`,
    },
    body: JSON.stringify({ product: '012345678901234567890123', quantity: 1 }),
  });

  assert.equal(response.status, 403);
});

test('staff tokens can confirm an order but cannot bypass order validation', async () => {
  const response = await fetch(`${baseUrl}/api/orders/not-an-object-id/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createToken('staff')}`,
    },
    body: JSON.stringify({ status: 'completed' }),
  });

  assert.equal(response.status, 400);
});

test('protected order routes reject missing or invalid tokens', async () => {
  const missingToken = await fetch(`${baseUrl}/api/orders`);
  const invalidToken = await fetch(`${baseUrl}/api/orders`, {
    headers: { Authorization: 'Bearer invalid-token' },
  });

  assert.equal(missingToken.status, 401);
  assert.equal(invalidToken.status, 401);
});

test('login endpoint rate-limits repeated attempts', async () => {
  const responses = [];
  for (let attempt = 0; attempt < 11; attempt += 1) {
    responses.push(await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
  }

  assert.ok(responses.slice(0, 10).every((response) => response.status === 400));
  assert.equal(responses[10].status, 429);
});
