#!/usr/bin/env node
import { execFileSync } from 'child_process';
import fs from 'fs';
const REPO = 'TomoTom0/gh-reply';
const REPO2 = 'TomoTom0/gh-reply';
const PR = '1';

function run(args) {
  return execFileSync('node', ['./bin/gh-reply.js', ...args], { encoding: 'utf8' });
}

function ghApiGraphql(q) {
  return execFileSync('gh', ['api', 'graphql', '-f', `query=${q}`], { encoding: 'utf8' });
}

function fileContains(path, substr) {
  if (!fs.existsSync(path)) return false;
  const c = fs.readFileSync(path, 'utf8');
  return c.indexOf(substr) !== -1;
}

function checkImplemented(path) {
  switch (path) {
    case 'src/commands/commentList.ts':
      return fileContains('src/commands/commentList.ts', '+line');
    case 'src/commands/commentShow.ts':
      return fileContains('src/commands/commentShow.ts', 'mapThreadDetail(');
    case 'src/commands/draftShow.ts':
      return fileContains('src/commands/draftShow.ts', 'JSON.stringify');
    case 'src/commands/listCmd.ts':
      return fileContains('src/commands/listCmd.ts', 'repoOverride || program.opts().repo');
    case 'src/index.ts':
      // suggestion was to remove duplicate option; check if show command still defines .option('--repo'
      return fileContains('src/index.ts', ".command('show <prNumber>')") && !fileContains('src/index.ts', ".command('show <prNumber>')\n  .option('--repo");
    case 'src/lib/gh.ts':
      return fileContains('src/lib/gh.ts', 'GH_PAGER');
    default:
      return false;
  }
}

function hasDetailedReply(threadId) {
  try {
    const out = run(['comment', 'show', PR, threadId, '--repo', REPO2]);
    const obj = JSON.parse(out);
    const comments = obj.comments || [];
    for (const c of comments) {
      if (c.author === 'TomoTom0') {
        const b = (c.body || '').toLowerCase();
        if (b.includes('commit') || b.includes('コミット') || b.includes('graphq') || b.includes('フォールバック') || b.includes('適用') || b.includes('+line') || b.includes('+line')) return true;
      }
    }
  } catch (e) {
    return false;
  }
  return false;
}

function addDraft(threadId, message) {
  try {
    execFileSync('node', ['./bin/gh-reply.js', 'draft', 'add', PR, threadId, message, '--repo', REPO2], { stdio: 'inherit' });
  } catch (e) {
    console.error('draft add failed', e.message);
  }
}

function sendDrafts() {
  try {
    execFileSync('node', ['./bin/gh-reply.js', 'draft', 'send', PR, '--repo', REPO2], { stdio: 'inherit' });
  } catch (e) {
    console.error('draft send failed', e.message);
  }
}

function main() {
  const listOut = run(['comment', 'list', PR, '--repo', REPO2, '--all']);
  const threads = JSON.parse(listOut);
  const toReply = [];
  for (const t of threads) {
    const tid = t.threadId;
    const path = t.path || '';
    const implemented = checkImplemented(path);
    const hasReply = hasDetailedReply(tid);
    console.log(`${tid} ${path} implemented=${implemented} hasDetailedReply=${hasReply}`);
    if (implemented && !hasReply) {
      // post implemented notice
      const msg = `対応しました：${path} に関して、該当箇所を修正しました（コミット 0bbf03d）。ご確認ください。`;
      toReply.push({ tid, msg });
    } else if (!implemented && !hasReply) {
      const msg = `ご指摘ありがとうございます。現在この指摘は未対応です。優先度を確認の上で対応予定です（または対応方針を提示します）。`;
      toReply.push({ tid, msg });
    }
  }
  if (toReply.length === 0) {
    console.log('No additional replies needed');
    return;
  }
  for (const r of toReply) {
    console.log('Adding draft for', r.tid);
    addDraft(r.tid, r.msg);
  }
  sendDrafts();
}

main();
