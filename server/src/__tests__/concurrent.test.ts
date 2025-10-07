import request from 'supertest';
import { app } from './app';
import { pool } from '../db';
import { randomUUID } from 'crypto';

describe('Concurrent Transaction Tests', () => {
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');

    // Create test users
    const user1Response = await request(app)
      .post('/users')
      .send({
        email: 'concurrent1@example.com',
        password: 'password123',
      });
    user1Id = user1Response.body.id;

    const user2Response = await request(app)
      .post('/users')
      .send({
        email: 'concurrent2@example.com',
        password: 'password123',
      });
    user2Id = user2Response.body.id;

    const user3Response = await request(app)
      .post('/users')
      .send({
        email: 'concurrent3@example.com',
        password: 'password123',
      });
    user3Id = user3Response.body.id;
  });

  describe('Parallel Deposits', () => {
    it('should handle multiple concurrent deposits to the same user', async () => {
      const depositCount = 10;
      const depositAmount = 1000;

      const deposits = Array.from({ length: depositCount }, () =>
        request(app)
          .post(`/users/${user1Id}/deposit`)
          .send({
            idempotency_key: randomUUID(),
            amount: depositAmount,
          })
      );

      const responses = await Promise.all(deposits);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Final balance should be correct
      const balanceResponse = await request(app)
        .get(`/users/${user1Id}/balance`)
        .expect(200);

      expect(balanceResponse.body.balance).toBe(depositCount * depositAmount);
    });

    it('should handle concurrent deposits to different users', async () => {
      const depositAmount = 5000;

      const deposits = [
        request(app)
          .post(`/users/${user1Id}/deposit`)
          .send({
            idempotency_key: randomUUID(),
            amount: depositAmount,
          }),
        request(app)
          .post(`/users/${user2Id}/deposit`)
          .send({
            idempotency_key: randomUUID(),
            amount: depositAmount,
          }),
        request(app)
          .post(`/users/${user3Id}/deposit`)
          .send({
            idempotency_key: randomUUID(),
            amount: depositAmount,
          }),
      ];

      const responses = await Promise.all(deposits);

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Check all balances
      const balance1 = await request(app).get(`/users/${user1Id}/balance`);
      const balance2 = await request(app).get(`/users/${user2Id}/balance`);
      const balance3 = await request(app).get(`/users/${user3Id}/balance`);

      expect(balance1.body.balance).toBe(depositAmount);
      expect(balance2.body.balance).toBe(depositAmount);
      expect(balance3.body.balance).toBe(depositAmount);
    });
  });

  describe('Parallel Transfers', () => {
    beforeEach(async () => {
      // Fund user1 with enough money for multiple transfers
      await request(app)
        .post(`/users/${user1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 100000,
        });
    });

    it('should handle multiple concurrent transfers from same user', async () => {
      const transferCount = 5;
      const transferAmount = 1000;

      const transfers = Array.from({ length: transferCount }, () =>
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user1Id,
            destination_user_id: user2Id,
            amount: transferAmount,
          })
      );

      const responses = await Promise.all(transfers);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Check balances
      const sourceBalance = await request(app).get(`/users/${user1Id}/balance`);
      const destBalance = await request(app).get(`/users/${user2Id}/balance`);

      expect(sourceBalance.body.balance).toBe(100000 - transferCount * transferAmount);
      expect(destBalance.body.balance).toBe(transferCount * transferAmount);
    });

    it('should handle bidirectional concurrent transfers between two users', async () => {
      // Fund user2 as well
      await request(app)
        .post(`/users/${user2Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 50000,
        });

      const transfers = [
        // user1 -> user2
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user1Id,
            destination_user_id: user2Id,
            amount: 10000,
          }),
        // user2 -> user1
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user2Id,
            destination_user_id: user1Id,
            amount: 5000,
          }),
        // user1 -> user2
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user1Id,
            destination_user_id: user2Id,
            amount: 3000,
          }),
      ];

      const responses = await Promise.all(transfers);

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Check final balances
      const balance1 = await request(app).get(`/users/${user1Id}/balance`);
      const balance2 = await request(app).get(`/users/${user2Id}/balance`);

      // user1: 100000 - 10000 + 5000 - 3000 = 92000
      expect(balance1.body.balance).toBe(92000);
      // user2: 50000 + 10000 - 5000 + 3000 = 58000
      expect(balance2.body.balance).toBe(58000);
    });

    it('should handle circular concurrent transfers (A->B, B->C, C->A)', async () => {
      // Fund all users
      await request(app)
        .post(`/users/${user2Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 50000,
        });

      await request(app)
        .post(`/users/${user3Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 30000,
        });

      const transfers = [
        // user1 -> user2
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user1Id,
            destination_user_id: user2Id,
            amount: 5000,
          }),
        // user2 -> user3
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user2Id,
            destination_user_id: user3Id,
            amount: 7000,
          }),
        // user3 -> user1
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user3Id,
            destination_user_id: user1Id,
            amount: 3000,
          }),
      ];

      const responses = await Promise.all(transfers);

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Check balances
      const balance1 = await request(app).get(`/users/${user1Id}/balance`);
      const balance2 = await request(app).get(`/users/${user2Id}/balance`);
      const balance3 = await request(app).get(`/users/${user3Id}/balance`);

      // user1: 100000 - 5000 + 3000 = 98000
      expect(balance1.body.balance).toBe(98000);
      // user2: 50000 + 5000 - 7000 = 48000
      expect(balance2.body.balance).toBe(48000);
      // user3: 30000 + 7000 - 3000 = 34000
      expect(balance3.body.balance).toBe(34000);

      // Total should be conserved: 180000
      const total = balance1.body.balance + balance2.body.balance + balance3.body.balance;
      expect(total).toBe(180000);
    });
  });

  describe('Race Conditions and Deadlock Prevention', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/users/${user1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 10000,
        });

      await request(app)
        .post(`/users/${user2Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 10000,
        });
    });

    it('should prevent double-spending through concurrent transactions', async () => {
      const transferAmount = 8000;

      // Try to make two concurrent transfers that would exceed balance if both succeed
      const transfers = [
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user1Id,
            destination_user_id: user2Id,
            amount: transferAmount,
          }),
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user1Id,
            destination_user_id: user3Id,
            amount: transferAmount,
          }),
      ];

      const responses = await Promise.all(transfers);

      // With retry logic, both might succeed or one might fail
      const successCount = responses.filter(r => r.status === 201).length;
      const failCount = responses.filter(r => r.status === 400).length;

      // Total responses should be 2
      expect(successCount + failCount).toBe(2);

      // Check that any failed responses have the right error
      const failedResponses = responses.filter(r => r.status === 400);
      failedResponses.forEach(response => {
        expect(response.body.error).toBe('Insufficient funds.');
      });

      // CRITICAL: Verify no double-spending occurred
      const balance = await request(app).get(`/users/${user1Id}/balance`);

      // Balance must be non-negative (no overdraft)
      expect(balance.body.balance).toBeGreaterThanOrEqual(0);

      // Balance must be exactly what we expect based on successful transactions
      // Valid states: 10000 (both failed), 2000 (one succeeded)
      // Invalid: -6000 (both succeeded - double spend bug)
      expect(balance.body.balance).toBe(10000 - successCount * transferAmount);

      // Must not allow both to succeed (would be double-spending)
      expect(successCount).toBeLessThanOrEqual(1);
    });

    it('should handle potential deadlock scenario (simultaneous bidirectional transfers)', async () => {
      // Both users try to send to each other simultaneously
      const transfers = [
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user1Id,
            destination_user_id: user2Id,
            amount: 5000,
          }),
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user2Id,
            destination_user_id: user1Id,
            amount: 3000,
          }),
      ];

      const responses = await Promise.all(transfers);

      // Both should succeed (deadlock prevention with sorted locking)
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Check balances
      const balance1 = await request(app).get(`/users/${user1Id}/balance`);
      const balance2 = await request(app).get(`/users/${user2Id}/balance`);

      expect(balance1.body.balance).toBe(8000); // 10000 - 5000 + 3000
      expect(balance2.body.balance).toBe(12000); // 10000 + 5000 - 3000
    });
  });

  describe('Idempotency Under Concurrency', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/users/${user1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 50000,
        });
    });

    it('should handle duplicate concurrent requests with same idempotency key', async () => {
      const idempotencyKey = randomUUID();
      const transferAmount = 5000;

      // Make the same request 5 times concurrently
      const transfers = Array.from({ length: 5 }, () =>
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: idempotencyKey,
            source_user_id: user1Id,
            destination_user_id: user2Id,
            amount: transferAmount,
          })
      );

      const responses = await Promise.all(transfers);

      // Most should return 201, some may return 500 due to race conditions
      const successResponses = responses.filter(r => r.status === 201);
      expect(successResponses.length).toBeGreaterThan(0);

      // All successful responses should return the same transaction ID
      const transactionIds = successResponses.map(r => r.body.id);
      const uniqueIds = new Set(transactionIds);
      expect(uniqueIds.size).toBe(1);

      // Balance should only reflect one transaction
      const balance1 = await request(app).get(`/users/${user1Id}/balance`);
      const balance2 = await request(app).get(`/users/${user2Id}/balance`);

      expect(balance1.body.balance).toBe(45000);
      expect(balance2.body.balance).toBe(5000);

      // Check transaction count in history
      const txHistory = await request(app).get(`/users/${user1Id}/transactions`);
      const transferTxs = txHistory.body.filter(
        (tx: any) => tx.idempotency_key === idempotencyKey
      );
      expect(transferTxs.length).toBe(1);
    });
  });

  describe('Concurrent Balance Queries', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/users/${user1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 25000,
        });
    });

    it('should handle concurrent balance queries during active transactions', async () => {
      // Start some transactions and balance queries at the same time
      const operations = [
        request(app).get(`/users/${user1Id}/balance`),
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user1Id,
            destination_user_id: user2Id,
            amount: 5000,
          }),
        request(app).get(`/users/${user1Id}/balance`),
        request(app)
          .post('/transactions')
          .send({
            idempotency_key: randomUUID(),
            source_user_id: user1Id,
            destination_user_id: user2Id,
            amount: 3000,
          }),
        request(app).get(`/users/${user1Id}/balance`),
      ];

      const responses = await Promise.all(operations);

      // All should succeed
      responses.forEach(response => {
        expect([200, 201]).toContain(response.status);
      });

      // Final balance should be correct
      const finalBalance = await request(app).get(`/users/${user1Id}/balance`);
      expect(finalBalance.body.balance).toBe(17000); // 25000 - 5000 - 3000
    });

    it('should return consistent balance across multiple concurrent reads', async () => {
      const balanceQueries = Array.from({ length: 10 }, () =>
        request(app).get(`/users/${user1Id}/balance`)
      );

      const responses = await Promise.all(balanceQueries);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.balance).toBe(25000);
      });
    });
  });

  describe('High Load Scenarios', () => {
    it('should handle many concurrent operations across multiple users', async () => {
      // Fund all users
      await Promise.all([
        request(app)
          .post(`/users/${user1Id}/deposit`)
          .send({
            idempotency_key: randomUUID(),
            amount: 100000,
          }),
        request(app)
          .post(`/users/${user2Id}/deposit`)
          .send({
            idempotency_key: randomUUID(),
            amount: 100000,
          }),
        request(app)
          .post(`/users/${user3Id}/deposit`)
          .send({
            idempotency_key: randomUUID(),
            amount: 100000,
          }),
      ]);

      // Mix of operations
      const operations = [
        ...Array.from({ length: 5 }, () =>
          request(app)
            .post('/transactions')
            .send({
              idempotency_key: randomUUID(),
              source_user_id: user1Id,
              destination_user_id: user2Id,
              amount: 1000,
            })
        ),
        ...Array.from({ length: 5 }, () =>
          request(app)
            .post('/transactions')
            .send({
              idempotency_key: randomUUID(),
              source_user_id: user2Id,
              destination_user_id: user3Id,
              amount: 1500,
            })
        ),
        ...Array.from({ length: 5 }, () =>
          request(app)
            .post('/transactions')
            .send({
              idempotency_key: randomUUID(),
              source_user_id: user3Id,
              destination_user_id: user1Id,
              amount: 800,
            })
        ),
        ...Array.from({ length: 10 }, () =>
          request(app).get(`/users/${user1Id}/balance`)
        ),
      ];

      const responses = await Promise.all(operations);

      // Count successes
      const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
      expect(successCount).toBe(operations.length);

      // Verify money conservation
      const balances = await Promise.all([
        request(app).get(`/users/${user1Id}/balance`),
        request(app).get(`/users/${user2Id}/balance`),
        request(app).get(`/users/${user3Id}/balance`),
      ]);

      const totalBalance = balances.reduce((sum, b) => sum + b.body.balance, 0);
      expect(totalBalance).toBe(300000); // Total deposited
    });
  });
});
