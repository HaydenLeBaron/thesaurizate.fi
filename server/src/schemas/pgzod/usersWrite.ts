import { z } from 'zod';

export const UsersWrite = z.object({
  id: z.string().uuid().optional(),
  email: z.string(),
  password_hash: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  account_number: z.string().nullable().optional(),
  routing_number: z.string().nullable().optional(),
  account_type: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  account_name: z.string().nullable().optional(),
});

export type UsersWriteT = z.infer<typeof UsersWrite>;
