import { getRepoInfo, ghGraphql } from '../lib/gh';
import { program } from 'commander';

export default async function commentShow(prNumber: string, threadId: string) {
  const { ensureGhAvailable } = await import('../lib/gh');
  await ensureGhAvailable();
  const repoOption = program.opts().repo;
  const repo = await getRepoInfo(repoOption);
  // Use node(id: ..) to fetch the PullRequestReviewThread safely
  // request available line fields as well
  const query = `{
    node(id: \"${threadId}\") {
      __typename
      ... on PullRequestReviewThread {
        id
        isResolved
        path
        line
        originalLine
        originalStartLine
        startLine
        comments(first:50) { nodes { id fullDatabaseId body bodyText bodyHTML createdAt commit { oid } originalCommit { oid } diffHunk line originalLine path author { login } url } }
      }
    }
  }`;
  const out = await ghGraphql(query);
  try {
    const thread = out.data.node;
    const lineVal = thread.line || thread.originalLine || thread.originalStartLine || thread.startLine || null;
    const mapped = {
      threadId: thread.id,
      path: thread.path || null,
      line: typeof lineVal === 'number' ? lineVal : (lineVal ? Number(lineVal) : null),
      isResolved: !!thread.isResolved,
      comments: (thread.comments.nodes || []).map((c: any) => ({
        id: c.id || null,
        databaseId: c.fullDatabaseId || null,
        body: c.body || '',
        bodyText: c.bodyText || null,
        bodyHTML: c.bodyHTML || null,
        createdAt: c.createdAt || null,
        commit: c.commit || null,
        originalCommit: c.originalCommit || null,
        diffHunk: c.diffHunk || null,
        line: c.line || c.originalLine || null,
        path: c.path || null,
        author: c.author?.login || null,
        url: c.url || null,
      })),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(mapped, null, 2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
  }
}
