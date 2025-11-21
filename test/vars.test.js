// 単体テスト: vars.ts の変数展開ロジック
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandMagicVars } from '../dist/lib/vars.js';

test('expandMagicVars: 基本的な変数展開', () => {
  const result = expandMagicVars('Hello {{name}}!', { name: 'World' });
  assert.strictEqual(result, 'Hello World!');
});

test('expandMagicVars: 複数の変数', () => {
  const result = expandMagicVars('{{greeting}} {{name}}!', { greeting: 'Hello', name: 'World' });
  assert.strictEqual(result, 'Hello World!');
});

test('expandMagicVars: スペースを含む変数', () => {
  const result = expandMagicVars('{{ name }}', { name: 'World' });
  assert.strictEqual(result, 'World');
});

test('expandMagicVars: 存在しない変数は空文字に', () => {
  const result = expandMagicVars('Hello {{unknown}}!', {});
  assert.strictEqual(result, 'Hello !');
});

test('expandMagicVars: 同じ変数の複数回使用', () => {
  const result = expandMagicVars('{{x}} + {{x}} = {{result}}', { x: '1', result: '2' });
  assert.strictEqual(result, '1 + 1 = 2');
});

test('expandMagicVars: 空のテンプレート', () => {
  const result = expandMagicVars('', { name: 'World' });
  assert.strictEqual(result, '');
});

test('expandMagicVars: null/undefined のテンプレート', () => {
  assert.strictEqual(expandMagicVars(null, { name: 'World' }), null);
  assert.strictEqual(expandMagicVars(undefined, { name: 'World' }), undefined);
});

test('expandMagicVars: 変数を含まないテンプレート', () => {
  const result = expandMagicVars('Hello World!', { name: 'Test' });
  assert.strictEqual(result, 'Hello World!');
});

test('expandMagicVars: アンダースコアを含む変数名', () => {
  const result = expandMagicVars('{{first_name}} {{last_name}}', { first_name: 'John', last_name: 'Doe' });
  assert.strictEqual(result, 'John Doe');
});

test('expandMagicVars: 数字を含む変数名', () => {
  const result = expandMagicVars('{{var1}} {{var2}}', { var1: 'a', var2: 'b' });
  assert.strictEqual(result, 'a b');
});
