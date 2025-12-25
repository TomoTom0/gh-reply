import { getDraftsForPr, removeDraft } from '../lib/store.js';
import { buildBaseReplyContext, getReplyToAuthor, sendSingleReply } from '../lib/sendSingleReply.js';

export default async function draftSend(prNumber: string, force = false, dryRun = false) {
  const drafts = await getDraftsForPr(prNumber);
  const { ensureGhAvailable } = await import('../lib/gh.js');
  await ensureGhAvailable();
  
  const repoOption = (await import('commander')).program.opts().repo;
  const baseContext = await buildBaseReplyContext(prNumber, repoOption);
  
  for (const [target, entry] of Object.entries(drafts)) {
    const replyTo = await getReplyToAuthor(target);
    const context = { ...baseContext, reply_to: replyTo };
    await sendSingleReply(prNumber, target, entry.body || '', entry.resolve || false, force, dryRun, context);
    await removeDraft(prNumber, target);
  }

  // Final summary to stderr
  // eslint-disable-next-line no-console
  console.error('All replies processed.');
}
