import { getRepoInfo, ghGraphql } from '../lib/gh';
import { program } from 'commander';

export default async function commentList(prNumber: string, includeResolved = false) {
  const { ensureGhAvailable } = await import('../lib/gh');
  await ensureGhAvailable();
  const repoOption = program.opts().repo;
  const repo = await getRepoInfo(repoOption);
  // request only fields that exist in the schema to avoid undefinedField errors
  const query = `{
    repository(owner: \"${repo.owner}\", name: \"${repo.name}\") {
      pullRequest(number: ${prNumber}) {
        reviewThreads(first:100) {
          nodes {
            id
            isResolved
            path
            line
            originalLine
            originalStartLine
            startLine
            comments(first:1) { nodes { id fullDatabaseId body bodyText bodyHTML createdAt commit { oid } originalCommit { oid } diffHunk line originalLine path author { login } url } }
          }
        }
      }
    }
  }`;
  let out: any;
  try {
    out = await ghGraphql(query);
  } catch (err) {
    // If the extended query fails (some fields may not exist on older API),
    // fallback to a minimal query that is more compatible.
    const fallback = `{
      repository(owner: \"${repo.owner}\", name: \"${repo.name}\") {
        pullRequest(number: ${prNumber}) {
          reviewThreads(first:100) {
            nodes { id isResolved path comments(first:1) { nodes { body author { login } } } }
          }
        }
      }
    }`;
    out = await ghGraphql(fallback);
  }
  try {
    const nodes = out.data.repository.pullRequest.reviewThreads.nodes;
    const filtered = includeResolved ? nodes : nodes.filter((n: any) => !n.isResolved);
    const mapped = filtered.map((node: any) => {
      const firstComment = node.comments.nodes[0] || {};
      const line = node.line || node.originalLine || node.startLine || null;
      return {
        threadId: node.id,
        path: node.path || null,
        line: line ? +line : null,
        isResolved: !!node.isResolved,
        comment: {
          id: firstComment.id || null,
          databaseId: firstComment.fullDatabaseId || null,
          body: firstComment.body || '',
          bodyText: firstComment.bodyText || null,
          bodyHTML: firstComment.bodyHTML || null,
          createdAt: firstComment.createdAt || null,
          commit: firstComment.commit || null,
          originalCommit: firstComment.originalCommit || null,
          diffHunk: firstComment.diffHunk || null,
          line: firstComment.line || firstComment.originalLine || null,
          path: firstComment.path || null,
          author: firstComment.author?.login || null,
          url: firstComment.url || null,
        },
      };
    });
    // output JSON on stdout
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(mapped, null, 2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
  }
}
