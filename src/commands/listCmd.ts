import { gh } from '../lib/gh';

export default async function listCmd(repoOverride?: string) {
  try {
    const { ensureGhAvailable, getRepoInfo } = await import('../lib/gh');
    await ensureGhAvailable();
    if (repoOverride) {
      // pass repo override
      const out = await gh(['pr', 'list', '--state', 'open', '--repo', repoOverride]);
      console.log(out);
      return;
    }
    const out = await gh(['pr', 'list', '--state', 'open']);
    console.log(out);
  } catch (errAny) {
    const e = errAny as Error;
    console.error('Failed to run `gh pr list`: ', e.message || e);
  }
}
