import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config/env.js';

test('missing configuration uses local development defaults', () => {
  assert.deepEqual(readConfig({}), {
    nodeEnv: 'development',
    host: '127.0.0.1',
    port: 3000,
    publicBaseUrl: 'http://127.0.0.1:3000',
  });
});

test('valid environment variables are converted to typed configuration', () => {
  assert.deepEqual(
    readConfig({ NODE_ENV: 'production', HOST: '0.0.0.0', PORT: '8080' }),
    {
      nodeEnv: 'production',
      host: '0.0.0.0',
      port: 8080,
      publicBaseUrl: 'http://127.0.0.1:8080',
    },
  );
});

test('IPv6 bind addresses are accepted', () => {
  const config = readConfig({ HOST: '::1' });
  assert.equal(config.host, '::1');
  assert.equal(config.publicBaseUrl, 'http://[::1]:3000');
});

test('a public origin is independent of the listen address and normalized', () => {
  const config = readConfig({ PUBLIC_BASE_URL: 'https://short.example.com/' });
  assert.equal(config.publicBaseUrl, 'https://short.example.com');
});

test('an unspecified IPv6 bind address uses a usable local public origin', () => {
  assert.equal(
    readConfig({ HOST: '::' }).publicBaseUrl,
    'http://127.0.0.1:3000',
  );
});

for (const publicBaseUrl of [
  '',
  'example.com',
  'ftp://example.com',
  'https://user:password@example.com',
  'https://example.com/links',
  'https://example.com/?query=1',
  'https://example.com/#fragment',
  'https://exam\nple.com',
]) {
  test(`invalid PUBLIC_BASE_URL ${JSON.stringify(publicBaseUrl)} is rejected`, () => {
    assert.throws(
      () => readConfig({ PUBLIC_BASE_URL: publicBaseUrl }),
      /PUBLIC_BASE_URL must be/,
    );
  });
}

for (const port of ['', '0', '-1', '65536', 'abc', '3e3', '3000.5', ' 3000 ']) {
  test(`invalid PORT ${JSON.stringify(port)} is rejected`, () => {
    assert.throws(() => readConfig({ PORT: port }), /PORT must be/);
  });
}

test('a misspelled environment is rejected', () => {
  assert.throws(
    () => readConfig({ NODE_ENV: 'prodution' }),
    /NODE_ENV must be/,
  );
});

test('an invalid bind address is rejected', () => {
  assert.throws(() => readConfig({ HOST: '' }), /HOST must be/);
});
