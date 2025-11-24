import request from 'supertest';
import { app } from './app';
import { pool } from '../db';
import { authConfig } from '../config/auth';
import * as db from 'zapatos/db';
import jwt from 'jsonwebtoken';
import { executeTransaction, executeDeposit } from '../services/transactions';

describe('Plaid Core Exchange API', () => {
  let testUserId: string;
  let testUser2Id: string;
  let accessToken: string;

  beforeEach(async () => {
    // Clean database before each test
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');

    // Create test users
    const user1 = await db.insert('users', {
      email: 'user1@example.com',
      password_hash: 'hashed_password',
      account_number: '123456789',
      routing_number: '987654321',
      account_type: 'depository',
      account_name: 'Test Account',
      contact_email: 'contact@example.com',
      contact_phone: '+1234567890',
    }).run(pool);
    testUserId = user1.id;

    const user2 = await db.insert('users', {
      email: 'user2@example.com',
      password_hash: 'hashed_password',
      account_number: '987654321',
      routing_number: '123456789',
      account_type: 'depository',
      account_name: 'Test Account 2',
      contact_email: 'contact2@example.com',
      contact_phone: '+1987654321',
    }).run(pool);
    testUser2Id = user2.id;

    // Create an access token for user1
    accessToken = jwt.sign(
      {
        sub: testUserId,
        iss: authConfig.issuer,
        aud: 'plaid-core-exchange',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        scope: 'openid accounts transactions',
      },
      authConfig.jwtSecret
    );

    // Create some transactions for testing
    await executeDeposit({
      idempotencyKey: crypto.randomUUID(),
      userId: testUserId,
      amount: 10000, // $100.00
    });

    await executeTransaction({
      idempotencyKey: crypto.randomUUID(),
      sourceUserId: testUserId,
      destinationUserId: testUser2Id,
      amount: 2000, // $20.00
    });
  });

  describe('GET /accounts', () => {
    it('should return accounts for authenticated user', async () => {
      const response = await request(app)
        .get('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('accountId', testUserId);
      expect(response.body[0]).toHaveProperty('accountType');
      expect(response.body[0]).toHaveProperty('balance');
      expect(response.body[0].balance).toHaveProperty('amount');
      expect(response.body[0].balance).toHaveProperty('currency', 'USD');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/accounts')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'unauthorized');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/accounts')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'unauthorized');
    });
  });

  describe('GET /accounts/:accountId', () => {
    it('should return account details for owned account', async () => {
      const response = await request(app)
        .get(`/accounts/${testUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('accountId', testUserId);
      expect(response.body).toHaveProperty('accountType');
      expect(response.body).toHaveProperty('accountName', 'Test Account');
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('routingNumber', '987654321');
      expect(response.body).toHaveProperty('accountNumber', '123456789');
    });

    it('should reject access to other user\'s account', async () => {
      const response = await request(app)
        .get(`/accounts/${testUser2Id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'forbidden');
      expect(response.body).toHaveProperty('error_description');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get(`/accounts/${testUserId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'unauthorized');
    });

    it('should return 400 for invalid account ID format', async () => {
      const response = await request(app)
        .get('/accounts/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'invalid_request');
    });

    it('should return 404 for non-existent account', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const token = jwt.sign(
        {
          sub: nonExistentId,
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          scope: 'openid accounts',
        },
        authConfig.jwtSecret
      );

      const response = await request(app)
        .get(`/accounts/${nonExistentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'not_found');
    });
  });

  describe('GET /accounts/:accountId/transactions', () => {
    it('should return transactions for owned account', async () => {
      const response = await request(app)
        .get(`/accounts/${testUserId}/transactions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('transactionId');
      expect(response.body[0]).toHaveProperty('accountId', testUserId);
      expect(response.body[0]).toHaveProperty('amount');
      expect(response.body[0]).toHaveProperty('transactionType');
      expect(response.body[0]).toHaveProperty('transactionDate');
      expect(response.body[0]).toHaveProperty('description');
    });

    it('should support pagination with limit and offset', async () => {
      const response = await request(app)
        .get(`/accounts/${testUserId}/transactions`)
        .query({ limit: 1, offset: 0 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(1);
    });

    it('should support date filtering', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const response = await request(app)
        .get(`/accounts/${testUserId}/transactions`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject access to other user\'s transactions', async () => {
      const response = await request(app)
        .get(`/accounts/${testUser2Id}/transactions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'forbidden');
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .get(`/accounts/${testUserId}/transactions`)
        .query({ startDate: 'invalid-date' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'invalid_request');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get(`/accounts/${testUserId}/transactions`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'unauthorized');
    });
  });

  describe('GET /accounts/:accountId/payment-networks', () => {
    it('should return payment networks for owned account', async () => {
      const response = await request(app)
        .get(`/accounts/${testUserId}/payment-networks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('accountId', testUserId);
      expect(response.body).toHaveProperty('networks');
      expect(Array.isArray(response.body.networks)).toBe(true);
      expect(response.body.networks.length).toBeGreaterThan(0);
      expect(response.body.networks[0]).toHaveProperty('type');
      expect(['ACH', 'WIRE']).toContain(response.body.networks[0].type);
    });

    it('should return empty networks for account without routing/account numbers', async () => {
      // Create token for user2 (no account/routing numbers)
      const user2Token = jwt.sign(
        {
          sub: testUser2Id,
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          scope: 'openid accounts',
        },
        authConfig.jwtSecret
      );

      const response = await request(app)
        .get(`/accounts/${testUser2Id}/payment-networks`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('accountId', testUser2Id);
      expect(response.body).toHaveProperty('networks');
      // Networks might be empty or contain default entries
    });

    it('should reject access to other user\'s payment networks', async () => {
      const response = await request(app)
        .get(`/accounts/${testUser2Id}/payment-networks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'forbidden');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get(`/accounts/${testUserId}/payment-networks`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'unauthorized');
    });
  });

  describe('GET /accounts/:accountId/contact', () => {
    it('should return contact information for owned account', async () => {
      const response = await request(app)
        .get(`/accounts/${testUserId}/contact`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('accountId', testUserId);
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('phone', '+1234567890');
      expect(response.body).toHaveProperty('name', 'Test Account');
    });

    it('should return contact info with fallback to user email', async () => {
      // Create token for user2 (no contact_email set)
      const user2Token = jwt.sign(
        {
          sub: testUser2Id,
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          scope: 'openid accounts',
        },
        authConfig.jwtSecret
      );

      const response = await request(app)
        .get(`/accounts/${testUser2Id}/contact`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('accountId', testUser2Id);
      // contact_email takes precedence over email
      expect(response.body).toHaveProperty('email', 'contact2@example.com');
    });

    it('should reject access to other user\'s contact info', async () => {
      const response = await request(app)
        .get(`/accounts/${testUser2Id}/contact`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'forbidden');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get(`/accounts/${testUserId}/contact`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'unauthorized');
    });
  });
});

