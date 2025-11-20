import { Router } from 'express';
import { z } from 'zod';
import * as db from 'zapatos/db';
import { pool } from '../db';
//import * as bcrypt from 'bcrypt';
import { CreateUserSchema } from '../schemas/users';
// FIXME: Re-enable authentication middleware in production
// import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * POST /users
 * Create a new user
 */
router.post('/users', async (req, res) => {
  try {
    const validatedBody = CreateUserSchema.parse(req.body);

    // Hash the password
    // FIXME: Re-enable bcrypt hashing in production
    const password_hash = validatedBody.password; // await bcrypt.hash(validatedBody.password, 10);

    // Create the user
    const newUser = await db.insert('users', {
      email: validatedBody.email,
      password_hash,
      account_number: validatedBody.account_number,
      routing_number: validatedBody.routing_number,
      account_type: validatedBody.account_type,
      contact_email: validatedBody.contact_email,
      contact_phone: validatedBody.contact_phone,
      account_name: validatedBody.account_name,
    }).run(pool);

    // Return user without password_hash
    const { password_hash: _, ...userResponse } = newUser;
    res.status(201).json(userResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else if (error instanceof Error && 'code' in error && error.code === '23505') {
      // Unique constraint violation (duplicate email)
      res.status(409).json({ error: 'User already exists' });
    } else {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * GET /admin/users
 * Get all user IDs and emails (development only - requires authentication)
 * FIXME: Re-enable authentication middleware in production
 */
router.get('/admin/users', /* authenticateToken, */ async (req, res) => {
  try {
    const allUsers = await db.select('users', {}).run(pool);

    // Map to only return id and email
    const users = allUsers.map(user => ({
      id: user.id,
      email: user.email,
    }));

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
