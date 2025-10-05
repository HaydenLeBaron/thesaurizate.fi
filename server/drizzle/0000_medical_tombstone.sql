CREATE TYPE "public"."language_enum" AS ENUM('en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "greetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" "language_enum" NOT NULL,
	"greeting" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
