import { z } from 'zod';

export const TransactionsRead = z.object({
  id: z.string().uuid(),
  idempotency_key: z.string().uuid(),
  source_account_id: z.string().uuid().nullable().optional(),
  destination_account_id: z.string().uuid(),
  amount: z.number().int(),
  created_at: z.string(),
});

export type TransactionsReadT = z.infer<typeof TransactionsRead>;
