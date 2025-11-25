import { z } from 'zod';
import { TransactionsRead } from '../pgzod/index';

// V2 Transaction response (Plaid-style with camelCase)
export const TransactionSchema = z.object({
  transactionId: TransactionsRead.shape.id.meta({ description: 'Transaction UUID', example: '550e8400-e29b-41d4-a716-446655440000' }),
  idempotencyKey: TransactionsRead.shape.idempotency_key.meta({ description: 'Idempotency key', example: 'txn_abc123xyz' }),
  sourceAccountId: TransactionsRead.shape.source_account_id.nullable().meta({ description: 'Source account UUID (null for deposits)', example: '550e8400-e29b-41d4-a716-446655440000' }),
  destinationAccountId: TransactionsRead.shape.destination_account_id.meta({ description: 'Destination account UUID', example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' }),
  amount: TransactionsRead.shape.amount.meta({ description: 'Transaction amount in cents', example: 10050 }),
  createdAt: TransactionsRead.shape.created_at.meta({ description: 'Transaction creation timestamp', example: '2025-10-06T12:00:00Z' }),
}).meta({ id: 'V2Transaction' });

// Query parameters for transaction list
export const TransactionListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional().default(100).meta({
    description: 'Maximum number of transactions to return',
    example: 100,
  }),
  offset: z.coerce.number().int().nonnegative().optional().default(0).meta({
    description: 'Number of transactions to skip',
    example: 0,
  }),
  startDate: z.string().datetime().optional().meta({
    description: 'Start date for filtering transactions (ISO 8601)',
    example: '2025-10-01T00:00:00Z',
  }),
  endDate: z.string().datetime().optional().meta({
    description: 'End date for filtering transactions (ISO 8601)',
    example: '2025-10-31T23:59:59Z',
  }),
});

export type Transaction = z.infer<typeof TransactionSchema>;
