import request from 'supertest';
import { app } from './app';
import { pool } from '../db';
import { randomUUID } from 'crypto';

describe('Schema Validation Tests', () => {
  let accountId: string;

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE transactions, accounts, users RESTART IDENTITY CASCADE');

    const userResponse = await request(app)
      .post('/users')
      .send({
        email: 'schema@example.com',
        password: 'password123',
      });
    const userId = userResponse.body.id;

    const accountResponse = await request(app)
      .post('/accounts')
      .send({
        user_id: userId,
      });
    accountId = accountResponse.body.id;
  });

  describe('Account Creation Schema Validation', () => {
    it('should validate user_id field type', async () => {
      const invalidTypes = [
        { user_id: 123 },
        { user_id: true },
        { user_id: {} },
        { user_id: [] },
        { user_id: 'not-a-uuid' },
      ];

      for (const body of invalidTypes) {
        const response = await request(app)
          .post('/accounts')
          .send(body)
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should reject missing user_id', async () => {
      const response = await request(app)
        .post('/accounts')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject extra unexpected fields gracefully', async () => {
      const userResponse = await request(app)
        .post('/users')
        .send({
          email: 'extra@example.com',
          password: 'password123',
        })
        .expect(201);

      const response = await request(app)
        .post('/accounts')
        .send({
          user_id: userResponse.body.id,
          unexpectedField: 'unexpected',
          anotherField: 'another',
        })
        .expect(201);

      // Should succeed and ignore extra fields
      expect(response.body.user_id).toBe(userResponse.body.id);
      expect(response.body).not.toHaveProperty('unexpectedField');
    });
  });

  describe('Transaction Creation Schema Validation', () => {
    let account2Id: string;

    beforeEach(async () => {
      const user2Response = await request(app)
        .post('/users')
        .send({
          email: 'account2@example.com',
          password: 'password123',
        });
      const userId2 = user2Response.body.id;

      const account2Response = await request(app)
        .post('/accounts')
        .send({
          user_id: userId2,
        });
      account2Id = account2Response.body.id;

      await request(app).post(`/accounts/${accountId}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 100000,
      });
    });

    it('should validate all required fields are present', async () => {
      const requiredFields = [
        'idempotency_key',
        'source_account_id',
        'destination_account_id',
        'amount',
      ];

      for (const fieldToOmit of requiredFields) {
        const body: any = {
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 1000,
        };
        delete body[fieldToOmit];

        const response = await request(app)
          .post('/transactions')
          .send(body)
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should validate idempotency_key is UUID format', async () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '12345',
        '',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        '00000000-0000-0000-0000-000000000000g',
      ];

      for (const invalidUUID of invalidUUIDs) {
        const response = await request(app)
          .post('/transactions')
          .send({
            idempotency_key: invalidUUID,
            source_account_id: accountId,
            destination_account_id: account2Id,
            amount: 1000,
          })
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should validate source_account_id is UUID format', async () => {
      const response = await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: 'not-a-uuid',
          destination_account_id: account2Id,
          amount: 1000,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should validate destination_account_id is UUID format', async () => {
      const response = await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: 'not-a-uuid',
          amount: 1000,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should validate amount is positive integer', async () => {
      const invalidAmounts = [0, -1, -100, 1.5, 100.99, NaN, Infinity];

      for (const amount of invalidAmounts) {
        const response = await request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_account_id: accountId,
            destination_account_id: account2Id,
            amount,
          })
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should validate source and destination are different (refinement)', async () => {
      const response = await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: accountId,
          amount: 1000,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject wrong field types', async () => {
      const invalidBodies = [
        {
          idempotency_key: 12345,
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 1000,
        },
        {
          idempotency_key: randomUUID(),
          source_account_id: 12345,
          destination_account_id: account2Id,
          amount: 1000,
        },
        {
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: '1000',
        },
      ];

      for (const body of invalidBodies) {
        const response = await request(app)
          .post('/transactions')
          .send(body)
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });
  });

  describe('Deposit Schema Validation', () => {
    it('should validate all required fields are present', async () => {
      const response = await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          // Missing both fields
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should validate idempotency_key format', async () => {
      const response = await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: 'invalid',
          amount: 1000,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should validate amount is positive', async () => {
      const invalidAmounts = [0, -1, -1000];

      for (const amount of invalidAmounts) {
        const response = await request(app)
          .post(`/accounts/${accountId}/deposit`)
          .send({
            idempotency_key: randomUUID(),
            amount,
          })
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should validate amount is integer', async () => {
      const response = await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 100.5,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should validate amount type', async () => {
      const invalidTypes = ['1000', true, {}, [], null];

      for (const amount of invalidTypes) {
        const response = await request(app)
          .post(`/accounts/${accountId}/deposit`)
          .send({
            idempotency_key: randomUUID(),
            amount,
          })
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });
  });

  describe('Balance Query Schema Validation', () => {
    it('should validate date format in query parameter', async () => {
      const invalidDates = [
        'not-a-date',
        '2025-13-01',
        '2025-12-32',
        '01/01/2025',
        '2025/01/01',
      ];

      for (const date of invalidDates) {
        const response = await request(app)
          .get(`/accounts/${accountId}/balance?date=${date}`)
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should accept valid ISO 8601 date formats', async () => {
      const validDates = [
        '2025-10-06T12:00:00Z',
        '2025-10-06T12:00:00.000Z',
        new Date().toISOString(),
      ];

      for (const date of validDates) {
        const response = await request(app)
          .get(`/accounts/${accountId}/balance?date=${date}`)
          .expect(200);

        expect(response.body).toHaveProperty('balance');
      }
    });

    it('should validate account ID in path parameter', async () => {
      const response = await request(app)
        .get('/accounts/not-a-uuid/balance')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Transaction History Query Validation', () => {
    it('should validate account ID in path parameter', async () => {
      const response = await request(app)
        .get('/accounts/not-a-uuid/transactions')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should accept valid UUID in path parameter', async () => {
      const response = await request(app)
        .get(`/accounts/${accountId}/transactions`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Content-Type Validation', () => {
    it('should handle requests with wrong content type', async () => {
      // Express should parse JSON even with missing content-type for simple objects
      const response = await request(app)
        .post('/users')
        .set('Content-Type', 'text/plain')
        .send('email=test@example.com&password=password123');

      // This should fail because body won't be parsed correctly
      expect(response.status).toBe(400);
    });

    it('should accept application/json content type', async () => {
      const response = await request(app)
        .post('/users')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          email: 'contenttype@example.com',
          password: 'password123',
        }))
        .expect(201);

      expect(response.body.email).toBe('contenttype@example.com');
    });
  });

  describe('Malformed JSON Handling', () => {
    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/users')
        .set('Content-Type', 'application/json')
        .send('{"email": "test@example.com", "password": invalid}'); // Invalid JSON

      expect(response.status).toBe(400);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/users')
        .send('')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Field Coercion and Type Safety', () => {
    it('should not coerce string numbers to numbers', async () => {
      const response = await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: '1000', // String instead of number
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should not coerce boolean to string', async () => {
      const response = await request(app)
        .post('/accounts')
        .send({
          email: true,
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('SQL Injection Prevention via Schema Validation', () => {
    it('should reject SQL injection attempts in email field', async () => {
      const sqlInjectionAttempts = [
        "admin'--",
        "admin' OR '1'='1",
        "'; DROP TABLE accounts;--",
      ];

      for (const email of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/accounts')
          .send({
            email,
            password: 'password123',
          })
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should sanitize UUID inputs through validation', async () => {
      const response = await request(app)
        .get("/accounts/'; DROP TABLE accounts;--/balance")
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Response Schema Consistency', () => {
    it('should return consistent account schema on creation', async () => {
      const userResponse = await request(app)
        .post('/users')
        .send({
          email: 'schema-test@example.com',
          password: 'password123',
        })
        .expect(201);

      const response = await request(app)
        .post('/accounts')
        .send({
          user_id: userResponse.body.id,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('user_id');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body.user_id).toBe(userResponse.body.id);
    });

    it('should return consistent transaction schema on creation', async () => {
      const user2Response = await request(app)
        .post('/users')
        .send({
          email: 'account2@example.com',
          password: 'password123',
        });

      const account2Response = await request(app)
        .post('/accounts')
        .send({
          user_id: user2Response.body.id,
        });

      await request(app).post(`/accounts/${accountId}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 10000,
      });

      const response = await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: account2Response.body.id,
          amount: 1000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('idempotency_key');
      expect(response.body).toHaveProperty('source_account_id');
      expect(response.body).toHaveProperty('destination_account_id');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('created_at');
    });

    it('should return consistent balance schema', async () => {
      const response = await request(app)
        .get(`/accounts/${accountId}/balance`)
        .expect(200);

      expect(response.body).toHaveProperty('account_id');
      expect(response.body).toHaveProperty('balance');
      expect(typeof response.body.account_id).toBe('string');
      expect(typeof response.body.balance).toBe('number');
    });

    it('should return consistent deposit schema', async () => {
      const response = await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 5000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('idempotency_key');
      expect(response.body).toHaveProperty('source_account_id');
      expect(response.body).toHaveProperty('destination_account_id');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body.source_account_id).toBeNull();
      expect(response.body.destination_account_id).toBe(accountId);
    });
  });
});
