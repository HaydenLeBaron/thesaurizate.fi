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

// Individual name schema (first, middle, last, suffix)
export const IndividualNameSchema = z.object({
  first: z.string().meta({ description: 'First name', example: 'John' }),
  middle: z.string().nullable().meta({ description: 'Middle name', example: 'Michael' }),
  last: z.string().meta({ description: 'Last name', example: 'Doe' }),
  suffix: z.string().nullable().meta({ description: 'Name suffix (e.g., Jr., Sr., III)', example: 'Jr.' }),
}).meta({ id: 'IndividualName' });

// Customer name schema (extends IndividualName with prefix)
export const CustomerNameSchema = IndividualNameSchema.extend({
  prefix: z.string().nullable().meta({ description: 'Name prefix (e.g., Mr., Mrs., Dr.)', example: 'Mr.' }),
}).meta({ id: 'CustomerName' });

// Account holder relationship type enum
export const AccountHolderRelationshipSchema = z.enum([
  'AUTHORIZED_SIGNER',
  'PRIMARY',
  'SECONDARY',
]).meta({ id: 'AccountHolderRelationship' });

// Account holder schema (extends CustomerName with relationship)
export const AccountHolderSchema = CustomerNameSchema.extend({
  relationship: AccountHolderRelationshipSchema.meta({ description: 'Relationship type of account holder', example: 'PRIMARY' }),
}).meta({ id: 'AccountHolder' });

// Delivery address type enum
export const DeliveryAddressTypeSchema = z.enum([
  'BUSINESS',
  'DELIVERY',
  'HOME',
  'MAILING',
]).meta({ id: 'DeliveryAddressType' });

// Delivery address schema
export const DeliveryAddressSchema = z.object({
  type: DeliveryAddressTypeSchema.meta({ description: 'Address type', example: 'HOME' }),
  primary: z.boolean().meta({ description: 'Whether this is the primary address', example: true }),
  line1: z.string().meta({ description: 'Address line 1', example: '123 Main St' }),
  line2: z.string().nullable().meta({ description: 'Address line 2', example: 'Apt 4B' }),
  line3: z.string().nullable().meta({ description: 'Address line 3', example: null }),
  city: z.string().meta({ description: 'City', example: 'New York' }),
  region: z.string().nullable().meta({ description: 'State or region', example: 'NY' }),
  postalCode: z.string().max(10).nullable().meta({ description: 'Postal code (max 10 characters)', example: '10001' }),
  country: z.string().meta({ description: 'ISO 3166 country code', example: 'US' }),
}).meta({ id: 'DeliveryAddress' });

// Telephone number purpose enum
export const TelephoneNumberPurposeSchema = z.enum([
  'BOTH',
  'BUSINESS',
  'CELL',
  'FAX',
  'HOME',
  'PERSONAL',
]).meta({ id: 'TelephoneNumberPurpose' });

// Telephone network enum
export const TelephoneNetworkSchema = z.enum([
  'CELLULAR',
  'LANDLINE',
  'PAGER',
  'SATELLITE',
  'VOIP',
]).nullable().meta({ id: 'TelephoneNetwork' });

// Telephone number schema
export const TelephoneNumberSchema = z.object({
  type: TelephoneNumberPurposeSchema.meta({ description: 'Telephone type/purpose', example: 'CELL' }),
  country: z.string().min(1).max(4).regex(/^\+?[1-9][0-9]{0,2}$/).meta({ description: 'Country code (1-4 chars, pattern: ^\\+?[1-9][0-9]{0,2}$)', example: '1' }),
  number: z.string().max(15).regex(/^\d+$/).meta({ description: 'Telephone number (max 15 digits)', example: '5551234567' }),
  network: TelephoneNetworkSchema.meta({ description: 'Telephone network type', example: 'CELLULAR' }),
  primary: z.boolean().meta({ description: 'Whether this is the primary telephone', example: true }),
}).meta({ id: 'TelephoneNumber' });

// V2 Account contact information (comprehensive)
export const AccountContactSchema = z.object({
  accountId: AccountsRead.shape.id.meta({ description: 'Account UUID', example: '550e8400-e29b-41d4-a716-446655440000' }),
  holders: z.array(AccountHolderSchema).min(1).meta({ description: 'Account holders (1-2 holders per account)', example: [{ relationship: 'PRIMARY', first: 'John', middle: null, last: 'Doe', suffix: null, prefix: 'Mr.' }] }),
  emails: z.array(z.string().email()).min(1).meta({ description: 'Contact email addresses', example: ['user@example.com'] }),
  addresses: z.array(DeliveryAddressSchema).min(1).meta({ description: 'Delivery addresses', example: [{ type: 'HOME', primary: true, line1: '123 Main St', line2: null, line3: null, city: 'New York', region: 'NY', postalCode: '10001', country: 'US' }] }),
  telephones: z.array(TelephoneNumberSchema).min(1).meta({ description: 'Telephone numbers', example: [{ type: 'CELL', country: '1', number: '5551234567', network: 'CELLULAR', primary: true }] }),
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
