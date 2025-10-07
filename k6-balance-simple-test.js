import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Simple balance read throughput test (1 transaction per user)
export const options = {
  setupTimeout: '2m',
  scenarios: {
    balance_reads: {
      executor: 'shared-iterations',
      vus: 100, // 100 concurrent virtual users
      iterations: 50000, // Total 50k balance reads
      maxDuration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<100'], // 95% of read requests should be fast (<100ms)
    http_req_failed: ['rate<0.01'],   // Less than 1% can fail
    iterations: ['rate>1000'],         // Target >1000 reads/sec
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// Setup: Create test users with exactly 1 transaction each
export function setup() {
  console.log('Setting up test users for simple balance reads...');

  const timestamp = Date.now();
  const numUsers = 1000; // Create 1000 users to query
  const userIds = [];

  console.log('Creating users...');
  for (let i = 0; i < numUsers; i++) {
    const res = http.post(`${BASE_URL}/users`, JSON.stringify({
      email: `balancesimple${timestamp}_${i}@example.com`,
      password: 'password123',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 201) {
      const userId = JSON.parse(res.body).id;
      userIds.push(userId);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`Created ${i + 1}/${numUsers} users`);
    }
  }

  console.log(`Created ${userIds.length} users`);
  console.log('Creating exactly 1 deposit transaction per user...');

  // Give each user exactly 1 transaction (a deposit)
  for (let i = 0; i < userIds.length; i++) {
    http.post(`${BASE_URL}/users/${userIds[i]}/deposit`, JSON.stringify({
      idempotency_key: uuidv4(),
      amount: 1000000, // $10,000 per user
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if ((i + 1) % 100 === 0) {
      console.log(`Created deposits for ${i + 1}/${userIds.length} users`);
    }
  }

  console.log(`Setup complete: ${userIds.length} users, ${userIds.length} transactions (1 per user)`);
  return { userIds };
}

// Main test: Read balances repeatedly
export default function (data) {
  const { userIds } = data;

  if (!userIds || userIds.length === 0) {
    console.error('No users available for testing');
    return;
  }

  // Pick a random user to query
  const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];

  // GET balance for the user
  const res = http.get(`${BASE_URL}/users/${randomUserId}/balance`, {
    headers: { 'Content-Type': 'application/json' },
  });

  // Verify response
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has balance field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('balance');
      } catch {
        return false;
      }
    },
  });
}

// Teardown: Report results
export function teardown(data) {
  console.log('\n📊 Simple Balance Read Test Complete');
}
