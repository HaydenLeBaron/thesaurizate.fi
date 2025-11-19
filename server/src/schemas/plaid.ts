import { z } from 'zod';

/**
 * Plaid Core Exchange / FDX API Schemas
 */

// Account Type
export const AccountTypeSchema = z.enum([
    'checking',
    'savings',
    'depository',
    'credit',
    'loan',
    'investment',
]);

// Account Schema
export const AccountSchema = z.object({
    accountId: z.string().uuid().meta({ description: 'Account identifier (user ID)', example: '123e4567-e89b-12d3-a456-426614174000' }),
    accountType: AccountTypeSchema.meta({ description: 'Type of account', example: 'checking' }),
    accountName: z.string().nullable().meta({ description: 'Display name for the account', example: 'Primary Checking' }),
    balance: z.object({
        amount: z.number().int().meta({ description: 'Balance in cents', example: 100000 }),
        currency: z.string().default('USD').meta({ description: 'Currency code', example: 'USD' }),
    }).meta({ description: 'Current account balance' }),
    routingNumber: z.string().nullable().meta({ description: 'Bank routing number', example: '021000021' }),
    accountNumber: z.string().nullable().meta({ description: 'Account number', example: '1234567890' }),
}).meta({ id: 'Account' });

// Transaction Type
export const TransactionTypeSchema = z.enum([
    'DEBIT',
    'CREDIT',
]);

// Transaction Schema (FDX format)
export const PlaidTransactionSchema = z.object({
    transactionId: z.string().uuid().meta({ description: 'Transaction identifier', example: '123e4567-e89b-12d3-a456-426614174000' }),
    accountId: z.string().uuid().meta({ description: 'Account identifier', example: '123e4567-e89b-12d3-a456-426614174000' }),
    amount: z.object({
        amount: z.number().int().meta({ description: 'Amount in cents', example: 5000 }),
        currency: z.string().default('USD').meta({ description: 'Currency code', example: 'USD' }),
    }).meta({ description: 'Transaction amount' }),
    transactionType: TransactionTypeSchema.meta({ description: 'Type of transaction', example: 'DEBIT' }),
    transactionDate: z.string().datetime().meta({ description: 'Transaction date/time', example: '2025-01-01T00:00:00Z' }),
    description: z.string().nullable().meta({ description: 'Transaction description', example: 'Transfer to user' }),
}).meta({ id: 'PlaidTransaction' });

// Payment Network Schema
export const PaymentNetworkSchema = z.object({
    accountId: z.string().uuid().meta({ description: 'Account identifier', example: '123e4567-e89b-12d3-a456-426614174000' }),
    networks: z.array(z.object({
        type: z.enum(['ACH', 'WIRE']).meta({ description: 'Payment network type', example: 'ACH' }),
        routingNumber: z.string().nullable().meta({ description: 'Routing number', example: '021000021' }),
        accountNumber: z.string().nullable().meta({ description: 'Account number', example: '1234567890' }),
    })).meta({ description: 'Supported payment networks' }),
}).meta({ id: 'PaymentNetwork' });

// Contact Schema
export const ContactSchema = z.object({
    accountId: z.string().uuid().meta({ description: 'Account identifier', example: '123e4567-e89b-12d3-a456-426614174000' }),
    email: z.string().email().meta({ description: 'Contact email', example: 'user@example.com' }),
    phone: z.string().nullable().meta({ description: 'Contact phone number', example: '+1234567890' }),
    name: z.string().nullable().meta({ description: 'Contact name', example: 'John Doe' }),
}).meta({ id: 'Contact' });

// Account ID Path Parameter
export const AccountIdPathSchema = z.object({
    accountId: z.string().uuid(),
}).meta({ id: 'AccountIdPath' });

// Transaction Query Parameters
export const TransactionQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
    offset: z.coerce.number().int().min(0).default(0).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
}).meta({ id: 'TransactionQuery' });

// Error Response Schema
export const ErrorResponseSchema = z.object({
    error: z.string().meta({ description: 'Error code', example: 'invalid_request' }),
    error_description: z.string().meta({ description: 'Human-readable error description', example: 'Invalid parameters' }),
}).meta({ id: 'ErrorResponse' });

// Export types
export type Account = z.infer<typeof AccountSchema>;
export type PlaidTransaction = z.infer<typeof PlaidTransactionSchema>;
export type PaymentNetwork = z.infer<typeof PaymentNetworkSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type AccountIdPath = z.infer<typeof AccountIdPathSchema>;
export type TransactionQuery = z.infer<typeof TransactionQuerySchema>;

