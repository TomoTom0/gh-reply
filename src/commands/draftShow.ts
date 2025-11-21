import { getDraftsForPr } from '../lib/store.js';

export default async function draftShow(prNumber: string) {
  const drafts = await getDraftsForPr(prNumber);
  const mapped: Record<string, any> = {};
  for (const [k, v] of Object.entries(drafts)) {
    mapped[k] = v;
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(mapped, null, 2));
}
