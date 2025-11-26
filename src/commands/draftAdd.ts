import { addOrUpdateDraft } from '../lib/store.js';

export default async function draftAdd(prNumber: string, targetId: string, body: string, resolveForce = false) {
  await addOrUpdateDraft(prNumber, targetId, { body, resolve: resolveForce });
  // status on stderr
  // eslint-disable-next-line no-console
  console.error('Draft saved.');
}
