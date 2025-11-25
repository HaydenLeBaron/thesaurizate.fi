import { z } from 'zod';

export const AccountsWrite = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type AccountsWriteT = z.infer<typeof AccountsWrite>;
