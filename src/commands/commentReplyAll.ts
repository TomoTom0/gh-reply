import { getRepoInfo, ghGraphql, getAuthenticatedUser } from '../lib/gh';
import { addOrUpdateDraft } from '../lib/store';

export default async function commentReplyAll(prNumber: string, message = 'Thanks — noted; PTAL', resolve = false, dryRun = false) {
  const { ensureGhAvailable } = await import('../lib/gh');
  await ensureGhAvailable();
  const repo = await getRepoInfo();
  // fetch review threads
  const query = `{
    repository(owner: \"${repo.owner}\", name: \"${repo.name}\") {
      pullRequest(number: ${prNumber}) {
        reviewThreads(first:100) {
          nodes { id path isResolved comments(first:50) { nodes { author { login } } } }
        }
      }
    }
  }`;
  const out = await ghGraphql(query);
  const nodes = out.data.repository.pullRequest.reviewThreads.nodes || [];
  const me = await getAuthenticatedUser();
  const toReply: string[] = [];
  for (const n of nodes) {
    const hasMyReply = (n.comments.nodes || []).some((c: any) => c.author?.login === me);
    if (!hasMyReply) toReply.push(n.id);
  }

  // create drafts
  for (const tid of toReply) {
    if (dryRun) {
      // eslint-disable-next-line no-console
      console.error('Dry-run: would add draft for', tid);
      continue;
    }
    await addOrUpdateDraft(prNumber, tid, { body: message, resolve });
    // eslint-disable-next-line no-console
    console.error('Draft added for', tid);
  }

  // send drafts
  if (!dryRun) {
    const sendCmd = await import('./draftSend');
    await sendCmd.default(prNumber, false, false);
  }
}

