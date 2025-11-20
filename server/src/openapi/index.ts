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
import {
  AccountSchema,
  PlaidTransactionSchema,
  PaymentNetworkSchema,
  ContactSchema,
  AccountIdPathSchema,
  TransactionQuerySchema,
  ErrorResponseSchema,
} from '../schemas/plaid';

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
            description: 'User already exists',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/admin/users': {
      get: {
        summary: 'Get all users (admin only)',
        description: 'Retrieve all user IDs and emails. Requires admin scope.',
        tags: ['Admin'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of users with IDs and emails',
            content: {
              'application/json': {
                schema: z.array(
                  z.object({
                    id: z.string().uuid(),
                    email: z.string().email(),
                  })
                ),
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '403': {
            description: 'Forbidden - Admin scope required',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
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
    // OAuth 2.0 / OIDC Endpoints
    '/oauth/token': {
      post: {
        summary: 'OAuth 2.0 Token Endpoint',
        description: 'Exchange client credentials or authorization code for access token',
        tags: ['OAuth'],
        requestBody: {
          content: {
            'application/json': {
              schema: z.object({
                grant_type: z.enum(['client_credentials', 'authorization_code']),
                client_id: z.string(),
                client_secret: z.string().optional(),
                code: z.string().optional(),
                scope: z.string().optional(),
              }),
            },
            'application/x-www-form-urlencoded': {
              schema: z.object({
                grant_type: z.enum(['client_credentials', 'authorization_code']),
                client_id: z.string(),
                client_secret: z.string().optional(),
                code: z.string().optional(),
                scope: z.string().optional(),
              }),
            },
          },
        },
        responses: {
          '200': {
            description: 'Token issued successfully',
            content: {
              'application/json': {
                schema: z.object({
                  access_token: z.string(),
                  token_type: z.literal('Bearer'),
                  expires_in: z.number(),
                  scope: z.string().optional(),
                  id_token: z.string().optional(),
                }),
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '401': {
            description: 'Invalid client credentials',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
        },
      },
    },
    '/oauth/userinfo': {
      get: {
        summary: 'OIDC UserInfo Endpoint',
        description: 'Get user information from access token',
        tags: ['OAuth'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'User information',
            content: {
              'application/json': {
                schema: z.object({
                  sub: z.string(),
                  email: z.string().optional(),
                  email_verified: z.boolean().optional(),
                  name: z.string().optional(),
                }),
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
        },
      },
    },
    '/.well-known/openid-configuration': {
      get: {
        summary: 'OIDC Discovery Endpoint',
        description: 'OpenID Connect discovery document',
        tags: ['OAuth'],
        responses: {
          '200': {
            description: 'OIDC configuration',
            content: {
              'application/json': {
                schema: z.object({
                  issuer: z.string(),
                  authorization_endpoint: z.string(),
                  token_endpoint: z.string(),
                  userinfo_endpoint: z.string(),
                  jwks_uri: z.string(),
                  response_types_supported: z.array(z.string()),
                  grant_types_supported: z.array(z.string()),
                  scopes_supported: z.array(z.string()),
                  id_token_signing_alg_values_supported: z.array(z.string()),
                  token_endpoint_auth_methods_supported: z.array(z.string()),
                }),
              },
            },
          },
        },
      },
    },
    '/.well-known/jwks.json': {
      get: {
        summary: 'JWKS Endpoint',
        description: 'JSON Web Key Set for token verification',
        tags: ['OAuth'],
        responses: {
          '200': {
            description: 'JWKS document',
            content: {
              'application/json': {
                schema: z.object({
                  keys: z.array(z.any()),
                }),
              },
            },
          },
        },
      },
    },
    // Plaid Core Exchange / FDX Endpoints
    '/accounts': {
      get: {
        summary: 'List Accounts',
        description: 'Get all accounts for authenticated user',
        tags: ['Plaid'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of accounts',
            content: {
              'application/json': {
                schema: z.array(AccountSchema),
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
        },
      },
    },
    '/accounts/{accountId}': {
      get: {
        summary: 'Get Account Details',
        description: 'Get detailed account information',
        tags: ['Plaid'],
        security: [{ BearerAuth: [] }],
        requestParams: {
          path: AccountIdPathSchema,
        },
        responses: {
          '200': {
            description: 'Account details',
            content: {
              'application/json': {
                schema: AccountSchema,
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '403': {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
        },
      },
    },
    '/accounts/{accountId}/transactions': {
      get: {
        summary: 'Get Account Transactions',
        description: 'Get transaction history for an account',
        tags: ['Plaid'],
        security: [{ BearerAuth: [] }],
        requestParams: {
          path: AccountIdPathSchema,
          query: TransactionQuerySchema,
        },
        responses: {
          '200': {
            description: 'List of transactions',
            content: {
              'application/json': {
                schema: z.array(PlaidTransactionSchema),
              },
            },
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '403': {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
        },
      },
    },
    '/accounts/{accountId}/payment-networks': {
      get: {
        summary: 'Get Payment Networks',
        description: 'Get payment network information for an account',
        tags: ['Plaid'],
        security: [{ BearerAuth: [] }],
        requestParams: {
          path: AccountIdPathSchema,
        },
        responses: {
          '200': {
            description: 'Payment network information',
            content: {
              'application/json': {
                schema: PaymentNetworkSchema,
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '403': {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
        },
      },
    },
    '/accounts/{accountId}/contact': {
      get: {
        summary: 'Get Account Contact',
        description: 'Get contact information for an account',
        tags: ['Plaid'],
        security: [{ BearerAuth: [] }],
        requestParams: {
          path: AccountIdPathSchema,
        },
        responses: {
          '200': {
            description: 'Contact information',
            content: {
              'application/json': {
                schema: ContactSchema,
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '403': {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: ErrorResponseSchema,
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'OAuth 2.0 Bearer Token',
      },
    },
  },
});
