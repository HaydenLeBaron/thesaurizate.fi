import { createDocument } from 'zod-openapi';
import { z } from 'zod';
import {
  CreateTransactionSchema,
  TransactionSchema,
  CreateDepositSchema,
  UserBalanceSchema,
  BalanceQuerySchema,
  UserIdPathSchema,
} from '../schemas/transactions';
import { CreateUserSchema, UserSchema } from '../schemas/users';

export const openApiSpec = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'Thesaurum API',
    version: '1.0.0',
    description: 'API for managing financial transactions',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  paths: {
    '/users': {
      post: {
        summary: 'Create a new user',
        description: 'Register a new user account',
        tags: ['Users'],
        requestBody: {
          content: {
            'application/json': {
              schema: CreateUserSchema,
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: UserSchema,
              },
            },
          },
          '400': {
            description: 'Validation error',
          },
          '409': {
            description: 'Email already exists',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/transactions': {
      post: {
        summary: 'Create a new transaction',
        description: 'Execute a financial transfer between two users with JIT balance verification',
        tags: ['Transactions'],
        requestBody: {
          content: {
            'application/json': {
              schema: CreateTransactionSchema,
            },
          },
        },
        responses: {
          '201': {
            description: 'Transaction created successfully',
            content: {
              'application/json': {
                schema: TransactionSchema,
              },
            },
          },
          '400': {
            description: 'Bad request (validation error or insufficient funds)',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/users/{id}/balance': {
      get: {
        summary: 'Get user balance',
        description: 'Get current balance or historical balance at a specific date',
        tags: ['Transactions'],
        requestParams: {
          path: UserIdPathSchema,
          query: BalanceQuerySchema,
        },
        responses: {
          '200': {
            description: 'User balance',
            content: {
              'application/json': {
                schema: UserBalanceSchema,
              },
            },
          },
          '400': {
            description: 'Bad request (validation error)',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/users/{id}/transactions': {
      get: {
        summary: 'Get user transaction history',
        description: 'Get all transactions where user is source or destination',
        tags: ['Transactions'],
        requestParams: {
          path: UserIdPathSchema,
        },
        responses: {
          '200': {
            description: 'List of transactions',
            content: {
              'application/json': {
                schema: z.array(TransactionSchema),
              },
            },
          },
          '400': {
            description: 'Bad request (validation error)',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/users/{id}/deposit': {
      post: {
        summary: 'Deposit money into user account',
        description: 'Inject money into the system by depositing funds into a user account',
        tags: ['Transactions'],
        requestParams: {
          path: UserIdPathSchema,
        },
        requestBody: {
          content: {
            'application/json': {
              schema: CreateDepositSchema,
            },
          },
        },
        responses: {
          '201': {
            description: 'Deposit successful',
            content: {
              'application/json': {
                schema: TransactionSchema,
              },
            },
          },
          '400': {
            description: 'Bad request (validation error)',
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
