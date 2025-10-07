-- Up Migration
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS private;

-- Down Migration
-- Don't drop the schemas on rollback to preserve any tables that might use them