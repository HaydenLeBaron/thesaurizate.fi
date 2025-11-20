import { z } from 'zod';

export const UsersRead = z.object({
  id: z.string().uuid(),
  email: z.string(),
  password_hash: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  account_number: z.string(),
  routing_number: z.string(),
  account_type: z.string(),
  contact_email: z.string(),
  contact_phone: z.string(),
  account_name: z.string(),
});

export type UsersReadT = z.infer<typeof UsersRead>;
