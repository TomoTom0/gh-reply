import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { DraftsSchema, Drafts, DraftEntry } from '../types.js';

const DRAFTS_PATH = path.join('.git', 'info', 'gh-reply-drafts.json');

async function ensureDir(): Promise<void> {
  const dir = path.dirname(DRAFTS_PATH);
  await fs.mkdirp(dir);
}

export async function readDrafts(): Promise<Drafts> {
  try {
    if (!(await fs.pathExists(DRAFTS_PATH))) {
      return {};
    }
    const raw = await fs.readFile(DRAFTS_PATH, 'utf8');
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw || '{}');
    } catch (e) {
      // corrupted drafts file -> treat as empty
      return {};
    }
    const result = DraftsSchema.parse(parsed);
    return result;
  } catch (err) {
    throw new Error(`Failed to read drafts: ${err}`);
  }
}

export async function writeDrafts(drafts: Drafts): Promise<void> {
  try {
    await ensureDir();
    const text = JSON.stringify(drafts, null, 2) + os.EOL;
    await fs.writeFile(DRAFTS_PATH, text, 'utf8');
  } catch (err) {
    throw new Error(`Failed to write drafts: ${err}`);
  }
}

export async function addOrUpdateDraft(prNumber: string, commentId: string, entry: Omit<DraftEntry, 'timestamp'>): Promise<void> {
  const drafts = await readDrafts();
  const pr = drafts[prNumber] || {};
  const now = new Date().toISOString();
  pr[commentId] = { ...entry, timestamp: now } as DraftEntry;
  drafts[prNumber] = pr;
  await writeDrafts(drafts);
}

export async function removeDraft(prNumber: string, commentId: string): Promise<void> {
  const drafts = await readDrafts();
  if (!drafts[prNumber]) return;
  delete drafts[prNumber][commentId];
  if (Object.keys(drafts[prNumber]).length === 0) delete drafts[prNumber];
  await writeDrafts(drafts);
}

export async function clearDrafts(prNumber: string): Promise<void> {
  const drafts = await readDrafts();
  // idempotent: remove pr entry if present
  if (!drafts || !drafts[prNumber]) return;
  delete drafts[prNumber];
  try {
    await writeDrafts(drafts);
  } catch (err) {
    // on failure, attempt to restore original file from disk if possible
    try {
      const raw = await fs.readFile(DRAFTS_PATH, 'utf8');
      // if we can parse, keep as-is; otherwise rethrow
      JSON.parse(raw || '{}');
    } catch (e) {
      // write back a safe empty object
      await writeDrafts({});
    }
    throw err;
  }
}

export async function getDraftsForPr(prNumber: string): Promise<Record<string, DraftEntry>> {
  const drafts = await readDrafts();
  return drafts[prNumber] || {};
}
