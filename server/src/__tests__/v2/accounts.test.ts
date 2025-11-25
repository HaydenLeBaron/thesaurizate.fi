import request from 'supertest';
import { app } from '../app';
import { pool } from '../../db';
import { randomUUID } from 'crypto';

describe('V2 Accounts API', () => {
  let userId1: string;
  let userId2: string;
  let account1Id: string;
  let account2Id: string;

  beforeEach(async () => {
    // Clean database before each test
    await pool.query('TRUNCATE TABLE transactions, accounts, users RESTART IDENTITY CASCADE');

    // Create test users
    const user1Response = await request(app)
      .post('/users')
      .send({
        email: 'account1@example.com',
        password: 'password123',
      });
    userId1 = user1Response.body.id;

    const user2Response = await request(app)
      .post('/users')
      .send({
        email: 'account2@example.com',
        password: 'password123',
      });
    userId2 = user2Response.body.id;

    // Create test accounts
    const account1Response = await request(app)
      .post('/accounts')
      .send({
        user_id: userId1,
      });
    account1Id = account1Response.body.id;

    const account2Response = await request(app)
      .post('/accounts')
      .send({
        user_id: userId2,
      });
    account2Id = account2Response.body.id;
  });

  describe('GET /v2/accounts', () => {
    it('should list all accounts', async () => {
      const response = await request(app)
        .get('/v2/accounts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);

      // Check response structure (camelCase)
      response.body.forEach((account: any) => {
        expect(account).toHaveProperty('accountId');
        expect(account).toHaveProperty('userId');
        expect(account).toHaveProperty('createdAt');
        expect(account).toHaveProperty('updatedAt');
        expect(typeof account.accountId).toBe('string');
        expect(typeof account.userId).toBe('string');
      });
    });

    it('should return empty array when no accounts exist', async () => {
      // Clean database
      await pool.query('TRUNCATE TABLE transactions, accounts, users RESTART IDENTITY CASCADE');

      const response = await request(app)
        .get('/v2/accounts')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should support pagination with limit', async () => {
      // Create a third account
      const user3Response = await request(app)
        .post('/users')
        .send({
          email: 'account3@example.com',
          password: 'password123',
        });
      const userId3 = user3Response.body.id;

      await request(app)
        .post('/accounts')
        .send({
          user_id: userId3,
        });

      const response = await request(app)
        .get('/v2/accounts?limit=2')
        .expect(200);

      expect(response.body.length).toBe(2);
    });

    it('should support pagination with offset', async () => {
      const response = await request(app)
        .get('/v2/accounts?limit=1&offset=1')
        .expect(200);

      expect(response.body.length).toBe(1);
    });

    it('should reject invalid limit', async () => {
      const response = await request(app)
        .get('/v2/accounts?limit=-1')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject invalid offset', async () => {
      const response = await request(app)
        .get('/v2/accounts?offset=-1')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /v2/accounts/{accountId}', () => {
    beforeEach(async () => {
      // Deposit money into account1
      await request(app)
        .post(`/accounts/${account1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 100000, // 1000.00 in cents
        });
    });

    it('should get account with balance information', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        accountId: account1Id,
        balance: {
          available: expect.any(Number),
          current: expect.any(Number),
          limit: null,
        },
        liabilities: {
          credit: 0,
          mortgage: 0,
        },
        metadata: {
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });

      expect(response.body.balance.available).toBe(100000);
      expect(response.body.balance.current).toBe(100000);
    });

    it('should get account with historical balance', async () => {
      const now = new Date().toISOString();
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}?date=${now}`)
        .expect(200);

      expect(response.body).toHaveProperty('balance');
      expect(response.body.balance.available).toBeGreaterThanOrEqual(0);
    });

    it('should return 404 for non-existent account', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .get(`/v2/accounts/${fakeAccountId}`)
        .expect(404);

      expect(response.body.error).toBe('Account not found');
    });

    it('should reject invalid account id format', async () => {
      const response = await request(app)
        .get('/v2/accounts/invalid-id')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reflect balance changes after transaction', async () => {
      // Create transaction
      await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 20000, // 200.00 in cents
        });

      // Check balance
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}`)
        .expect(200);

      expect(response.body.balance.available).toBe(80000); // 800.00 in cents
      expect(response.body.balance.current).toBe(80000);
    });
  });

  describe('GET /v2/accounts/{accountId}/contact', () => {
    it('should get account contact information', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/contact`)
        .expect(200);

      expect(response.body).toMatchObject({
        accountId: account1Id,
        contact: {
          email: 'account1@example.com',
          userId: userId1,
        },
      });
    });

    it('should return 404 for non-existent account', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .get(`/v2/accounts/${fakeAccountId}/contact`)
        .expect(404);

      expect(response.body.error).toBe('Account not found');
    });

    it('should reject invalid account id format', async () => {
      const response = await request(app)
        .get('/v2/accounts/invalid-id/contact')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /v2/accounts/{accountId}/payment-networks', () => {
    it('should get payment networks for account', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/payment-networks`)
        .expect(200);

      expect(response.body).toMatchObject({
        accountId: account1Id,
        paymentNetworks: expect.any(Array),
      });

      expect(response.body.paymentNetworks.length).toBe(2);
      expect(response.body.paymentNetworks).toContainEqual({
        type: 'ACH',
        enabled: true,
        capabilities: ['credit', 'debit'],
      });
      expect(response.body.paymentNetworks).toContainEqual({
        type: 'WIRE',
        enabled: true,
        capabilities: ['credit', 'debit'],
      });
    });

    it('should return 404 for non-existent account', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .get(`/v2/accounts/${fakeAccountId}/payment-networks`)
        .expect(404);

      expect(response.body.error).toBe('Account not found');
    });

    it('should reject invalid account id format', async () => {
      const response = await request(app)
        .get('/v2/accounts/invalid-id/payment-networks')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });
});
