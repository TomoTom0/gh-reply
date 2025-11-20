import fs from 'fs-extra';
import path from 'path';

// Import built JS from dist to run tests against compiled output
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as storeApi from '../dist/lib/store.js';

const DRAFT_PATH = path.join('.git', 'info', 'gh-reply-drafts.json');

test('write and read drafts', async () => {
  // backup existing
  let orig = null;
  if (await fs.pathExists(DRAFT_PATH)) {
    orig = await fs.readFile(DRAFT_PATH, 'utf8');
  }
    try {
    // ensure clean
    await fs.remove(DRAFT_PATH);
    // write draft
    await storeApi.addOrUpdateDraft('42', 'thread1', { body: 'hello', resolve: false });
    const drafts = await storeApi.getDraftsForPr('42');
    assert.ok(drafts['thread1']);
    assert.strictEqual(drafts['thread1'].body, 'hello');
    // remove
    await storeApi.removeDraft('42', 'thread1');
    const drafts2 = await storeApi.getDraftsForPr('42');
    assert.strictEqual(Object.keys(drafts2).length, 0);
    } finally {
    // restore
    if (orig !== null) {
      await fs.ensureDir(path.dirname(DRAFT_PATH));
      await fs.writeFile(DRAFT_PATH, orig, 'utf8');
    } else {
      await fs.remove(DRAFT_PATH);
    }
    }
});
