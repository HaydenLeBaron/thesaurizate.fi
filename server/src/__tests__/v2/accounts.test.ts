import request from 'supertest';
import { app } from '../app';
import { pool } from '../../db';
import { randomUUID } from 'crypto';

describe('V2 Accounts API', () => {
  let userId1: string;
  let userId2: string;
  let account1Id: string;
  let account2Id: string;

  beforeEach(async () => {
    // Clean database before each test
    await pool.query('TRUNCATE TABLE transactions, accounts, users RESTART IDENTITY CASCADE');

    // Create test users
    const user1Response = await request(app)
      .post('/users')
      .send({
        email: 'account1@example.com',
        password: 'password123',
      });
    userId1 = user1Response.body.id;

    const user2Response = await request(app)
      .post('/users')
      .send({
        email: 'account2@example.com',
        password: 'password123',
      });
    userId2 = user2Response.body.id;

    // Create test accounts
    const account1Response = await request(app)
      .post('/accounts')
      .send({
        user_id: userId1,
      });
    account1Id = account1Response.body.id;

    const account2Response = await request(app)
      .post('/accounts')
      .send({
        user_id: userId2,
      });
    account2Id = account2Response.body.id;
  });

  describe('GET /v2/accounts', () => {
    it('should list all accounts', async () => {
      const response = await request(app)
        .get('/v2/accounts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);

      // Check response structure (camelCase)
      response.body.forEach((account: any) => {
        expect(account).toHaveProperty('accountId');
        expect(account).toHaveProperty('userId');
        expect(account).toHaveProperty('createdAt');
        expect(account).toHaveProperty('updatedAt');
        expect(typeof account.accountId).toBe('string');
        expect(typeof account.userId).toBe('string');
      });
    });

    it('should return empty array when no accounts exist', async () => {
      // Clean database
      await pool.query('TRUNCATE TABLE transactions, accounts, users RESTART IDENTITY CASCADE');

      const response = await request(app)
        .get('/v2/accounts')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should support pagination with limit', async () => {
      // Create a third account
      const user3Response = await request(app)
        .post('/users')
        .send({
          email: 'account3@example.com',
          password: 'password123',
        });
      const userId3 = user3Response.body.id;

      await request(app)
        .post('/accounts')
        .send({
          user_id: userId3,
        });

      const response = await request(app)
        .get('/v2/accounts?limit=2')
        .expect(200);

      expect(response.body.length).toBe(2);
    });

    it('should support pagination with offset', async () => {
      const response = await request(app)
        .get('/v2/accounts?limit=1&offset=1')
        .expect(200);

      expect(response.body.length).toBe(1);
    });

    it('should reject invalid limit', async () => {
      const response = await request(app)
        .get('/v2/accounts?limit=-1')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject invalid offset', async () => {
      const response = await request(app)
        .get('/v2/accounts?offset=-1')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /v2/accounts/{accountId}', () => {
    beforeEach(async () => {
      // Deposit money into account1
      await request(app)
        .post(`/accounts/${account1Id}/deposit`)
        .send({
          idempotency_key: randomUUID(),
          amount: 100000, // 1000.00 in cents
        });
    });

    it('should get account with balance information', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        accountId: account1Id,
        balance: {
          available: expect.any(Number),
          current: expect.any(Number),
          limit: null,
        },
        liabilities: {
          credit: 0,
          mortgage: 0,
        },
        metadata: {
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });

      expect(response.body.balance.available).toBe(100000);
      expect(response.body.balance.current).toBe(100000);
    });

    it('should get account with historical balance', async () => {
      const now = new Date().toISOString();
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}?date=${now}`)
        .expect(200);

      expect(response.body).toHaveProperty('balance');
      expect(response.body.balance.available).toBeGreaterThanOrEqual(0);
    });

    it('should return 404 for non-existent account', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .get(`/v2/accounts/${fakeAccountId}`)
        .expect(404);

      expect(response.body.error).toBe('Account not found');
    });

    it('should reject invalid account id format', async () => {
      const response = await request(app)
        .get('/v2/accounts/invalid-id')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reflect balance changes after transaction', async () => {
      // Create transaction
      await request(app)
        .post('/transactions')
        .send({
          idempotency_key: randomUUID(),
          source_account_id: account1Id,
          destination_account_id: account2Id,
          amount: 20000, // 200.00 in cents
        });

      // Check balance
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}`)
        .expect(200);

      expect(response.body.balance.available).toBe(80000); // 800.00 in cents
      expect(response.body.balance.current).toBe(80000);
    });
  });

  describe('GET /v2/accounts/{accountId}/contact', () => {
    beforeEach(async () => {
      // Update account with contact information
      await pool.query(`
        UPDATE accounts
        SET 
          primary_account_holder_id = $1,
          contact_email = 'account1@example.com',
          address_type = 'HOME',
          address_primary = true,
          address_line1 = '123 Main St',
          address_line2 = 'Apt 4B',
          address_city = 'New York',
          address_region = 'NY',
          address_postal_code = '10001',
          address_country = 'US',
          telephone_type = 'CELL',
          telephone_country = '1',
          telephone_number = '5551234567',
          telephone_network = 'CELLULAR',
          telephone_primary = true
        WHERE id = $2
      `, [userId1, account1Id]);

      // Update user with name information
      await pool.query(`
        UPDATE users
        SET 
          name_first = 'John',
          name_middle = 'Michael',
          name_last = 'Doe',
          name_suffix = 'Jr.',
          name_prefix = 'Mr.'
        WHERE id = $1
      `, [userId1]);
    });

    it('should get account contact information with all fields populated', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/contact`)
        .expect(200);

      expect(response.body).toMatchObject({
        accountId: account1Id,
        holders: expect.any(Array),
        emails: expect.any(Array),
        addresses: expect.any(Array),
        telephones: expect.any(Array),
      });

      // Verify holders array structure
      expect(response.body.holders.length).toBeGreaterThanOrEqual(1);
      expect(response.body.holders.length).toBeLessThanOrEqual(2);
      expect(response.body.holders[0]).toMatchObject({
        relationship: 'PRIMARY',
        first: 'John',
        middle: 'Michael',
        last: 'Doe',
        suffix: 'Jr.',
        prefix: 'Mr.',
      });

      // Verify emails array structure
      expect(response.body.emails.length).toBe(1);
      expect(response.body.emails[0]).toBe('account1@example.com');

      // Verify addresses array structure
      expect(response.body.addresses.length).toBe(1);
      expect(response.body.addresses[0]).toMatchObject({
        type: 'HOME',
        primary: true,
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'New York',
        region: 'NY',
        postalCode: '10001',
        country: 'US',
      });

      // Verify telephones array structure
      expect(response.body.telephones.length).toBe(1);
      expect(response.body.telephones[0]).toMatchObject({
        type: 'CELL',
        country: '1',
        number: '5551234567',
        network: 'CELLULAR',
        primary: true,
      });
    });

    it('should handle nullable fields correctly', async () => {
      // Update account with minimal data (required fields only)
      await pool.query(`
        UPDATE accounts
        SET 
          address_line2 = NULL,
          address_line3 = NULL,
          address_region = NULL,
          address_postal_code = NULL,
          telephone_network = NULL
        WHERE id = $1
      `, [account1Id]);

      // Update user with minimal name data
      await pool.query(`
        UPDATE users
        SET 
          name_middle = NULL,
          name_suffix = NULL,
          name_prefix = NULL
        WHERE id = $1
      `, [userId1]);

      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/contact`)
        .expect(200);

      expect(response.body.holders[0].middle).toBeNull();
      expect(response.body.holders[0].suffix).toBeNull();
      expect(response.body.holders[0].prefix).toBeNull();
      expect(response.body.addresses[0].line2).toBeNull();
      expect(response.body.addresses[0].line3).toBeNull();
      expect(response.body.addresses[0].region).toBeNull();
      expect(response.body.addresses[0].postalCode).toBeNull();
      expect(response.body.telephones[0].network).toBeNull();
    });

    it('should return account with secondary holder when present', async () => {
      // Add secondary account holder
      await pool.query(`
        UPDATE accounts
        SET secondary_account_holder_id = $1
        WHERE id = $2
      `, [userId2, account1Id]);

      // Update second user with name information
      await pool.query(`
        UPDATE users
        SET 
          name_first = 'Jane',
          name_last = 'Doe',
          name_prefix = 'Mrs.'
        WHERE id = $1
      `, [userId2]);

      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/contact`)
        .expect(200);

      expect(response.body.holders.length).toBe(2);
      expect(response.body.holders[0].relationship).toBe('PRIMARY');
      expect(response.body.holders[1].relationship).toBe('SECONDARY');
      expect(response.body.holders[1].first).toBe('Jane');
      expect(response.body.holders[1].last).toBe('Doe');
    });

    it('should return 404 for non-existent account', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .get(`/v2/accounts/${fakeAccountId}/contact`)
        .expect(404);

      expect(response.body.error).toBe('Account not found');
    });

    it('should reject invalid account id format', async () => {
      const response = await request(app)
        .get('/v2/accounts/invalid-id/contact')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should handle accounts with minimal data (required fields only)', async () => {
      // Create a new account with minimal contact data
      const user3Response = await request(app)
        .post('/users')
        .send({
          email: 'minimal@example.com',
          password: 'password123',
        });
      const userId3 = user3Response.body.id;

      await pool.query(`
        UPDATE users
        SET name_first = 'Min', name_last = 'User'
        WHERE id = $1
      `, [userId3]);

      const account3Response = await request(app)
        .post('/accounts')
        .send({
          user_id: userId3,
        });
      const account3Id = account3Response.body.id;

      await pool.query(`
        UPDATE accounts
        SET 
          primary_account_holder_id = $1,
          contact_email = 'minimal@example.com',
          address_type = 'HOME',
          address_line1 = '456 Simple St',
          address_city = 'Boston',
          address_country = 'US',
          telephone_type = 'HOME',
          telephone_country = '1',
          telephone_number = '5559999999'
        WHERE id = $2
      `, [userId3, account3Id]);

      const response = await request(app)
        .get(`/v2/accounts/${account3Id}/contact`)
        .expect(200);

      expect(response.body.holders.length).toBeGreaterThanOrEqual(1);
      expect(response.body.emails.length).toBe(1);
      expect(response.body.addresses.length).toBe(1);
      expect(response.body.telephones.length).toBe(1);
    });
  });

  describe('GET /v2/accounts/{accountId}/payment-networks', () => {
    it('should get payment networks for account', async () => {
      const response = await request(app)
        .get(`/v2/accounts/${account1Id}/payment-networks`)
        .expect(200);

      expect(response.body).toMatchObject({
        accountId: account1Id,
        paymentNetworks: expect.any(Array),
      });

      expect(response.body.paymentNetworks.length).toBe(2);
      expect(response.body.paymentNetworks).toContainEqual({
        type: 'ACH',
        enabled: true,
        capabilities: ['credit', 'debit'],
      });
      expect(response.body.paymentNetworks).toContainEqual({
        type: 'WIRE',
        enabled: true,
        capabilities: ['credit', 'debit'],
      });
    });

    it('should return 404 for non-existent account', async () => {
      const fakeAccountId = randomUUID();
      const response = await request(app)
        .get(`/v2/accounts/${fakeAccountId}/payment-networks`)
        .expect(404);

      expect(response.body.error).toBe('Account not found');
    });

    it('should reject invalid account id format', async () => {
      const response = await request(app)
        .get('/v2/accounts/invalid-id/payment-networks')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });
});
