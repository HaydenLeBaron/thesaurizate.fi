import { z } from 'zod';

// Language enum with OpenAPI metadata
export const LanguageEnum = z.enum(["de", "en", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"]).meta({
  description: 'Language code',
  example: 'en',
});

// Full Greeting schema (for responses)
export const GreetingSchema = z.object({
  id: z.number().int().meta({
    description: 'Unique identifier for the greeting',
    example: 1,
  }),
  language: LanguageEnum,
  greeting: z.string().meta({
    description: 'The greeting text',
    example: 'Hello',
  }),
  created_at: z.coerce.date().meta({
    description: 'Creation timestamp',
    example: '2025-10-06T00:00:00.000Z',
  }),
  description: z.string().nullable().optional().meta({
    description: 'Optional description of the greeting',
    example: 'A friendly greeting',
  }),
}).meta({ id: 'Greeting' });

// Schema for creating a greeting (omit id and created_at)
export const CreateGreetingSchema = z.object({
  language: LanguageEnum,
  greeting: z.string().meta({
    description: 'The greeting text',
    example: 'Hello',
  }),
  description: z.string().nullable().optional().meta({
    description: 'Optional description of the greeting',
    example: 'A friendly greeting',
  }),
}).meta({ id: 'CreateGreeting' });

export type Greeting = z.infer<typeof GreetingSchema>;
export type CreateGreeting = z.infer<typeof CreateGreetingSchema>;
