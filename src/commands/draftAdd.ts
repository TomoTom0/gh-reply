import { addOrUpdateDraft } from '../lib/store';

export default async function draftAdd(prNumber: string, targetId: string, body: string, resolve = false) {
  await addOrUpdateDraft(prNumber, targetId, { body, resolve });
  console.log('Draft saved.');
}

