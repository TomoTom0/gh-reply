// 結合テスト: draft コマンドの連携
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../dist/lib/store.js';
import fs from 'fs-extra';
import path from 'path';

const DRAFT_PATH = path.join('.git', 'info', 'gh-reply-drafts.json');

test('draft ワークフロー: add → show → clear', async () => {
  // バックアップ
  let orig = null;
  if (await fs.pathExists(DRAFT_PATH)) {
    orig = await fs.readFile(DRAFT_PATH, 'utf8');
  }
  await fs.ensureDir(path.dirname(DRAFT_PATH));

  try {
    await fs.remove(DRAFT_PATH);

    // 1. 複数のドラフトを追加
    await store.addOrUpdateDraft('100', 'thread1', { body: 'Reply 1', resolve: false });
    await store.addOrUpdateDraft('100', 'thread2', { body: 'Reply 2', resolve: true });
    await store.addOrUpdateDraft('200', 'thread3', { body: 'Reply 3', resolve: false });

    // 2. PR 100 のドラフトを確認
    const drafts100 = await store.getDraftsForPr('100');
    assert.strictEqual(Object.keys(drafts100).length, 2);
    assert.strictEqual(drafts100['thread1'].body, 'Reply 1');
    assert.strictEqual(drafts100['thread1'].resolve, false);
    assert.strictEqual(drafts100['thread2'].body, 'Reply 2');
    assert.strictEqual(drafts100['thread2'].resolve, true);

    // 3. PR 200 のドラフトを確認
    const drafts200 = await store.getDraftsForPr('200');
    assert.strictEqual(Object.keys(drafts200).length, 1);

    // 4. ドラフトを更新
    await store.addOrUpdateDraft('100', 'thread1', { body: 'Updated Reply 1', resolve: true });
    const updatedDrafts = await store.getDraftsForPr('100');
    assert.strictEqual(updatedDrafts['thread1'].body, 'Updated Reply 1');
    assert.strictEqual(updatedDrafts['thread1'].resolve, true);

    // 5. PR 100 のドラフトをクリア
    await store.clearDrafts('100');
    const clearedDrafts = await store.getDraftsForPr('100');
    assert.strictEqual(Object.keys(clearedDrafts).length, 0);

    // 6. PR 200 のドラフトは影響なし
    const remaining = await store.getDraftsForPr('200');
    assert.strictEqual(Object.keys(remaining).length, 1);

  } finally {
    // リストア
    if (orig !== null) {
      await fs.ensureDir(path.dirname(DRAFT_PATH));
      await fs.writeFile(DRAFT_PATH, orig, 'utf8');
    } else {
      await fs.remove(DRAFT_PATH);
    }
  }
});

test('draft 個別削除: removeDraft', async () => {
  let orig = null;
  if (await fs.pathExists(DRAFT_PATH)) {
    orig = await fs.readFile(DRAFT_PATH, 'utf8');
  }
  await fs.ensureDir(path.dirname(DRAFT_PATH));

  try {
    await fs.remove(DRAFT_PATH);

    // ドラフトを追加
    await store.addOrUpdateDraft('100', 'thread1', { body: 'Reply 1', resolve: false });
    await store.addOrUpdateDraft('100', 'thread2', { body: 'Reply 2', resolve: false });

    // thread1 のみ削除
    await store.removeDraft('100', 'thread1');

    const drafts = await store.getDraftsForPr('100');
    assert.strictEqual(Object.keys(drafts).length, 1);
    assert.strictEqual(drafts['thread2'].body, 'Reply 2');
    assert.strictEqual(drafts['thread1'], undefined);

  } finally {
    if (orig !== null) {
      await fs.ensureDir(path.dirname(DRAFT_PATH));
      await fs.writeFile(DRAFT_PATH, orig, 'utf8');
    } else {
      await fs.remove(DRAFT_PATH);
    }
  }
});

test('draft エッジケース: 存在しないPRのドラフト取得', async () => {
  let orig = null;
  if (await fs.pathExists(DRAFT_PATH)) {
    orig = await fs.readFile(DRAFT_PATH, 'utf8');
  }
  await fs.ensureDir(path.dirname(DRAFT_PATH));

  try {
    await fs.remove(DRAFT_PATH);

    const drafts = await store.getDraftsForPr('nonexistent');
    assert.deepStrictEqual(drafts, {});

  } finally {
    if (orig !== null) {
      await fs.ensureDir(path.dirname(DRAFT_PATH));
      await fs.writeFile(DRAFT_PATH, orig, 'utf8');
    } else {
      await fs.remove(DRAFT_PATH);
    }
  }
});

test('draft エッジケース: 空のbody', async () => {
  let orig = null;
  if (await fs.pathExists(DRAFT_PATH)) {
    orig = await fs.readFile(DRAFT_PATH, 'utf8');
  }
  await fs.ensureDir(path.dirname(DRAFT_PATH));

  try {
    await fs.remove(DRAFT_PATH);

    await store.addOrUpdateDraft('100', 'thread1', { body: '', resolve: true });
    const drafts = await store.getDraftsForPr('100');
    assert.strictEqual(drafts['thread1'].body, '');
    assert.strictEqual(drafts['thread1'].resolve, true);

  } finally {
    if (orig !== null) {
      await fs.ensureDir(path.dirname(DRAFT_PATH));
      await fs.writeFile(DRAFT_PATH, orig, 'utf8');
    } else {
      await fs.remove(DRAFT_PATH);
    }
  }
});
