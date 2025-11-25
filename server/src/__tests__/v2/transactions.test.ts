import request from 'supertest';
import { app } from '../app';
import { pool } from '../../db';
import { randomUUID } from 'crypto';

describe('V2 Transactions API', () => {
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
    const userId1 = user1Response.body.id;

    const user2Response = await request(app)
      .post('/users')
      .send({
        email: 'account2@example.com',
        password: 'password123',
      });
    const userId2 = user2Response.body.id;

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

  describe('GET /v2/accounts/{accountId}/transactions', () => {
    beforeEach(async () => {
      // Setup initial transactions
      await request(app)
        .post(`/accounts/${account1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 100000, // 1000.00 in cents
        });

      await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 10000, // 100.00 in cents
        });

      await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 5000, // 50.00 in cents
        });
    });

    it('should get transaction history for an account', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/transactions`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3); // deposit + 2 transactions

      // Check response structure (camelCase)
      response.body.forEach((txn: any) => {
        expect(txn).toHaveProperty('transactionId');
        expect(txn).toHaveProperty('idempotencyKey');
        expect(txn).toHaveProperty('sourceAccountId');
        expect(txn).toHaveProperty('destinationAccountId');
        expect(txn).toHaveProperty('amount');
        expect(txn).toHaveProperty('createdAt');
        expect(typeof txn.transactionId).toBe('string');
        expect(typeof txn.amount).toBe('number');
      });
    });

    it('should return transactions in descending order by created_at', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/transactions`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);

      // Check ordering
      for (let i = 0; i < response.body.length - 1; i++) {
        const current = new Date(response.body[i].createdAt);
        const next = new Date(response.body[i + 1].createdAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should return empty array for account with no transactions', async () => {
      // Create a new user and account
      const user3Response = await request(app)
        .post('/users')
        .send({
          email: 'account3@example.com',
          password: 'password123',
        });
      const userId3 = user3Response.body.id;

      const account3Response = await request(app)
        .post('/accounts')
        .send({
          user_id: userId3,
        });

      const response = await request(app)
        .get(`/v2/accounts/${account3Response.body.id}/transactions`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should include both sent and received transactions', async () => {
      // Account2 sends money back to account1
      await request(app)
        .post(`/accounts/${account2Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 50000, // 500.00 in cents
        });

      await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account2Id,
          destination_account_id: account1Id,
          amount: 7500, // 75.00 in cents
        });

      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/transactions`)
        .expect(200);

      // Should have deposit, 2 sent, and 1 received
      expect(response.body.length).toBeGreaterThanOrEqual(4);

      // Verify we have both sent and received
      const sentTransactions = response.body.filter((txn: any) => txn.sourceAccountId === account1Id);
      const receivedTransactions = response.body.filter((txn: any) => txn.destinationAccountId === account1Id && txn.sourceAccountId !== null);
      expect(sentTransactions.length).toBeGreaterThan(0);
      expect(receivedTransactions.length).toBeGreaterThan(0);
    });

    it('should support pagination with limit', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/transactions?limit=2`)
        .expect(200);

      expect(response.body.length).toBe(2);
    });

    it('should support pagination with offset', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/transactions?limit=1&offset=1`)
        .expect(200);

      expect(response.body.length).toBe(1);
    });

    it('should support date filtering with startDate', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/transactions?startDate=${startDate.toISOString()}`)
        .expect(200);

      // All transactions should be after startDate
      response.body.forEach((txn: any) => {
        const txnDate = new Date(txn.createdAt);
        expect(txnDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
      });
    });

    it('should support date filtering with endDate', async () => {
      const now = new Date();
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/transactions?endDate=${endDate.toISOString()}`)
        .expect(200);

      // All transactions should be before endDate
      response.body.forEach((txn: any) => {
        const txnDate = new Date(txn.createdAt);
        expect(txnDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    it('should return 404 for non-existent account', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .get(`/v2/accounts/${fakeAccountId}/transactions`)
        .expect(404);

      expect(response.body.error).toBe('Account not found');
    });

    it('should reject invalid account id format', async () => {
      const response = await request(app)
        .get('/v2/accounts/invalid-id/transactions')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject invalid limit', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/transactions?limit=-1`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject invalid offset', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/transactions?offset=-1`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/transactions?startDate=invalid-date`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });
});
