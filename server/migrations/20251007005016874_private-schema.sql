-- Up Migration
CREATE SCHEMA IF NOT EXISTS private;

-- Down Migration
-- Don't drop the private schema on rollback to preserve other tables that might use it