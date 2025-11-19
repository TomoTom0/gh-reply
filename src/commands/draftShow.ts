import { getDraftsForPr } from '../lib/store';

export default async function draftShow(prNumber: string) {
  const drafts = await getDraftsForPr(prNumber);
  const chalk = (await import('chalk')).default;
  for (const [k, v] of Object.entries(drafts)) {
    console.log(chalk.green(k), v.timestamp, v.resolve ? chalk.red('RESOLVE') : '');
    console.log(v.body);
    console.log('---');
  }
}
