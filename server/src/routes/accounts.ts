import { Router } from 'express';
import { z } from 'zod';
import * as db from 'zapatos/db';
import { pool } from '../db';
import { CreateAccountSchema } from '../schemas/accounts';

const router = Router();

/**
 * POST /accounts
 * Create a new account (requires user_id)
 */
router.post('/accounts', async (req, res) => {
  try {
    const validatedBody = CreateAccountSchema.parse(req.body);

    // Verify that the user exists
    const user = await db.selectOne('users', { id: validatedBody.user_id }).run(pool);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create the account linked to the user
    const newAccount = await db.insert('accounts', {
      user_id: validatedBody.user_id,
    }).run(pool);

    res.status(201).json(newAccount);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else if (error instanceof Error && 'code' in error && error.code === '23503') {
      // Foreign key constraint violation (invalid user_id)
      res.status(404).json({ error: 'User not found' });
    } else {
      console.error('Error creating account:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
