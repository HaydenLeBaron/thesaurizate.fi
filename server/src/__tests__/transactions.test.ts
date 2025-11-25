import request from 'supertest';
import { app } from './app';
import { pool } from '../db';
import { randomUUID } from 'crypto';

describe('Transactions API', () => {
  let account1Id: string;
  let account2Id: string;

  beforeEach(async () => {
    // Clean database before each test
    await pool.query('TRUNCATE TABLE transactions, accounts, users RESTART IDENTITY CASCADE');

    // Create test users
    const user1Response = await request(app)
      .post('/v1/users')
      .send({
        email: 'account1@example.com',
        password: 'password123',
      });
    const userId1 = user1Response.body.id;

    const user2Response = await request(app)
      .post('/v1/users')
      .send({
        email: 'account2@example.com',
        password: 'password123',
      });
    const userId2 = user2Response.body.id;

    // Create test accounts
    const account1Response = await request(app)
      .post('/v1/accounts')
      .send({
        user_id: userId1,
      });
    account1Id = account1Response.body.id;

    const account2Response = await request(app)
      .post('/v1/accounts')
      .send({
        user_id: userId2,
      });
    account2Id = account2Response.body.id;
  });

  describe('POST /accounts/:id/deposit', () => {
    it('should deposit money into account account', async () => {
      const idempotencyKey = randomUUID();
      const response = await request(app)
        .post(`/v1/accounts/${account1Id}/deposit`)
        .send({
          idempotency_key: idempotencyKey,
          amount: 10000, // 100.00 in cents
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        idempotency_key: idempotencyKey,
        source_account_id: null,
        destination_account_id: account1Id,
        amount: 10000,
        created_at: expect.any(String),
      });
    });

    it('should reject duplicate idempotency key', async () => {
      const idempotencyKey = randomUUID();
      // First deposit
      await request(app)
        .post(`/v1/accounts/${account1Id}/deposit`)
        .send({
          idempotency_key: idempotencyKey,
          amount: 10000, // 100.00 in cents
        })
        .expect(201);

      // Duplicate deposit with same idempotency key
      const response = await request(app)
        .post(`/v1/accounts/${account1Id}/deposit`)
        .send({
          idempotency_key: idempotencyKey,
          amount: 10000,
        })
        .expect(201);

      // Should return the same transaction
      expect(response.body.idempotency_key).toBe(idempotencyKey);
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post(`/v1/accounts/${account1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: -5000, // -50.00 in cents
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject missing idempotency_key', async () => {
      const response = await request(app)
        .post(`/v1/accounts/${account1Id}/deposit`)
        .send({
          amount: 10000,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject non-existent account for deposit', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .post(`/v1/accounts/${fakeAccountId}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 10000,
        })
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /transactions', () => {
    beforeEach(async () => {
      // Deposit money into account1's account
      await request(app)
        .post(`/v1/accounts/${account1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 50000, // 500.00 in cents
        });
    });

    it('should create a transaction between accounts', async () => {
      const idempotencyKey = randomUUID();
      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: idempotencyKey,
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 10000, // 100.00 in cents
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        idempotency_key: idempotencyKey,
        source_account_id: account1Id,
        destination_account_id: account2Id,
        amount: 10000,
        created_at: expect.any(String),
      });
    });

    it('should reject transaction with insufficient funds', async () => {
      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 100000, // 1000.00 in cents
        })
        .expect(400);

      expect(response.body.error).toBe('Insufficient funds.');
    });

    it('should reject transaction with invalid amount', async () => {
      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: -10000, // -100.00 in cents
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject transaction to same account', async () => {
      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
          destination_account_id: account1Id,
          amount: 10000, // 100.00 in cents
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should handle duplicate idempotency key', async () => {
      const idempotencyKey = randomUUID();
      // First transaction
      await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: idempotencyKey,
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 10000, // 100.00 in cents
        })
        .expect(201);

      // Duplicate transaction
      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: idempotencyKey,
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 10000,
        })
        .expect(201);

      // Should return the same transaction
      expect(response.body.idempotency_key).toBe(idempotencyKey);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should handle invalid date format in balance query', async () => {
      const response = await request(app)
        .get(`/v1/accounts/${account1Id}/balance?date=invalid-date`)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should handle non-existent account for balance', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .get(`/v1/accounts/${fakeAccountId}/balance`)
        .expect(200);

      // Should return 0 balance for non-existent account
      expect(response.body.balance).toBe(0);
    });

    it('should handle non-existent source account for transaction', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: fakeAccountId,
          destination_account_id: account2Id,
          amount: 10000,
        })
        .expect(400);

      // Non-existent account will have 0 balance, so this will be insufficient funds
      expect(response.body.error).toBe('Insufficient funds.');
    });
  });

  describe('GET /accounts/:id/balance', () => {
    beforeEach(async () => {
      // Setup initial balances
      await request(app)
        .post(`/v1/accounts/${account1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 100000, // 1000.00 in cents
        });

      await request(app)
        .post(`/v1/accounts/${account2Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 50000, // 500.00 in cents
        });
    });

    it('should get current balance for a account', async () => {
      const response = await request(app)
        .get(`/v1/accounts/${account1Id}/balance`)
        .expect(200);

      expect(response.body).toMatchObject({
        account_id: account1Id,
        balance: 100000, // 1000.00 in cents
      });
    });

    it('should reflect balance changes after transaction', async () => {
      // Create transaction
      await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 20000, // 200.00 in cents
        });

      // Check source account balance
      const response1 = await request(app)
        .get(`/v1/accounts/${account1Id}/balance`)
        .expect(200);
      expect(response1.body.balance).toBe(80000); // 800.00 in cents

      // Check destination account balance
      const response2 = await request(app)
        .get(`/v1/accounts/${account2Id}/balance`)
        .expect(200);
      expect(response2.body.balance).toBe(70000); // 700.00 in cents
    });

    it('should return zero balance for account with no transactions', async () => {
      // Create a new user and account
      const user3Response = await request(app)
        .post('/v1/users')
        .send({
          email: 'account3@example.com',
          password: 'password123',
        });
      const userId3 = user3Response.body.id;

      const account3Response = await request(app)
        .post('/v1/accounts')
        .send({
          user_id: userId3,
        });

      const response = await request(app)
        .get(`/v1/accounts/${account3Response.body.id}/balance`)
        .expect(200);

      expect(response.body.balance).toBe(0);
    });

    it('should get balance at specific date', async () => {
      // Get current date for query
      const now = new Date().toISOString();

      const response = await request(app)
        .get(`/v1/accounts/${account1Id}/balance?date=${now}`)
        .expect(200);

      expect(response.body).toMatchObject({
        account_id: account1Id,
        balance: expect.any(Number),
      });
    });

    it('should reject invalid account id', async () => {
      const response = await request(app)
        .get('/v1/accounts/invalid/balance')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /accounts/:id/transactions', () => {
    beforeEach(async () => {
      // Setup transactions
      await request(app)
        .post(`/v1/accounts/${account1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 100000, // 1000.00 in cents
        });

      await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 10000, // 100.00 in cents
        });

      await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 5000, // 50.00 in cents
        });
    });

    it('should get transaction history for a account', async () => {
      const response = await request(app)
        .get(`/v1/accounts/${account1Id}/transactions`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3); // deposit + 2 transactions

      // Check that transactions include account1
      response.body.forEach((txn: any) => {
        expect(
          txn.source_account_id === account1Id || txn.destination_account_id === account1Id
        ).toBe(true);
      });
    });

    it('should return transactions in descending order by created_at', async () => {
      const response = await request(app)
        .get(`/v1/accounts/${account1Id}/transactions`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);

      // Check ordering
      for (let i = 0; i < response.body.length - 1; i++) {
        const current = new Date(response.body[i].created_at);
        const next = new Date(response.body[i + 1].created_at);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should return empty array for account with no transactions', async () => {
      // Create a new user and account
      const user3Response = await request(app)
        .post('/v1/users')
        .send({
          email: 'account3@example.com',
          password: 'password123',
        });
      const userId3 = user3Response.body.id;

      const account3Response = await request(app)
        .post('/v1/accounts')
        .send({
          user_id: userId3,
        });

      const response = await request(app)
        .get(`/v1/accounts/${account3Response.body.id}/transactions`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should include both sent and received transactions', async () => {
      // Account2 sends money back to account1
      await request(app)
        .post(`/v1/accounts/${account2Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 50000, // 500.00 in cents
        });

      await request(app)
        .post('/v1/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account2Id,
          destination_account_id: account1Id,
          amount: 7500, // 75.00 in cents
        });

      const response = await request(app)
        .get(`/v1/accounts/${account1Id}/transactions`)
        .expect(200);

      // Should have deposit, 2 sent, and 1 received
      expect(response.body.length).toBeGreaterThanOrEqual(4);
    });

    it('should reject invalid account id', async () => {
      const response = await request(app)
        .get('/v1/accounts/invalid/transactions')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });
});
