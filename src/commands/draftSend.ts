import { getDraftsForPr, removeDraft } from '../lib/store';
import { gh, ghGraphql, buildResolveMutation, buildAddCommentMutation, getRepoInfo, getPrDetails, getAuthenticatedUser } from '../lib/gh';
import { expandMagicVars } from '../lib/vars';

export default async function draftSend(prNumber: string, force = false, dryRun = false) {
  const drafts = await getDraftsForPr(prNumber);
  const chalk = (await import('chalk')).default;
  const { ensureGhAvailable } = await import('../lib/gh');
  await ensureGhAvailable();
  const repoOption = (await import('commander')).program.opts().repo;
  for (const [target, entry] of Object.entries(drafts)) {
    // main vs thread
    if (target === 'main') {
      if (entry.body && entry.body.length > 0) {
        await gh(['pr', 'comment', prNumber, '--body', entry.body]);
      }
      await removeDraft(prNumber, target);
      continue;
    }

    // Build magic var context
    const repo = await getRepoInfo();
    const prDetails = await getPrDetails(prNumber, `${repo.owner}/${repo.name}`);
    const authUser = await getAuthenticatedUser();
    // if target is a thread id, fetch the thread to get the first comment author and databaseId
    let replyToAuthor = String(target);
    let firstCommentDbId: number | null = null;
    if (target !== 'main') {
      try {
        const nodeQuery = `{
          node(id: \"${target}\") {
            __typename
            ... on PullRequestReviewThread {
              id
              isResolved
              comments(first:1) { nodes { databaseId author { login } body } }
            }
          }
        }`;
        const nodeRes = await ghGraphql(nodeQuery);
        const node = nodeRes?.data?.node;
        const author = node?.comments?.nodes?.[0]?.author?.login;
        const dbid = node?.comments?.nodes?.[0]?.databaseId;
        if (author) replyToAuthor = author;
        if (dbid) firstCommentDbId = Number(dbid);
      } catch (err) {
        // ignore and fall back to target
      }
    }
    // compute local commit if in git repo
    let localCommit = '';
    try {
      const { execa } = await import('execa');
      const r = await execa('git', ['rev-parse', 'HEAD']);
      localCommit = (r.stdout || '').trim();
    } catch (_) {}

    const ctx = {
      repo_owner: String(repo.owner),
      repo_name: String(repo.name),
      pr_number: String(prNumber),
      reply_to: replyToAuthor,
      date: new Date().toISOString(),
      username: authUser || process.env['USER'] || '',
      repo_url: `https://github.com/${repo.owner}/${repo.name}`,
      base_branch: String(prDetails.baseRefName || ''),
      head_branch: String(prDetails.headRefName || ''),
      pr_title: String(prDetails.title || ''),
      author: String((prDetails.author && prDetails.author.login) || ''),
      local_commit: localCommit,
    } as Record<string,string>;

    let body = entry.body || '';
    body = expandMagicVars(body, ctx);

    // Try direct reply via GraphQL mutation using variables
    let directReplySucceeded = false;
    if (body && body.length > 0 && target !== 'main') {
      try {
        const mutation = `mutation ($threadId: ID!, $body: String!) { addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$threadId, body:$body}) { comment { id } } }`;
        const vars = { threadId: target, body };
        if (!dryRun) await ghGraphql(mutation, vars);
        directReplySucceeded = true;
        // write status to stderr
        // eslint-disable-next-line no-console
        console.error('Direct reply succeeded', target);
      } catch (errAny) {
        const e = errAny as Error;
        // eslint-disable-next-line no-console
        console.error('Direct reply failed for', target, e.message || e);
        directReplySucceeded = false;
      }
    }

    // Fallback to PR comment if direct reply not done / target is main
    if (!directReplySucceeded && body && body.length > 0) {
      try {
        const mention = replyToAuthor ? `@${replyToAuthor} ` : '';
        if (!dryRun) await gh(['pr', 'comment', prNumber, '--body', `${mention}${body}`]);
        console.log(chalk.green('Posted PR comment for'), target);
      } catch (errAny) {
        const e = errAny as Error;
        console.error(chalk.red('Failed to post PR comment for'), target, e.message || e);
        continue; // skip resolve if posting failed
      }
    }

    // Resolve logic
    if (entry.resolve) {
      if ((entry.body && entry.body.length > 0) || force) {
        const resolveMutation = buildResolveMutation(target);
        try {
          if (!dryRun) await ghGraphql(resolveMutation);
          // eslint-disable-next-line no-console
          console.error('Resolved', target);
        } catch (errAny) {
          const e = errAny as Error;
          // eslint-disable-next-line no-console
          console.error('Failed to resolve', target, e.message || e);
        }
      } else {
        console.log(chalk.yellow('Skipping resolve for'), target);
      }
    }

    await removeDraft(prNumber, target);
  }

  // Final summary to stderr
  // eslint-disable-next-line no-console
  console.error('All replies processed.');
}
