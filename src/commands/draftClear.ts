import { clearDrafts } from '../lib/store.js';

export default async function draftClear(prNumber: string) {
  await clearDrafts(prNumber);
  // status messages go to stderr to avoid polluting JSON stdout
  // eslint-disable-next-line no-console
  console.error('Drafts cleared.');
}
