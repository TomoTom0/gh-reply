// 非破壊通信テスト: 実際の GitHub API を呼び出す（読み取りのみ）
//
// 環境変数:
//   TEST_REPO: テスト対象リポジトリ (例: "owner/repo")
//   SKIP_API_TESTS: "1" でスキップ
//
// 使用例:
//   TEST_REPO=octocat/Hello-World npm test
//   SKIP_API_TESTS=1 npm test

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';

const TEST_REPO = process.env.TEST_REPO || '';
const SKIP_API_TESTS = process.env.SKIP_API_TESTS === '1';

// gh CLI が利用可能かチェック
function isGhAvailable() {
  try {
    execSync('gh auth status', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// テストをスキップするかどうか
function shouldSkip() {
  if (SKIP_API_TESTS) return 'SKIP_API_TESTS が設定されています';
  if (!TEST_REPO) return 'TEST_REPO が設定されていません';
  if (!isGhAvailable()) return 'gh CLI が認証されていません';
  return null;
}

describe('API 通信テスト（非破壊）', { skip: shouldSkip() }, () => {
  let prNumber = null;

  before(async () => {
    // テスト用の PR 番号を取得（最新の PR）
    try {
      const result = execSync(
        `gh pr list --repo ${TEST_REPO} --state all --limit 1 --json number`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const prs = JSON.parse(result);
      if (prs.length > 0) {
        prNumber = prs[0].number;
      }
    } catch (e) {
      console.error('PR 番号の取得に失敗:', e.message);
    }
  });

  test('list コマンド: open PRs を取得', async () => {
    const result = execSync(
      `node dist/index.js list --repo ${TEST_REPO}`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed), '結果は配列であるべき');
  });

  test('list コマンド: --state all で全 PRs を取得', async () => {
    const result = execSync(
      `node dist/index.js list --repo ${TEST_REPO} --state all`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed), '結果は配列であるべき');
  });

  test('list コマンド: --state closed', async () => {
    const result = execSync(
      `node dist/index.js list --repo ${TEST_REPO} --state closed`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed), '結果は配列であるべき');
    // closed PR は state が "CLOSED" または "MERGED"
    for (const pr of parsed) {
      assert.ok(['CLOSED', 'MERGED'].includes(pr.state), `state は CLOSED か MERGED であるべき: ${pr.state}`);
    }
  });

  test('show コマンド: PR 詳細を取得', async (t) => {
    if (!prNumber) {
      t.skip('テスト用の PR が見つかりません');
      return;
    }
    const result = execSync(
      `node dist/index.js show ${prNumber} --repo ${TEST_REPO}`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(result);
    assert.ok(parsed.title, 'title が存在するべき');
    assert.ok(parsed.author, 'author が存在するべき');
  });

  test('comment list コマンド: レビューコメントを取得', async (t) => {
    if (!prNumber) {
      t.skip('テスト用の PR が見つかりません');
      return;
    }
    const result = execSync(
      `node dist/index.js comment list ${prNumber} --repo ${TEST_REPO}`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(result);
    assert.ok(typeof parsed.total === 'number', 'total が数値であるべき');
    assert.ok(typeof parsed.page === 'number', 'page が数値であるべき');
    assert.ok(Array.isArray(parsed.items), 'items が配列であるべき');
  });

  test('comment list コマンド: --all オプション', async (t) => {
    if (!prNumber) {
      t.skip('テスト用の PR が見つかりません');
      return;
    }
    const result = execSync(
      `node dist/index.js comment list ${prNumber} --repo ${TEST_REPO} --all`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed.items), 'items が配列であるべき');
  });

  test('comment list コマンド: ページネーション', async (t) => {
    if (!prNumber) {
      t.skip('テスト用の PR が見つかりません');
      return;
    }
    const result = execSync(
      `node dist/index.js comment list ${prNumber} --repo ${TEST_REPO} --page 1 --per-page 5`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.page, 1, 'page は 1 であるべき');
    assert.strictEqual(parsed.perPage, 5, 'perPage は 5 であるべき');
    assert.ok(parsed.items.length <= 5, 'items は最大 5 件であるべき');
  });

  test('comment list コマンド: --detail オプション', async (t) => {
    if (!prNumber) {
      t.skip('テスト用の PR が見つかりません');
      return;
    }
    const result = execSync(
      `node dist/index.js comment list ${prNumber} --repo ${TEST_REPO} --detail url,bodyHTML`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(result);
    // detail に url, bodyHTML を指定したので、これらが含まれているはず
    // (ただし、コメントがない場合は検証できない)
    assert.ok(Array.isArray(parsed.items), 'items が配列であるべき');
  });

  test('draft show コマンド: ドラフト一覧（空でもOK）', async (t) => {
    if (!prNumber) {
      t.skip('テスト用の PR が見つかりません');
      return;
    }
    const result = execSync(
      `node dist/index.js draft show ${prNumber}`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(result);
    assert.ok(typeof parsed === 'object', '結果はオブジェクトであるべき');
  });
});

describe('エラーハンドリングテスト', { skip: shouldSkip() }, () => {
  test('存在しない PR 番号でエラー', async () => {
    try {
      execSync(
        `node dist/index.js show 999999999 --repo ${TEST_REPO}`,
        { encoding: 'utf8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] }
      );
      assert.fail('エラーが発生するべき');
    } catch (e) {
      // エラーが発生することを期待
      assert.ok(e.status !== 0, 'exit code は 0 以外であるべき');
    }
  });

  test('無効な state オプション', async () => {
    // 無効な state はデフォルトの "open" にフォールバック
    const result = execSync(
      `node dist/index.js list --repo ${TEST_REPO} --state invalid`,
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed), '結果は配列であるべき');
  });
});
