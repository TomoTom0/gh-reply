// 単体テスト: gh.js の各関数
import { test, describe, mock, beforeEach, afterEach } from 'bun:test';
import assert from 'node:assert/strict';

// execaをモック
let execaMock;
beforeEach(() => {
  execaMock = {
    calls: [],
    responses: new Map(),
  };
});

afterEach(() => {
  mock.restore();
});

function mockExeca(command, args, options = {}) {
  const key = `${command} ${args.join(' ')}`;
  execaMock.calls.push({ command, args, options });

  if (execaMock.responses.has(key)) {
    const response = execaMock.responses.get(key);
    if (response.error) {
      const err = new Error(response.error);
      err.stdout = response.stdout || '';
      err.stderr = response.stderr || '';
      throw err;
    }
    return Promise.resolve({
      stdout: response.stdout || '',
      stderr: response.stderr || '',
    });
  }

  return Promise.resolve({ stdout: '', stderr: '' });
}

describe('ensureGhAvailable', () => {
  test('gh CLI が利用可能で認証済みの場合は成功', async () => {
    // execa をモック
    const { execa } = await import('execa');
    mock.module('execa', () => ({
      execa: mockExeca,
    }));

    execaMock.responses.set('gh --version', { stdout: 'gh version 2.0.0' });
    execaMock.responses.set('gh auth status', { stdout: 'Logged in' });

    const { ensureGhAvailable } = await import('../dist/lib/gh.js');
    await ensureGhAvailable();

    assert.strictEqual(execaMock.calls.length >= 2, true);
  });

  test('gh CLI が未インストールの場合はエラー', async () => {
    mock.module('execa', () => ({
      execa: (cmd, args) => {
        if (cmd === 'gh' && args[0] === '--version') {
          throw new Error('command not found');
        }
      },
    }));

    const { ensureGhAvailable } = await import('../dist/lib/gh.js');

    await assert.rejects(
      async () => await ensureGhAvailable(),
      /not installed or not in PATH/
    );
  });

  test('gh CLI が未認証の場合はエラー', async () => {
    mock.module('execa', () => ({
      execa: (cmd, args) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve({ stdout: 'gh version 2.0.0' });
        }
        if (cmd === 'gh' && args[0] === 'auth') {
          throw new Error('not authenticated');
        }
      },
    }));

    const { ensureGhAvailable } = await import('../dist/lib/gh.js');

    await assert.rejects(
      async () => await ensureGhAvailable(),
      /not authenticated/
    );
  });
});

describe('buildResolveMutation', () => {
  test('スレッドIDからmutationを生成', async () => {
    const { buildResolveMutation } = await import('../dist/lib/gh.js');

    const mutation = buildResolveMutation('THREAD_123');
    assert.ok(mutation.includes('resolveReviewThread'));
    assert.ok(mutation.includes('THREAD_123'));
  });

  test('特殊文字を含むIDを正しくエスケープ', async () => {
    const { buildResolveMutation } = await import('../dist/lib/gh.js');

    const mutation = buildResolveMutation('THREAD_"test"');
    assert.ok(mutation.includes('THREAD_\\"test\\"'));
  });
});

describe('buildAddCommentMutation', () => {
  test('subjectIdとbodyからmutationを生成', async () => {
    const { buildAddCommentMutation } = await import('../dist/lib/gh.js');

    const mutation = buildAddCommentMutation('PR_123', 'Test comment');
    assert.ok(mutation.includes('addComment'));
    assert.ok(mutation.includes('PR_123'));
    assert.ok(mutation.includes('Test comment'));
  });

  test('特殊文字を含むbodyを正しくエスケープ', async () => {
    const { buildAddCommentMutation } = await import('../dist/lib/gh.js');

    const mutation = buildAddCommentMutation('PR_123', 'Comment with "quotes"');
    assert.ok(mutation.includes('\\"quotes\\"'));
  });
});

describe('getRepoInfo', () => {
  test('repoOverride が指定されている場合はそれを使用', async () => {
    const { getRepoInfo } = await import('../dist/lib/gh.js');

    const result = await getRepoInfo('owner/repo');
    assert.deepStrictEqual(result, { owner: 'owner', name: 'repo' });
  });

  test('無効なrepoOverrideの場合はエラー', async () => {
    const { getRepoInfo } = await import('../dist/lib/gh.js');

    await assert.rejects(
      async () => await getRepoInfo('invalid'),
      /Invalid repo override/
    );
  });

  test('repoOverride なしの場合は gh repo view を使用', async () => {
    mock.module('execa', () => ({
      execa: (cmd, args) => {
        if (cmd === 'gh' && args.includes('repo')) {
          return Promise.resolve({
            stdout: JSON.stringify({
              owner: { login: 'test-owner' },
              name: 'test-repo',
            }),
          });
        }
      },
    }));

    const { getRepoInfo } = await import('../dist/lib/gh.js');

    const result = await getRepoInfo();
    assert.strictEqual(result.owner, 'test-owner');
    assert.strictEqual(result.name, 'test-repo');
  });
});

