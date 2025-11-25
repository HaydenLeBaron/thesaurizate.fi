-- Up Migration

-- Enable UUID generation for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

----------------------------------------------------
-- Table: public.users
-- Purpose: Stores user identity and credentials.
-- A user can have many accounts.
----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

----------------------------------------------------
-- Table: public.accounts
-- Purpose: Stores account information.
-- NOTE: We lock on this row directly during transactions to prevent concurrent transfers.
-- A user can have many accounts.
----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

----------------------------------------------------
-- Table: public.transactions
-- Purpose: An immutable, append-only ledger of all financial movements.
-- This serves as the permanent audit trail and the ONLY source of truth for balances.
----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- The UNIQUE constraint provides perfect, database-enforced idempotency.
    idempotency_key UUID NOT NULL UNIQUE,
    -- NULL source_account_id indicates a deposit (money injection into the system)
    source_account_id UUID REFERENCES public.accounts(id),
    destination_account_id UUID NOT NULL REFERENCES public.accounts(id),
    -- Amount stored as integer representing cents. Ensures a transaction always represents a positive movement of funds.
    amount BIGINT NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

----------------------------------------------------
-- Optimized indexes for JIT balance calculation and transaction queries
----------------------------------------------------
-- Composite index for balance queries (covers both source + destination lookups)
CREATE INDEX IF NOT EXISTS idx_transactions_account_balance
ON public.transactions (source_account_id, destination_account_id, created_at, amount);

-- Individual indexes for transaction history queries
CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.transactions (source_account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_dest ON public.transactions (destination_account_id, created_at);

----------------------------------------------------
-- Function: public.get_balance_on_date
-- Purpose: Calculate a account's balance at any point in time.
-- Performance: Optimized with STABLE PARALLEL SAFE for query parallelization.
-- Note: NULL source_account_id indicates a deposit (money entering the system)
----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_balance_on_date(
    p_account_id UUID,
    p_date TIMESTAMPTZ
)
RETURNS BIGINT AS $$
    SELECT COALESCE(SUM(
        CASE
            WHEN source_account_id = p_account_id THEN -amount
            WHEN destination_account_id = p_account_id THEN amount
            ELSE 0
        END
    ), 0)
    FROM public.transactions
    WHERE (source_account_id = p_account_id OR destination_account_id = p_account_id)
        AND created_at <= p_date;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

----------------------------------------------------
-- Function: public.get_current_balance
-- Purpose: Calculate a account's current balance from the ledger.
-- This is the ONLY source of truth for a account's balance.
-- Implementation: Delegates to get_balance_on_date with NOW() to avoid code duplication.
----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_balance(p_account_id UUID)
RETURNS BIGINT AS $$
    SELECT public.get_balance_on_date(p_account_id, NOW());
$$ LANGUAGE sql STABLE PARALLEL SAFE;

-- Down Migration

DROP FUNCTION IF EXISTS public.get_current_balance(UUID);
DROP FUNCTION IF EXISTS public.get_balance_on_date(UUID, TIMESTAMPTZ);
DROP INDEX IF EXISTS idx_transactions_dest;
DROP INDEX IF EXISTS idx_transactions_source;
DROP INDEX IF EXISTS idx_transactions_account_balance;
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.accounts;
DROP TABLE IF EXISTS public.users;
DROP EXTENSION IF EXISTS "uuid-ossp";