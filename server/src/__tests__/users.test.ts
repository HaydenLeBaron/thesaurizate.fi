import request from 'supertest';
import { app } from './app';
import { pool } from '../db';

describe('Users API', () => {
  beforeEach(async () => {
    // Clean database before each test
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');
  });

  describe('POST /users', () => {
    it('should create a new user successfully', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        email: 'test@example.com',
        created_at: expect.any(String),
      });
      expect(response.body.password_hash).toBeUndefined();
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject password shorter than 8 characters', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'test@example.com',
          password: 'short',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
      };

      // Create first user
      await request(app).post('/users').send(userData).expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe('Email already exists');
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });
});
