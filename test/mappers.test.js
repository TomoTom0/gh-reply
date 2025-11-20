import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapThreadNode, mapThreadDetail } from '../dist/lib/mappers.js';

test('mapThreadNode maps fields correctly', () => {
  const node = {
    id: 'T1',
    path: 'a.js',
    line: '10',
    isResolved: false,
    comments: { nodes: [{ id: 'C1', fullDatabaseId: '123', body: 'hi', author: { login: 'u' }, createdAt: '2020-01-01', commit: { oid: 'abc' }, originalCommit: { oid: 'abc' }, diffHunk: 'hunk' }] }
  };
  const out = mapThreadNode(node);
  assert.strictEqual(out.threadId, 'T1');
  assert.strictEqual(out.comment.id, 'C1');
  assert.strictEqual(out.line, 10);
});

test('mapThreadDetail maps fields correctly', () => {
  const node = {
    id: 'T2',
    path: 'b.js',
    line: 5,
    comments: { nodes: [{ id: 'C2', body: 'x' }] }
  };
  const out = mapThreadDetail(node);
  assert.strictEqual(out.threadId, 'T2');
  assert.strictEqual(out.line, 5);
});

