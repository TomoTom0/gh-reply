import { addOrUpdateDraft } from '../lib/store.js';
import draftSend from './draftSend.js';

export default async function commentReply(
  prNumber: string, 
  targetId: string, 
  body: string, 
  resolve = false,
  dryRun = false
) {
  const resolveEnabled = process.env['GHREPLY_RESOLVE'] !== 'false';
  
  if (resolve && !resolveEnabled) {
    // eslint-disable-next-line no-console
    console.error('Warning: --resolve is disabled by GHREPLY_RESOLVE=false');
    resolve = false;
  }
  
  // Add draft temporarily
  await addOrUpdateDraft(prNumber, targetId, { body, resolve });
  
  // Immediately send
  await draftSend(prNumber, false, dryRun);
}
