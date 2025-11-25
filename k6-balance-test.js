import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Balance read throughput test configuration
export const options = {
  setupTimeout: '4m',
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
    iterations: ['rate>200'],         // Target >200 reads/sec
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// Setup: Create test accounts with known balances
export function setup() {
  console.log('Setting up test accounts for balance reads...');

  const timestamp = Date.now();
  const numAccounts = 1000; // Create 1000 accounts to query
  const accountIds = [];

  for (let i = 0; i < numAccounts; i++) {
    const res = http.post(`${BASE_URL}/accounts`, JSON.stringify({
      email: `balancetest${timestamp}_${i}@example.com`,
      password: 'password123',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 201) {
      const accountId = JSON.parse(res.body).id;
      accountIds.push(accountId);

      // Give each account a large initial balance
      http.post(`${BASE_URL}/accounts/${accountId}/deposit`, JSON.stringify({
        idempotency_key: uuidv4(),
        amount: 100000000, // $1M per account to support many transactions
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  console.log(`Created ${accountIds.length} accounts with balances`);
  console.log('Creating 10-100 transactions per account to build transaction history...');

  // Create 10-100 transactions per account to create realistic balance calculation load
  let totalTransactionsCreated = 0;
  for (let i = 0; i < accountIds.length; i++) {
    const numTransactions = Math.floor(Math.random() * 101) + 10; // Random 10-100 transactions per account

    for (let j = 0; j < numTransactions; j++) {
      // Pick random source and destination (different accounts)
      const sourceIdx = i;
      let destIdx = Math.floor(Math.random() * accountIds.length);
      while (destIdx === sourceIdx) {
        destIdx = Math.floor(Math.random() * accountIds.length);
      }

      // Small random amount
      const amount = Math.floor(Math.random() * 100) + 1;

      http.post(`${BASE_URL}/transactions`, JSON.stringify({
        idempotency_key: uuidv4(),
        source_account_id: accountIds[sourceIdx],
        destination_account_id: accountIds[destIdx],
        amount: amount,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });

      totalTransactionsCreated++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`Created transactions for ${i + 1}/${accountIds.length} accounts (${totalTransactionsCreated} total transactions so far)`);
    }
  }

  console.log(`Setup complete: ${accountIds.length} accounts, ${totalTransactionsCreated} transactions created`);
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
  console.log('\n📊 Balance Read Test Complete');
}
