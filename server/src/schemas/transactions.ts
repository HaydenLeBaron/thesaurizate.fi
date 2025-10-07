import { z } from 'zod';
import { UsersRead } from './pgzod/index';
import { TransactionsRead, TransactionsWrite } from './pgzod/index';

// Balance schema
const BalanceSchema = z.number().int().meta({ description: 'Balance in cents', example: 50000 })

// Base amount schema with DB constraints (positive integer)
const BaseAmountSchema = TransactionsWrite.shape.amount.int().positive()

// Transaction creation - Use TransactionsWrite, omit auto-generated fields, make source_user_id required, add business rules
export const CreateTransactionSchema = TransactionsWrite
  .omit({ id: true, created_at: true, source_user_id: true, idempotency_key: true, destination_user_id: true, amount: true })
  .extend({
    idempotency_key: TransactionsWrite.shape.idempotency_key.meta({ description: 'Unique key for idempotent requests', example: 'txn_abc123xyz' }),
    source_user_id: z.uuid().meta({ description: 'UUID of the user sending funds', example: '550e8400-e29b-41d4-a716-446655440000' }), // Make required (not nullable/optional)
    destination_user_id: TransactionsWrite.shape.destination_user_id.meta({ description: 'UUID of the user receiving funds', example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' }),
    amount: BaseAmountSchema.meta({ description: 'Transfer amount in cents', example: 10050 }),
  })
  .refine((data) => data.source_user_id !== data.destination_user_id, {
    message: 'Source and destination users must be different',
  })
  .meta({ id: 'CreateTransaction' });

// Deposit creation - Use TransactionsWrite, omit fields not in request body, add business rules
// Note: destination_user_id comes from path param, not request body
export const CreateDepositSchema = TransactionsWrite
  .omit({ id: true, source_user_id: true, created_at: true, destination_user_id: true, idempotency_key: true, amount: true })
  .extend({
    idempotency_key: TransactionsWrite.shape.idempotency_key.meta({ description: 'Unique key for idempotent requests', example: 'dep_xyz789abc' }),
    amount: BaseAmountSchema.meta({ description: 'Deposit amount in cents', example: 10000 }),
  })
  .meta({ id: 'CreateDeposit' });

// Transaction response - Use TransactionsRead directly
export const TransactionSchema = TransactionsRead.meta({ id: 'Transaction' });

// User balance response (balance in cents)
export const UserBalanceSchema = z.object({
  user_id: UsersRead.shape.id,
  balance: BalanceSchema
}).meta({ id: 'UserBalance' });

// Query/Path parameters
export const BalanceQuerySchema = z.object({
  date: z.iso.datetime().optional().meta({
    description: 'Optional ISO 8601 datetime to get historical balance',
    example: '2025-10-06T12:00:00Z'
  }),
});

export const UserIdPathSchema = z.object({
  id: UsersRead.shape.id.meta({ description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' }),
});

export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
export type CreateDeposit = z.infer<typeof CreateDepositSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type UserBalance = z.infer<typeof UserBalanceSchema>;
