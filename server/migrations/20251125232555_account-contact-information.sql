-- Up Migration

-- Extend users table with name fields
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS name_first TEXT,
  ADD COLUMN IF NOT EXISTS name_middle TEXT,
  ADD COLUMN IF NOT EXISTS name_last TEXT,
  ADD COLUMN IF NOT EXISTS name_suffix TEXT,
  ADD COLUMN IF NOT EXISTS name_prefix TEXT;

-- Modify accounts table to add account holder references
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS primary_account_holder_id UUID,
  ADD COLUMN IF NOT EXISTS secondary_account_holder_id UUID;

-- Add foreign key constraints for account holders
ALTER TABLE public.accounts
  ADD CONSTRAINT fk_accounts_primary_holder
    FOREIGN KEY (primary_account_holder_id)
    REFERENCES public.users(id)
    ON DELETE RESTRICT;

ALTER TABLE public.accounts
  ADD CONSTRAINT fk_accounts_secondary_holder
    FOREIGN KEY (secondary_account_holder_id)
    REFERENCES public.users(id)
    ON DELETE RESTRICT;

-- Add contact email to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Add address fields to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS address_type TEXT,
  ADD COLUMN IF NOT EXISTS address_primary BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS address_line3 TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_region TEXT,
  ADD COLUMN IF NOT EXISTS address_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_country TEXT;

-- Add telephone fields to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS telephone_type TEXT,
  ADD COLUMN IF NOT EXISTS telephone_country TEXT,
  ADD COLUMN IF NOT EXISTS telephone_number TEXT,
  ADD COLUMN IF NOT EXISTS telephone_network TEXT,
  ADD COLUMN IF NOT EXISTS telephone_primary BOOLEAN DEFAULT true;

-- Add check constraints for enums and patterns
-- Address type enum
ALTER TABLE public.accounts
  ADD CONSTRAINT chk_address_type
    CHECK (address_type IS NULL OR address_type IN ('BUSINESS', 'DELIVERY', 'HOME', 'MAILING'));

-- Telephone type enum
ALTER TABLE public.accounts
  ADD CONSTRAINT chk_telephone_type
    CHECK (telephone_type IS NULL OR telephone_type IN ('BOTH', 'BUSINESS', 'CELL', 'FAX', 'HOME', 'PERSONAL'));

-- Telephone network enum
ALTER TABLE public.accounts
  ADD CONSTRAINT chk_telephone_network
    CHECK (telephone_network IS NULL OR telephone_network IN ('CELLULAR', 'LANDLINE', 'PAGER', 'SATELLITE', 'VOIP'));

-- Telephone country code pattern (1-4 chars, pattern: ^\+?[1-9][0-9]{0,2}$)
-- Note: PostgreSQL CHECK constraints don't support full regex, so we'll validate in application layer
-- But we can add length constraint
ALTER TABLE public.accounts
  ADD CONSTRAINT chk_telephone_country_length
    CHECK (telephone_country IS NULL OR (LENGTH(telephone_country) >= 1 AND LENGTH(telephone_country) <= 4));

-- Telephone number max length (15 chars)
ALTER TABLE public.accounts
  ADD CONSTRAINT chk_telephone_number_length
    CHECK (telephone_number IS NULL OR LENGTH(telephone_number) <= 15);

-- Address postal code max length (10 chars)
ALTER TABLE public.accounts
  ADD CONSTRAINT chk_address_postal_code_length
    CHECK (address_postal_code IS NULL OR LENGTH(address_postal_code) <= 10);

-- Down Migration

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS chk_address_postal_code_length,
  DROP CONSTRAINT IF EXISTS chk_telephone_number_length,
  DROP CONSTRAINT IF EXISTS chk_telephone_country_length,
  DROP CONSTRAINT IF EXISTS chk_telephone_network,
  DROP CONSTRAINT IF EXISTS chk_telephone_type,
  DROP CONSTRAINT IF EXISTS chk_address_type;

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS fk_accounts_secondary_holder,
  DROP CONSTRAINT IF EXISTS fk_accounts_primary_holder;

ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS telephone_primary,
  DROP COLUMN IF EXISTS telephone_network,
  DROP COLUMN IF EXISTS telephone_number,
  DROP COLUMN IF EXISTS telephone_country,
  DROP COLUMN IF EXISTS telephone_type,
  DROP COLUMN IF EXISTS address_country,
  DROP COLUMN IF EXISTS address_postal_code,
  DROP COLUMN IF EXISTS address_region,
  DROP COLUMN IF EXISTS address_city,
  DROP COLUMN IF EXISTS address_line3,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS address_primary,
  DROP COLUMN IF EXISTS address_type,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS secondary_account_holder_id,
  DROP COLUMN IF EXISTS primary_account_holder_id;

ALTER TABLE public.users
  DROP COLUMN IF EXISTS name_prefix,
  DROP COLUMN IF EXISTS name_suffix,
  DROP COLUMN IF EXISTS name_last,
  DROP COLUMN IF EXISTS name_middle,
  DROP COLUMN IF EXISTS name_first;
