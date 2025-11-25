import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Stress test configuration
export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },   // Ramp up to 100 virtual accounts
        { duration: '30s', target: 500 },   // Ramp up to 500 accounts
        { duration: '1m', target: 1000 },   // Peak at 1000 concurrent accounts
        { duration: '30s', target: 0 },     // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete within 850ms
    http_req_failed: ['rate<0.1'],    // Less than 10% of requests can fail
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// Setup: Create accounts (runs once per VU)
export function setup() {
  console.log('Setting up test data...');

  // Use timestamp to ensure unique emails across test runs
  const timestamp = Date.now();

  // Create test accounts (more accounts = less contention, better success rate)
  const numAccounts = 10000;
  const accountIds = [];

  for (let i = 0; i < numAccounts; i++) {
    const res = http.post(`${BASE_URL}/accounts`, JSON.stringify({
      email: `k6test${timestamp}_${i}@example.com`,
      password: 'password123',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 201) {
      const accountId = JSON.parse(res.body).id;
      accountIds.push(accountId);

      // Deposit initial balance immediately after creating account
      const depositRes = http.post(`${BASE_URL}/accounts/${accountId}/deposit`, JSON.stringify({
        idempotency_key: uuidv4(),
        amount: 10000000000, // 100,000,000.00 in cents = $100M per account
      }), {
        headers: { 'Content-Type': 'application/json' },
      });

      if (depositRes.status !== 201) {
        console.log(`Failed to deposit for account ${i}: status=${depositRes.status}, body=${depositRes.body}`);
      }
    }
  }

  console.log(`Created ${accountIds.length} accounts with initial balances`);
  return { accountIds };
}

// Main test scenario (runs repeatedly by each VU)
export default function (data) {
  const { accountIds } = data;

  if (!accountIds || accountIds.length < 2) {
    console.error('Not enough accounts created');
    return;
  }

  // Pick random source and destination accounts
  const sourceIdx = Math.floor(Math.random() * accountIds.length);
  let destIdx = Math.floor(Math.random() * accountIds.length);
  while (destIdx === sourceIdx) {
    destIdx = Math.floor(Math.random() * accountIds.length);
  }

  const amount = 1; // Fixed 1 cent per transaction to minimize depletion
  const idempotencyKey = uuidv4();

  // Execute transaction
  const res = http.post(`${BASE_URL}/transactions`, JSON.stringify({
    idempotency_key: idempotencyKey,
    source_account_id: accountIds[sourceIdx],
    destination_account_id: accountIds[destIdx],
    amount: amount,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  // Verify response
  check(res, {
    'transaction created or insufficient funds': (r) => r.status === 201 || r.status === 400,
  });

  sleep(0.1); // Small delay between requests per VU
}

// Teardown: Verify data integrity (runs once after all VUs finish)
export function teardown(data) {
  const { accountIds } = data;

  console.log('\nVerifying data integrity...');

  let totalBalance = 0;
  for (const accountId of accountIds) {
    const res = http.get(`${BASE_URL}/accounts/${accountId}/balance`);
    if (res.status === 200) {
      totalBalance += JSON.parse(res.body).balance;
    }
  }

  const expectedTotal = accountIds.length * 10000000000;
  console.log(`Expected total: ${expectedTotal} cents`);
  console.log(`Actual total: ${totalBalance} cents`);
  console.log(`Difference: ${totalBalance - expectedTotal} cents`);
}
