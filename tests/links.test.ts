import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('create a link, then redirect to its full destination', async () => {
  const app = createApp();
  const originalUrl = 'https://example.com/articles/backend?source=test#intro';
  const created = await request(app)
    .post('/api/urls')
    .send({ url: originalUrl })
    .expect('Content-Type', /json/)
    .expect(201);

  assert.match(created.body.shortCode, /^[A-Za-z0-9_-]{8}$/);
  assert.equal(created.body.originalUrl, originalUrl);
  assert.equal(
    created.body.shortUrl,
    `http://127.0.0.1:3000/${created.body.shortCode}`,
  );
  assert.equal(created.headers.location, created.body.shortUrl);

  await request(app)
    .get(`/${created.body.shortCode}`)
    .expect(302)
    .expect('Location', originalUrl)
    .expect('Cache-Control', 'no-store');
});

test('the configured origin is used instead of an untrusted Host header', async () => {
  const app = createApp({ publicBaseUrl: 'https://short.example.com' });
  const response = await request(app)
    .post('/api/urls')
    .set('Host', 'attacker.example')
    .send({ url: 'https://example.com' })
    .expect(201);

  assert.equal(
    response.body.shortUrl,
    `https://short.example.com/${response.body.shortCode}`,
  );
  assert.equal(response.body.originalUrl, 'https://example.com/');
});

test('outer whitespace is trimmed and HTTP URLs are accepted', async () => {
  const response = await request(createApp())
    .post('/api/urls')
    .send({ url: '  http://example.com  ' })
    .expect(201);
  assert.equal(response.body.originalUrl, 'http://example.com/');
});

for (const [label, body] of [
  ['missing url', {}],
  ['numeric url', { url: 123 }],
  ['null url', { url: null }],
  ['array body', [{ url: 'https://example.com' }]],
  ['empty url', { url: '  ' }],
  ['invalid url', { url: 'not a url' }],
  ['relative url', { url: '/articles/backend' }],
  ['missing scheme separators', { url: 'https:example.com' }],
  ['script URL', { url: 'javascript:alert(1)' }],
  ['file URL', { url: 'file:///etc/passwd' }],
  ['embedded credentials', { url: 'https://user:password@example.com' }],
  ['embedded control character', { url: 'https://exam\nple.com' }],
  ['oversized URL', { url: `https://example.com/${'a'.repeat(2048)}` }],
] as const) {
  test(`${label} returns a structured validation error`, async () => {
    const response = await request(createApp())
      .post('/api/urls')
      .send(body)
      .expect('Content-Type', /json/)
      .expect(400);

    assert.equal(response.body.error.code, 'INVALID_INPUT');
    assert.equal(typeof response.body.error.message, 'string');
  });
}

test('an absent JSON body returns a validation error', async () => {
  const response = await request(createApp())
    .post('/api/urls')
    .set('Content-Type', 'application/json')
    .expect(400);
  assert.equal(response.body.error.code, 'INVALID_INPUT');
});

test('malformed JSON returns 400 without echoing its contents', async () => {
  const response = await request(createApp())
    .post('/api/urls')
    .set('Content-Type', 'application/json')
    .send('{"url":"private-input"')
    .expect(400);

  assert.deepEqual(response.body, {
    error: {
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON.',
    },
  });
});

test('a body larger than 8 KiB returns 413', async () => {
  const response = await request(createApp())
    .post('/api/urls')
    .send({ url: `https://example.com/${'a'.repeat(9 * 1024)}` })
    .expect(413);
  assert.equal(response.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('a non-JSON content type returns 415', async () => {
  const response = await request(createApp())
    .post('/api/urls')
    .type('text/plain')
    .send('{"url":"https://example.com"}')
    .expect(415);
  assert.equal(response.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('compressed bodies are explicitly rejected', async () => {
  const response = await request(createApp())
    .post('/api/urls')
    .set('Content-Encoding', 'gzip')
    .send({ url: 'https://example.com' })
    .expect(415);
  assert.equal(response.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('an unsupported JSON charset returns 415', async () => {
  const response = await request(createApp())
    .post('/api/urls')
    .set('Content-Type', 'application/json; charset=iso-8859-1')
    .send('{"url":"https://example.com"}')
    .expect(415);
  assert.equal(response.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('an unknown well-formed code returns LINK_NOT_FOUND', async () => {
  const response = await request(createApp()).get('/NoSuch01').expect(404);
  assert.deepEqual(response.body, {
    error: { code: 'LINK_NOT_FOUND', message: 'Short link not found.' },
  });
});

test('a malformed code falls through to the route-not-found handler', async () => {
  const response = await request(createApp()).get('/too-long-code').expect(404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('invalid URL encoding returns a structured 400', async () => {
  const response = await request(createApp()).get('/%E0%A4%A').expect(400);
  assert.equal(response.body.error.code, 'INVALID_REQUEST');
});

test('short codes are case-sensitive and HEAD returns redirect headers only', async () => {
  const app = createApp({ generateCode: () => 'CaseAb01' });
  await request(app)
    .post('/api/urls')
    .send({ url: 'https://example.com' })
    .expect(201);
  await request(app).get('/caseab01').expect(404);

  const response = await request(app)
    .head('/CaseAb01')
    .expect(302)
    .expect('Location', 'https://example.com/');
  assert.equal(response.text, undefined);
});

test('separate app instances do not share in-memory links', async () => {
  const app = createApp({ generateCode: () => 'Local001' });
  await request(app)
    .post('/api/urls')
    .send({ url: 'https://example.com' })
    .expect(201);
  await request(createApp()).get('/Local001').expect(404);
});

test('a collision generates a new code without overwriting the original link', async () => {
  const codes = ['Same0001', 'Same0001', 'Next0002'];
  const app = createApp({ generateCode: () => codes.shift() ?? 'Fallback' });

  await request(app)
    .post('/api/urls')
    .send({ url: 'https://example.com/first' })
    .expect(201);
  const second = await request(app)
    .post('/api/urls')
    .send({ url: 'https://example.com/second' })
    .expect(201);

  assert.equal(second.body.shortCode, 'Next0002');
  await request(app)
    .get('/Same0001')
    .expect('Location', 'https://example.com/first');
  await request(app)
    .get('/Next0002')
    .expect('Location', 'https://example.com/second');
});

test('repeated collisions stop after ten attempts and preserve existing data', async () => {
  let attempts = 0;
  const app = createApp({
    generateCode: () => {
      attempts++;
      return 'Same0001';
    },
  });
  await request(app)
    .post('/api/urls')
    .send({ url: 'https://example.com/first' })
    .expect(201);
  attempts = 0;

  const response = await request(app)
    .post('/api/urls')
    .send({ url: 'https://example.com/second' })
    .expect(503);

  assert.equal(attempts, 10);
  assert.equal(response.body.error.code, 'CODE_GENERATION_FAILED');
  await request(app)
    .get('/Same0001')
    .expect('Location', 'https://example.com/first');
});

test('concurrent HTTP requests retain distinct destinations', async () => {
  let sequence = 0;
  const app = createApp({
    generateCode: () => String(++sequence).padStart(8, '0'),
  });
  const responses = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      request(app)
        .post('/api/urls')
        .send({ url: `https://example.com/${index}` })
        .expect(201),
    ),
  );

  assert.equal(
    new Set(responses.map((response) => response.body.shortCode)).size,
    12,
  );
  await Promise.all(
    responses.map((response, index) =>
      request(app)
        .get(`/${response.body.shortCode}`)
        .expect(302)
        .expect('Location', `https://example.com/${index}`),
    ),
  );
});
