import { gh, ghGraphql, buildResolveMutation, getRepoInfo, getPrDetails, getAuthenticatedUser } from './gh.js';
import { expandMagicVars } from './vars.js';
import os from 'os';

export interface ReplyContext {
  repo_owner: string;
  repo_name: string;
  pr_number: string;
  reply_to: string;
  date: string;
  username: string;
  repo_url: string;
  base_branch: string;
  head_branch: string;
  pr_title: string;
  author: string;
  local_commit: string;
}

export async function buildReplyContext(prNumber: string, target: string, repoOption?: string): Promise<ReplyContext> {
  const repo = await getRepoInfo(repoOption);
  const prDetails = await getPrDetails(prNumber, `${repo.owner}/${repo.name}`);
  const authUser = await getAuthenticatedUser();
  
  let replyToAuthor = String(target);
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
      if (author) replyToAuthor = author;
    } catch (err) {
      // ignore and fall back to target
    }
  }
  
  let localCommit = '';
  try {
    const { execa } = await import('execa');
    const r = await execa('git', ['rev-parse', 'HEAD']);
    localCommit = (r.stdout || '').trim();
  } catch (_) {}

  return {
    repo_owner: String(repo.owner),
    repo_name: String(repo.name),
    pr_number: String(prNumber),
    reply_to: replyToAuthor,
    date: new Date().toISOString(),
    username: authUser || os.userInfo().username || '',
    repo_url: `https://github.com/${repo.owner}/${repo.name}`,
    base_branch: String(prDetails.baseRefName || ''),
    head_branch: String(prDetails.headRefName || ''),
    pr_title: String(prDetails.title || ''),
    author: String((prDetails.author && prDetails.author.login) || ''),
    local_commit: localCommit,
  };
}

export async function sendSingleReply(
  prNumber: string,
  target: string,
  body: string,
  resolve: boolean,
  force: boolean,
  dryRun: boolean,
  context?: ReplyContext
) {
  const chalk = (await import('chalk')).default;
  const { ensureGhAvailable } = await import('./gh.js');
  await ensureGhAvailable();
  
  // Handle main PR-level comment
  if (target === 'main') {
    if (body && body.length > 0) {
      if (!dryRun) await gh(['pr', 'comment', prNumber, '--body', body]);
      console.log(chalk.green('Posted PR comment'));
    }
    return;
  }

  // Build context if not provided
  const ctx = context || await buildReplyContext(prNumber, target, (await import('commander')).program.opts().repo);
  
  // Expand magic variables
  const expandedBody = expandMagicVars(body, ctx as unknown as Record<string, string>);

  // Try direct reply via GraphQL mutation
  let directReplySucceeded = false;
  if (expandedBody && expandedBody.length > 0) {
    try {
      const mutation = `mutation ($threadId: ID!, $body: String!) { addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$threadId, body:$body}) { comment { id } } }`;
      const vars = { threadId: target, body: expandedBody };
      if (!dryRun) await ghGraphql(mutation, vars);
      directReplySucceeded = true;
      // eslint-disable-next-line no-console
      console.error('Direct reply succeeded', target);
    } catch (errAny) {
      const e = errAny as Error;
      // eslint-disable-next-line no-console
      console.error('Direct reply failed for', target, e.message || e);
      directReplySucceeded = false;
    }
  }

  // Fallback to PR comment if direct reply failed
  if (!directReplySucceeded && expandedBody && expandedBody.length > 0) {
    try {
      const mention = ctx.reply_to ? `@${ctx.reply_to} ` : '';
      if (!dryRun) await gh(['pr', 'comment', prNumber, '--body', `${mention}${expandedBody}`]);
      console.log(chalk.green('Posted PR comment for'), target);
    } catch (errAny) {
      const e = errAny as Error;
      console.error(chalk.red('Failed to post PR comment for'), target, e.message || e);
      return; // Don't resolve if posting failed
    }
  }

  // Resolve logic
  if (resolve) {
    if ((expandedBody && expandedBody.length > 0) || force) {
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
}
