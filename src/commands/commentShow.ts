import { getRepoInfo, ghGraphql } from '../lib/gh.js';
import { program } from 'commander';

export default async function commentShow(prNumber: string, threadId: string, detail?: string) {
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
  let out: any;
  try {
    out = await ghGraphql(query);
  } catch (err) {
    // fallback to minimal node query when some fields are unavailable
    const fallback = `{
      node(id: \"${threadId}\") {
        __typename
        ... on PullRequestReviewThread {
          id
          isResolved
          path
          comments(first:50) { nodes { body author { login } createdAt url } }
        }
      }
    }`;
    out = await ghGraphql(fallback);
  }
  try {
    const thread = out.data.node;
    // use mapper for consistent mapping logic
    const { mapThreadDetail } = await import('../lib/mappers.js');
    const mapped = mapThreadDetail(thread);
    // detail フィールド除外（1回の map にまとめる）
    const detailSet = new Set((detail || '').split(',').map(s => s.trim()).filter(Boolean));
    if (mapped.comments) {
      mapped.comments = mapped.comments.map((c: any) => {
        if (!detailSet.has('bodyHTML')) { delete c.bodyHTML; }
        if (!detailSet.has('diffHunk')) { delete c.diffHunk; }
        if (!detailSet.has('commitOid')) { delete c.commitOid; delete c.originalCommitOid; }
        if (!detailSet.has('url')) { delete c.url; }
        return c;
      });
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(mapped, null, 2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
  }
}
