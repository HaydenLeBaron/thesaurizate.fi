import { pool } from '../db';

beforeAll(async () => {
  // Only suppress console output if not running stress tests
  if (!process.env.SHOW_LOGS) {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  }

  // Clear test data before running tests
  // Delete in order to respect foreign key constraints
  await pool.query('TRUNCATE TABLE transactions CASCADE');
  await pool.query('TRUNCATE TABLE users CASCADE');
});

afterAll(async () => {
  // Clean up and close pool
  await pool.end();
});
