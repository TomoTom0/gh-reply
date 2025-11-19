#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

const program = new Command();
const pkgPath = path.join(__dirname, '..', 'package.json');
let version = '0.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  version = pkg.version || version;
} catch (_e) {}

program.name('gh-reply').version(version);

program
  .command('list')
  .description('list open PRs')
  .option('--repo <owner/name>', 'specify repository')
  .action(async (opts: any) => {
    const cmd = await import('./commands/listCmd');
    await cmd.default(opts.repo);
  });

program
  .command('show <prNumber>')
  .description('show PR details')
  .option('--repo <owner/name>', 'specify repository')
  .action(async (prNumber: string, opts: any) => {
    const { gh } = await import('./lib/gh');
    const repo = opts.repo ? ['--repo', opts.repo] : [];
    const out = await gh(['pr', 'view', prNumber, ...repo]);
    console.log(out);
  });

const comment = program.command('comment').description('comment operations');

comment
  .command('list <prNumber>')
  .description('list review threads for a PR')
  .action(async (prNumber: string) => {
    const cmd = await import('./commands/commentList');
    await cmd.default(prNumber);
  });

comment
  .command('show <prNumber> <threadId>')
  .description('show review thread details')
  .action(async (prNumber: string, threadId: string) => {
    const cmd = await import('./commands/commentShow');
    await cmd.default(prNumber, threadId);
  });

const draft = program.command('draft').description('draft management');

draft
  .command('add <prNumber> <targetId> <body>')
  .option('-r, --resolve', 'mark to resolve after sending')
  .description('add draft reply')
  .action(async (prNumber: string, targetId: string, body: string, opts: any) => {
    const cmd = await import('./commands/draftAdd');
    await cmd.default(prNumber, targetId, body, !!opts.resolve);
  });

draft
  .command('show <prNumber>')
  .description('show drafts for PR')
  .action(async (prNumber: string) => {
    const cmd = await import('./commands/draftShow');
    await cmd.default(prNumber);
  });

draft
  .command('send <prNumber>')
  .option('-f, --force', 'force resolve even with empty body')
  .description('send drafts for PR')
  .option('--dry-run', 'show actions without making changes')
  .action(async (prNumber: string, opts: any) => {
    const cmd = await import('./commands/draftSend');
    await cmd.default(prNumber, !!opts.force, !!opts.dryRun);
  });

draft
  .command('clear <prNumber>')
  .description('clear drafts for PR')
  .action(async (prNumber: string) => {
    const cmd = await import('./commands/draftClear');
    await cmd.default(prNumber);
  });

program.parse(process.argv);
