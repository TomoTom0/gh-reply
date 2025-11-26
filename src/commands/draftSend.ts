import { getDraftsForPr, removeDraft } from '../lib/store.js';
import { buildReplyContext, sendSingleReply } from '../lib/sendSingleReply.js';

export default async function draftSend(prNumber: string, force = false, dryRun = false) {
  const drafts = await getDraftsForPr(prNumber);
  const { ensureGhAvailable } = await import('../lib/gh.js');
  await ensureGhAvailable();
  const repoOption = (await import('commander')).program.opts().repo;
  
  // Build context once for all drafts
  const hasDrafts = Object.keys(drafts).length > 0;
  const context = hasDrafts ? await buildReplyContext(prNumber, Object.keys(drafts)[0], repoOption) : undefined;
  
  for (const [target, entry] of Object.entries(drafts)) {
    await sendSingleReply(prNumber, target, entry.body || '', entry.resolve || false, force, dryRun, context);
    await removeDraft(prNumber, target);
  }

  // Final summary to stderr
  // eslint-disable-next-line no-console
  console.error('All replies processed.');
}
