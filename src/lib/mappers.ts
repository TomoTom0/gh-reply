export function mapThreadNode(node: any) {
  const firstComment = (node.comments && node.comments.nodes && node.comments.nodes[0]) || {};
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
      commitOid: firstComment.commit?.oid || null,
      originalCommitOid: firstComment.originalCommit?.oid || null,
      diffHunk: firstComment.diffHunk || null,
      line: firstComment.line || firstComment.originalLine || null,
      path: firstComment.path || null,
      author: firstComment.author?.login || null,
      url: firstComment.url || null,
    },
  };
}

export function mapThreadDetail(node: any) {
  const lineVal = node.line || node.originalLine || node.originalStartLine || node.startLine || null;
  return {
    threadId: node.id,
    path: node.path || null,
    line: lineVal ? +lineVal : null,
    isResolved: !!node.isResolved,
    comments: (node.comments && node.comments.nodes || []).map((c: any) => ({
      id: c.id || null,
      databaseId: c.fullDatabaseId || null,
      body: c.body || '',
      bodyText: c.bodyText || null,
      bodyHTML: c.bodyHTML || null,
      createdAt: c.createdAt || null,
      commitOid: c.commit?.oid || null,
      originalCommitOid: c.originalCommit?.oid || null,
      diffHunk: c.diffHunk || null,
      line: c.line || c.originalLine || null,
      path: c.path || null,
      author: c.author?.login || null,
      url: c.url || null,
    })),
  };
}

