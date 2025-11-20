import { z } from 'zod';

export const UsersWrite = z.object({
  id: z.string().uuid().optional(),
  email: z.string(),
  password_hash: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  account_number: z.string(),
  routing_number: z.string(),
  account_type: z.string(),
  contact_email: z.string(),
  contact_phone: z.string(),
  account_name: z.string(),
});

export type UsersWriteT = z.infer<typeof UsersWrite>;
