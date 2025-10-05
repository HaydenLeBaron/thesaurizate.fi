import { pgTable, serial, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

// Language enum
export const languageEnum = pgEnum('language_enum', ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko']);

// Greetings table
export const greetings = pgTable('greetings', {
  id: serial('id').primaryKey(),
  language: languageEnum('language').notNull(),
  greeting: text('greeting').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Export type
export type Greeting = typeof greetings.$inferSelect;
export type NewGreeting = typeof greetings.$inferInsert;
