-- Create language enum (idempotent)
DO $$ BEGIN
  CREATE TYPE "public"."language_enum" AS ENUM('en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create greetings table
CREATE TABLE IF NOT EXISTS "greetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" "language_enum" NOT NULL,
	"greeting" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
