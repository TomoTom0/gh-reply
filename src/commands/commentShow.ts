import { getRepoInfo, ghGraphql } from '../lib/gh';

export default async function commentShow(prNumber: string, threadId: string) {
  const { ensureGhAvailable } = await import('../lib/gh');
  await ensureGhAvailable();
  const repo = await getRepoInfo();
  const query = `{
    repository(owner: \"${repo.owner}\", name: \"${repo.name}\") {
      pullRequest(number: ${prNumber}) {
        reviewThread(id: \"${threadId}\") {
          id isResolved path comments(first:50) { nodes { body author { login } createdAt } }
        }
      }
    }
  }`;
  const out = await ghGraphql(query);
  try {
    const thread = out.data.repository.pullRequest.reviewThread;
    const chalk = (await import('chalk')).default;
    console.log(chalk.green('Thread:'), thread.id);
    console.log(chalk.yellow('Path:'), thread.path);
    for (const c of thread.comments.nodes) {
      console.log(chalk.blue(c.author?.login || 'unknown'), c.createdAt);
      console.log(c.body);
      console.log('---');
    }
  } catch (e) {
    console.log(JSON.stringify(out, null, 2));
  }
}
