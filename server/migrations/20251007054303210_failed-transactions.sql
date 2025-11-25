-- Up Migration
CREATE TABLE IF NOT EXISTS private.failed_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL,
  source_account_id UUID REFERENCES public.accounts(id),
  destination_account_id UUID REFERENCES public.accounts(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  addressed_at TIMESTAMPTZ NULL,
  CONSTRAINT different_accounts CHECK (source_account_id IS NULL OR source_account_id != destination_account_id)
);

CREATE INDEX IF NOT EXISTS idx_failed_transactions_idempotency_key ON private.failed_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_failed_transactions_failed_at ON private.failed_transactions(failed_at DESC);
CREATE INDEX IF NOT EXISTS idx_failed_transactions_source_account ON private.failed_transactions(source_account_id);
CREATE INDEX IF NOT EXISTS idx_failed_transactions_destination_account ON private.failed_transactions(destination_account_id);

-- Down Migration
DROP TABLE IF EXISTS private.failed_transactions;