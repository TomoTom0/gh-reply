import { clearDrafts } from '../lib/store.js';

export default async function draftClear(prNumber: string) {
  await clearDrafts(prNumber);
  console.log('Drafts cleared.');
}
