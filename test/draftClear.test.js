import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../dist/lib/store.js';
import fs from 'fs-extra';
import path from 'path';

const DRAFT_PATH = path.join('.git', 'info', 'gh-reply-drafts.json');

test('clearDrafts is idempotent and safe', async () => {
  // backup
  let orig = null;
  if (await fs.pathExists(DRAFT_PATH)) {
    orig = await fs.readFile(DRAFT_PATH, 'utf8');
  }
  // ensure directory exists for tests (avoid ENOENT)
  await fs.ensureDir(path.dirname(DRAFT_PATH));
  try {
    await fs.remove(DRAFT_PATH);
    // add some drafts
    await store.addOrUpdateDraft('1', 'a', { body: 'x', resolve: false });
    await store.addOrUpdateDraft('2', 'b', { body: 'y', resolve: false });
    // clear a PR that exists
    await store.clearDrafts('1');
    const d1 = await store.getDraftsForPr('1');
    assert.strictEqual(Object.keys(d1).length, 0);
    // clear again (should not throw)
    await store.clearDrafts('1');
    // clear non-existent PR
    await store.clearDrafts('nope');
  } finally {
    if (orig !== null) {
      await fs.ensureDir(path.dirname(DRAFT_PATH));
      await fs.writeFile(DRAFT_PATH, orig, 'utf8');
    } else {
      await fs.remove(DRAFT_PATH);
    }
  }
});
