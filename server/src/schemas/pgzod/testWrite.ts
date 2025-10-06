import { z } from 'zod';

export const TestWrite = z.object({
  id: z.number().int().optional(),
  name: z.string(),
});

export type TestWriteT = z.infer<typeof TestWrite>;
