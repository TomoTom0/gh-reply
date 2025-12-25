import { addOrUpdateDraft } from '../lib/store.js';
import { shouldResolve } from '../lib/envUtils.js';

export default async function draftAdd(prNumber: string, targetId: string, body: string, resolve = false) {
  resolve = shouldResolve(resolve);
  
  await addOrUpdateDraft(prNumber, targetId, { body, resolve });
  // status on stderr
  // eslint-disable-next-line no-console
  console.error('Draft saved.');
}
