import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config/env.js';

test('missing configuration uses local development defaults', () => {
  assert.deepEqual(readConfig({}), {
    nodeEnv: 'development',
    host: '127.0.0.1',
    port: 3000,
  });
});

test('valid environment variables are converted to typed configuration', () => {
  assert.deepEqual(
    readConfig({ NODE_ENV: 'production', HOST: '0.0.0.0', PORT: '8080' }),
    { nodeEnv: 'production', host: '0.0.0.0', port: 8080 },
  );
});

test('IPv6 bind addresses are accepted', () => {
  assert.equal(readConfig({ HOST: '::1' }).host, '::1');
});

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
