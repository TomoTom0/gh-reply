import { clearDrafts } from '../lib/store';

export default async function draftClear(prNumber: string) {
  await clearDrafts(prNumber);
  console.log('Drafts cleared.');
}

