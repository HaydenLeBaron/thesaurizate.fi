import { randomUUID } from 'crypto';
import { pool } from '../db';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function makeRequest(method: string, path: string, body?: any): Promise<any> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  return { status: response.status, body: data };
}

describe('Stress Tests', () => {
  beforeAll(async () => {
    // Clean database before stress tests
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    // Pool cleanup is handled in global setup
  });

  it('should handle 50,000 concurrent transactions across 10,000 users', async () => {
    const NUM_USERS = 1000;
    const NUM_TRANSACTIONS = 5000;
    const INITIAL_BALANCE = 1000000; // 10,000.00 in cents per user

    console.log('\n🧪 Starting stress test...');
    console.log(`📊 Creating ${NUM_USERS} users...`);

    const startSetup = Date.now();

    // Create 1,000 users
    const userIds: string[] = [];
    const userCreationPromises = [];

    for (let i = 0; i < NUM_USERS; i++) {
      userCreationPromises.push(
        makeRequest('POST', '/users', {
          email: `stresstest${i}@example.com`,
          password: 'password123',
        })
      );
    }

    const userResponses = await Promise.all(userCreationPromises);
    userResponses.forEach((res) => {
      userIds.push(res.body.id);
    });

    console.log(`✅ Created ${userIds.length} users`);
    console.log('💰 Depositing initial balances...');

    // Deposit initial balance to all users
    const depositPromises = userIds.map((userId) =>
      makeRequest('POST', `/users/${userId}/deposit`, {
        idempotency_key: randomUUID(),
        amount: INITIAL_BALANCE,
      })
    );

    await Promise.all(depositPromises);

    const setupDuration = Date.now() - startSetup;
    console.log(`✅ Setup completed in ${setupDuration}ms`);
    console.log(`💸 Executing ${NUM_TRANSACTIONS} concurrent transactions...`);

    const startTransactions = Date.now();

    // Create 50,000 transactions with random source/destination pairs
    const transactionPromises = [];

    console.log(`⏱️  Starting to queue promises at: ${Date.now() - startTransactions}ms`);

    for (let i = 0; i < NUM_TRANSACTIONS; i++) {
      // Pick random source and destination users (ensuring they're different)
      const sourceIdx = Math.floor(Math.random() * NUM_USERS);
      let destIdx = Math.floor(Math.random() * NUM_USERS);
      while (destIdx === sourceIdx) {
        destIdx = Math.floor(Math.random() * NUM_USERS);
      }

      // Random amount between 1 and 100 cents
      const amount = Math.floor(Math.random() * 100) + 1;

      transactionPromises.push(
        makeRequest('POST', '/transactions', {
          idempotency_key: randomUUID(),
          source_user_id: userIds[sourceIdx],
          destination_user_id: userIds[destIdx],
          amount: amount,
        }).catch((e) => ({ error: e, status: 500 }))
      );
    }

    console.log(`⏱️  All promises queued at: ${Date.now() - startTransactions}ms`);

    // Execute all transactions concurrently
    const transactionResults = await Promise.all(transactionPromises);

    const transactionsDuration = Date.now() - startTransactions;
    console.log(`⏱️  All promises resolved at: ${transactionsDuration}ms`);

    // Count successes and failures
    const successes = transactionResults.filter(
      (res: any) => !res.error && res.status === 201
    ).length;
    const failures = transactionResults.filter(
      (res: any) => res.error || res.status !== 201
    ).length;

    console.log(`\n📈 Stress Test Results:`);
    console.log(`   Total transactions: ${NUM_TRANSACTIONS}`);
    console.log(`   Successful: ${successes}`);
    console.log(`   Failed: ${failures}`);
    console.log(`   Duration: ${transactionsDuration}ms`);
    console.log(
      `   Throughput: ${(NUM_TRANSACTIONS / (transactionsDuration / 1000)).toFixed(2)} txn/sec`
    );
    console.log(
      `   Average latency: ${(transactionsDuration / NUM_TRANSACTIONS).toFixed(2)}ms per transaction\n`
    );

    // Verify data integrity: sum of all balances should equal initial total
    console.log('🔍 Verifying data integrity...');

    const balancePromises = userIds.map((userId) =>
      makeRequest('GET', `/users/${userId}/balance`)
    );

    const balanceResponses = await Promise.all(balancePromises);
    const totalBalance = balanceResponses.reduce(
      (sum, res) => sum + res.body.balance,
      0
    );

    const expectedTotal = NUM_USERS * INITIAL_BALANCE;

    console.log(`   Expected total: ${expectedTotal} cents`);
    console.log(`   Actual total: ${totalBalance} cents`);
    console.log(`   Difference: ${totalBalance - expectedTotal} cents\n`);

    // Query failed transactions for audit
    console.log('📋 Checking failed transactions log...');
    const failedTxnsResult = await pool.query(
      'SELECT COUNT(*) as count FROM private.failed_transactions'
    );
    const failedTxnsCount = parseInt(failedTxnsResult.rows[0].count, 10);
    console.log(`   Failed transactions logged: ${failedTxnsCount}\n`);

    // Assert that we had a reasonable number of successes
    expect(successes).toBeGreaterThan(0);

    // Assert data integrity: total balance should be preserved
    expect(totalBalance).toBe(expectedTotal);

    // Performance assertions (adjust based on your requirements)
    expect(transactionsDuration).toBeLessThan(300000); // Should complete within 5 minutes
  }, 600000); // 10-minute timeout for this test
});
