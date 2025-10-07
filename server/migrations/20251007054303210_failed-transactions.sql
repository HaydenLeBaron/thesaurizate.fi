-- Up Migration
CREATE TABLE IF NOT EXISTS private.failed_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL,
  source_user_id UUID REFERENCES public.users(id),
  destination_user_id UUID REFERENCES public.users(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  addressed_at TIMESTAMPTZ NULL,
  CONSTRAINT different_users CHECK (source_user_id IS NULL OR source_user_id != destination_user_id)
);

CREATE INDEX IF NOT EXISTS idx_failed_transactions_idempotency_key ON private.failed_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_failed_transactions_failed_at ON private.failed_transactions(failed_at DESC);
CREATE INDEX IF NOT EXISTS idx_failed_transactions_source_user ON private.failed_transactions(source_user_id);
CREATE INDEX IF NOT EXISTS idx_failed_transactions_destination_user ON private.failed_transactions(destination_user_id);

-- Down Migration
DROP TABLE IF EXISTS private.failed_transactions;