import { z } from 'zod';

export const AccountsRead = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AccountsReadT = z.infer<typeof AccountsRead>;
