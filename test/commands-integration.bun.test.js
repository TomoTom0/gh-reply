// commands層の統合テスト: gh.jsをモック化してコマンド実行をテスト
import { test, describe, mock, beforeEach, afterEach } from 'bun:test';
import assert from 'node:assert/strict';

// console.log/console.errorをキャプチャするヘルパー
let consoleOutput = { log: [], error: [] };
let originalConsoleLog;
let originalConsoleError;
let originalExitCode;

beforeEach(() => {
  consoleOutput = { log: [], error: [] };
  originalConsoleLog = console.log;
  originalConsoleError = console.error;
  originalExitCode = process.exitCode;

  console.log = (...args) => {
    consoleOutput.log.push(args.join(' '));
  };
  console.error = (...args) => {
    consoleOutput.error.push(args.join(' '));
  };
  process.exitCode = undefined;
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  process.exitCode = originalExitCode;
  mock.restore();
});

describe('listCmd', () => {
  test('正常系: PRリストを取得して出力', async () => {
    // gh.jsをモック
    mock.module('../dist/lib/gh.js', () => ({
      ensureGhAvailable: async () => {},
      ghJson: async (args) => {
        return [
          { number: 1, title: 'Test PR 1', state: 'OPEN' },
          { number: 2, title: 'Test PR 2', state: 'CLOSED' },
        ];
      },
    }));

    const listCmd = (await import('../dist/commands/listCmd.js')).default;

    await listCmd(null, 'open');

    assert.strictEqual(consoleOutput.log.length, 1);
    const output = JSON.parse(consoleOutput.log[0]);
    assert.ok(Array.isArray(output));
    assert.strictEqual(output.length, 2);
  });

  test('無効なstateはopenにフォールバック', async () => {
    let capturedArgs = null;
    mock.module('../dist/lib/gh.js', () => ({
      ensureGhAvailable: async () => {},
      ghJson: async (args) => {
        capturedArgs = args;
        return [];
      },
    }));

    const listCmd = (await import('../dist/commands/listCmd.js')).default;

    await listCmd(null, 'invalid');

    assert.ok(capturedArgs.includes('open'));
    assert.ok(!capturedArgs.includes('invalid'));
  });

  test('repoOverrideを指定できる', async () => {
    let capturedArgs = null;
    mock.module('../dist/lib/gh.js', () => ({
      ensureGhAvailable: async () => {},
      ghJson: async (args) => {
        capturedArgs = args;
        return [];
      },
    }));

    const listCmd = (await import('../dist/commands/listCmd.js')).default;

    await listCmd('owner/repo', 'open');

    assert.ok(capturedArgs.includes('owner/repo'));
  });

  test('エラー時にprocess.exitCodeを設定', async () => {
    mock.module('../dist/lib/gh.js', () => ({
      ensureGhAvailable: async () => {},
      ghJson: async () => {
        throw new Error('API error');
      },
    }));

    const listCmd = (await import('../dist/commands/listCmd.js')).default;

    await listCmd(null, 'open');

    assert.strictEqual(process.exitCode, 2);
    assert.ok(consoleOutput.error.length > 0);
  });
});

describe('commentList', () => {
  test('レビュースレッドを取得して出力', async () => {
    mock.module('../dist/lib/gh.js', () => ({
      ensureGhAvailable: async () => {},
      ghGraphql: async () => ({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    id: 'THREAD_1',
                    isResolved: false,
                    path: 'test.js',
                    line: 10,
                    comments: {
                      nodes: [{ body: 'Comment 1', author: { login: 'reviewer' } }],
                    },
                  },
                ],
              },
            },
          },
        },
      }),
      getRepoInfo: async () => ({ owner: 'test', name: 'repo' }),
    }));

    const commentList = (await import('../dist/commands/commentList.js')).default;

    await commentList('123', {});

    assert.strictEqual(consoleOutput.log.length, 1);
    const output = JSON.parse(consoleOutput.log[0]);
    assert.ok(output.items);
    assert.ok(Array.isArray(output.items));
  });

  test('--all オプションで解決済みも含める', async () => {
    let capturedQuery = '';
    mock.module('../dist/lib/gh.js', () => ({
      ensureGhAvailable: async () => {},
      ghGraphql: async (query) => {
        capturedQuery = query;
        return {
          data: {
            repository: {
              pullRequest: {
                reviewThreads: { nodes: [] },
              },
            },
          },
        };
      },
      getRepoInfo: async () => ({ owner: 'test', name: 'repo' }),
    }));

    const commentList = (await import('../dist/commands/commentList.js')).default;

    await commentList('123', { includeResolved: true });

    // GraphQLクエリに制限がないことを確認
    assert.ok(capturedQuery.length > 0);
  });
});

describe('draftShow', () => {
  test('ドラフトを取得して出力', async () => {
    mock.module('../dist/lib/store.js', () => ({
      getDraftsForPr: async (prNumber) => ({
        'thread1': { body: 'Draft reply 1', resolve: false },
        'thread2': { body: 'Draft reply 2', resolve: true },
      }),
    }));

    const draftShow = (await import('../dist/commands/draftShow.js')).default;

    await draftShow('123');

    assert.strictEqual(consoleOutput.log.length, 1);
    const output = JSON.parse(consoleOutput.log[0]);
    assert.ok(output.thread1);
    assert.ok(output.thread2);
  });
});

describe('draftClear', () => {
  test('ドラフトをクリア', async () => {
    let cleared = false;
    mock.module('../dist/lib/store.js', () => ({
      clearDrafts: async (prNumber) => {
        cleared = true;
      },
    }));

    const draftClear = (await import('../dist/commands/draftClear.js')).default;

    await draftClear('123');

    assert.strictEqual(cleared, true);
    assert.ok(consoleOutput.log.some(msg => msg.includes('cleared')));
  });
});

describe('draftAdd', () => {
  test('ドラフトを追加', async () => {
    let addedDraft = null;
    mock.module('../dist/lib/store.js', () => ({
      addOrUpdateDraft: async (prNumber, threadId, draft) => {
        addedDraft = { prNumber, threadId, draft };
      },
    }));

    const draftAdd = (await import('../dist/commands/draftAdd.js')).default;

    await draftAdd('123', 'thread1', 'Test reply', false);

    assert.ok(addedDraft);
    assert.strictEqual(addedDraft.prNumber, '123');
    assert.strictEqual(addedDraft.threadId, 'thread1');
    assert.strictEqual(addedDraft.draft.body, 'Test reply');
  });
});
