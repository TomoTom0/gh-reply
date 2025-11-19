import { getRepoInfo, ghGraphql } from '../lib/gh';
import { program } from 'commander';

export default async function commentShow(prNumber: string, threadId: string) {
  const { ensureGhAvailable } = await import('../lib/gh');
  await ensureGhAvailable();
  const repoOption = program.opts().repo;
  const repo = await getRepoInfo(repoOption);
  // Use node(id: ..) to fetch the PullRequestReviewThread safely
  const query = `{
    node(id: \"${threadId}\") {
      __typename
      ... on PullRequestReviewThread {
        id
        isResolved
        path
        comments(first:50) { nodes { body author { login } createdAt } }
      }
    }
  }`;
  const out = await ghGraphql(query);
  try {
    const thread = out.data.node;
    const mapped = {
      threadId: thread.id,
      path: thread.path || null,
      isResolved: !!thread.isResolved,
      comments: (thread.comments.nodes || []).map((c: any) => ({
        body: c.body,
        author: c.author?.login || null,
        createdAt: c.createdAt || null,
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
