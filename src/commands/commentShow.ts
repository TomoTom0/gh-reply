import { getRepoInfo, ghGraphql } from '../lib/gh.js';
import { program } from 'commander';

export default async function commentShow(prNumber: string, threadId: string) {
  const { ensureGhAvailable } = await import('../lib/gh.js');
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
    // use mapper for consistent mapping logic
    const { mapThreadDetail } = await import('../lib/mappers.js');
    const mapped = mapThreadDetail(thread);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(mapped, null, 2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
  }
}
