/**
 * This file manually registers paths to the OpenAPI so that the API
 * is displayed in the raw OpenAPI spec and the Swagger UI visualization.
 */

import { z } from 'zod';
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { selectGreetingSchema, createGreetingSchema, languageSchema } from '../schemas/greeting.schema';

const registry = new OpenAPIRegistry();

// Register paths (don't register schemas separately with v8+)
registry.registerPath({
  method: 'get',
  path: '/greetings',
  summary: 'Get all greetings',
  tags: ['Greetings'],
  responses: {
    200: {
      description: 'List of all greetings',
      content: {
        'application/json': {
          schema: z.array(selectGreetingSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/greetings/{language}',
  summary: 'Get greetings by language',
  tags: ['Greetings'],
  request: {
    params: z.object({
      language: languageSchema,
    }),
  },
  responses: {
    200: {
      description: 'List of greetings in the specified language',
      content: {
        'application/json': {
          schema: z.array(selectGreetingSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/greetings',
  summary: 'Create a new greeting',
  tags: ['Greetings'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createGreetingSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Created greeting',
      content: {
        'application/json': {
          schema: selectGreetingSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/greetings/{id}',
  summary: 'Delete a greeting by ID',
  tags: ['Greetings'],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    204: {
      description: 'Greeting deleted successfully',
    },
    404: {
      description: 'Greeting not found',
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiSpec = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'Thesaurum API',
    version: '1.0.0',
    description: 'API for managing greetings in different languages',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
});
