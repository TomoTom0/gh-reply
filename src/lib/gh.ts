import { execa } from 'execa';

export async function gh(args: string[], input?: string) {
  // sanitize args: don't pass --repo with empty/undefined value
  const safeArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--repo') {
      const v = args[i+1];
      if (v) {
        safeArgs.push(a, String(v));
        i++; // skip value
      } else {
        i++; // skip value position
        continue;
      }
    } else {
      safeArgs.push(a);
    }
  }
  // ensure environment variables to make gh non-interactive and deterministic
  const env = Object.assign({}, process.env, {
    GH_PAGER: '',
    GH_NO_UPDATE_NOTIFIER: '1',
    NO_COLOR: '1',
    CLICOLOR: '0',
    CI: 'true',
  });

  try {
    const res = await execa('gh', safeArgs, { input, stderr: 'pipe', cwd: process.cwd(), env });
    return res.stdout;
  } catch (errAny) {
    const e: any = errAny;
    const stdout = e.stdout || '';
    const stderr = e.stderr || '';
    const msg = `gh command failed: gh ${safeArgs.join(' ')}\nstdout: ${stdout}\nstderr: ${stderr}`;
    // write diagnostics to stderr (do not pollute stdout which should be reserved for JSON)
    // eslint-disable-next-line no-console
    console.error(msg);
    throw new Error(msg);
  }
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
  try {
    const out = await ghJson(['repo', 'view', '--json', 'owner,name']);
    if (typeof out === 'string') throw new Error('Failed to get repo info');
    const owner = out.owner?.login || out.owner;
    const name = out.name;
    return { owner, name };
  } catch (err) {
    // fallback: try to infer from local git remotes
    try {
      const { execa } = await import('execa');
      // find top level git dir
      const root = (await execa('git', ['rev-parse', '--show-toplevel'])).stdout.trim();
      // try origin first
      let remoteUrl = '';
      try {
        remoteUrl = (await execa('git', ['remote', 'get-url', 'origin'], { cwd: root })).stdout.trim();
      } catch (_) {
        // try to get first remote name
        const remotesOut = (await execa('git', ['remote'], { cwd: root })).stdout.trim();
        const firstRemote = remotesOut.split(/\r?\n/)[0];
        if (!firstRemote) throw new Error('No git remote found');
        remoteUrl = (await execa('git', ['remote', 'get-url', firstRemote], { cwd: root })).stdout.trim();
      }
      // parse owner/repo from URL
      const m = remoteUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
      if (!m) throw new Error('Failed to parse remote URL');
      const parts = m[1].split('/');
      return { owner: parts[0], name: parts[1] };
    } catch (gitErr) {
      throw err; // rethrow original gh error for transparency
    }
  }
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

export async function requestWithRetry<T>(fn: () => Promise<T>, retries = 3, baseDelayMs = 500): Promise<T> {
  // Exponential backoff with full jitter per https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
  let attempt = 0;
  let lastErr: any;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      attempt++;
      if (attempt >= retries) break;
      // exponential backoff with jitter
      const exp = Math.pow(2, attempt);
      const maxDelay = baseDelayMs * exp;
      const delay = Math.floor(Math.random() * maxDelay);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastErr;
}
