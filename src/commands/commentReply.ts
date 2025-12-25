import { sendSingleReply } from '../lib/sendSingleReply.js';
import { shouldResolve } from '../lib/envUtils.js';

export default async function commentReply(
  prNumber: string, 
  targetId: string, 
  body: string, 
  resolve = false,
  dryRun = false
) {
  resolve = shouldResolve(resolve);
  
  // Send single reply without touching draft store
  await sendSingleReply(prNumber, targetId, body, resolve, false, dryRun);
}
