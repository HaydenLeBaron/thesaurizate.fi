import request from 'supertest';
import { app } from './app';
import { pool } from '../db';
import { randomUUID } from 'crypto';

describe('Edge Cases and Boundary Tests', () => {
  let userId: string;

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');

    const userResponse = await request(app)
      .post('/users')
      .send({
        email: 'edgecase@example.com',
        password: 'password123',
      });
    userId = userResponse.body.id;
  });

  describe('Transaction Amount Edge Cases', () => {
    it('should reject transaction with zero amount', async () => {
      const response = await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_user_id: userId,
          destination_user_id: randomUUID(),
          amount: 0,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject deposit with zero amount', async () => {
      const response = await request(app)
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 0,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should handle very large transaction amounts', async () => {
      const largeAmount = 999999999999; // 9.99 billion cents = $99,999,999.99

      // Deposit large amount
      await request(app)
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: largeAmount,
        })
        .expect(201);

      // Check balance
      const balanceResponse = await request(app)
        .get(`/users/${userId}/balance`)
        .expect(200);

      expect(balanceResponse.body.balance).toBe(largeAmount);
    });

    it('should handle minimum valid amount (1 cent)', async () => {
      await request(app)
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 1,
        })
        .expect(201);

      const balanceResponse = await request(app)
        .get(`/users/${userId}/balance`)
        .expect(200);

      expect(balanceResponse.body.balance).toBe(1);
    });

    it('should reject negative amounts', async () => {
      const response = await request(app)
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: -100,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject decimal amounts', async () => {
      const response = await request(app)
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 100.50,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('UUID Validation Edge Cases', () => {
    it('should reject malformed UUID for user id', async () => {
      const response = await request(app)
        .get('/users/not-a-uuid/balance')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject malformed UUID for idempotency key', async () => {
      const response = await request(app)
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: 'not-a-uuid',
          amount: 1000,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should accept valid v4 UUID', async () => {
      const validUUID = randomUUID();
      const response = await request(app)
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: validUUID,
          amount: 1000,
        })
        .expect(201);

      expect(response.body.idempotency_key).toBe(validUUID);
    });

    it('should reject empty string as UUID', async () => {
      const response = await request(app)
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: '',
          amount: 1000,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Email Validation Edge Cases', () => {
    it('should accept valid email formats', async () => {
      const validEmails = [
        'test@example.com',
        'user.name+tag@example.co.uk',
        'test123@test-domain.org',
      ];

      for (const email of validEmails) {
        const response = await request(app)
          .post('/users')
          .send({
            email,
            password: 'password123',
          })
          .expect(201);

        expect(response.body.email).toBe(email);
      }
    });

    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@.com',
      ];

      for (const email of invalidEmails) {
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

    it('should reject empty email', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: '',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Password Validation Edge Cases', () => {
    it('should accept password with exactly 8 characters', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'minpass@example.com',
          password: '12345678',
        })
        .expect(201);

      expect(response.body.email).toBe('minpass@example.com');
    });

    it('should reject password with 7 characters', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'shortpass@example.com',
          password: '1234567',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should accept very long passwords', async () => {
      const longPassword = 'a'.repeat(100);
      const response = await request(app)
        .post('/users')
        .send({
          email: 'longpass@example.com',
          password: longPassword,
        })
        .expect(201);

      expect(response.body.email).toBe('longpass@example.com');
    });

    it('should accept passwords with special characters', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'special@example.com',
          password: '!@#$%^&*()',
        })
        .expect(201);

      expect(response.body.email).toBe('special@example.com');
    });
  });

  describe('Date Query Edge Cases', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/users/${userId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 10000,
        });
    });

    it('should handle future date query', async () => {
      const futureDate = new Date('2099-12-31T23:59:59Z').toISOString();
      const response = await request(app)
        .get(`/users/${userId}/balance?date=${futureDate}`)
        .expect(200);

      expect(response.body.balance).toBe(10000);
    });

    it('should handle past date query before any transactions', async () => {
      const pastDate = new Date('2000-01-01T00:00:00Z').toISOString();
      const response = await request(app)
        .get(`/users/${userId}/balance?date=${pastDate}`)
        .expect(200);

      expect(response.body.balance).toBe(0);
    });

    it('should reject invalid ISO 8601 date format', async () => {
      const response = await request(app)
        .get(`/users/${userId}/balance?date=2025-13-45`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should accept valid ISO 8601 formats', async () => {
      const validDates = [
        new Date().toISOString(),
        '2025-10-06T12:00:00Z',
        '2025-10-06T12:00:00.000Z',
      ];

      for (const date of validDates) {
        const response = await request(app)
          .get(`/users/${userId}/balance?date=${date}`)
          .expect(200);

        expect(response.body).toHaveProperty('balance');
      }
    });
  });

  describe('Empty and Null Values', () => {
    it('should reject null values in required fields', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: null,
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject undefined values in required fields', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject empty object body', async () => {
      const response = await request(app)
        .post('/users')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });
});