describe('getAuthenticatedUser', () => {
  test('認証済みユーザーのログインを取得', async () => {
    mock.module('execa', () => ({
      execa: (cmd, args) => {
        if (cmd === 'gh' && args.includes('user')) {
          return Promise.resolve({
            stdout: JSON.stringify({ login: 'testuser' }),
          });
        }
      },
    }));

    const { getAuthenticatedUser } = await import('../dist/lib/gh.js');

    const result = await getAuthenticatedUser();
    assert.strictEqual(result, 'testuser');
  });

  test('エラー時は空文字を返す', async () => {
    mock.module('execa', () => ({
      execa: () => {
        throw new Error('API error');
      },
    }));

    const { getAuthenticatedUser } = await import('../dist/lib/gh.js');

    const result = await getAuthenticatedUser();
    assert.strictEqual(result, '');
  });
});

describe('ghJson', () => {
  test('JSON形式の出力をパース', async () => {
    mock.module('execa', () => ({
      execa: () => Promise.resolve({
        stdout: JSON.stringify({ test: 'data' }),
      }),
    }));

    const { ghJson } = await import('../dist/lib/gh.js');

    const result = await ghJson(['test']);
    assert.deepStrictEqual(result, { test: 'data' });
  });

  test('JSON以外の出力はそのまま返す', async () => {
    mock.module('execa', () => ({
      execa: () => Promise.resolve({
        stdout: 'plain text output',
      }),
    }));

    const { ghJson } = await import('../dist/lib/gh.js');

    const result = await ghJson(['test']);
    assert.strictEqual(result, 'plain text output');
  });
});

describe('getPrDetails', () => {
  test('PR詳細を取得', async () => {
    mock.module('execa', () => ({
      execa: () => Promise.resolve({
        stdout: JSON.stringify({
          title: 'Test PR',
          author: { login: 'testuser' },
          headRefName: 'feature',
          baseRefName: 'main',
        }),
      }),
    }));

    const { getPrDetails } = await import('../dist/lib/gh.js');

    const result = await getPrDetails('123');
    assert.strictEqual(result.title, 'Test PR');
    assert.strictEqual(result.author.login, 'testuser');
  });

  test('repoOverride を指定できる', async () => {
    let capturedArgs = [];
    mock.module('execa', () => ({
      execa: (cmd, args) => {
        capturedArgs = args;
        return Promise.resolve({
          stdout: JSON.stringify({ title: 'Test' }),
        });
      },
    }));

    const { getPrDetails } = await import('../dist/lib/gh.js');

    await getPrDetails('123', 'owner/repo');
    assert.ok(capturedArgs.includes('owner/repo'));
  });
});

describe('ghGraphql', () => {
  test('変数なしのGraphQLクエリを実行', async () => {
    mock.module('execa', () => ({
      execa: (cmd, args) => {
        if (args.includes('graphql')) {
          return Promise.resolve({
            stdout: JSON.stringify({ data: { test: 'result' } }),
          });
        }
      },
    }));

    const { ghGraphql } = await import('../dist/lib/gh.js');

    const result = await ghGraphql('query { test }');
    assert.ok(result.data);
    assert.strictEqual(result.data.test, 'result');
  });

  test('変数ありのGraphQLクエリを実行', async () => {
    let capturedInput = '';
    mock.module('execa', () => ({
      execa: (cmd, args, opts) => {
        if (opts && opts.input) {
          capturedInput = opts.input;
        }
        return Promise.resolve({
          stdout: JSON.stringify({ data: { test: 'result' } }),
        });
      },
    }));

    const { ghGraphql } = await import('../dist/lib/gh.js');

    const result = await ghGraphql('query($id: ID!) { test(id: $id) }', { id: '123' });
    assert.ok(result.data);
  });

  test('GraphQLエラーを適切に処理', async () => {
    mock.module('execa', () => ({
      execa: () => Promise.resolve({
        stdout: JSON.stringify({
          errors: [{ message: 'GraphQL error' }],
        }),
      }),
    }));

    const { ghGraphql } = await import('../dist/lib/gh.js');

    await assert.rejects(
      async () => await ghGraphql('query { test }'),
      /GraphQL error/
    );
  });

  test('リトライロジックが動作する', async () => {
    let callCount = 0;
    mock.module('execa', () => ({
      execa: () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Temporary error');
        }
        return Promise.resolve({
          stdout: JSON.stringify({ data: { test: 'success' } }),
        });
      },
    }));

    const { ghGraphql } = await import('../dist/lib/gh.js');

    const result = await ghGraphql('query { test }');
    assert.ok(result.data);
    assert.ok(callCount >= 2, 'リトライが実行されるべき');
  });
});

describe('gh', () => {
  test('--repo オプションで空値を除外', async () => {
    let capturedArgs = [];
    mock.module('execa', () => ({
      execa: (cmd, args) => {
        capturedArgs = args;
        return Promise.resolve({ stdout: 'ok' });
      },
    }));

    const { gh } = await import('../dist/lib/gh.js');

    await gh(['pr', 'list', '--repo', '', '--state', 'open']);

    // --repo と空値が除外されているべき
    assert.ok(!capturedArgs.includes('--repo'));
    assert.ok(capturedArgs.includes('--state'));
  });

  test('エラー時に適切なメッセージを出力', async () => {
    mock.module('execa', () => ({
      execa: () => {
        const err = new Error('command failed');
        err.stdout = 'stdout content';
        err.stderr = 'stderr content';
        throw err;
      },
    }));

    const { gh } = await import('../dist/lib/gh.js');

    await assert.rejects(
      async () => await gh(['test']),
      /gh command failed/
    );
  });
});
