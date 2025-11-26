import { addOrUpdateDraft } from '../lib/store.js';

export default async function draftAdd(prNumber: string, targetId: string, body: string, resolve = false) {
  const resolveEnabled = process.env['GHREPLY_RESOLVE'] !== 'false';
  
  if (resolve && !resolveEnabled) {
    // eslint-disable-next-line no-console
    console.error('Warning: --resolve is disabled by GHREPLY_RESOLVE=false');
    resolve = false;
  }
  
  await addOrUpdateDraft(prNumber, targetId, { body, resolve });
  // status on stderr
  // eslint-disable-next-line no-console
  console.error('Draft saved.');
}
