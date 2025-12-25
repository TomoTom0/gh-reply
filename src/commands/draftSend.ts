import { getDraftsForPr, removeDraft } from '../lib/store.js';
import { sendSingleReply } from '../lib/sendSingleReply.js';

export default async function draftSend(prNumber: string, force = false, dryRun = false) {
  const drafts = await getDraftsForPr(prNumber);
  const { ensureGhAvailable } = await import('../lib/gh.js');
  await ensureGhAvailable();
  
  for (const [target, entry] of Object.entries(drafts)) {
    await sendSingleReply(prNumber, target, entry.body || '', entry.resolve || false, force, dryRun);
    await removeDraft(prNumber, target);
  }

  // Final summary to stderr
  // eslint-disable-next-line no-console
  console.error('All replies processed.');
}
