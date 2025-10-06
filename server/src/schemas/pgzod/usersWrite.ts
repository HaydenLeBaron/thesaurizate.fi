import { z } from 'zod';

export const UsersWrite = z.object({
  id: z.string().uuid().optional(),
  email: z.string(),
  password_hash: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type UsersWriteT = z.infer<typeof UsersWrite>;
