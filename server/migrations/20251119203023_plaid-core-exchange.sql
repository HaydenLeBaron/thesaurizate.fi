-- Up Migration

----------------------------------------------------
-- Add Plaid Core Exchange fields to users table
-- Purpose: Support Plaid Core Exchange integration by adding
-- account information fields to the users table.
-- Note: Since the system uses 1 user = 1 account, we extend
-- the users table rather than creating a separate accounts table.
----------------------------------------------------
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS account_number TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS routing_number TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS account_name TEXT NOT NULL;

-- Down Migration

ALTER TABLE public.users
DROP COLUMN IF EXISTS account_number,
DROP COLUMN IF EXISTS routing_number,
DROP COLUMN IF EXISTS account_type,
DROP COLUMN IF EXISTS contact_email,
DROP COLUMN IF EXISTS contact_phone,
DROP COLUMN IF EXISTS account_name;

