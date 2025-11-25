import { Router } from 'express';
import { z } from 'zod';
import { executeTransaction, executeDeposit, getAccountBalance, getAccountBalanceOnDate } from '../services/transactions';
import { CreateTransactionSchema, CreateDepositSchema, AccountIdPathSchema, BalanceQuerySchema } from '../schemas/transactions';

const router = Router();

/**
 * POST /transactions
 * Create a new financial transaction
 */
router.post('/transactions', async (req, res) => {
  try {
    const validatedBody = CreateTransactionSchema.parse(req.body);

    const transaction = await executeTransaction({
      idempotencyKey: validatedBody.idempotency_key,
      sourceAccountId: validatedBody.source_account_id,
      destinationAccountId: validatedBody.destination_account_id,
      amount: validatedBody.amount,
    });

    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else if (error instanceof Error) {
      if (error.message === 'Insufficient funds.') {
        res.status(400).json({ error: error.message });
      } else {
        console.error('Error creating transaction:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * GET /accounts/:id/balance
 * Get the current balance for a account (or balance at a specific date if ?date= query param provided)
 */
router.get('/accounts/:id/balance', async (req, res) => {
  try {
    const validatedParams = AccountIdPathSchema.parse(req.params);
    const validatedQuery = BalanceQuerySchema.parse(req.query);

    let balance: number;

    if (validatedQuery.date) {
      balance = await getAccountBalanceOnDate(validatedParams.id, new Date(validatedQuery.date));
    } else {
      balance = await getAccountBalance(validatedParams.id);
    }

    res.json({ account_id: validatedParams.id, balance });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching balance:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * GET /accounts/:id/transactions
 * Get transaction history for a account
 */
router.get('/accounts/:id/transactions', async (req, res) => {
  try {
    const validatedParams = AccountIdPathSchema.parse(req.params);

    // Import db here to avoid circular dependencies
    const db = await import('zapatos/db');
    const { pool } = await import('../db');

    const transactions = await db.sql`
      SELECT * FROM ${'transactions'}
      WHERE ${{ source_account_id: validatedParams.id }}
         OR ${{ destination_account_id: validatedParams.id }}
      ORDER BY ${'created_at'} DESC
    `.run(pool);

    res.json(transactions);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * POST /accounts/:id/deposit
 * Deposit money into a account's account (inject money into the system)
 */
router.post('/accounts/:id/deposit', async (req, res) => {
  try {
    const validatedParams = AccountIdPathSchema.parse(req.params);
    const validatedBody = CreateDepositSchema.parse(req.body);

    const transaction = await executeDeposit({
      idempotencyKey: validatedBody.idempotency_key,
      accountId: validatedParams.id,
      amount: validatedBody.amount,
    });

    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error creating deposit:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
