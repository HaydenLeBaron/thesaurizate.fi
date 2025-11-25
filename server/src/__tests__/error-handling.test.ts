import request from 'supertest';
import { app } from './app';
import { pool } from '../db';
import { randomUUID } from 'crypto';

describe('Error Handling Tests', () => {
  let accountId: string;
  let account2Id: string;

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE transactions, accounts, users RESTART IDENTITY CASCADE');

    const userResponse = await request(app)
      .post('/v1/users')
      .send({
        email: 'error@example.com',
        password: 'password123',
      });
    const userId = userResponse.body.id;

    const user2Response = await request(app)
      .post('/v1/users')
      .send({
        email: 'error2@example.com',
        password: 'password123',
      });
    const userId2 = user2Response.body.id;

    const accountResponse = await request(app)
      .post('/v1/accounts')
      .send({
        user_id: userId,
      });
    accountId = accountResponse.body.id;

    const account2Response = await request(app)
      .post('/v1/accounts')
      .send({
        user_id: userId2,
      });
    account2Id = account2Response.body.id;
  });

  describe('Database Error Handling', () => {
    it('should handle duplicate email with 409 conflict', async () => {
      const response = await request(app)
        .post('/v1/users')
        .send({
          email: 'error@example.com', // Duplicate
          password: 'password123',
        })
        .expect(409);

      expect(response.body.error).toBe('Email already exists');
    });

    it('should handle non-existent account gracefully for deposits', async () => {
      const fakeAccountId = randomUUID();

      const response = await request(app)
        .post(`/accounts/${fakeAccountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 10000,
        })
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle non-existent source account in transaction', async () => {
      const fakeAccountId = randomUUID();

      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: fakeAccountId,
          destination_account_id: accountId,
          amount: 1000,
        })
        .expect(400);

      // Should fail due to insufficient funds (0 balance for non-existent account)
      expect(response.body.error).toBe('Insufficient funds.');
    });

    it('should handle non-existent destination account in transaction', async () => {
      await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 10000,
        });

      const fakeAccountId = randomUUID();

      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: fakeAccountId,
          amount: 1000,
        })
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('Business Logic Error Handling', () => {
    it('should return 400 for insufficient funds', async () => {
      await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 5000,
        });

      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 10000,
        })
        .expect(400);

      expect(response.body.error).toBe('Insufficient funds.');
    });

    it('should prevent self-transfer with validation error', async () => {
      await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 10000,
        });

      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: accountId,
          amount: 1000,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should handle exact balance transfer correctly', async () => {
      await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 5000,
        });

      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 5000,
        })
        .expect(201);

      expect(response.body.amount).toBe(5000);

      const balance = await request(app).get(`/accounts/${accountId}/balance`);
      expect(balance.body.balance).toBe(0);
    });

    it('should reject transfer one cent over balance', async () => {
      await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 5000,
        });

      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 5001,
        })
        .expect(400);

      expect(response.body.error).toBe('Insufficient funds.');
    });
  });

  describe('Input Validation Error Messages', () => {
    it('should provide clear error for invalid email', async () => {
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          email: 'not-an-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeDefined();
    });

    it('should provide clear error for short password', async () => {
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          email: 'test@example.com',
          password: '1234567', // 7 chars
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeDefined();
    });

    it('should provide clear error for missing fields', async () => {
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeDefined();
    });

    it('should provide error details for multiple validation failures', async () => {
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          email: 'invalid',
          password: 'short',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeDefined();
      expect(Array.isArray(response.body.details)).toBe(true);
      expect(response.body.details.length).toBeGreaterThan(0);
    });
  });

  describe('HTTP Method Error Handling', () => {
    it('should return 404 for unsupported routes', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);
    });

    it('should handle POST to balance endpoint (wrong method)', async () => {
      const response = await request(app)
        .post(`/accounts/${accountId}/balance`)
        .send({})
        .expect(404);
    });

    it('should handle GET to transaction creation endpoint (wrong method)', async () => {
      const response = await request(app)
        .get('/v1/transactions')
        .expect(404);
    });
  });

  describe('Idempotency Error Scenarios', () => {
    it('should return same transaction on duplicate idempotency key', async () => {
      await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 50000,
        });

      const idempotencyKey = randomUUID();

      // First transaction
      const response1 = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: idempotencyKey,
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 1000,
        })
        .expect(201);

      // Duplicate transaction
      const response2 = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: idempotencyKey,
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 1000,
        })
        .expect(201);

      expect(response1.body.id).toBe(response2.body.id);
      expect(response1.body.idempotency_key).toBe(response2.body.idempotency_key);
    });

    it('should handle idempotency for deposits', async () => {
      const idempotencyKey = randomUUID();

      const response1 = await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: idempotencyKey,
          amount: 10000,
        })
        .expect(201);

      const response2 = await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: idempotencyKey,
          amount: 10000,
        })
        .expect(201);

      expect(response1.body.id).toBe(response2.body.id);

      // Balance should only reflect one deposit
      const balance = await request(app).get(`/accounts/${accountId}/balance`);
      expect(balance.body.balance).toBe(10000);
    });

    it('should allow different transactions with different idempotency keys', async () => {
      await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 50000,
        });

      const response1 = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 1000,
        })
        .expect(201);

      const response2 = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 1000,
        })
        .expect(201);

      expect(response1.body.id).not.toBe(response2.body.id);

      const balance = await request(app).get(`/accounts/${accountId}/balance`);
      expect(balance.body.balance).toBe(48000); // 50000 - 1000 - 1000
    });
  });

  describe('Edge Case Error Handling', () => {
    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(100) + '@example.com';

      const response = await request(app)
        .post('/v1/users')
        .send({
          email: longEmail,
          password: 'password123',
        });

      // Must handle gracefully - either accept with validation or reject
      // Should NOT crash (500 only acceptable if DB constraint)
      if (response.status === 201) {
        expect(response.body.email).toBe(longEmail);
      } else {
        expect([400, 500]).toContain(response.status);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should handle Unicode in email', async () => {
      const response = await request(app)
        .post('/v1/users')
        .send({
          email: 'test@例え.jp',
          password: 'password123',
        });

      // Email validation should handle this - either accept or reject with clear error
      if (response.status === 201) {
        expect(response.body.email).toBe('test@例え.jp');
      } else {
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation error');
      }
    });

    it('should handle special characters in password', async () => {
      const response = await request(app)
        .post('/v1/users')
        .send({
          email: 'special@example.com',
          password: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        })
        .expect(201);

      expect(response.body.email).toBe('special@example.com');
    });

    it('should handle null values properly', async () => {
      const response = await request(app)
        .post('/v1/users')
        .send({
          email: null,
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Transaction History Error Handling', () => {
    it('should return empty array for account with no transactions', async () => {
      const response = await request(app)
        .get(`/accounts/${accountId}/transactions`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle invalid account ID in transaction history', async () => {
      const response = await request(app)
        .get('/v1/accounts/invalid-id/transactions')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should handle non-existent account ID in transaction history', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .get(`/accounts/${fakeAccountId}/transactions`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('Balance Query Error Handling', () => {
    it('should return zero for non-existent account balance', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .get(`/accounts/${fakeAccountId}/balance`)
        .expect(200);

      expect(response.body.balance).toBe(0);
    });

    it('should handle invalid date format in balance query', async () => {
      const response = await request(app)
        .get(`/accounts/${accountId}/balance?date=invalid-date`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should handle malformed query parameters', async () => {
      const response = await request(app)
        .get(`/accounts/${accountId}/balance?date=2025-13-45T99:99:99Z`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Error Response Consistency', () => {
    it('should always include error field in error responses', async () => {
      const errorEndpoints = [
        { method: 'post', url: '/v1/accounts', body: {} },
        { method: 'post', url: '/v1/transactions', body: {} },
        { method: 'get', url: '/v1/accounts/invalid/balance', body: undefined },
      ];

      for (const endpoint of errorEndpoints) {
        const request_obj = request(app)[endpoint.method as 'post' | 'get'](endpoint.url);

        const response = endpoint.body !== undefined
          ? await request_obj.send(endpoint.body)
          : await request_obj;

        if (response.status >= 400) {
          expect(response.body).toHaveProperty('error');
          expect(typeof response.body.error).toBe('string');
        }
      }
    });

    it('should include details for validation errors', async () => {
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          email: 'invalid',
          password: 'short',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeDefined();
      expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('should not leak sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          email: 'test@example.com',
          password: 'short',
        })
        .expect(400);

      // Should not contain password in error message
      const responseString = JSON.stringify(response.body);
      expect(responseString).not.toContain('short');
    });
  });

  describe('Concurrent Error Scenarios', () => {
    it('should handle concurrent insufficient fund scenarios correctly', async () => {
      await request(app)
        .post(`/accounts/${accountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 10000,
        });

      // Try to spend more than available concurrently
      const transfers = [
        request(app).post('/v1/transactions').send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 8000,
        }),
        request(app).post('/v1/transactions').send({
          idempotency_key: randomUUID(),
          source_account_id: accountId,
          destination_account_id: account2Id,
          amount: 8000,
        }),
      ];

      const responses = await Promise.all(transfers);
      const statuses = responses.map(r => r.status).sort();

      // One should succeed, one should fail
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      const failedResponse = responses.find(r => r.status === 400);
      expect(failedResponse?.body.error).toBe('Insufficient funds.');
    });
  });

  describe('Health Check Error Handling', () => {
    it('should return ok status for health endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });

    it('should handle health check even under load', async () => {
      // Make concurrent requests
      const healthChecks = Array.from({ length: 10 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(healthChecks);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });
});
