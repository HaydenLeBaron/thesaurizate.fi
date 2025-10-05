import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { greetings, languageEnum } from '../db/schema';
import { z } from 'zod';

// Manually define the Zod schema for the language enum
export const languageSchema = z.enum(languageEnum.enumValues);

// Auto-generated Zod schemas from Drizzle schema
export const selectGreetingSchema = createSelectSchema(greetings);
export const insertGreetingSchema = createInsertSchema(greetings, {
    // Override the language schema to use our manual definition
    language: languageSchema,
});

// Custom schema for creating greetings (exclude id and createdAt)
export const createGreetingSchema = insertGreetingSchema.pick({
  language: true,
  greeting: true,
});

// Types
export type Greeting = z.infer<typeof selectGreetingSchema>;
export type CreateGreeting = z.infer<typeof createGreetingSchema>;
export type Language = z.infer<typeof languageSchema>;
