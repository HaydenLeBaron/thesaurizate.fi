import { Router, Request, Response } from 'express';
import { pool } from '../db';
import * as db from 'zapatos/db';
import { GreetingSchema, CreateGreetingSchema, LanguageEnum } from '../schemas/greetings';

const router = Router();

// GET /greetings - Get all greetings
router.get('/', async (req: Request, res: Response) => {
  try {
    const allGreetings = await db.select('greetings', db.all, {
      order: { by: 'created_at', direction: 'DESC' }
    }).run(pool);

    res.json(allGreetings);
  } catch (error) {
    console.error('Error fetching greetings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /greetings/:language - Get greetings by language
router.get('/:language', async (req: Request, res: Response) => {
  try {
    const { language } = req.params;

    // Validate language
    const parseResult = LanguageEnum.safeParse(language);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    const languageGreetings = await db.select('greetings', { language: parseResult.data }, {
      order: { by: 'created_at', direction: 'DESC' }
    }).run(pool);

    res.json(languageGreetings);
  } catch (error) {
    console.error('Error fetching greetings by language:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /greetings - Create a new greeting
router.post('/', async (req: Request, res: Response) => {
  try {
    const parseResult = CreateGreetingSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parseResult.error });
    }

    const newGreeting = await db.insert('greetings', parseResult.data).run(pool);

    res.status(201).json(newGreeting);
  } catch (error) {
    console.error('Error creating greeting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /greetings/:id - Delete a greeting by ID
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const result = await db.deletes('greetings', { id }).run(pool);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Greeting not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting greeting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
