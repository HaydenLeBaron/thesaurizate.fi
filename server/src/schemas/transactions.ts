import { z } from 'zod';
import { TransactionsRead } from './pgzod/index';

// API-level transaction creation (amount in cents)
export const CreateTransactionSchema = z.object({
  idempotency_key: z.string().uuid().meta({ description: 'Unique key for idempotent requests' }),
  source_user_id: z.string().uuid().meta({ description: 'UUID of the user sending funds' }),
  destination_user_id: z.string().uuid().meta({ description: 'UUID of the user receiving funds' }),
  amount: z.number().int().positive().meta({
    description: 'Transfer amount in cents',
    example: 10050
  }),
}).refine(data => data.source_user_id !== data.destination_user_id, {
  message: 'Source and destination users must be different',
}).meta({ id: 'CreateTransaction' });

// API-level deposit creation (amount in cents)
export const CreateDepositSchema = z.object({
  idempotency_key: z.string().uuid().meta({ description: 'Unique key for idempotent requests' }),
  amount: z.number().int().positive().meta({
    description: 'Deposit amount in cents',
    example: 10000
  }),
}).meta({ id: 'CreateDeposit' });

// Transaction response - use pgzod schema directly
export const TransactionSchema = TransactionsRead.meta({ id: 'Transaction' });

// User balance response (balance in cents)
export const UserBalanceSchema = z.object({
  user_id: z.string().uuid(),
  balance: z.number().int().meta({ description: 'Balance in cents' }),
}).meta({ id: 'UserBalance' });

// Query/Path parameters
export const BalanceQuerySchema = z.object({
  date: z.string().datetime().optional().meta({
    description: 'Optional ISO 8601 datetime to get historical balance',
    example: '2025-10-06T12:00:00Z'
  }),
});

export const UserIdPathSchema = z.object({
  id: z.string().uuid().meta({ description: 'User UUID' }),
});

export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
export type CreateDeposit = z.infer<typeof CreateDepositSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type UserBalance = z.infer<typeof UserBalanceSchema>;
