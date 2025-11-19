import { z } from 'zod';

export const UsersRead = z.object({
  id: z.string().uuid(),
  email: z.string(),
  password_hash: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  account_number: z.string().nullable().optional(),
  routing_number: z.string().nullable().optional(),
  account_type: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  account_name: z.string().nullable().optional(),
});

export type UsersReadT = z.infer<typeof UsersRead>;
