import { z } from 'zod';

export const PgmigrationsWrite = z.object({
  id: z.number().int().optional(),
  name: z.string(),
  run_on: z.coerce.date(),
});

export type PgmigrationsWriteT = z.infer<typeof PgmigrationsWrite>;
