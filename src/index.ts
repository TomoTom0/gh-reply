#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const program = new Command();
// __dirname is not defined in ESM; derive from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.join(__dirname, '..', 'package.json');
let version = '0.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  version = pkg.version || version;
} catch (_e) {}

program.name('gh-reply').version(version);
// --repo is optional; gh CLI can infer repository from CWD when run inside a git repo
program.option('--repo <owner/name>', 'specify repository');

program
  .command('list')
  .description('list PRs')
  .option('--state <state>', 'PR state: open, closed, merged, all', 'open')
  .action(async (opts: any) => {
    const repo = program.opts().repo;
    const cmd = await import('./commands/listCmd.js');
    await cmd.default(repo, opts.state);
  });

program
  .command('show <prNumber>')
  .description('show PR details')
  .action(async (prNumber: string, opts: any) => {
    // Show PR details as JSON using gh --json
    const repoOpt = program.opts().repo;
    const { ghJson } = await import('./lib/gh.js');
    const args = ['pr', 'view', prNumber, '--json', 'title,body,author,headRefName,baseRefName,headRefOid,url'];
    if (repoOpt) args.push('--repo', repoOpt);
    const out = await ghJson(args);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
  });

const comment = program.command('comment').description('comment operations');

comment
  .command('list <prNumber>')
  .description('list review threads for a PR')
  .option('--all', 'include resolved threads')
  .option('--label <label>', 'filter by PR label')
  .option('--comment-filter <filters>', 'filter comments by author:NAME,contains:TEXT,severity:LEVEL (comma-separated)')
  .option('--detail <cols>', 'comma-separated detail fields to include (e.g. url,bodyHTML,diffHunk,commitOid)')
  .option('--page <n>', 'page number (1-based)', '1')
  .option('--per-page <n>', 'items per page', '10')
  .action(async (prNumber: string, opts: any) => {
    const cmd = await import('./commands/commentList.js');
    const page = Number(opts.page || 1);
    const perPage = Number(opts.perPage || opts['per-page'] || 10);
    await cmd.default(prNumber, {
      includeResolved: !!opts.all,
      label: opts.label || undefined,
      detail: opts.detail || undefined,
      page,
      perPage,
      commentFilter: opts.commentFilter || undefined,
    });
  });

comment
  .command('show <prNumber> <threadId>')
  .description('show review thread details')
  .option('--detail <cols>', 'comma-separated detail fields to include')
  .action(async (prNumber: string, threadId: string, opts: any) => {
    const cmd = await import('./commands/commentShow.js');
    await cmd.default(prNumber, threadId, opts.detail);
  });



const draft = program.command('draft').description('draft management');

draft
  .command('add <prNumber> <targetId> <body>')
  .option('-r, --resolve-force', 'mark to resolve after sending')
  .description('add draft reply')
  .action(async (prNumber: string, targetId: string, body: string, opts: any) => {
    const cmd = await import('./commands/draftAdd.js');
    await cmd.default(prNumber, targetId, body, !!opts.resolveForce);
  });

draft
  .command('show <prNumber>')
  .description('show drafts for PR')
  .action(async (prNumber: string) => {
    const cmd = await import('./commands/draftShow.js');
    await cmd.default(prNumber);
  });

draft
  .command('send <prNumber>')
  .option('-f, --force', 'force resolve even with empty body')
  .description('send drafts for PR')
  .option('--dry-run', 'show actions without making changes')
  .action(async (prNumber: string, opts: any) => {
    const cmd = await import('./commands/draftSend.js');
    await cmd.default(prNumber, !!opts.force, !!opts.dryRun);
  });

draft
  .command('clear <prNumber>')
  .description('clear drafts for PR')
  .action(async (prNumber: string) => {
    const cmd = await import('./commands/draftClear.js');
    await cmd.default(prNumber);
  });

program.parse(process.argv);
