import { getRepoInfo, ghGraphql } from '../lib/gh.js';
import { program } from 'commander';
import { mapThreadNode } from '../lib/mappers.js';

type Options = {
  includeResolved?: boolean;
  label?: string | undefined;
  detail?: string | undefined;
  page?: number;
  perPage?: number;
  commentFilter?: string | undefined;
};

export default async function commentList(prNumber: string, opts: Options | boolean = false) {
  const options: Options = typeof opts === 'boolean' ? { includeResolved: opts } : opts || {};
  const { ensureGhAvailable } = await import('../lib/gh.js');
  await ensureGhAvailable();
  const repoOption = program.opts().repo;
  const repo = await getRepoInfo(repoOption);
  // request only fields that exist in the schema to avoid undefinedField errors
  const query = `{
    repository(owner: \"${repo.owner}\", name: \"${repo.name}\") {
      pullRequest(number: ${prNumber}) {
        labels(first:100) { nodes { name } }
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
    const prNode = out.data.repository.pullRequest;
    const prLabels = (prNode.labels && prNode.labels.nodes || []).map((l: any) => String(l.name).toLowerCase());

    // --label option: check if the PR has the specified labels
    if (options.label) {
      const requiredLabels = options.label.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
      const hasAllLabels = requiredLabels.every((label: string) => prLabels.includes(label));
      if (!hasAllLabels) {
        // PRが指定ラベルを持っていない場合は空の結果を返す
        const emptyResult = { total: 0, page: 1, perPage: options.perPage || 10, items: [], filteredByLabel: true, missingLabels: requiredLabels.filter((l: string) => !prLabels.includes(l)) };
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(emptyResult, null, 2));
        return;
      }
    }

    const nodes = prNode.reviewThreads.nodes;
    const filteredNodes = options.includeResolved ? nodes : nodes.filter((n: any) => !n.isResolved);
    let mappedItems = filteredNodes.map((node: any) => mapThreadNode(node));

    // comment-filter を適用（ページネーションの前に）
    const cf = options.commentFilter || '';
    const filters = (cf || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    if (filters.length > 0) {
      mappedItems = mappedItems.filter((it: any) => {
        const c = it.comment || {};
        for (const f of filters) {
          const [k, v] = f.split(':', 2).map((s: string) => s.trim());
          if (!k || !v) continue;
          if (k === 'author' && String(c.author || '').toLowerCase() !== v.toLowerCase()) return false;
          if (k === 'contains' && !(String(c.body || '').toLowerCase().includes(v.toLowerCase()))) return false;
          if (k === 'severity') {
            const sev = v.toLowerCase();
            if (!prLabels.includes(sev) && !(String(c.body || '').toLowerCase().includes(sev))) return false;
          }
        }
        return true;
      });
    }

    // pagination（フィルタリング後に適用）
    const total = mappedItems.length;
    const page = options.page && options.page > 0 ? options.page : 1;
    const perPage = options.perPage && options.perPage > 0 ? options.perPage : 10;
    const start = (page - 1) * perPage;
    const pageItems = mappedItems.slice(start, start + perPage);

    // detail フィールド除外（1回の map にまとめる）
    const detailSet = new Set((options.detail || '').split(',').map((s: string) => s.trim()).filter(Boolean));
    const mapped = pageItems.map((m: any) => {
      if (m.comment) {
        if (!detailSet.has('bodyHTML')) { delete m.comment.bodyHTML; }
        if (!detailSet.has('diffHunk')) { delete m.comment.diffHunk; }
        if (!detailSet.has('commitOid')) { delete m.comment.commitOid; delete m.comment.originalCommitOid; }
        if (!detailSet.has('url')) { delete m.comment.url; }
      }
      return m;
    });

    // include pagination metadata
    const result = { total, page, perPage, items: mapped };
    // output JSON on stdout
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 2;
  }
}
