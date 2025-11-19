import { z } from 'zod';

export const DraftEntrySchema = z.object({
  body: z.string(),
  path: z.string().optional(),
  line: z.number().optional(),
  originalComment: z.string().optional(),
  resolve: z.boolean().optional(),
  timestamp: z.string()
});

export const DraftsSchema = z.record(z.record(DraftEntrySchema));

export type DraftEntry = z.infer<typeof DraftEntrySchema>;
export type Drafts = z.infer<typeof DraftsSchema>;
