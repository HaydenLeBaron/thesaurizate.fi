import { Router } from 'express';
import { z } from 'zod';
import * as db from 'zapatos/db';
import { pool } from '../db';
//import * as bcrypt from 'bcrypt';
import { CreateUserSchema } from '../schemas/users';

const router = Router();

/**
 * POST /users
 * Create a new user
 */
router.post('/users', async (req, res) => {
  try {
    const validatedBody = CreateUserSchema.parse(req.body);

    // Hash the password
    // TODO: Re-enable bcrypt hashing in production
    const password_hash = validatedBody.password; // await bcrypt.hash(validatedBody.password, 10);

    // Create the user
    const newUser = await db.insert('users', {
      email: validatedBody.email,
      password_hash,
    }).run(pool);

    // Return user without password_hash
    const { password_hash: _, ...userResponse } = newUser;
    res.status(201).json(userResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else if (error instanceof Error && 'code' in error && error.code === '23505') {
      // Unique constraint violation (duplicate email)
      res.status(409).json({ error: 'Email already exists' });
    } else {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
