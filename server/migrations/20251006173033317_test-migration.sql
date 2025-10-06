-- Up Migration

CREATE TABLE IF NOT EXISTS "test" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);

-- Down Migration