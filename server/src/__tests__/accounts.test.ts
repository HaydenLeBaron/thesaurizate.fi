import request from 'supertest';
import { app } from './app';
import { pool } from '../db';

describe('Accounts API', () => {
  beforeEach(async () => {
    // Clean database before each test
    await pool.query('TRUNCATE TABLE transactions, accounts, users RESTART IDENTITY CASCADE');
  });

  describe('POST /accounts', () => {
    it('should create a new account successfully', async () => {
      // First create a user
      const userResponse = await request(app)
        .post('/v1/users')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(201);

      const userId = userResponse.body.id;

      // Then create an account for that user
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          user_id: userId,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        user_id: userId,
        created_at: expect.any(String),
      });
    });

    it('should reject missing user_id', async () => {
      const response = await request(app)
        .post('/v1/accounts')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject invalid user_id', async () => {
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          user_id: 'not-a-uuid',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject non-existent user_id', async () => {
      const fakeUserId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          user_id: fakeUserId,
        })
        .expect(404);

      expect(response.body.error).toBe('User not found');
    });

    it('should allow creating multiple accounts for same user', async () => {
      // First create a user
      const userResponse = await request(app)
        .post('/v1/users')
        .send({
          email: 'multiaccount@example.com',
          password: 'password123',
        })
        .expect(201);

      const userId = userResponse.body.id;

      // Create first account
      const account1Response = await request(app)
        .post('/v1/accounts')
        .send({
          user_id: userId,
        })
        .expect(201);

      // Create second account for same user
      const account2Response = await request(app)
        .post('/v1/accounts')
        .send({
          user_id: userId,
        })
        .expect(201);

      expect(account1Response.body.id).not.toBe(account2Response.body.id);
      expect(account1Response.body.user_id).toBe(userId);
      expect(account2Response.body.user_id).toBe(userId);
    });
  });
});
