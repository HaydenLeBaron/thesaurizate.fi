-- Up Migration

-- Enable UUID generation for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

----------------------------------------------------
-- Table: users
-- Purpose: Stores user identity and credentials.
-- NOTE: Each user has exactly one implicit account. We lock on this row
-- directly during transactions to prevent concurrent transfers.
----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

----------------------------------------------------
-- Table: transactions
-- Purpose: An immutable, append-only ledger of all financial movements.
-- This serves as the permanent audit trail and the ONLY source of truth for balances.
----------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- The UNIQUE constraint provides perfect, database-enforced idempotency.
    idempotency_key UUID NOT NULL UNIQUE,
    -- NULL source_user_id indicates a deposit (money injection into the system)
    source_user_id UUID REFERENCES users(id),
    destination_user_id UUID NOT NULL REFERENCES users(id),
    -- Amount stored as integer representing cents. Ensures a transaction always represents a positive movement of funds.
    amount BIGINT NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

----------------------------------------------------
-- Optimized indexes for JIT balance calculation and transaction queries
----------------------------------------------------
-- Composite index for balance queries (covers both source + destination lookups)
CREATE INDEX idx_transactions_user_balance
ON transactions (source_user_id, destination_user_id, created_at, amount);

-- Individual indexes for transaction history queries
CREATE INDEX idx_transactions_source ON transactions (source_user_id, created_at);
CREATE INDEX idx_transactions_dest ON transactions (destination_user_id, created_at);

----------------------------------------------------
-- Function: public.get_balance_on_date
-- Purpose: Calculate a user's balance at any point in time.
-- Performance: Optimized with STABLE PARALLEL SAFE for query parallelization.
-- Note: NULL source_user_id indicates a deposit (money entering the system)
----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_balance_on_date(
    p_user_id UUID,
    p_date TIMESTAMPTZ
)
RETURNS BIGINT AS $$
    SELECT COALESCE(SUM(
        CASE
            WHEN source_user_id = p_user_id THEN -amount
            WHEN destination_user_id = p_user_id THEN amount
            ELSE 0
        END
    ), 0)
    FROM transactions
    WHERE (source_user_id = p_user_id OR destination_user_id = p_user_id)
        AND created_at <= p_date;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

----------------------------------------------------
-- Function: public.get_current_balance
-- Purpose: Calculate a user's current balance from the ledger.
-- This is the ONLY source of truth for a user's balance.
-- Implementation: Delegates to get_balance_on_date with NOW() to avoid code duplication.
----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_balance(p_user_id UUID)
RETURNS BIGINT AS $$
    SELECT public.get_balance_on_date(p_user_id, NOW());
$$ LANGUAGE sql STABLE PARALLEL SAFE;

-- Down Migration

DROP FUNCTION IF EXISTS public.get_current_balance(UUID);
DROP FUNCTION IF EXISTS public.get_balance_on_date(UUID, TIMESTAMPTZ);
DROP INDEX IF EXISTS idx_transactions_dest;
DROP INDEX IF EXISTS idx_transactions_source;
DROP INDEX IF EXISTS idx_transactions_user_balance;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS users;
DROP EXTENSION IF EXISTS "uuid-ossp";