import { sendSingleReply } from '../lib/sendSingleReply.js';

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
  
  // Send single reply without touching draft store
  await sendSingleReply(prNumber, targetId, body, resolve, false, dryRun);
}
