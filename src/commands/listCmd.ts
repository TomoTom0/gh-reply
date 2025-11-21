import { gh } from '../lib/gh.js';
import { program } from 'commander';

export default async function listCmd(repoOverride?: string) {
  try {
    const { ensureGhAvailable, ghJson } = await import('../lib/gh.js');
    await ensureGhAvailable();
    const repo = repoOverride || program.opts().repo;
    const args = ['pr', 'list', '--state', 'open', '--json', 'number,title,author,url'];
    if (repo) args.push('--repo', repo);
    const out = await ghJson(args);
    // Ensure JSON output on stdout. All debug/info messages must go to stderr.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
  } catch (errAny) {
    const e = errAny as Error;
    // eslint-disable-next-line no-console
    console.error('Failed to run `gh pr list`: ', e.message || e);
    process.exitCode = 2;
  }
}
