import request from 'supertest';
import { app } from './app';
import { pool } from '../db';
import { randomUUID } from 'crypto';

describe('Balance Calculation Accuracy Tests', () => {
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');

    const users = await Promise.all([
      request(app).post('/users').send({
        email: 'balance1@example.com',
        password: 'password123',
      }),
      request(app).post('/users').send({
        email: 'balance2@example.com',
        password: 'password123',
      }),
      request(app).post('/users').send({
        email: 'balance3@example.com',
        password: 'password123',
      }),
    ]);

    user1Id = users[0].body.id;
    user2Id = users[1].body.id;
    user3Id = users[2].body.id;
  });

  describe('Simple Balance Calculations', () => {
    it('should calculate correct balance after single deposit', async () => {
      await request(app)
        .post(`/users/${user1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 12345,
        });

      const balance = await request(app).get(`/users/${user1Id}/balance`);
      expect(balance.body.balance).toBe(12345);
    });

    it('should calculate correct balance after multiple deposits', async () => {
      const deposits = [5000, 3000, 2000, 1000];

      for (const amount of deposits) {
        await request(app)
          .post(`/users/${user1Id}/deposit`)
          .send({
            idempotency_key: randomUUID(),
            amount,
          });
      }

      const balance = await request(app).get(`/users/${user1Id}/balance`);
      expect(balance.body.balance).toBe(11000);
    });

    it('should calculate correct balance after deposit and single transfer out', async () => {
      await request(app)
        .post(`/users/${user1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 10000,
        });

      await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_user_id: user1Id,
          destination_user_id: user2Id,
          amount: 3000,
        });

      const balance = await request(app).get(`/users/${user1Id}/balance`);
      expect(balance.body.balance).toBe(7000);
    });

    it('should calculate correct balance after receiving a transfer', async () => {
      await request(app)
        .post(`/users/${user1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 10000,
        });

      await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_user_id: user1Id,
          destination_user_id: user2Id,
          amount: 4000,
        });

      const balance = await request(app).get(`/users/${user2Id}/balance`);
      expect(balance.body.balance).toBe(4000);
    });
  });

  describe('Complex Balance Calculations', () => {
    it('should calculate correct balance after many mixed transactions', async () => {
      // Initial deposit
      await request(app)
        .post(`/users/${user1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 100000,
        });

      // Multiple outgoing transfers
      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user2Id,
        amount: 10000,
      });

      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user3Id,
        amount: 15000,
      });

      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user2Id,
        amount: 5000,
      });

      // Fund user2 and receive money from user2
      await request(app)
        .post(`/users/${user2Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 50000,
        });

      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user2Id,
        destination_user_id: user1Id,
        amount: 8000,
      });

      // More outgoing
      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user3Id,
        amount: 12000,
      });

      const balance = await request(app).get(`/users/${user1Id}/balance`);
      // 100000 - 10000 - 15000 - 5000 + 8000 - 12000 = 66000
      expect(balance.body.balance).toBe(66000);
    });

    it('should maintain correct balances in circular transfer scenario', async () => {
      // Fund all users
      await Promise.all([
        request(app).post(`/users/${user1Id}/deposit`).send({
          idempotency_key: randomUUID(),
          amount: 30000,
        }),
        request(app).post(`/users/${user2Id}/deposit`).send({
          idempotency_key: randomUUID(),
          amount: 20000,
        }),
        request(app).post(`/users/${user3Id}/deposit`).send({
          idempotency_key: randomUUID(),
          amount: 10000,
        }),
      ]);

      // Circular transfers
      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user2Id,
        amount: 5000,
      });

      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user2Id,
        destination_user_id: user3Id,
        amount: 7000,
      });

      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user3Id,
        destination_user_id: user1Id,
        amount: 3000,
      });

      const balances = await Promise.all([
        request(app).get(`/users/${user1Id}/balance`),
        request(app).get(`/users/${user2Id}/balance`),
        request(app).get(`/users/${user3Id}/balance`),
      ]);

      // user1: 30000 - 5000 + 3000 = 28000
      expect(balances[0].body.balance).toBe(28000);
      // user2: 20000 + 5000 - 7000 = 18000
      expect(balances[1].body.balance).toBe(18000);
      // user3: 10000 + 7000 - 3000 = 14000
      expect(balances[2].body.balance).toBe(14000);
    });

    it('should calculate balance correctly after 100 small transactions', async () => {
      await request(app)
        .post(`/users/${user1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 1000000, // 1M cents = $10,000
        });

      // Make 100 small transfers
      const transferAmount = 100;
      for (let i = 0; i < 100; i++) {
        await request(app).post('/transactions').send({
          idempotency_key: randomUUID(),
          source_user_id: user1Id,
          destination_user_id: user2Id,
          amount: transferAmount,
        });
      }

      const balance1 = await request(app).get(`/users/${user1Id}/balance`);
      const balance2 = await request(app).get(`/users/${user2Id}/balance`);

      expect(balance1.body.balance).toBe(1000000 - 100 * transferAmount);
      expect(balance2.body.balance).toBe(100 * transferAmount);
    });
  });

  describe('Money Conservation (Invariant Testing)', () => {
    it('should conserve total money in the system across transfers', async () => {
      // Initial deposits
      const initialTotal = 150000;
      await request(app).post(`/users/${user1Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 100000,
      });
      await request(app).post(`/users/${user2Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 50000,
      });

      // Perform various transfers
      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user2Id,
        amount: 25000,
      });

      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user2Id,
        destination_user_id: user3Id,
        amount: 30000,
      });

      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user3Id,
        amount: 15000,
      });

      // Get all balances
      const balances = await Promise.all([
        request(app).get(`/users/${user1Id}/balance`),
        request(app).get(`/users/${user2Id}/balance`),
        request(app).get(`/users/${user3Id}/balance`),
      ]);

      const totalBalance = balances.reduce((sum, b) => sum + b.body.balance, 0);
      expect(totalBalance).toBe(initialTotal);
    });

    it('should conserve money even with complex transfer patterns', async () => {
      // Random initial amounts
      const amounts = [78123, 45678, 91234];
      const initialTotal = amounts.reduce((a, b) => a + b, 0);

      await Promise.all([
        request(app).post(`/users/${user1Id}/deposit`).send({
          idempotency_key: randomUUID(),
          amount: amounts[0],
        }),
        request(app).post(`/users/${user2Id}/deposit`).send({
          idempotency_key: randomUUID(),
          amount: amounts[1],
        }),
        request(app).post(`/users/${user3Id}/deposit`).send({
          idempotency_key: randomUUID(),
          amount: amounts[2],
        }),
      ]);

      // Random transfers
      const transfers = [
        { from: user1Id, to: user2Id, amount: 12345 },
        { from: user2Id, to: user3Id, amount: 6789 },
        { from: user3Id, to: user1Id, amount: 23456 },
        { from: user1Id, to: user3Id, amount: 7890 },
        { from: user2Id, to: user1Id, amount: 11111 },
        { from: user3Id, to: user2Id, amount: 9876 },
      ];

      for (const transfer of transfers) {
        await request(app).post('/transactions').send({
          idempotency_key: randomUUID(),
          source_user_id: transfer.from,
          destination_user_id: transfer.to,
          amount: transfer.amount,
        });
      }

      const balances = await Promise.all([
        request(app).get(`/users/${user1Id}/balance`),
        request(app).get(`/users/${user2Id}/balance`),
        request(app).get(`/users/${user3Id}/balance`),
      ]);

      const totalBalance = balances.reduce((sum, b) => sum + b.body.balance, 0);
      expect(totalBalance).toBe(initialTotal);
    });
  });

  describe('Historical Balance Calculations', () => {
    it('should calculate balance at specific point in time', async () => {
      // Deposit
      await request(app).post(`/users/${user1Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 10000,
      });

      // Wait a bit and capture timestamp
      await new Promise(resolve => setTimeout(resolve, 100));
      const checkpointDate = new Date().toISOString();
      await new Promise(resolve => setTimeout(resolve, 100));

      // More transactions after checkpoint
      await request(app).post(`/users/${user1Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 5000,
      });

      // Balance at checkpoint should be 10000
      const historicalBalance = await request(app)
        .get(`/users/${user1Id}/balance?date=${checkpointDate}`);
      expect(historicalBalance.body.balance).toBe(10000);

      // Current balance should be 15000
      const currentBalance = await request(app)
        .get(`/users/${user1Id}/balance`);
      expect(currentBalance.body.balance).toBe(15000);
    });

    it('should show zero balance before first transaction', async () => {
      const pastDate = new Date('2020-01-01T00:00:00Z').toISOString();

      await request(app).post(`/users/${user1Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 10000,
      });

      const balance = await request(app)
        .get(`/users/${user1Id}/balance?date=${pastDate}`);
      expect(balance.body.balance).toBe(0);
    });

    it('should calculate complex historical balance correctly', async () => {
      // Series of transactions
      await request(app).post(`/users/${user1Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 50000,
      });

      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user2Id,
        amount: 10000,
      });

      // Checkpoint 1: should be 40000
      await new Promise(resolve => setTimeout(resolve, 100));
      const checkpoint1 = new Date().toISOString();
      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user2Id,
        amount: 5000,
      });

      // Checkpoint 2: should be 35000
      await new Promise(resolve => setTimeout(resolve, 100));
      const checkpoint2 = new Date().toISOString();
      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app).post(`/users/${user1Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 20000,
      });

      const balance1 = await request(app)
        .get(`/users/${user1Id}/balance?date=${checkpoint1}`);
      expect(balance1.body.balance).toBe(40000);

      const balance2 = await request(app)
        .get(`/users/${user1Id}/balance?date=${checkpoint2}`);
      expect(balance2.body.balance).toBe(35000);

      const currentBalance = await request(app)
        .get(`/users/${user1Id}/balance`);
      expect(currentBalance.body.balance).toBe(55000);
    });
  });

  describe('Precision and Rounding', () => {
    it('should handle amounts without any rounding errors', async () => {
      // Test with prime numbers to catch any rounding issues
      const primeAmounts = [7, 13, 17, 23, 29, 31, 37, 41, 43, 47];

      for (const amount of primeAmounts) {
        await request(app).post(`/users/${user1Id}/deposit`).send({
          idempotency_key: randomUUID(),
          amount,
        });
      }

      const balance = await request(app).get(`/users/${user1Id}/balance`);
      const expectedSum = primeAmounts.reduce((a, b) => a + b, 0);
      expect(balance.body.balance).toBe(expectedSum);
    });

    it('should maintain precision with large numbers', async () => {
      const largeAmount1 = 999999999;
      const largeAmount2 = 888888888;

      await request(app).post(`/users/${user1Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: largeAmount1,
      });

      await request(app).post(`/users/${user1Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: largeAmount2,
      });

      const balance = await request(app).get(`/users/${user1Id}/balance`);
      expect(balance.body.balance).toBe(largeAmount1 + largeAmount2);
    });
  });

  describe('Balance After Failed Transactions', () => {
    it('should not change balance after failed transaction (insufficient funds)', async () => {
      await request(app).post(`/users/${user1Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 5000,
      });

      const balanceBefore = await request(app).get(`/users/${user1Id}/balance`);

      // Try to send more than available
      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user2Id,
        amount: 10000,
      }).expect(400);

      const balanceAfter = await request(app).get(`/users/${user1Id}/balance`);
      expect(balanceAfter.body.balance).toBe(balanceBefore.body.balance);
      expect(balanceAfter.body.balance).toBe(5000);
    });

    it('should not affect recipient balance after failed transaction', async () => {
      await request(app).post(`/users/${user1Id}/deposit`).send({
        idempotency_key: randomUUID(),
        amount: 1000,
      });

      const balance2Before = await request(app).get(`/users/${user2Id}/balance`);

      // Try to send more than available
      await request(app).post('/transactions').send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user2Id,
        amount: 5000,
      }).expect(400);

      const balance2After = await request(app).get(`/users/${user2Id}/balance`);
      expect(balance2After.body.balance).toBe(balance2Before.body.balance);
      expect(balance2After.body.balance).toBe(0);
    });
  });
});
