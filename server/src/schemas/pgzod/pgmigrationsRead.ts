import { z } from 'zod';

export const PgmigrationsRead = z.object({
  id: z.number().int(),
  name: z.string(),
  run_on: z.coerce.date(),
});

export type PgmigrationsReadT = z.infer<typeof PgmigrationsRead>;
