import { z } from 'zod';
import { AccountsRead } from '../pgzod/index';
import { UsersRead } from '../pgzod/index';

// V2 Account response with balance (Plaid-style)
export const AccountWithBalanceSchema = z.object({
  accountId: AccountsRead.shape.id.meta({ description: 'Account UUID', example: '550e8400-e29b-41d4-a716-446655440000' }),
  balance: z.object({
    available: z.number().int().meta({ description: 'Available balance in cents', example: 50000 }),
    current: z.number().int().meta({ description: 'Current balance in cents', example: 50000 }),
    limit: z.number().int().nullable().meta({ description: 'Account limit in cents (null if no limit)', example: null }),
  }),
  liabilities: z.object({
    credit: z.number().int().meta({ description: 'Credit liability in cents', example: 0 }),
    mortgage: z.number().int().meta({ description: 'Mortgage liability in cents', example: 0 }),
  }),
  metadata: z.object({
    createdAt: z.string().datetime().meta({ description: 'Account creation timestamp', example: '2025-10-06T12:00:00Z' }),
    updatedAt: z.string().datetime().meta({ description: 'Account last update timestamp', example: '2025-10-06T12:00:00Z' }),
  }),
}).meta({ id: 'AccountWithBalance' });

// V2 Account list item (simplified account info)
export const AccountListItemSchema = z.object({
  accountId: AccountsRead.shape.id,
  userId: AccountsRead.shape.user_id,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).meta({ id: 'AccountListItem' });

// V2 Account contact information
export const AccountContactSchema = z.object({
  accountId: AccountsRead.shape.id,
  contact: z.object({
    email: UsersRead.shape.email.meta({ description: 'Contact email address', example: 'user@example.com' }),
    userId: UsersRead.shape.id.meta({ description: 'User UUID', example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' }),
  }),
}).meta({ id: 'AccountContact' });

// Query parameters
export const AccountListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional().default(100).meta({
    description: 'Maximum number of accounts to return',
    example: 100,
  }),
  offset: z.coerce.number().int().nonnegative().optional().default(0).meta({
    description: 'Number of accounts to skip',
    example: 0,
  }),
});

export const AccountBalanceQuerySchema = z.object({
  date: z.string().datetime().optional().meta({
    description: 'Optional ISO 8601 datetime to get historical balance',
    example: '2025-10-06T12:00:00Z',
  }),
});

export const AccountIdPathSchema = z.object({
  accountId: AccountsRead.shape.id.meta({ description: 'Account UUID', example: '550e8400-e29b-41d4-a716-446655440000' }),
});

export type AccountWithBalance = z.infer<typeof AccountWithBalanceSchema>;
export type AccountListItem = z.infer<typeof AccountListItemSchema>;
export type AccountContact = z.infer<typeof AccountContactSchema>;
