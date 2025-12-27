// commands層のスモークテスト: 基本的な実行可能性を確認
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// 各コマンドが正しくインポートできることを確認
describe('commands: import check', () => {
  test('listCmd をインポートできる', async () => {
    const listCmd = (await import('../dist/commands/listCmd.js')).default;
    assert.strictEqual(typeof listCmd, 'function');
  });

  test('commentList をインポートできる', async () => {
    const commentList = (await import('../dist/commands/commentList.js')).default;
    assert.strictEqual(typeof commentList, 'function');
  });

  test('commentReply をインポートできる', async () => {
    const commentReply = (await import('../dist/commands/commentReply.js')).default;
    assert.strictEqual(typeof commentReply, 'function');
  });

  test('commentShow をインポートできる', async () => {
    const commentShow = (await import('../dist/commands/commentShow.js')).default;
    assert.strictEqual(typeof commentShow, 'function');
  });

  test('draftAdd をインポートできる', async () => {
    const draftAdd = (await import('../dist/commands/draftAdd.js')).default;
    assert.strictEqual(typeof draftAdd, 'function');
  });

  test('draftShow をインポートできる', async () => {
    const draftShow = (await import('../dist/commands/draftShow.js')).default;
    assert.strictEqual(typeof draftShow, 'function');
  });

  test('draftSend をインポートできる', async () => {
    const draftSend = (await import('../dist/commands/draftSend.js')).default;
    assert.strictEqual(typeof draftSend, 'function');
  });

  test('draftClear をインポートできる', async () => {
    const draftClear = (await import('../dist/commands/draftClear.js')).default;
    assert.strictEqual(typeof draftClear, 'function');
  });
});
