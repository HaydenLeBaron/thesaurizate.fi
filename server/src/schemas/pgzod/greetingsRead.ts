import { z } from 'zod';

export const GreetingsRead = z.object({
  id: z.number().int(),
  language: z.enum(["de", "en", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"]),
  greeting: z.string(),
  created_at: z.coerce.date(),
  description: z.string().nullable().optional(),
});

export type GreetingsReadT = z.infer<typeof GreetingsRead>;
