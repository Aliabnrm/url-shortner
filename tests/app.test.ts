import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/error-handler.js';

test('GET /health returns a successful JSON response', async () => {
  const response = await request(createApp())
    .get('/health')
    .expect('Content-Type', /json/)
    .expect('Cache-Control', 'no-store')
    .expect(200);

  assert.deepEqual(response.body, { status: 'ok' });
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('an unknown route returns the JSON error contract', async () => {
  const response = await request(createApp())
    .get('/missing')
    .expect('Content-Type', /json/)
    .expect(404);

  assert.deepEqual(response.body, {
    error: { code: 'NOT_FOUND', message: 'Route not found.' },
  });
});

test('POST /health does not match the GET route', async () => {
  await request(createApp()).post('/health').expect(404);
});

test('HEAD /health returns headers without a response body', async () => {
  const response = await request(createApp()).head('/health').expect(200);
  assert.equal(response.text, undefined);
});

test('an unexpected async failure returns 500 without exposing details', async (t) => {
  const app = express();
  const internalError = new Error(
    'Sensitive internal database connection detail',
  );
  const errorLog = t.mock.method(console, 'error', () => {});

  app.get('/failure', async () => {
    throw internalError;
  });
  app.use(errorHandler);

  const response = await request(app)
    .get('/failure')
    .expect('Content-Type', /json/)
    .expect(500);

  assert.deepEqual(response.body, {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
  assert.equal(
    JSON.stringify(response.body).includes(internalError.message),
    false,
  );
  assert.equal(errorLog.mock.callCount(), 1);
  assert.equal(errorLog.mock.calls[0]?.arguments[1], internalError);
});
