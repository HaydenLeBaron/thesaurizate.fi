import { createDocument } from 'zod-openapi';
import { z } from 'zod';
import { GreetingSchema, CreateGreetingSchema, LanguageEnum } from '../schemas/greetings';
import { TestEndpointSchema } from '../schemas/testEndpoint';

export const openApiSpec = createDocument({
  openapi: '3.1.0',
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
  paths: {
    '/greetings': {
      get: {
        summary: 'Get all greetings',
        tags: ['Greetings'],
        responses: {
          '200': {
            description: 'List of all greetings',
            content: {
              'application/json': {
                schema: z.array(GreetingSchema),
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a new greeting',
        tags: ['Greetings'],
        requestBody: {
          content: {
            'application/json': {
              schema: CreateGreetingSchema,
            },
          },
        },
        responses: {
          '201': {
            description: 'Created greeting',
            content: {
              'application/json': {
                schema: GreetingSchema,
              },
            },
          },
        },
      },
    },
    '/greetings/{language}': {
      get: {
        summary: 'Get greetings by language',
        tags: ['Greetings'],
        requestParams: {
          path: z.object({
            language: LanguageEnum,
          }),
        },
        responses: {
          '200': {
            description: 'List of greetings in the specified language',
            content: {
              'application/json': {
                schema: z.array(GreetingSchema),
              },
            },
          },
        },
      },
    },
    '/greetings/{id}': {
      delete: {
        summary: 'Delete a greeting by ID',
        tags: ['Greetings'],
        requestParams: {
          path: z.object({
            id: z.number().int().positive().meta({
              description: 'Greeting ID',
              example: 1,
            }),
          }),
        },
        responses: {
          '200': {
            description: 'Deleted greeting',
            content: {
              'application/json': {
                schema: GreetingSchema,
              },
            },
          },
          '404': {
            description: 'Greeting not found',
          },
        },
      },
    },
    '/testEndpoint': {
      get: {
        summary: 'Get all test rows',
        description: 'Retrieves a list of all rows from the test table.',
        tags: ['Test'],
        responses: {
          '200': {
            description: 'A list of test rows',
            content: {
              'application/json': {
                schema: z.array(TestEndpointSchema),
              },
            },
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: z.object({
                  status: z.string().meta({ example: 'ok' }),
                }),
              },
            },
          },
        },
      },
    },
  },
});
