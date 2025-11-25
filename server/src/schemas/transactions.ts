import { z } from 'zod';
import { AccountsRead } from './pgzod/index';
import { TransactionsRead, TransactionsWrite } from './pgzod/index';

// Balance schema
const BalanceSchema = z.number().int().meta({ description: 'Balance in cents', example: 50000 })

// Base amount schema with DB constraints (positive integer)
const BaseAmountSchema = TransactionsWrite.shape.amount.int().positive()

// Transaction creation - Use TransactionsWrite, omit auto-generated fields, make source_account_id required, add business rules
export const CreateTransactionSchema = TransactionsWrite
  .omit({ id: true, created_at: true, source_account_id: true, idempotency_key: true, destination_account_id: true, amount: true })
  .extend({
    idempotency_key: TransactionsWrite.shape.idempotency_key.meta({ description: 'Unique key for idempotent requests', example: 'txn_abc123xyz' }),
    source_account_id: z.uuid().meta({ description: 'UUID of the account sending funds', example: '550e8400-e29b-41d4-a716-446655440000' }), // Make required (not nullable/optional)
    destination_account_id: TransactionsWrite.shape.destination_account_id.meta({ description: 'UUID of the account receiving funds', example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' }),
    amount: BaseAmountSchema.meta({ description: 'Transfer amount in cents', example: 10050 }),
  })
  .refine((data) => data.source_account_id !== data.destination_account_id, {
    message: 'Source and destination accounts must be different',
  })
  .meta({ id: 'CreateTransaction' });

// Deposit creation - Use TransactionsWrite, omit fields not in request body, add business rules
// Note: destination_account_id comes from path param, not request body
export const CreateDepositSchema = TransactionsWrite
  .omit({ id: true, source_account_id: true, created_at: true, destination_account_id: true, idempotency_key: true, amount: true })
  .extend({
    idempotency_key: TransactionsWrite.shape.idempotency_key.meta({ description: 'Unique key for idempotent requests', example: 'dep_xyz789abc' }),
    amount: BaseAmountSchema.meta({ description: 'Deposit amount in cents', example: 10000 }),
  })
  .meta({ id: 'CreateDeposit' });

// Transaction response - Use TransactionsRead directly
export const TransactionSchema = TransactionsRead.meta({ id: 'Transaction' });

// Account balance response (balance in cents)
export const AccountBalanceSchema = z.object({
  account_id: AccountsRead.shape.id,
  balance: BalanceSchema
}).meta({ id: 'AccountBalance' });

// Query/Path parameters
export const BalanceQuerySchema = z.object({
  date: z.iso.datetime().optional().meta({
    description: 'Optional ISO 8601 datetime to get historical balance',
    example: '2025-10-06T12:00:00Z'
  }),
});

export const AccountIdPathSchema = z.object({
  id: AccountsRead.shape.id.meta({ description: 'Account UUID', example: '550e8400-e29b-41d4-a716-446655440000' }),
});

export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
export type CreateDeposit = z.infer<typeof CreateDepositSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type AccountBalance = z.infer<typeof AccountBalanceSchema>;
