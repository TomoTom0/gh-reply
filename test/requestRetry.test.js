import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestWithRetry } from '../dist/lib/gh.js';

test('requestWithRetry retries and eventually succeeds', async () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls < 3) throw new Error('transient');
    return 'ok';
  };
  const res = await requestWithRetry(fn, 5, 10);
  assert.strictEqual(res, 'ok');
  assert.ok(calls >= 3);
});

