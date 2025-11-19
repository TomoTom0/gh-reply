import { getRepoInfo, ghGraphql } from '../lib/gh';
import { program } from 'commander';

export default async function commentList(prNumber: string) {
  const { ensureGhAvailable } = await import('../lib/gh');
  await ensureGhAvailable();
  const repoOption = program.opts().repo;
  const repo = await getRepoInfo(repoOption);
  const query = `{
    repository(owner: \"${repo.owner}\", name: \"${repo.name}\") {
      pullRequest(number: ${prNumber}) {
        reviewThreads(first:100) {
          nodes { id isResolved path comments(first:1) { nodes { body author { login } } } }
        }
      }
    }
  }`;
  const out = await ghGraphql(query);
  try {
    const nodes = out.data.repository.pullRequest.reviewThreads.nodes;
    const unresolved = nodes.filter((n: any) => !n.isResolved);
    const mapped = unresolved.map((node: any) => {
      const firstComment = node.comments.nodes[0] || {};
      return {
        threadId: node.id,
        path: node.path || null,
        line: null,
        body: firstComment.body || '',
        author: firstComment.author?.login || null,
        isResolved: !!node.isResolved,
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
