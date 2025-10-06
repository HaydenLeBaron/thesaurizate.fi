import { z } from 'zod';

export const GreetingsWrite = z.object({
  id: z.number().int().optional(),
  language: z.enum(["de", "en", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"]),
  greeting: z.string(),
  created_at: z.coerce.date().optional(),
  description: z.string().nullable().optional(),
});

export type GreetingsWriteT = z.infer<typeof GreetingsWrite>;
