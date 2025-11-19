import { addOrUpdateDraft } from '../lib/store';

export default async function draftAdd(prNumber: string, targetId: string, body: string, resolve = false) {
  await addOrUpdateDraft(prNumber, targetId, { body, resolve });
  // status on stderr
  // eslint-disable-next-line no-console
  console.error('Draft saved.');
}
