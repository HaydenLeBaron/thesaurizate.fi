import { Router } from 'express';
import { z } from 'zod';
import * as db from 'zapatos/db';
import { pool } from '../../db';
import { getAccountBalance, getAccountBalanceOnDate } from '../../services/transactions';
import {
  AccountListQuerySchema,
  AccountBalanceQuerySchema,
  AccountIdPathSchema,
} from '../../schemas/v2/accounts';

const router = Router();

/**
 * GET /v2/accounts
 * Search and view customer accounts
 */
router.get('/accounts', async (req, res) => {
  try {
    const validatedQuery = AccountListQuerySchema.parse(req.query);

    // Query all accounts with pagination
    const accounts = await db.select('accounts', {}, {
      limit: validatedQuery.limit,
      offset: validatedQuery.offset,
      order: { by: 'created_at', direction: 'DESC' },
    }).run(pool);

    // Transform to V2 response format (camelCase)
    const response = accounts.map(account => ({
      accountId: account.id,
      userId: account.user_id,
      createdAt: account.created_at.toISOString(),
      updatedAt: account.updated_at.toISOString(),
    }));

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching accounts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * GET /v2/accounts/{accountId}
 * Get account balances, liabilities, and other information
 */
router.get('/accounts/:accountId', async (req, res) => {
  try {
    const validatedParams = AccountIdPathSchema.parse(req.params);
    const validatedQuery = AccountBalanceQuerySchema.parse(req.query);

    // Query account from database
    const account = await db.selectOne('accounts', { id: validatedParams.accountId }).run(pool);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get balance (current or historical)
    let balance: number;
    if (validatedQuery.date) {
      balance = await getAccountBalanceOnDate(validatedParams.accountId, new Date(validatedQuery.date));
    } else {
      balance = await getAccountBalance(validatedParams.accountId);
    }

    // Transform to V2 response format (Plaid-style)
    const response = {
      accountId: account.id,
      balance: {
        available: balance,
        current: balance,
        limit: null, // No limit for now
      },
      liabilities: {
        credit: 0, // No credit liability for now
        mortgage: 0, // No mortgage liability for now
      },
      metadata: {
        createdAt: account.created_at.toISOString(),
        updatedAt: account.updated_at.toISOString(),
      },
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching account:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * GET /v2/accounts/{accountId}/contact
 * Get account contact information
 */
router.get('/accounts/:accountId/contact', async (req, res) => {
  try {
    const validatedParams = AccountIdPathSchema.parse(req.params);

    // Query account from database
    const account = await db.selectOne('accounts', { id: validatedParams.accountId }).run(pool);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Query associated user information
    const user = await db.selectOne('users', { id: account.user_id }).run(pool);
    if (!user) {
      return res.status(404).json({ error: 'User not found for account' });
    }

    // Transform to V2 response format
    const response = {
      accountId: account.id,
      contact: {
        email: user.email,
        userId: user.id,
      },
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching account contact:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * GET /v2/accounts/{accountId}/payment-networks
 * Get payment networks supported by an account
 */
router.get('/accounts/:accountId/payment-networks', async (req, res) => {
  try {
    const validatedParams = AccountIdPathSchema.parse(req.params);

    // Query account from database
    const account = await db.selectOne('accounts', { id: validatedParams.accountId }).run(pool);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Return supported payment networks (hardcoded for now)
    const response = {
      accountId: account.id,
      paymentNetworks: [
        {
          type: 'ACH' as const,
          enabled: true,
          capabilities: ['credit', 'debit'],
        },
        {
          type: 'WIRE' as const,
          enabled: true,
          capabilities: ['credit', 'debit'],
        },
      ],
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching payment networks:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
