#!/usr/bin/env node
const { execFileSync } = require('child_process');

const REPO = 'TomoTom0/gh-reply';
const PR = '1';

function runGhReply(args) {
  const out = execFileSync('node', ['./bin/gh-reply.js', ...args], { encoding: 'utf8' });
  return out;
}

function runCmd(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' });
}

const listOut = runGhReply(['comment', 'list', PR, '--repo', REPO, '--all']);
let threads = [];
try {
  threads = JSON.parse(listOut);
} catch (e) {
  console.error('Failed to parse thread list JSON:', e.message);
  console.error('Raw output was:', listOut);
  process.exit(1);
}

for (const t of threads) {
  const id = t.threadId;
  const path = t.path || '';
  let msg = '';
  if (path === 'src/commands/commentList.ts') {
    msg = 'ご指摘ありがとうございます。ご提案に従い、src/commands/commentList.ts の該当箇所で数値変換を簡潔化しました（コミット 0bbf03d）。GraphQL のフォールバック処理は維持しています。お手数ですがご確認ください。';
  } else if (path === 'src/commands/commentShow.ts') {
    msg = 'ご指摘ありがとうございます。commentShow の互換性向上案を受け取りました。現状は主要フィールド取得後にフォールバックを行う実装としていますが、追加対応を検討します。';
  } else if (path === 'src/commands/draftShow.ts') {
    msg = 'ご指摘ありがとうございます。draftShow の出力について、既存の drafts オブジェクトをそのまま JSON 出力する案に賛同します。対応を検討します。';
  } else if (path === 'src/commands/listCmd.ts') {
    msg = 'ご指摘ありがとうございます。repo オーバーライド処理の簡素化について同意します。呼び出し元との互換性を確認した上で修正します。';
  } else if (path === 'src/index.ts') {
    msg = 'ご指摘ありがとうございます。--repo の重複定義について整理します。';
  } else if (path === 'src/lib/gh.ts') {
    msg = 'ご指摘ありがとうございます。引数サニタイズ処理は map/filter/flat を用いて簡潔化する案を検討します。';
  } else {
    msg = 'ご指摘ありがとうございます。検討の上対応します。';
  }

  console.error('Adding draft for', id, 'path=', path);
  // use execFileSync to avoid shell quoting issues
  try {
    runCmd('node', ['./bin/gh-reply.js', 'draft', 'add', PR, id, msg, '--repo', REPO]);
  } catch (e) {
    console.error('Failed to add draft for', id, e.message);
  }
}

// send drafts
try {
  runCmd('node', ['./bin/gh-reply.js', 'draft', 'send', PR, '--repo', REPO]);
} catch (e) {
  console.error('Failed to send drafts:', e.message);
}

// list posted replies by current user
try {
  const gql = `query { repository(owner: "TomoTom0", name: "gh-reply") { pullRequest(number: 1) { reviewThreads(first:100) { nodes { id path comments(first:50) { nodes { id body author { login } createdAt url } } } } } } }`;
  const res = runCmd('gh', ['api', 'graphql', '-f', `query=${gql}`]);
  const parsed = JSON.parse(res);
  const nodes = parsed.data.repository.pullRequest.reviewThreads.nodes;
  const me = parsed.data.repository ? undefined : undefined;
  const mine = nodes.map(n => ({ threadId: n.id, path: n.path, myReplies: n.comments.nodes.filter(c => c.author && c.author.login === 'TomoTom0') })).filter(x => x.myReplies.length>0);
  console.log(JSON.stringify(mine, null, 2));
} catch (e) {
  console.error('Failed to list posted replies:', e.message);
}

