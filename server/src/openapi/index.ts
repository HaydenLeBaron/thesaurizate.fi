import { createDocument } from 'zod-openapi';
import { z } from 'zod';
import {
  CreateTransactionSchema,
  TransactionSchema,
  CreateDepositSchema,
  AccountBalanceSchema,
  BalanceQuerySchema,
  AccountIdPathSchema,
} from '../schemas/transactions';
import { CreateAccountSchema, AccountSchema } from '../schemas/accounts';

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
    '/v1/accounts': {
      post: {
        summary: 'Create a new account',
        description: 'Register a new account account',
        tags: ['Accounts'],
        requestBody: {
          content: {
            'application/json': {
              schema: CreateAccountSchema,
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created successfully',
            content: {
              'application/json': {
                schema: AccountSchema,
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
    '/v1/transactions': {
      post: {
        summary: 'Create a new transaction',
        description: 'Execute a financial transfer between two accounts with JIT balance verification',
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
    '/v1/accounts/{id}/balance': {
      get: {
        summary: 'Get account balance',
        description: 'Get current balance or historical balance at a specific date',
        tags: ['Transactions'],
        requestParams: {
          path: AccountIdPathSchema,
          query: BalanceQuerySchema,
        },
        responses: {
          '200': {
            description: 'Account balance',
            content: {
              'application/json': {
                schema: AccountBalanceSchema,
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
    '/v1/accounts/{id}/transactions': {
      get: {
        summary: 'Get account transaction history',
        description: 'Get all transactions where account is source or destination',
        tags: ['Transactions'],
        requestParams: {
          path: AccountIdPathSchema,
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
    '/v1/accounts/{id}/deposit': {
      post: {
        summary: 'Deposit money into account account',
        description: 'Inject money into the system by depositing funds into a account account',
        tags: ['Transactions'],
        requestParams: {
          path: AccountIdPathSchema,
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
    '/v2/ping': {
      get: {
        summary: 'Ping endpoint',
        description: 'Simple ping endpoint for version 2 API',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Ping successful',
            content: {
              'application/json': {
                schema: z.object({
                  status: z.string().meta({ example: 'ok' }),
                  version: z.string().meta({ example: 'v2' }),
                }),
              },
            },
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
