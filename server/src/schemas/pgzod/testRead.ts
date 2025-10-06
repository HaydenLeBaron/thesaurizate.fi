import { z } from 'zod';

export const TestRead = z.object({
  id: z.number().int(),
  name: z.string(),
});

export type TestReadT = z.infer<typeof TestRead>;
