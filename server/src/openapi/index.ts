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
import { CreateUserSchema, UserSchema } from '../schemas/users';
import {
  AccountListQuerySchema,
  AccountBalanceQuerySchema as V2AccountBalanceQuerySchema,
  AccountIdPathSchema as V2AccountIdPathSchema,
  AccountWithBalanceSchema,
  AccountListItemSchema,
  AccountContactSchema,
} from '../schemas/v2/accounts';
import {
  TransactionListQuerySchema,
  TransactionSchema as V2TransactionSchema,
} from '../schemas/v2/transactions';
import { PaymentNetworksResponseSchema } from '../schemas/v2/payment-networks';

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
    '/v1/users': {
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
    // V2 API Endpoints
    '/v2/accounts': {
      get: {
        summary: 'Search and view customer accounts',
        description: 'List all customer accounts with pagination',
        tags: ['V2 Accounts'],
        requestParams: {
          query: AccountListQuerySchema,
        },
        responses: {
          '200': {
            description: 'List of accounts',
            content: {
              'application/json': {
                schema: z.array(AccountListItemSchema),
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
    '/v2/accounts/{accountId}': {
      get: {
        summary: 'Get account balances, liabilities, and other information',
        description: 'Get account details including balance, liabilities, and metadata',
        tags: ['V2 Accounts'],
        requestParams: {
          path: V2AccountIdPathSchema,
          query: V2AccountBalanceQuerySchema,
        },
        responses: {
          '200': {
            description: 'Account with balance information',
            content: {
              'application/json': {
                schema: AccountWithBalanceSchema,
              },
            },
          },
          '404': {
            description: 'Account not found',
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
    '/v2/accounts/{accountId}/contact': {
      get: {
        summary: 'Get account contact information',
        description: 'Get contact information for an account',
        tags: ['V2 Accounts'],
        requestParams: {
          path: V2AccountIdPathSchema,
        },
        responses: {
          '200': {
            description: 'Account contact information',
            content: {
              'application/json': {
                schema: AccountContactSchema,
              },
            },
          },
          '404': {
            description: 'Account or user not found',
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
    '/v2/accounts/{accountId}/transactions': {
      get: {
        summary: 'List all account transactions',
        description: 'Get all transactions for an account with optional filtering and pagination',
        tags: ['V2 Transactions'],
        requestParams: {
          path: V2AccountIdPathSchema,
          query: TransactionListQuerySchema,
        },
        responses: {
          '200': {
            description: 'List of transactions',
            content: {
              'application/json': {
                schema: z.array(V2TransactionSchema),
              },
            },
          },
          '404': {
            description: 'Account not found',
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
    '/v2/accounts/{accountId}/payment-networks': {
      get: {
        summary: 'Get payment networks supported by an account',
        description: 'Get list of payment networks (e.g., ACH, WIRE) supported by an account',
        tags: ['V2 Accounts'],
        requestParams: {
          path: V2AccountIdPathSchema,
        },
        responses: {
          '200': {
            description: 'Payment networks for account',
            content: {
              'application/json': {
                schema: PaymentNetworksResponseSchema,
              },
            },
          },
          '404': {
            description: 'Account not found',
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
  },
});
