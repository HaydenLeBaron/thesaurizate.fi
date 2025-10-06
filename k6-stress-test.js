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
        { duration: '10s', target: 100 },   // Ramp up to 100 virtual users
        { duration: '30s', target: 500 },   // Ramp up to 500 users
        { duration: '1m', target: 1000 },   // Peak at 1000 concurrent users
        { duration: '30s', target: 0 },     // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete within 500ms
    http_req_failed: ['rate<0.1'],    // Less than 10% of requests can fail
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// Setup: Create users (runs once per VU)
export function setup() {
  console.log('Setting up test data...');

  // Use timestamp to ensure unique emails across test runs
  const timestamp = Date.now();

  // Create test users (more users = less contention, better success rate)
  const numUsers = 10000;
  const userIds = [];

  for (let i = 0; i < numUsers; i++) {
    const res = http.post(`${BASE_URL}/users`, JSON.stringify({
      email: `k6test${timestamp}_${i}@example.com`,
      password: 'password123',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 201) {
      const userId = JSON.parse(res.body).id;
      userIds.push(userId);

      // Deposit initial balance immediately after creating user
      const depositRes = http.post(`${BASE_URL}/users/${userId}/deposit`, JSON.stringify({
        idempotency_key: uuidv4(),
        amount: 10000000000, // 100,000,000.00 in cents = $100M per user
      }), {
        headers: { 'Content-Type': 'application/json' },
      });

      if (depositRes.status !== 201) {
        console.log(`Failed to deposit for user ${i}: status=${depositRes.status}, body=${depositRes.body}`);
      }
    }
  }

  console.log(`Created ${userIds.length} users with initial balances`);
  return { userIds };
}

// Main test scenario (runs repeatedly by each VU)
export default function (data) {
  const { userIds } = data;

  if (!userIds || userIds.length < 2) {
    console.error('Not enough users created');
    return;
  }

  // Pick random source and destination users
  const sourceIdx = Math.floor(Math.random() * userIds.length);
  let destIdx = Math.floor(Math.random() * userIds.length);
  while (destIdx === sourceIdx) {
    destIdx = Math.floor(Math.random() * userIds.length);
  }

  const amount = 1; // Fixed 1 cent per transaction to minimize depletion
  const idempotencyKey = uuidv4();

  // Execute transaction
  const res = http.post(`${BASE_URL}/transactions`, JSON.stringify({
    idempotency_key: idempotencyKey,
    source_user_id: userIds[sourceIdx],
    destination_user_id: userIds[destIdx],
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
  const { userIds } = data;

  console.log('\nVerifying data integrity...');

  let totalBalance = 0;
  for (const userId of userIds) {
    const res = http.get(`${BASE_URL}/users/${userId}/balance`);
    if (res.status === 200) {
      totalBalance += JSON.parse(res.body).balance;
    }
  }

  const expectedTotal = userIds.length * 10000000000;
  console.log(`Expected total: ${expectedTotal} cents`);
  console.log(`Actual total: ${totalBalance} cents`);
  console.log(`Difference: ${totalBalance - expectedTotal} cents`);
}
