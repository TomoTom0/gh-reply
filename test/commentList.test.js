// 単体テスト: commentList のフィルタリングロジック
import { test } from 'node:test';
import assert from 'node:assert/strict';

// フィルタリングロジックのテスト用ヘルパー
function applyCommentFilter(items, filterStr, prLabels = []) {
  const filters = (filterStr || '').split(',').map(s => s.trim()).filter(Boolean);
  if (filters.length === 0) return items;

  return items.filter(it => {
    const c = it.comment || {};
    for (const f of filters) {
      const [k, v] = f.split(':', 2).map(s => s.trim());
      if (!k || !v) continue;
      if (k === 'author' && String(c.author || '').toLowerCase() !== v.toLowerCase()) return false;
      if (k === 'contains' && !(String(c.body || '').toLowerCase().includes(v.toLowerCase()))) return false;
      if (k === 'severity') {
        const sev = v.toLowerCase();
        if (!prLabels.includes(sev) && !(String(c.body || '').toLowerCase().includes(sev))) return false;
      }
    }
    return true;
  });
}

// 詳細フィールド除外ロジック
function applyDetailFilter(items, detailStr) {
  const detailSet = new Set((detailStr || '').split(',').map(s => s.trim()).filter(Boolean));
  let result = [...items];

  if (!detailSet.has('bodyHTML')) {
    result = result.map(m => { if (m.comment) { delete m.comment.bodyHTML; } return m; });
  }
  if (!detailSet.has('diffHunk')) {
    result = result.map(m => { if (m.comment) { delete m.comment.diffHunk; } return m; });
  }
  if (!detailSet.has('commitOid')) {
    result = result.map(m => { if (m.comment) { delete m.comment.commitOid; delete m.comment.originalCommitOid; } return m; });
  }
  if (!detailSet.has('url')) {
    result = result.map(m => { if (m.comment) { delete m.comment.url; } return m; });
  }
  return result;
}

// ページネーションロジック
function applyPagination(items, page, perPage) {
  const p = page > 0 ? page : 1;
  const pp = perPage > 0 ? perPage : 10;
  const start = (p - 1) * pp;
  return items.slice(start, start + pp);
}

test('comment-filter: author フィルター', () => {
  const items = [
    { threadId: '1', comment: { author: 'alice', body: 'hello' } },
    { threadId: '2', comment: { author: 'bob', body: 'world' } },
    { threadId: '3', comment: { author: 'Alice', body: 'test' } },
  ];

  const filtered = applyCommentFilter(items, 'author:alice');
  assert.strictEqual(filtered.length, 2);
  assert.ok(filtered.every(i => i.comment.author.toLowerCase() === 'alice'));
});

test('comment-filter: contains フィルター', () => {
  const items = [
    { threadId: '1', comment: { author: 'alice', body: 'fix the bug' } },
    { threadId: '2', comment: { author: 'bob', body: 'add feature' } },
    { threadId: '3', comment: { author: 'charlie', body: 'Bug report' } },
  ];

  const filtered = applyCommentFilter(items, 'contains:bug');
  assert.strictEqual(filtered.length, 2);
});

test('comment-filter: severity フィルター (PRラベル)', () => {
  const items = [
    { threadId: '1', comment: { author: 'alice', body: 'minor issue' } },
    { threadId: '2', comment: { author: 'bob', body: 'critical problem' } },
  ];

  const filtered = applyCommentFilter(items, 'severity:critical', ['critical']);
  assert.strictEqual(filtered.length, 2); // PRラベルに critical があるので両方マッチ
});

test('comment-filter: 複数フィルターの組み合わせ', () => {
  const items = [
    { threadId: '1', comment: { author: 'alice', body: 'fix bug' } },
    { threadId: '2', comment: { author: 'alice', body: 'add feature' } },
    { threadId: '3', comment: { author: 'bob', body: 'fix bug' } },
  ];

  const filtered = applyCommentFilter(items, 'author:alice,contains:bug');
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].threadId, '1');
});

test('detail フィルター: デフォルトで重いフィールドを除外', () => {
  const items = [
    {
      threadId: '1',
      comment: {
        body: 'test',
        bodyHTML: '<p>test</p>',
        diffHunk: '@@ -1,2 +1,3 @@',
        commitOid: 'abc123',
        originalCommitOid: 'def456',
        url: 'https://github.com/...'
      }
    }
  ];

  const filtered = applyDetailFilter(items, '');
  assert.strictEqual(filtered[0].comment.body, 'test');
  assert.strictEqual(filtered[0].comment.bodyHTML, undefined);
  assert.strictEqual(filtered[0].comment.diffHunk, undefined);
  assert.strictEqual(filtered[0].comment.commitOid, undefined);
  assert.strictEqual(filtered[0].comment.url, undefined);
});

test('detail フィルター: 特定フィールドを含める', () => {
  const items = [
    {
      threadId: '1',
      comment: {
        body: 'test',
        bodyHTML: '<p>test</p>',
        diffHunk: '@@ -1,2 +1,3 @@',
        url: 'https://github.com/...'
      }
    }
  ];

  const filtered = applyDetailFilter(items, 'bodyHTML,url');
  assert.strictEqual(filtered[0].comment.bodyHTML, '<p>test</p>');
  assert.strictEqual(filtered[0].comment.url, 'https://github.com/...');
  assert.strictEqual(filtered[0].comment.diffHunk, undefined);
});

test('pagination: 基本的なページネーション', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ threadId: String(i + 1) }));

  const page1 = applyPagination(items, 1, 10);
  assert.strictEqual(page1.length, 10);
  assert.strictEqual(page1[0].threadId, '1');

  const page2 = applyPagination(items, 2, 10);
  assert.strictEqual(page2.length, 10);
  assert.strictEqual(page2[0].threadId, '11');

  const page3 = applyPagination(items, 3, 10);
  assert.strictEqual(page3.length, 5);
  assert.strictEqual(page3[0].threadId, '21');
});

test('pagination: 範囲外のページ', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ threadId: String(i + 1) }));

  const page10 = applyPagination(items, 10, 10);
  assert.strictEqual(page10.length, 0);
});
