import { execa } from 'execa';

export async function gh(args: string[], input?: string) {
  const res = await execa('gh', args, { input, stderr: 'inherit' });
  return res.stdout;
}

export async function ensureGhAvailable(): Promise<void> {
  try {
    await execa('gh', ['--version']);
  } catch (e) {
    throw new Error('`gh` CLI is not installed or not in PATH. Install GitHub CLI: https://cli.github.com/');
  }
  try {
    await execa('gh', ['auth', 'status']);
  } catch (e) {
    throw new Error('`gh` is not authenticated. Run `gh auth login` to authenticate.');
  }
}

export async function ghJson(args: string[]) {
  // Runs gh with --json when appropriate or returns raw stdout
  const out = await gh(args);
  try {
    return JSON.parse(out);
  } catch (_) {
    return out;
  }
}

export async function ghGraphql(query: string, variables?: object) {
  // Use gh api graphql. If variables provided, pass both query and variables via stdin
  return await requestWithRetry(async () => {
    const q = query.replace(/\s+/g, ' ').trim();
    if (variables) {
      // Pass full JSON body via stdin using --input - to avoid shell/escape issues
      const args = ['api', 'graphql', '--input', '-'];
      const body = JSON.stringify({ query: q, variables });
      const out = await gh(args, body);
      try {
        const parsed = JSON.parse(out);
        if (parsed.errors) throw new Error(JSON.stringify(parsed.errors));
        return parsed;
      } catch (e) {
        throw e;
      }
    } else {
      const args = ['api', 'graphql', '-f', `query=${q}`];
      const out = await gh(args);
      try {
        const parsed = JSON.parse(out);
        if (parsed.errors) throw new Error(JSON.stringify(parsed.errors));
        return parsed;
      } catch (e) {
        throw e;
      }
    }
  }, 3);
}

export function buildResolveMutation(threadId: string) {
  const tid = JSON.stringify(threadId);
  return `mutation { resolveReviewThread(input:{threadId:${tid}}) { clientMutationId } }`;
}

export function buildAddCommentMutation(subjectId: string, body: string) {
  const sid = JSON.stringify(subjectId);
  const b = JSON.stringify(body);
  return `mutation { addComment(input:{subjectId:${sid}, body:${b}}) { clientMutationId } }`;
}

export async function getRepoInfo(repoOverride?: string) {
  // returns { owner: string, name: string }
  if (repoOverride) {
    const parts = repoOverride.split('/');
    if (parts.length !== 2) throw new Error('Invalid repo override. Expected owner/name');
    return { owner: parts[0], name: parts[1] };
  }
  const out = await ghJson(['repo', 'view', '--json', 'owner,name']);
  if (typeof out === 'string') throw new Error('Failed to get repo info');
  const owner = out.owner?.login || out.owner;
  const name = out.name;
  return { owner, name };
}

export async function getAuthenticatedUser() {
  try {
    const out = await ghJson(['api', 'user']);
    if (typeof out === 'string') return '';
    return out.login || out.login?.login || '';
  } catch (_) {
    return '';
  }
}

export async function getPrDetails(prNumber: string, repoOverride?: string) {
  const repo = repoOverride ? { repo: repoOverride } : undefined;
  const args = ['pr', 'view', prNumber, '--json', 'title,headRefName,baseRefName,author,headRefOid'];
  if (repoOverride) args.push('--repo', repoOverride);
  const out = await ghJson(args);
  if (typeof out === 'string') throw new Error('Failed to get pr details');
  return out;
}

export async function requestWithRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  let attempt = 0;
  let lastErr: any;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      attempt++;
      if (attempt >= retries) break;
      await new Promise((res) => setTimeout(res, delayMs * attempt));
    }
  }
  throw lastErr;
}
