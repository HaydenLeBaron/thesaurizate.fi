import { Router, Request, Response } from 'express';
import { pool } from '../db';
import * as db from 'zapatos/db';

const router = Router();

// GET /testEndpoint - Get all test rows
router.get('/', async (req: Request, res: Response) => {
  try {
    const allTestRows = await db.select('test', db.all, {
      order: { by: 'id', direction: 'ASC' }
    }).run(pool);

    res.json(allTestRows);
  } catch (error) {
    console.error('Error fetching test rows:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
