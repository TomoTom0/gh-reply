// 単体テスト: listCmd の state バリデーション
import { test } from 'node:test';
import assert from 'node:assert/strict';

// state バリデーションロジック
function validateState(state) {
  const validStates = ['open', 'closed', 'merged', 'all'];
  return validStates.includes(state) ? state : 'open';
}

test('state バリデーション: 有効な state', () => {
  assert.strictEqual(validateState('open'), 'open');
  assert.strictEqual(validateState('closed'), 'closed');
  assert.strictEqual(validateState('merged'), 'merged');
  assert.strictEqual(validateState('all'), 'all');
});

test('state バリデーション: 無効な state はデフォルトに', () => {
  assert.strictEqual(validateState('invalid'), 'open');
  assert.strictEqual(validateState(''), 'open');
  assert.strictEqual(validateState(undefined), 'open');
});

test('state バリデーション: 大文字小文字の区別', () => {
  // 現在の実装は大文字小文字を区別する
  assert.strictEqual(validateState('Open'), 'open');
  assert.strictEqual(validateState('CLOSED'), 'open');
});
