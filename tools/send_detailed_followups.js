#!/usr/bin/env node
const { execFileSync } = require('child_process');

const REPO = 'TomoTom0/gh-reply';
const PR = '1';
const MY = 'TomoTom0';
const COMMIT = '0bbf03d';

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' });
}

function ghReply(args) {
  return run('node', ['./bin/gh-reply.js', ...args]);
}

function listThreads() {
  const out = ghReply(['comment', 'list', PR, '--repo', REPO, '--all']);
  return JSON.parse(out);
}

function postDraft(threadId, message) {
  try {
    run('node', ['./bin/gh-reply.js', 'draft', 'add', PR, threadId, message, '--repo', REPO]);
    return true;
  } catch (e) {
    console.error('failed to add draft for', threadId, e.message);
    return false;
  }
}

function sendDrafts() {
  try {
    run('node', ['./bin/gh-reply.js', 'draft', 'send', PR, '--repo', REPO]);
  } catch (e) {
    console.error('failed to send drafts', e.message);
  }
}

function makeMessage(path) {
  // produce a polite, specific message per file
  switch (path) {
    case 'src/commands/commentList.ts':
      return `ご指摘ありがとうございます。ご提案に従い、${path} の該当箇所で数値変換を簡潔化しました（コミット ${COMMIT}）。具体的には \`typeof\` チェックを \`line ? +line : null\` に置換しています。GraphQL のフォールバック処理は維持しています。変更に問題がないかご確認ください。`;
    case 'src/commands/commentShow.ts':
      return `ご指摘ありがとうございます。commentShow の拡張フィールド取得に関する互換性向上のご提案を受け取りました。現状は主要フィールド取得後にフォールバックを行う実装としていますが、例外時の追加フォールバックを近日中に実装する予定です。実装方針や優先順位にご意見があればお知らせください。`;
    case 'src/commands/draftShow.ts':
      return `ご指摘ありがとうございます。draftShow の出力は、既存の下書きオブジェクトをそのまま JSON 出力する形に簡潔化する案に賛同します。安全性（エスケープ/文字列長等）を確認した上で対応を進めます。対応予定日や優先度の希望があれば教えてください。`;
    case 'src/commands/listCmd.ts':
      return `ご指摘ありがとうございます。repo オーバーライドの取り扱いについて、より読みやすい形に簡素化する案に同意します。呼び出し元との互換性を確認したうえで修正を行う予定です。具体案があれば共有いただけると助かります。`;
    case 'src/index.ts':
      return `ご指摘ありがとうございます。--repo の重複定義は整理します。グローバルオプションに一本化する方向で修正を進めますが、問題があればお知らせください。`;
    case 'src/lib/gh.ts':
      return `ご指摘ありがとうございます。引数サニタイズ処理は map/filter/flat を利用してより宣言的に簡潔化する方針で検討します。パフォーマンス上の懸念があれば教えてください。`;
    default:
      return `ご指摘ありがとうございます。いただいたフィードバックを踏まえ対応を検討します。`;
  }
}

function main() {
  const threads = listThreads();
  for (const t of threads) {
    const id = t.threadId;
    const path = t.path || '';
    const msg = makeMessage(path);
    console.error('Posting detailed follow-up to', id, '(', path, ')');
    postDraft(id, msg);
  }
  // send
  sendDrafts();
}

main();

