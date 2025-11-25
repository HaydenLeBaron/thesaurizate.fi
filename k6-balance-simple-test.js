import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Simple balance read throughput test (1 transaction per account)
export const options = {
  setupTimeout: '2m',
  scenarios: {
    balance_reads: {
      executor: 'shared-iterations',
      vus: 100, // 100 concurrent virtual accounts
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

// Setup: Create test accounts with exactly 1 transaction each
export function setup() {
  console.log('Setting up test accounts for simple balance reads...');

  const timestamp = Date.now();
  const numAccounts = 1000; // Create 1000 accounts to query
  const accountIds = [];

  console.log('Creating accounts...');
  for (let i = 0; i < numAccounts; i++) {
    const res = http.post(`${BASE_URL}/accounts`, JSON.stringify({
      email: `balancesimple${timestamp}_${i}@example.com`,
      password: 'password123',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 201) {
      const accountId = JSON.parse(res.body).id;
      accountIds.push(accountId);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`Created ${i + 1}/${numAccounts} accounts`);
    }
  }

  console.log(`Created ${accountIds.length} accounts`);
  console.log('Creating exactly 1 deposit transaction per account...');

  // Give each account exactly 1 transaction (a deposit)
  for (let i = 0; i < accountIds.length; i++) {
    http.post(`${BASE_URL}/accounts/${accountIds[i]}/deposit`, JSON.stringify({
      idempotency_key: uuidv4(),
      amount: 1000000, // $10,000 per account
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if ((i + 1) % 100 === 0) {
      console.log(`Created deposits for ${i + 1}/${accountIds.length} accounts`);
    }
  }

  console.log(`Setup complete: ${accountIds.length} accounts, ${accountIds.length} transactions (1 per account)`);
  return { accountIds };
}

// Main test: Read balances repeatedly
export default function (data) {
  const { accountIds } = data;

  if (!accountIds || accountIds.length === 0) {
    console.error('No accounts available for testing');
    return;
  }

  // Pick a random account to query
  const randomAccountId = accountIds[Math.floor(Math.random() * accountIds.length)];

  // GET balance for the account
  const res = http.get(`${BASE_URL}/accounts/${randomAccountId}/balance`, {
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
