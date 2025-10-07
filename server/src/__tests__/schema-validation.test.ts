import request from 'supertest';
import { app } from './app';
import { pool } from '../db';
import { randomUUID } from 'crypto';

describe('Schema Validation Tests', () => {
  let userId: string;

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');

    const userResponse = await request(app)
      .post('/users')
      .send({
        email: 'schema@example.com',
        password: 'password123',
      });
    userId = userResponse.body.id;
  });

  describe('User Creation Schema Validation', () => {
    it('should validate email field type', async () => {
      const invalidTypes = [
        { email: 123, password: 'password123' },
        { email: true, password: 'password123' },
        { email: {}, password: 'password123' },
        { email: [], password: 'password123' },
      ];

      for (const body of invalidTypes) {
        const response = await request(app)
          .post('/users')
          .send(body)
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should validate password field type', async () => {
      const invalidTypes = [
        { email: 'test@example.com', password: 12345678 },
        { email: 'test@example.com', password: true },
        { email: 'test@example.com', password: {} },
        { email: 'test@example.com', password: [] },
      ];

      for (const body of invalidTypes) {
        const response = await request(app)
          .post('/users')
          .send(body)
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should reject extra unexpected fields gracefully', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'extra@example.com',
          password: 'password123',
          unexpectedField: 'unexpected',
          anotherField: 'another',
        })
        .expect(201);

      // Should succeed and ignore extra fields
      expect(response.body.email).toBe('extra@example.com');
      expect(response.body).not.toHaveProperty('unexpectedField');
    });

    it('should return validation details in error response', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'invalid-email',
          password: 'short',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeDefined();
      expect(Array.isArray(response.body.details)).toBe(true);
    });
  });

  describe('Transaction Creation Schema Validation', () => {
    let user2Id: string;

    beforeEach(async () => {
      const user2Response = await request(app)
        .post('/users')
        .send({
          email: 'user2@example.com',
          password: 'password123',
        });
      user2Id = user2Response.body.id;

      await request(app).post(`/users/${userId}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 100000,
      });
    });

    it('should validate all required fields are present', async () => {
      const requiredFields = [
        'idempotency_key',
        'source_user_id',
        'destination_user_id',
        'amount',
      ];

      for (const fieldToOmit of requiredFields) {
        const body: any = {
          idempotency_key: randomUUID(),
          source_user_id: userId,
          destination_user_id: user2Id,
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
            source_user_id: userId,
            destination_user_id: user2Id,
            amount: 1000,
          })
          .expect(400);

        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should validate source_user_id is UUID format', async () => {
      const response = await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_user_id: 'not-a-uuid',
          destination_user_id: user2Id,
          amount: 1000,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should validate destination_user_id is UUID format', async () => {
      const response = await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_user_id: userId,
          destination_user_id: 'not-a-uuid',
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
            source_user_id: userId,
            destination_user_id: user2Id,
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
          source_user_id: userId,
          destination_user_id: userId,
          amount: 1000,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject wrong field types', async () => {
      const invalidBodies = [
        {
          idempotency_key: 12345,
          source_user_id: userId,
          destination_user_id: user2Id,
          amount: 1000,
        },
        {
          idempotency_key: randomUUID(),
          source_user_id: 12345,
          destination_user_id: user2Id,
          amount: 1000,
        },
        {
          idempotency_key: randomUUID(),
          source_user_id: userId,
          destination_user_id: user2Id,
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
        .post(`/users/${userId}/deposit`)
        .send({
          // Missing both fields
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should validate idempotency_key format', async () => {
      const response = await request(app)
        .post(`/users/${userId}/deposit`)
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
          .post(`/users/${userId}/deposit`)
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
        .post(`/users/${userId}/deposit`)
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
          .post(`/users/${userId}/deposit`)
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
          .get(`/users/${userId}/balance?date=${date}`)
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
          .get(`/users/${userId}/balance?date=${date}`)
          .expect(200);

        expect(response.body).toHaveProperty('balance');
      }
    });

    it('should validate user ID in path parameter', async () => {
      const response = await request(app)
        .get('/users/not-a-uuid/balance')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Transaction History Query Validation', () => {
    it('should validate user ID in path parameter', async () => {
      const response = await request(app)
        .get('/users/not-a-uuid/transactions')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should accept valid UUID in path parameter', async () => {
      const response = await request(app)
        .get(`/users/${userId}/transactions`)
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
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: '1000', // String instead of number
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should not coerce boolean to string', async () => {
      const response = await request(app)
        .post('/users')
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
        "'; DROP TABLE users;--",
      ];

      for (const email of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/users')
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
        .get("/users/'; DROP TABLE users;--/balance")
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Response Schema Consistency', () => {
    it('should return consistent user schema on creation', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'schema-test@example.com',
          password: 'password123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('password_hash');
    });

    it('should return consistent transaction schema on creation', async () => {
      const user2Response = await request(app)
        .post('/users')
        .send({
          email: 'user2@example.com',
          password: 'password123',
        });

      await request(app).post(`/users/${userId}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 10000,
      });

      const response = await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_user_id: userId,
          destination_user_id: user2Response.body.id,
          amount: 1000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('idempotency_key');
      expect(response.body).toHaveProperty('source_user_id');
      expect(response.body).toHaveProperty('destination_user_id');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('created_at');
    });

    it('should return consistent balance schema', async () => {
      const response = await request(app)
        .get(`/users/${userId}/balance`)
        .expect(200);

      expect(response.body).toHaveProperty('user_id');
      expect(response.body).toHaveProperty('balance');
      expect(typeof response.body.user_id).toBe('string');
      expect(typeof response.body.balance).toBe('number');
    });

    it('should return consistent deposit schema', async () => {
      const response = await request(app)
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 5000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('idempotency_key');
      expect(response.body).toHaveProperty('source_user_id');
      expect(response.body).toHaveProperty('destination_user_id');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body.source_user_id).toBeNull();
      expect(response.body.destination_user_id).toBe(userId);
    });
  });
});
