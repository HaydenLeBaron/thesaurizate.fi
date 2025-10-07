import * as db from 'zapatos/db';
import { pool } from '../db';
import type * as s from 'zapatos/schema';

const MAX_RETRIES = 10;
const INITIAL_BACKOFF_MS = 10;

/**
 * Checks if an error is a PostgreSQL serialization error that can be retried
 */
function isSerializationError(error: any): boolean {
  return (
    error?.code === '40001' || // serialization_failure
    error?.code === '40P01'    // deadlock_detected
  );
}

/**
 * Logs a failed transaction to the private.failed_transactions table for audit purposes
 */
async function logFailedTransaction(data: {
  idempotencyKey: string;
  sourceUserId: string | null;
  destinationUserId: string;
  amount: number;
  errorMessage: string;
  retryCount: number;
}): Promise<void> {
  try {
    await db.sql`
      INSERT INTO private.failed_transactions (
        idempotency_key,
        source_user_id,
        destination_user_id,
        amount,
        error_message,
        retry_count
      ) VALUES (
        ${db.param(data.idempotencyKey)}::uuid,
        ${db.param(data.sourceUserId)}::uuid,
        ${db.param(data.destinationUserId)}::uuid,
        ${db.param(data.amount)},
        ${db.param(data.errorMessage)},
        ${db.param(data.retryCount)}
      )
    `.run(pool);
  } catch (logError) {
    // Don't throw if logging fails - we don't want to mask the original error
    console.error('Failed to log failed transaction:', logError);
  }
}

/**
 * Sleep utility for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a financial transfer with JIT balance verification.
 *
 * Security guarantees:
 * - Idempotent (UNIQUE constraint on idempotency_key)
 * - Atomic (PostgreSQL TRANSACTION)
 * - Race-condition-free (SELECT FOR UPDATE row locks on users table)
 * - Single source of truth (balance calculated from ledger inside transaction)
 * - No balance drift (balance is never stored, only calculated)
 *
 * @param {object} data - The transaction data
 * @returns {Promise<transactions.JSONSelectable>} The created transaction record
 */
export async function executeTransaction(data: {
  idempotencyKey: string;
  sourceUserId: string;
  destinationUserId: string;
  amount: number;
}): Promise<s.transactions.JSONSelectable> {
  // Retry loop with exponential backoff for serialization errors
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 1. Idempotency Check: Prevents duplicate API requests
      const existingTx = await db.selectOne(
        'transactions',
        { idempotency_key: data.idempotencyKey }
      ).run(pool);

      if (existingTx) {
        console.log('Idempotency key already processed. Returning original transaction.');
        return existingTx;
      }

      // 2. Begin Atomic Database Transaction
      return await db.serializable(pool, async (txClient) => {
        // 3. Acquire Row-Level Locks on Users (Prevents Deadlocks)
        // Lock users in sorted order by user_id to prevent deadlocks
        // Since each user = one account, we lock the user rows directly
        const lockOrderIds = [data.sourceUserId, data.destinationUserId].sort();

        await Promise.all(
          lockOrderIds.map((userId) =>
            db.sql`SELECT FROM users WHERE ${{ id: userId }} FOR UPDATE`.run(txClient)
          )
        );

        // 4. JIT Balance Verification (Single Source of Truth)
        // CRITICAL: This calculation happens INSIDE the transaction with locks held,
        // guaranteeing that the balance cannot change between check and transaction creation.
        const balanceResult = await db.sql<s.transactions.SQL, Array<{ balance: string }>>`
          SELECT public.get_current_balance(${db.param(data.sourceUserId)}::uuid) as balance
        `.run(txClient);

        const sourceBalance = parseInt(balanceResult[0].balance, 10);
        const transferAmount = data.amount;

        // 5. Authorization Check
        if (sourceBalance < transferAmount) {
          throw new Error('Insufficient funds.');
        }

        // 6. Create Immutable Transaction Record
        // No balance updates needed - the ledger is self-describing
        const newTransaction = await db.insert(
          'transactions',
          {
            idempotency_key: data.idempotencyKey,
            source_user_id: data.sourceUserId,
            destination_user_id: data.destinationUserId,
            amount: data.amount,
          }
        ).run(txClient);

        return newTransaction;
      });
    } catch (error) {
      // Check if this is a retryable serialization error
      if (isSerializationError(error) && attempt < MAX_RETRIES) {
        // Exponential backoff: 10ms, 20ms, 40ms
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.log(`Serialization error on attempt ${attempt + 1}. Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }

      // If we've exhausted retries or it's not a retryable error, log and rethrow
      if (attempt === MAX_RETRIES) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logFailedTransaction({
          idempotencyKey: data.idempotencyKey,
          sourceUserId: data.sourceUserId,
          destinationUserId: data.destinationUserId,
          amount: data.amount,
          errorMessage,
          retryCount: attempt,
        });
      }

      throw error;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error('Unexpected end of retry loop');
}

/**
 * Get the current balance for a user by calculating from the ledger
 * @returns Balance in cents (integer)
 */
export async function getUserBalance(userId: string): Promise<number> {
  const result = await db.sql<s.transactions.SQL, Array<{ balance: string }>>`
    SELECT public.get_current_balance(${db.param(userId)}::uuid) as balance
  `.run(pool);

  return parseInt(result[0].balance, 10);
}

/**
 * Get the balance for a user at a specific date
 * @returns Balance in cents (integer)
 */
export async function getUserBalanceOnDate(userId: string, date: Date): Promise<number> {
  const result = await db.sql<s.transactions.SQL, Array<{ balance: string }>>`
    SELECT public.get_balance_on_date(${db.param(userId)}::uuid, ${db.param(date)}::timestamptz) as balance
  `.run(pool);

  return parseInt(result[0].balance, 10);
}

/**
 * Deposits money into a user's account (injects money into the system).
 *
 * This creates a transaction with a NULL source_user_id, effectively
 * injecting money into the system. This is how initial capital enters.
 *
 * Security guarantees:
 * - Idempotent (UNIQUE constraint on idempotency_key)
 * - Atomic (PostgreSQL TRANSACTION)
 *
 * @param {object} data - The deposit data
 * @returns {Promise<transactions.JSONSelectable>} The created transaction record
 */
export async function executeDeposit(data: {
  idempotencyKey: string;
  userId: string;
  amount: number;
}): Promise<s.transactions.JSONSelectable> {
  // 1. Idempotency Check
  const existingTx = await db.selectOne(
    'transactions',
    { idempotency_key: data.idempotencyKey }
  ).run(pool);

  if (existingTx) {
    console.log('Idempotency key already processed. Returning original transaction.');
    return existingTx;
  }

  // 2. Create deposit transaction with NULL source
  return await db.transaction(pool, db.IsolationLevel.ReadCommitted, async (txClient) => {
    const newTransaction = await db.insert(
      'transactions',
      {
        idempotency_key: data.idempotencyKey,
        source_user_id: null, // NULL source = system deposit
        destination_user_id: data.userId,
        amount: data.amount,
      }
    ).run(txClient);

    return newTransaction;
  });
}
