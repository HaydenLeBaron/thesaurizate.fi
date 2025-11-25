import { z } from 'zod';

export const TransactionsWrite = z.object({
  id: z.string().uuid().optional(),
  idempotency_key: z.string().uuid(),
  source_account_id: z.string().uuid().nullable().optional(),
  destination_account_id: z.string().uuid(),
  amount: z.number().int(),
  created_at: z.string().optional(),
});

export type TransactionsWriteT = z.infer<typeof TransactionsWrite>;
