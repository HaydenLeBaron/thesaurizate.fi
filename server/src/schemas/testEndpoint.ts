import { z } from 'zod';

// Full Test schema (for responses)
export const TestEndpointSchema = z.object({
  id: z.number().int().meta({
    description: 'Unique identifier for the test row',
    example: 1,
  }),
  name: z.string().meta({
    description: 'The name value',
    example: 'Test Name',
  }),
}).meta({ id: 'TestEndpoint' });

// Schema for creating a test row (omit id)
export const CreateTestEndpointSchema = z.object({
  name: z.string().meta({
    description: 'The name value',
    example: 'Test Name',
  }),
}).meta({ id: 'CreateTestEndpoint' });

export type TestEndpoint = z.infer<typeof TestEndpointSchema>;
export type CreateTestEndpoint = z.infer<typeof CreateTestEndpointSchema>;
