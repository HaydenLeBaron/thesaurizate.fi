import { Router } from 'express';
import { z } from 'zod';
import * as db from 'zapatos/db';
import { pool } from '../../db';
import { AccountIdPathSchema } from '../../schemas/v2/accounts';
import { TransactionListQuerySchema } from '../../schemas/v2/transactions';

const router = Router();

/**
 * GET /v2/accounts/{accountId}/transactions
 * List all account transactions
 */
router.get('/accounts/:accountId/transactions', async (req, res) => {
  try {
    const validatedParams = AccountIdPathSchema.parse(req.params);
    const validatedQuery = TransactionListQuerySchema.parse(req.query);

    // Verify account exists
    const account = await db.selectOne('accounts', { id: validatedParams.accountId }).run(pool);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Build date filter conditions
    const dateConditions: db.SQL[] = [];
    if (validatedQuery.startDate) {
      dateConditions.push(db.sql`${'created_at'} >= ${db.param(new Date(validatedQuery.startDate))}::timestamptz`);
    }
    if (validatedQuery.endDate) {
      dateConditions.push(db.sql`${'created_at'} <= ${db.param(new Date(validatedQuery.endDate))}::timestamptz`);
    }

    // Query transactions where account is source or destination
    // Use SQL for OR conditions (Zapatos doesn't support 'or' in where clause)
    const orCondition = db.sql`(${'source_account_id'} = ${db.param(validatedParams.accountId)}::uuid OR ${'destination_account_id'} = ${db.param(validatedParams.accountId)}::uuid)`;
    
    let whereClause: db.SQL;
    if (dateConditions.length > 0) {
      const dateFilter = dateConditions.reduce((acc, condition) => 
        acc ? db.sql`${acc} AND ${condition}` : condition
      );
      whereClause = db.sql`${orCondition} AND ${dateFilter}`;
    } else {
      whereClause = orCondition;
    }
    
    const transactions = await db.sql`
      SELECT * FROM ${'transactions'}
      WHERE ${whereClause}
      ORDER BY ${'created_at'} DESC
      LIMIT ${db.param(validatedQuery.limit)}
      OFFSET ${db.param(validatedQuery.offset)}
    `.run(pool);

    // Transform to V2 response format (camelCase)
    // When using raw SQL, PostgreSQL returns int8 as string, so convert to number
    const response = transactions.map(txn => ({
      transactionId: txn.id,
      idempotencyKey: txn.idempotency_key,
      sourceAccountId: txn.source_account_id,
      destinationAccountId: txn.destination_account_id,
      amount: typeof txn.amount === 'string' ? parseInt(txn.amount, 10) : txn.amount,
      createdAt: String(txn.created_at),
    }));

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
