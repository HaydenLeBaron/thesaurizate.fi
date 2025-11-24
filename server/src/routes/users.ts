import { Router } from 'express';
import { z } from 'zod';
import * as db from 'zapatos/db';
import { pool } from '../db';
import { randomUUID } from 'crypto';
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

    // Generate defaults for optional Plaid Core Exchange fields if not provided
    // These fields are required in the DB but optional in the API for backward compatibility
    // Note: account_number, routing_number, contact_email, contact_phone, and account_name have UNIQUE constraints
    const tempId = randomUUID();
    const account_number = validatedBody.account_number || `ACC-${tempId.replace(/-/g, '').substring(0, 16)}`;
    // Generate unique routing number using UUID to ensure uniqueness
    const routing_number = validatedBody.routing_number || `RT${tempId.replace(/-/g, '').substring(0, 9)}`;
    const account_type = validatedBody.account_type || 'depository';
    const contact_email = validatedBody.contact_email || validatedBody.email;
    // Generate unique phone number using UUID to ensure uniqueness
    const contact_phone = validatedBody.contact_phone || `+1${tempId.replace(/-/g, '').substring(0, 10)}`;
    // Use email-based account name with UUID suffix to ensure uniqueness
    const account_name = validatedBody.account_name || `Account-${validatedBody.email.split('@')[0]}-${tempId.substring(0, 8)}`;

    // Create the user
    const newUser = await db.insert('users', {
      email: validatedBody.email,
      password_hash,
      account_number,
      routing_number,
      account_type,
      contact_email,
      contact_phone,
      account_name,
    }).run(pool);

    // Return user without password_hash
    const { password_hash: _, ...userResponse } = newUser;
    res.status(201).json(userResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else if (error instanceof Error && 'code' in error && error.code === '23505') {
      // Unique constraint violation - could be email, account_number, routing_number, contact_email, contact_phone, or account_name
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('email')) {
        res.status(409).json({ error: 'User already exists' });
      } else {
        res.status(409).json({ error: 'A user with this information already exists', details: errorMessage });
      }
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
