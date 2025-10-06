import { z } from 'zod';

export const UsersRead = z.object({
  id: z.string().uuid(),
  email: z.string(),
  password_hash: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type UsersReadT = z.infer<typeof UsersRead>;
