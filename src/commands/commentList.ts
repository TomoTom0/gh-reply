import { getRepoInfo, ghGraphql } from '../lib/gh';
import chalk from 'chalk';

export default async function commentList(prNumber: string) {
  const { ensureGhAvailable } = await import('../lib/gh');
  await ensureGhAvailable();
  const repo = await getRepoInfo();
  const query = `{
    repository(owner: \"${repo.owner}\", name: \"${repo.name}\") {
      pullRequest(number: ${prNumber}) {
        reviewThreads(first:100) {
          nodes { id isResolved path comments(first:1) { nodes { body databaseId } } }
        }
      }
    }
  }`;
  const out = await ghGraphql(query);
  try {
    const nodes = out.data.repository.pullRequest.reviewThreads.nodes;
    const unresolved = nodes.filter((n: any) => !n.isResolved);
    for (const node of unresolved) {
      const firstComment = node.comments.nodes[0];
      console.log(chalk.green('Thread:'), node.id);
      console.log(chalk.yellow('Path:'), node.path);
      console.log(chalk.blue('Comment:'), firstComment?.body);
      console.log('---');
    }
  } catch (e) {
    console.log(JSON.stringify(out, null, 2));
  }
}
